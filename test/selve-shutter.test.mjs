import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import process from "node:process";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { SelveShutter } from "../dist/selve-shutter-accessory.js";
import { USBRfService } from "../dist/util/usb-rf.service.js";
import initialize from "../dist/index.js";

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
  initialize({registerPlatform(name) { alias = name; }});
  assert.equal(alias, "selve");
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
