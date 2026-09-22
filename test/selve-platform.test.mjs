import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { test } from 'node:test';
import initialize from '../dist/index.js';
import { SelvePlatform } from '../dist/selve-platform.js';
import { USBRfService } from '../dist/util/usb-rf.service.js';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('homebridge'));
const { HomebridgeAPI } = await import(pathToFileURL(join(root, 'api.js')));
const { PlatformAccessory } = await import(pathToFileURL(join(root, 'platformAccessory.js')));
const { BridgeService } = await import(pathToFileURL(join(root, 'bridgeService.js')));
const log = { debug() {}, info() {}, warn() {}, error() {} };
const config = { platform: 'selve', usbPort: '/dev/mock', shutters: [{name: 'Bedroom', device: 0, showStop: true}] };

function setup(t, settings = config, cached = []) {
  const api = new HomebridgeAPI();
  const calls = { registered: [], updated: [], removed: [], requested: [], errors: [], warnings: [], usb: [] };
  t.mock.method(USBRfService.prototype, 'requestUpdate', async function (device) {
    calls.requested.push(device);
    calls.usb.push(this);
  });
  for (const [method, key] of [['registerPlatformAccessories', 'registered'], ['updatePlatformAccessories', 'updated'], ['unregisterPlatformAccessories', 'removed']]) {
    t.mock.method(api, method, (...args) => {
      if (method !== 'updatePlatformAccessories') {
        assert.deepEqual(args.slice(0, 2), ['homebridge-selve', 'selve']);
      }
      const accessories = args.at(-1);
      for (const accessory of accessories) {
        accessory._associatedPlugin = 'homebridge-selve';
        accessory._associatedPlatform = 'selve';
      }
      calls[key].push(...accessories);
    });
  }
  const platform = new SelvePlatform({ ...log, error: (...args) => calls.errors.push(args.join(' ')), warn: message => calls.warnings.push(message) }, settings, api);
  for (const accessory of cached) { platform.configureAccessory(accessory); }
  t.after(() => api.emit('shutdown'));
  return {api, platform, calls, launch: () => api.emit('didFinishLaunching')};
}
function restore(accessory) {
  return PlatformAccessory.deserialize(JSON.parse(JSON.stringify(PlatformAccessory.serialize(accessory))));
}

test('registers the full plugin identifier with the unchanged alias', () => {
  initialize({registerPlatform(...args) { assert.deepEqual(args, ['homebridge-selve', 'selve', SelvePlatform]); }});
});

for (const alias of ['selve', 'homebridge-selve.selve']) {
  test(`matches Homebridge's static loader UUID for ${alias}`, t => {
    const { api, calls, launch } = setup(t, {...config, platform: alias});
    assert.equal(calls.requested.length, 0, 'USB is untouched before launch');
    launch();
    const [accessory] = calls.registered;
    // Exercise Homebridge's own legacy loader, not a duplicate UUID formula.
    const legacy = BridgeService.prototype.createHAPAccessory.call({}, {getPluginIdentifier: () => 'homebridge-selve'}, {
      getServices: () => [new api.hap.Service.WindowCovering('Bedroom')],
    }, 'Bedroom', alias);
    assert.equal(accessory.UUID, legacy.UUID);
    assert.deepEqual(calls.requested, [0]);
    api.emit('shutdown');
    assert.equal(calls.usb[0].eventEmitter.listenerCount('shutdown'), 0);
  });
}

test('restores cached services and handlers without duplicating accessories or commands', async t => {
  const first = setup(t);
  first.launch();
  const cached = restore(first.calls.registered[0]);
  first.api.emit('shutdown');
  const covering = cached.getService(first.api.hap.Service.WindowCovering);
  const stop = cached.getServiceById(first.api.hap.Service.Switch, '3');
  const second = setup(t, config, [cached]);
  second.launch();
  assert.deepEqual(second.calls.registered, []);
  assert.deepEqual(second.calls.updated, [cached]);
  assert.equal(cached.getService(second.api.hap.Service.WindowCovering), covering);
  assert.equal(cached.getServiceById(second.api.hap.Service.Switch, '3'), stop);
  const [usb] = second.calls.usb;
  usb.eventEmitter.emit('0', {CurrentPosition: 47, PositionState: 2, ObstructionDetected: false});
  assert.equal(await covering.getCharacteristic(second.api.hap.Characteristic.CurrentPosition).handleGetRequest(), 47);
  let stopped = 0;
  usb.sendStop = async () => { stopped++; };
  await stop.getCharacteristic(second.api.hap.Characteristic.On).handleSetRequest(true);
  assert.equal(stopped, 1);
  assert.equal(await stop.getCharacteristic(second.api.hap.Characteristic.On).handleGetRequest(), false);
});

test('adds/removes configured shutters and reconciles optional buttons after restart', t => {
  const first = setup(t, {...config, shutters: [...config.shutters, {name: 'Office', device: 63}]});
  first.launch();
  const cached = first.calls.registered.map(restore);
  first.api.emit('shutdown');
  const second = setup(t, {...config, shutters: [{name: 'Bedroom', device: 0, showIntermediate1: true}, {name: 'New', device: 4}]}, cached);
  second.launch();
  assert.deepEqual(second.calls.removed.map(a => a.displayName), ['Office']);
  assert.deepEqual(second.calls.registered.map(a => a.displayName), ['New']);
  assert.equal(cached[0].getServiceById(second.api.hap.Service.Switch, '3'), undefined);
  assert.ok(cached[0].getServiceById(second.api.hap.Service.Switch, '1'));
});

test('an explicit empty array removes cached shutters without opening USB', t => {
  const first = setup(t); first.launch();
  const cached = restore(first.calls.registered[0]);
  first.api.emit('shutdown');
  const second = setup(t, {...config, shutters: []}, [cached]); second.launch();
  assert.deepEqual(second.calls.removed, [cached]);
  assert.deepEqual(second.calls.requested, []);
});

const invalidConfigs = [null, {}, {usbPort: 3, shutters: []}, {usbPort: ' ', shutters: []}, {usbPort: '/dev/mock'},
  {...config, shutters: {}}, ...[null, {}, {name: ' ', device: 0}, {name: 'Bad', device: '0'}, {name: 'Bad', device: NaN},
    {name: 'Bad', device: -1}, {name: 'Bad', device: 64}, {name: 'Bad', device: 0.5}, {name: 'Bad', device: 1, showStop: 'false'},
    {name: 'Bedroom', device: 1}, {name: 'Duplicate', device: 0}].map(shutter => ({...config, shutters: [...config.shutters, shutter]}))];
for (const [index, settings] of invalidConfigs.entries()) {
  test(`invalid configuration ${index} retains cached accessories, rejects control, and never touches USB`, async t => {
    const first = setup(t); first.launch();
    const cached = restore(first.calls.registered[0]); first.api.emit('shutdown');
    const next = setup(t, settings, [cached]); next.launch();
    assert.deepEqual(next.calls.requested, []);
    assert.deepEqual(next.calls.removed, []);
    assert.deepEqual(next.calls.updated, []);
    assert.equal(next.calls.errors.length + next.calls.warnings.length, 1);
    const { Characteristic, Service, HAPStatus } = next.api.hap;
    const current = cached.getService(Service.WindowCovering).getCharacteristic(Characteristic.CurrentPosition);
    const target = cached.getService(Service.WindowCovering).getCharacteristic(Characteristic.TargetPosition);
    const stop = cached.getServiceById(Service.Switch, '3').getCharacteristic(Characteristic.On);
    for (const characteristic of [current, target, stop]) {
      await assert.rejects(characteristic.handleGetRequest(), error => error === HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    await assert.rejects(target.handleSetRequest(50));
    await assert.rejects(stop.handleSetRequest(true));
  });
}

test('catches initialization failures, retains the cache, and stops USB recovery', async t => {
  const first = setup(t); first.launch();
  const cached = restore(first.calls.registered[0]); first.api.emit('shutdown');
  const next = setup(t, config, [cached]);
  t.mock.method(next.api, 'updatePlatformAccessories', () => { throw new Error('Storage unavailable'); });
  assert.doesNotThrow(next.launch);
  assert.match(next.calls.errors[0], /Storage unavailable/);
  assert.deepEqual(next.calls.removed, []);
  await assert.rejects(next.calls.usb[0].sendStop(0), /shut down/);
});

test('does not start after shutdown', t => {
  const next = setup(t); next.api.emit('shutdown'); next.launch();
  assert.deepEqual(next.calls.requested, []);
});

test('unsupported Node 26/Homebridge combination logs an error without touching USB', t => {
  const descriptor = Object.getOwnPropertyDescriptor(process.versions, 'node');
  try {
    Object.defineProperty(process.versions, 'node', {value: '26.8.2'});
    const next = setup(t);
    t.mock.method(next.api, 'versionGreaterOrEqual', () => false);
    assert.doesNotThrow(next.launch);
    assert.match(next.calls.errors[0], /Node.js 26 requires Homebridge 2.3.0/);
    assert.deepEqual(next.calls.requested, []);
  } finally {
    Object.defineProperty(process.versions, 'node', descriptor);
  }
});

test('a repeated launch event does not duplicate USB requests or accessories', t => {
  const next = setup(t); next.launch(); next.launch();
  assert.deepEqual(next.calls.requested, [0]);
  assert.equal(next.calls.registered.length, 1);
});
