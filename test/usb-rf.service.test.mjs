import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { setTimeout } from "node:timers";
import {
  USBRfService,
  convertPositionToCommeo,
  convertPositionToHomekit,
  createMoveIntermediatePositionCommand,
  createMovePositionCommand,
  createRequestUpdateCommand,
  createStopCommand,
  parseCommeoStateMessage,
} from "../dist/util/usb-rf.service.js";
import { HomebridgeStatusState } from "../dist/data/commeo-state.js";

const log = {
  debug() {},
  error() {},
  info() {},
  warn() {},
};

class MockSerialPort extends EventEmitter {
  isOpen = false;
  writes = [];

  constructor({ writeDelayMs = 0, writeNeverCompletes = false } = {}) {
    super();
    this.writeDelayMs = writeDelayMs;
    this.writeNeverCompletes = writeNeverCompletes;
  }

  open(callback) {
    this.isOpen = true;
    callback();
  }

  close(callback) {
    this.isOpen = false;
    this.emit("close");
    callback();
  }

  drain(callback) { callback(); }

  write(data, callback) {
    this.writes.push(data);
    if (!this.writeNeverCompletes) {
      setTimeout(() => callback(), this.writeDelayMs);
    }
    return true;
  }
}

test("converts positions between HomeKit and Commeo ranges", () => {
  assert.equal(convertPositionToCommeo(0), 65535);
  assert.equal(convertPositionToCommeo(50), 32767);
  assert.equal(convertPositionToCommeo(100), 0);

  assert.equal(convertPositionToHomekit(0), 100);
  assert.equal(convertPositionToHomekit(32768), 50);
  assert.equal(convertPositionToHomekit(65535), 0);
});

test("generates Selve command XML without changing payload shape", () => {
  assert.equal(
    createMovePositionCommand(4, 50),
    "<methodCall><methodName>selve.GW.command.device</methodName><array><int>4</int><int>7</int><int>1</int><int>32767</int></array></methodCall>",
  );
  assert.equal(
    createStopCommand(4),
    "<methodCall><methodName>selve.GW.command.device</methodName><array><int>4</int><int>0</int><int>1</int><int>0</int></array></methodCall>",
  );
  assert.equal(
    createMoveIntermediatePositionCommand(4, 1),
    "<methodCall><methodName>selve.GW.command.device</methodName><array><int>4</int><int>3</int><int>1</int><int>0</int></array></methodCall>",
  );
  assert.equal(
    createMoveIntermediatePositionCommand(4, 2),
    "<methodCall><methodName>selve.GW.command.device</methodName><array><int>4</int><int>5</int><int>1</int><int>0</int></array></methodCall>",
  );
  assert.equal(
    createRequestUpdateCommand(4),
    "<methodCall><methodName>selve.GW.device.getValues</methodName><array><int>4</int></array></methodCall>",
  );
});

test("parses Selve event XML into HomeKit state", () => {
  const parsed = parseCommeoStateMessage(
    "<methodCall><methodName>selve.GW.event.device</methodName><array><int>4</int><int>2</int><int>0</int><int>0</int><int>0</int></array></methodCall>",
  );

  assert.deepEqual(parsed, {
    device: "4",
    state: {
      CurrentPosition: 100,
      PositionState: HomebridgeStatusState.INCREASING,
      ObstructionDetected: false,
    },
  });
});

test("parses getValues response XML into HomeKit state", () => {
  const parsed = parseCommeoStateMessage(
    "<methodResponse><array><string>selve.GW.device.getValues</string><int>4</int><int>3</int><int>65535</int><int>0</int><int>100</int></array></methodResponse>",
  );

  assert.deepEqual(parsed, {
    device: "4",
    state: {
      CurrentPosition: 0,
      PositionState: HomebridgeStatusState.DECREASING,
      ObstructionDetected: true,
    },
  });
});

test("ignores unknown and fault XML without throwing", () => {
  assert.equal(
    parseCommeoStateMessage("<methodCall><methodName>other.method</methodName></methodCall>"),
    undefined,
  );
  assert.equal(
    parseCommeoStateMessage("<methodResponse><fault><string>bad</string></fault></methodResponse>"),
    undefined,
  );
});

test("queues serial writes in command order", async () => {
  const port = new MockSerialPort({ writeDelayMs: 5 });
  const service = new USBRfService(log, "/dev/mock", {
    serialPortFactory: () => port,
    commandDelayMs: 0,
  });

  await Promise.all([
    service.sendMovePosition(4, 100),
    service.sendStop(4),
    service.requestUpdate(4),
  ]);

  assert.deepEqual(port.writes, [
    createMovePositionCommand(4, 100),
    createStopCommand(4),
    createRequestUpdateCommand(4),
  ]);
});

test("rejects a serial write that exceeds the command timeout", async () => {
  const port = new MockSerialPort({ writeNeverCompletes: true });
  const service = new USBRfService(log, "/dev/mock", {
    serialPortFactory: () => port,
    commandDelayMs: 0,
    timeoutMs: 5,
  });

  await assert.rejects(service.sendStop(4), /timeout/i);
});

function mockService(port, options = {}) {
  return new USBRfService(log, "/dev/mock", {
    serialPortFactory: () => port, commandDelayMs: 0, timeoutMs: 100, ...options,
  });
}

test("does not transmit a timed-out command when a delayed open completes", async () => {
  const port = new MockSerialPort();
  let completeOpen;
  port.open = (callback) => { completeOpen = () => { port.isOpen = true; callback(); }; };
  const service = mockService(port, { timeoutMs: 5 });
  await assert.rejects(service.sendMovePosition(4, 0), /timeout/i);
  await assert.rejects(service.sendStop(4), /timeout/i);
  completeOpen();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(port.writes, []);
  assert.equal(port.isOpen, false);
  service.shutdown();
});

test("handles USB errors and reconnects on the next command without replaying", async () => {
  const ports = [new MockSerialPort(), new MockSerialPort()];
  let count = 0;
  const service = mockService(null, { serialPortFactory: () => ports[count++] });
  await service.requestUpdate(4);
  assert.doesNotThrow(() => ports[0].emit("error", new Error("USB disconnected")));
  await service.requestUpdate(4);
  assert.equal(count, 2);
  assert.equal(ports[0].isOpen, false);
  assert.deepEqual(ports[1].writes, [createRequestUpdateCommand(4)]);
  service.shutdown();
});

test("rejects an in-flight write immediately on disconnect", async () => {
  const port = new MockSerialPort({ writeNeverCompletes: true });
  const service = mockService(port);
  const command = service.sendStop(4);
  const rejection = assert.rejects(command, /connection closed/);
  await new Promise((resolve) => setTimeout(resolve, 0));
  port.isOpen = false;
  port.emit("close");
  await rejection;
  service.shutdown();
});

test("shutdown cancels active and queued writes and closes the port", async () => {
  const port = new MockSerialPort({ writeNeverCompletes: true });
  const service = mockService(port);
  const active = assert.rejects(service.sendStop(4), /shut down/);
  const queued = assert.rejects(service.sendMovePosition(4, 0), /shut down/);
  await new Promise((resolve) => setTimeout(resolve, 0));
  service.shutdown();
  await Promise.all([active, queued]);
  assert.equal(port.writes.length, 1);
  assert.equal(port.isOpen, false);
});

test("shutdown during opening closes the late connection without writing", async () => {
  const port = new MockSerialPort();
  let completeOpen;
  port.open = (callback) => { completeOpen = () => { port.isOpen = true; callback(); }; };
  const service = mockService(port);
  const rejected = assert.rejects(service.requestUpdate(4), /shut down/);
  await new Promise((resolve) => setTimeout(resolve, 0));
  service.shutdown();
  completeOpen();
  await rejected;
  assert.equal(port.isOpen, false);
  assert.equal(port.writes.length, 0);
});

test("failed open does not poison subsequent connection attempts", async () => {
  const port = new MockSerialPort();
  port.open = (callback) => callback(new Error("missing USB device"));
  const replacement = new MockSerialPort();
  let count = 0;
  const service = mockService(null, { serialPortFactory: () => count++ === 0 ? port : replacement });
  await assert.rejects(service.requestUpdate(4), /missing USB/);
  await service.requestUpdate(4);
  assert.equal(replacement.writes.length, 1);
  service.shutdown();
});

test("waits for hardware drain before starting the next queued command", async () => {
  const port = new MockSerialPort();
  let drain;
  port.drain = (callback) => { drain = callback; };
  const service = mockService(port);
  const first = service.sendStop(4);
  const second = service.requestUpdate(4);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(port.writes.length, 1);
  drain();
  await first;
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(port.writes.length, 2);
  drain();
  await second;
  service.shutdown();
});

test("handles split and concatenated serial XML frames", async () => {
  const port = new MockSerialPort();
  const service = mockService(port);
  const states = [];
  service.eventEmitter.on("4", (state) => states.push(state));
  await service.requestUpdate(4);
  const frame = "<methodCall>\r\n<methodName>selve.GW.event.device</methodName><array><int>4</int><int>1</int><int>0</int><int>0</int><int>0</int></array></methodCall>";
  port.emit("data", Buffer.from(frame.slice(0, 40)));
  assert.equal(states.length, 0);
  port.emit("data", Buffer.from(frame.slice(40) + "\r\n" + frame));
  assert.equal(states.length, 2);
  service.shutdown();
});

test("recovers after malformed and oversized serial input", async () => {
  const port = new MockSerialPort();
  const service = mockService(port);
  let states = 0;
  service.eventEmitter.on("4", () => states++);
  await service.requestUpdate(4);
  port.emit("data", Buffer.from("<methodCall><broken></methodCall>"));
  port.emit("data", Buffer.from("x".repeat(65537)));
  port.emit("data", Buffer.from("<methodCall><methodName>selve.GW.event.device</methodName><array><int>4</int><int>1</int><int>0</int><int>0</int><int>0</int></array></methodCall>"));
  assert.equal(states, 1);
  service.shutdown();
});

test("accepts legacy status frames without flags but rejects empty or non-integer fields", () => {
  const frame = values => `<methodCall><methodName>selve.GW.event.device</methodName><array>${values.map(v => `<int>${v}</int>`).join("")}</array></methodCall>`;
  for (const values of [[4, 1, 32768], [4, 1, 32768, 0]]) {
    const parsed = parseCommeoStateMessage(frame(values));
    assert.equal(parsed.state.CurrentPosition, 50);
    assert.equal(parsed.state.ObstructionDetected, false);
  }
  for (const invalid of ["", " ", "abc", "1.5", "0x10", "1e2"]) {
    for (const index of [0, 1, 2, 4]) {
      const values = [4, 1, 32768, 0, 0];
      values[index] = invalid;
      assert.equal(parseCommeoStateMessage(frame(values)), undefined, `${index}: ${invalid}`);
    }
  }
});

test("resynchronizes a truncated frame at the next valid method root", async () => {
  const port = new MockSerialPort();
  const service = mockService(port);
  const states = [];
  service.eventEmitter.on("4", state => states.push(state));
  await service.requestUpdate(4);
  for (const root of ["methodCall", "methodResponse"]) {
    port.emit("data", Buffer.from(`<${root}><array><int>4</int>`));
    port.emit("data", Buffer.from("<methodCall><methodName>selve.GW.event.device</methodName><array><int>4</int><int>1</int><int>0</int></array></methodCall>"));
  }
  assert.equal(states.length, 2);
  service.shutdown();
});

test("waits for a slow asynchronous close before opening a replacement", async () => {
  const port = new MockSerialPort();
  const replacement = new MockSerialPort();
  let finishClose;
  port.close = cb => { finishClose = () => { port.isOpen = false; port.emit("close"); cb(); }; };
  let opens = 0;
  const service = mockService(null, {serialPortFactory: () => ++opens === 1 ? port : replacement});
  await service.requestUpdate(4);
  port.emit("error", new Error("USB error"));
  const next = service.requestUpdate(4);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(opens, 1);
  finishClose();
  await next;
  assert.equal(opens, 2);
  assert.deepEqual(replacement.writes, [createRequestUpdateCommand(4)]);
  service.shutdown();
});
