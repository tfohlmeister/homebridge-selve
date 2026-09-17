import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import process from "node:process";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { SelveShutter } from "../dist/selve-shutter-accessory.js";
import { USBRfService } from "../dist/util/usb-rf.service.js";
import initialize from "../dist/index.js";
import { SelvePlatform } from "../dist/selve-platform.js";

// Use the HAP implementation belonging to the Homebridge version under test.
const require = createRequire(import.meta.url);
const homebridgeRequire = createRequire(require.resolve("homebridge"));
let hap;
try { hap = homebridgeRequire("@homebridge/hap-nodejs"); }
catch { hap = homebridgeRequire("hap-nodejs"); }
const log = { debug() {}, info() {}, warn() {}, error() {} };
function setup(options = {}) {
  const calls = [];
  const usb = {
    eventEmitter: new EventEmitter(),
    async requestUpdate(device) { calls.push(["update", device]); },
    async sendMovePosition(...args) { calls.push(["move", ...args]); },
    async sendStop(device) { calls.push(["stop", device]); },
    async sendMoveIntermediatePosition(...args) { calls.push(["intermediate", ...args]); },
  };
  const shutter = new SelveShutter(hap, log, { name: "Livingroom", device: 4, ...options }, usb);
  const covering = shutter.getServices().find(s => s.UUID === hap.Service.WindowCovering.UUID);
  return {shutter, covering, usb, calls};
}
function report(usb, CurrentPosition = 50, PositionState = 2) {
  usb.eventEmitter.emit("4", {CurrentPosition, PositionState, ObstructionDetected: false});
}

test("registers the legacy platform alias", () => {
  let alias;
  initialize({versionGreaterOrEqual: () => true, registerPlatform(name) { alias = name; }});
  assert.equal(alias, "selve");
});

test("platform rejects a missing USB path before initializing accessories", () => {
  assert.throws(() => new SelvePlatform(log, {}, {hap}), /usbPort/);
});

test("platform tolerates an empty configuration and reports why", () => {
  const warnings = [];
  const api = Object.assign(new EventEmitter(), {hap});
  const platform = new SelvePlatform({...log, warn: message => warnings.push(message)}, {usbPort: "/dev/mock"}, api);
  platform.accessories(accessories => assert.deepEqual(accessories, []));
  assert.match(warnings[0], /No shutter configs/);
  api.emit("shutdown");
});

test("platform skips invalid entries, preserves valid device IDs, and propagates shutdown", async t => {
  const requested = [];
  const errors = [];
  const services = [];
  t.mock.method(USBRfService.prototype, "requestUpdate", async function (device) {
    services.push(this);
    requested.push(device);
  });
  const api = Object.assign(new EventEmitter(), {hap});
  const platform = new SelvePlatform({...log, error: message => errors.push(message)}, {
    usbPort: "/dev/mock",
    shutters: [{device: 1}, {name: "Invalid", device: "2"}, {name: "Bedroom", device: 0}, {name: "Office", device: 63}],
  }, api);
  platform.accessories(accessories => assert.deepEqual(accessories.map(a => a.name), ["Bedroom", "Office"]));
  assert.deepEqual(requested, [0, 63]);
  assert.equal(errors.length, 2);
  const [service] = services;
  let shutdown = false;
  service.eventEmitter.once("shutdown", () => { shutdown = true; });
  api.emit("shutdown");
  assert.equal(shutdown, true);
  await assert.rejects(service.sendStop(0), /shut down/);
});

test("remote movement notifies HomeKit in both directions without exceeding position bounds", () => {
  const {covering, usb} = setup();
  const current = covering.getCharacteristic(hap.Characteristic.CurrentPosition);
  const target = covering.getCharacteristic(hap.Characteristic.TargetPosition);
  report(usb, 0, 2);
  report(usb, 0, 1);
  assert.equal(current.value, 0);
  report(usb, 60, 1);
  assert.equal(current.value, 59);
  assert.equal(target.value, 60);
  report(usb, 100, 2);
  report(usb, 100, 0);
  assert.equal(current.value, 100);
  report(usb, 40, 0);
  assert.equal(current.value, 41);
  assert.equal(target.value, 40);
  usb.eventEmitter.emit("shutdown");
});

test("preserves accessory names and optional service subtypes", () => {
  const {shutter, calls} = setup({showIntermediate1: true, showIntermediate2: true, showStop: true});
  assert.equal(shutter.name, "Livingroom");
  assert.deepEqual(shutter.getServices().map(s => [s.UUID, s.subtype]), [
    [hap.Service.AccessoryInformation.UUID, undefined],
    [hap.Service.WindowCovering.UUID, undefined],
    [hap.Service.Switch.UUID, "1"], [hap.Service.Switch.UUID, "2"], [hap.Service.Switch.UUID, "3"],
  ]);
  assert.deepEqual(calls, [["update", 4]]);
});

test("reports unavailable until a receiver status arrives, and after a USB failure", async () => {
  const {covering, usb} = setup();
  const current = covering.getCharacteristic(hap.Characteristic.CurrentPosition);
  await assert.rejects(current.handleGetRequest(), e => e === hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  report(usb, 35);
  assert.equal(await current.handleGetRequest(), 35);
  usb.eventEmitter.emit("unavailable");
  await assert.rejects(current.handleGetRequest(), e => e === hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  report(usb, 40);
  assert.equal(await current.handleGetRequest(), 40);
});

test("supports USB failure notifications for all 64 shutters without listener warnings", async () => {
  const usb = new USBRfService(log, "/dev/mock");
  usb.requestUpdate = async () => {};
  const warnings = [];
  const onWarning = warning => {
    if (warning.name === "MaxListenersExceededWarning" && warning.emitter === usb.eventEmitter) {
      warnings.push(warning);
    }
  };
  process.on("warning", onWarning);
  try {
    const positions = Array.from({length: 64}, (_, device) => {
      const shutter = new SelveShutter(hap, log, {name: `Shutter ${device}`, device}, usb);
      const covering = shutter.getServices().find(s => s.UUID === hap.Service.WindowCovering.UUID);
      usb.eventEmitter.emit(String(device), {CurrentPosition: 50, PositionState: 2, ObstructionDetected: false});
      return covering.getCharacteristic(hap.Characteristic.CurrentPosition);
    });
    for (const position of positions) {
      assert.equal(await position.handleGetRequest(), 50);
    }
    usb.eventEmitter.emit("unavailable");
    for (const position of positions) {
      await assert.rejects(position.handleGetRequest(), e => e === hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    await setImmediate();
    assert.equal(warnings.length, 0);
  } finally {
    process.removeListener("warning", onWarning);
    usb.shutdown();
  }
});

test("sends the configured device and target; restores the previous target on failure", async () => {
  const {covering, usb, calls} = setup();
  report(usb, 35);
  const target = covering.getCharacteristic(hap.Characteristic.TargetPosition);
  await target.handleSetRequest(70);
  assert.deepEqual(calls.at(-1), ["move", 4, 70]);
  usb.sendMovePosition = async () => {throw new Error("USB unavailable");};
  await assert.rejects(target.handleSetRequest(10));
  assert.equal(await target.handleGetRequest(), 70);
});

test("tracks receiver movement and synchronizes the target when stopped", async () => {
  const {covering, usb} = setup();
  report(usb, 65, 0);
  assert.equal(await covering.getCharacteristic(hap.Characteristic.PositionState).handleGetRequest(), 0);
  report(usb, 60, 2);
  assert.equal(await covering.getCharacteristic(hap.Characteristic.TargetPosition).handleGetRequest(), 60);
});

test("optional buttons issue the right commands and ignore off writes", async () => {
  const {shutter, calls} = setup({showIntermediate1: true, showIntermediate2: true, showStop: true});
  for (const service of shutter.getServices().filter(s => s.UUID === hap.Service.Switch.UUID)) {
    const on = service.getCharacteristic(hap.Characteristic.On);
    await on.handleSetRequest(true);
    await on.handleSetRequest(false);
  }
  assert.deepEqual(calls, [["update",4],["intermediate",4,1],["intermediate",4,2],["stop",4]]);
});

test("retries missing replies with capped backoff, stops on state, and cancels on shutdown", async t => {
  t.mock.timers.enable({apis: ["setTimeout"]});
  const {usb, calls} = setup();
  await setImmediate();
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    const before = calls.length;
    t.mock.timers.tick(delay - 1);
    await setImmediate();
    assert.equal(calls.length, before);
    t.mock.timers.tick(1);
    await setImmediate();
    assert.equal(calls.length, before + 1);
  }
  report(usb);
  const recovered = calls.length;
  t.mock.timers.tick(60000);
  await setImmediate();
  assert.equal(calls.length, recovered);
  usb.eventEmitter.emit("unavailable");
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.equal(calls.length, recovered + 1);
  usb.eventEmitter.emit("shutdown");
  t.mock.timers.tick(60000);
  await setImmediate();
  assert.equal(calls.length, recovered + 1);
});

test("does not accumulate retries while a status write is queued", async t => {
  t.mock.timers.enable({apis: ["setTimeout"]});
  const {usb, calls} = setup();
  await setImmediate();
  let finish;
  usb.requestUpdate = () => {
    calls.push(["pending"]);
    return new Promise(resolve => { finish = resolve; });
  };
  t.mock.timers.tick(1000);
  await setImmediate();
  for (let i = 0; i < 3; i++) {
    usb.eventEmitter.emit("unavailable");
    t.mock.timers.tick(30000);
    await setImmediate();
  }
  assert.equal(calls.length, 2);
  usb.eventEmitter.emit("shutdown");
  finish();
  await setImmediate();
  t.mock.timers.tick(60000);
  await setImmediate();
  assert.equal(calls.length, 2);
});

test("a failed move preserves a newer stopped status or newer target", async () => {
  const {covering, usb} = setup();
  report(usb, 35);
  const target = covering.getCharacteristic(hap.Characteristic.TargetPosition);
  let fail;
  usb.sendMovePosition = () => new Promise((_, reject) => { fail = reject; });
  const failure = assert.rejects(target.handleSetRequest(70));
  report(usb, 70);
  fail(new Error("USB disconnected"));
  await failure;
  assert.equal(await target.handleGetRequest(), 70);
  const secondFailure = assert.rejects(target.handleSetRequest(10));
  usb.sendMovePosition = async () => {};
  await target.handleSetRequest(80);
  fail(new Error("Earlier command failed"));
  await secondFailure;
  assert.equal(await target.handleGetRequest(), 80);
  usb.eventEmitter.emit("shutdown");
});

test("failed momentary controls reset and accept another press", async t => {
  t.mock.timers.enable({apis: ["setTimeout"]});
  const {shutter, usb} = setup({showIntermediate1: true, showIntermediate2: true, showStop: true});
  usb.sendMoveIntermediatePosition = usb.sendStop = async () => { throw new Error("USB disconnected"); };
  for (const service of shutter.getServices().filter(s => s.UUID === hap.Service.Switch.UUID)) {
    const on = service.getCharacteristic(hap.Characteristic.On);
    for (let press = 0; press < 2; press++) {
      on.updateValue(true);
      await assert.rejects(on.handleSetRequest(true));
      t.mock.timers.tick(500);
      assert.equal(await on.handleGetRequest(), false);
    }
  }
  usb.eventEmitter.emit("shutdown");
});

for (const failure of ["disconnect", "write timeout"]) {
  test(`recovers from ${failure} using status reads without HomeKit writes`, async t => {
    t.mock.timers.enable({apis: ["setTimeout"]});
    let absent = false;
    let dropReply = false;
    const ports = [];
    class Port extends EventEmitter {
      isOpen = false;
      writes = [];
      open(cb) { this.isOpen = !absent; cb(absent ? new Error("Missing USB") : undefined); }
      close(cb) { this.isOpen = false; this.emit("close"); cb(); }
      drain(cb) { cb(); }
      write(data, cb) {
        this.writes.push(data);
        if (failure === "write timeout" && data.includes("command.device")) { return; }
        if (!dropReply) {
          const device = /<int>(\d+)<\/int>/.exec(data)[1];
          this.emit("data", `<methodResponse><array><string>selve.GW.device.getValues</string><int>${device}</int><int>1</int><int>32768</int></array></methodResponse>`);
        }
        cb();
      }
    }
    const usb = new USBRfService(log, "/dev/mock", {
      commandDelayMs: 0, timeoutMs: 100,
      serialPortFactory: () => { const port = new Port(); ports.push(port); return port; },
    });
    const currents = Array.from({length: 64}, (_, device) => {
      const shutter = new SelveShutter(hap, log, {name: `Shutter ${device}`, device}, usb);
      return shutter.getServices().find(s => s.UUID === hap.Service.WindowCovering.UUID)
        .getCharacteristic(hap.Characteristic.CurrentPosition);
    });
    const advance = async ms => { t.mock.timers.tick(ms); await setImmediate(); };
    const drainQueue = async () => { for (let i = 0; i < 70; i++) { await advance(0); } };
    try {
      await drainQueue();
      for (const current of currents) { assert.equal(await current.handleGetRequest(), 50); }
      if (failure === "disconnect") {
        absent = true;
        ports[0].emit("error", new Error("USB removed"));
      } else {
        const rejected = assert.rejects(usb.sendMovePosition(0, 70), /timeout/i);
        await drainQueue();
        await advance(100);
        await rejected;
      }
      for (const current of currents) {
        await assert.rejects(current.handleGetRequest(), e => e === hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
      await advance(1000);
      await drainQueue();
      absent = false;
      dropReply = true;
      await advance(2000);
      await drainQueue();
      dropReply = false;
      await advance(4000);
      await drainQueue();
      for (const current of currents) { assert.equal(await current.handleGetRequest(), 50); }
      assert.ok(ports.length > 1);
      assert.ok(ports.slice(1).flatMap(p => p.writes).every(xml => xml.includes("getValues")));
    } finally { usb.shutdown(); }
  });
}

test("rejects Node 26 with older Homebridge before registering the platform", () => {
  const descriptor = Object.getOwnPropertyDescriptor(process.versions, "node");
  try {
    Object.defineProperty(process.versions, "node", {value: "26.8.2"});
    const api = {
      versionGreaterOrEqual(version) { assert.equal(version, "2.3.0"); return false; },
      registerPlatform() { assert.fail("Unsupported platform must not register"); },
    };
    assert.throws(() => initialize(api), /Node.js 26 requires Homebridge 2.3.0/);
    Object.defineProperty(process.versions, "node", {value: "24.20.0"});
    let registered = false;
    initialize({...api, registerPlatform() { registered = true; }});
    assert.equal(registered, true);
  } finally {
    Object.defineProperty(process.versions, "node", descriptor);
  }
});
