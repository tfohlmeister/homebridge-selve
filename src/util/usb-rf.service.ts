import events from "events";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Logging } from "homebridge";
import { SerialPort } from "serialport";
import {
  CommeoState,
  CommeoStatusState,
  HomebridgeStatusState,
} from "../data/commeo-state.js";

const COMMEO_MAX_POSITION = 65535;
const COMMEO_TIMEOUT = 10000;
const COMMEO_COMMAND_DELAY = 500;

type SerialPortLike = Pick<SerialPort, "isOpen" | "open" | "close" | "on" | "removeListener" | "write" | "drain">;

interface Connection {
  port: SerialPortLike;
  ready: Promise<void>;
  rejectReady: (error: Error) => void;
  invalid: boolean;
  opening: boolean;
  closing: boolean;
  buffer: string;
  onData: (data: Buffer) => void;
}

export interface USBRfServiceOptions {
  serialPortFactory?: (path: string, baudRate: number) => SerialPortLike;
  commandDelayMs?: number;
  timeoutMs?: number;
}

export interface ParsedCommeoStateMessage {
  device: string;
  state: CommeoState;
}

const parser = new XMLParser();

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function convertPositionToHomekit(commeoPos: number): number {
  return Math.min(
    100,
    Math.round(100 - (commeoPos / COMMEO_MAX_POSITION) * 100)
  );
}

export function convertPositionToCommeo(homekitPos: number): number {
  return homekitPos > 0
    ? COMMEO_MAX_POSITION -
        Math.min(
          Math.round((homekitPos / 100) * COMMEO_MAX_POSITION),
          COMMEO_MAX_POSITION
        )
    : COMMEO_MAX_POSITION;
}

export function createMovePositionCommand(device: number, targetPos: number): string {
  const commeoTargetPos = convertPositionToCommeo(targetPos);
  return `<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>1</int><int>${commeoTargetPos}</int></array></methodCall>`;
}

export function createStopCommand(device: number): string {
  return `<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>0</int><int>1</int><int>0</int></array></methodCall>`;
}

export function createMoveIntermediatePositionCommand(device: number, pos: 1 | 2): string {
  return `<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>${
    pos === 1 ? 3 : 5
  }</int><int>1</int><int>0</int></array></methodCall>`;
}

export function createRequestUpdateCommand(device: number): string {
  return `<methodCall><methodName>selve.GW.device.getValues</methodName><array><int>${device}</int></array></methodCall>`;
}

export function parseCommeoStateMessage(input: string): ParsedCommeoStateMessage | undefined {
  if (XMLValidator.validate(input) !== true) {
    return undefined;
  }
  const data = parser.parse(input);
  if (!data.methodCall && !data.methodResponse) {
    return undefined;
  }
  if (data.methodResponse?.fault) {
    return undefined;
  }
  if (
    data.methodCall &&
    data.methodCall.methodName !== "selve.GW.event.device"
  ) {
    return undefined;
  }
  if (data.methodResponse) {
    const responseNames = toArray<string>(data.methodResponse.array?.string);
    if (responseNames[0] !== "selve.GW.device.getValues") {
      return undefined;
    }
  }

  const payload = toArray<number>(
    data.methodCall
      ? data.methodCall.array?.int
      : data.methodResponse.array?.int
  ).map(Number);

  if (payload.length < 5 || payload.some((value) => !Number.isInteger(value)) ||
      payload[0] < 0 || payload[0] > 63 || payload[2] < 0 || payload[2] > COMMEO_MAX_POSITION) {
    return undefined;
  }

  const device = String(payload[0]);
  const stateStatus: CommeoStatusState = payload[1];
  const PositionState =
    stateStatus === CommeoStatusState.MOVING_UP
      ? HomebridgeStatusState.INCREASING
      : stateStatus === CommeoStatusState.MOVING_DOWN
      ? HomebridgeStatusState.DECREASING
      : HomebridgeStatusState.STOPPED;
  const CurrentPosition = convertPositionToHomekit(payload[2]);
  const flags = String(payload[4]).split("");
  const ObstructionDetected =
    flags[0] === "1" || flags[1] === "1" || flags[2] === "1";

  return {
    device,
    state: {
      CurrentPosition,
      PositionState,
      ObstructionDetected,
    } as CommeoState,
  };
}

export class USBRfService {
  public readonly eventEmitter = new events.EventEmitter();
  private connection: Connection | undefined;
  private commandQueue: Promise<void> = Promise.resolve();
  private rejectCommand: ((error: Error) => void) | undefined;
  private stopped = false;
  private readonly serialPortFactory: (path: string, baudRate: number) => SerialPortLike;
  private readonly commandDelayMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly log: Logging, private readonly port: string, options: USBRfServiceOptions = {}) {
    this.serialPortFactory = options.serialPortFactory ??
      ((path, baudRate) => new SerialPort({ path, baudRate, autoOpen: false }));
    this.commandDelayMs = options.commandDelayMs ?? COMMEO_COMMAND_DELAY;
    this.timeoutMs = options.timeoutMs ?? COMMEO_TIMEOUT;
  }

  private handleData(connection: Connection, data: Buffer): void {
    if (connection.invalid) {
      return;
    }
    connection.buffer += data.toString();
    let end: RegExpExecArray | null;
    while ((end = /<\/method(?:Response|Call)>/.exec(connection.buffer))) {
      const length = end.index + end[0].length;
      const frame = connection.buffer.slice(0, length).trim();
      connection.buffer = connection.buffer.slice(length);
      const start = frame.search(/<method(?:Response|Call)>/);
      const input = start < 0 ? frame : frame.slice(start);
      try {
        if (XMLValidator.validate(input) !== true) {
          this.log.warn("Ignoring malformed Selve XML");
          continue;
        }
        const message = parser.parse(input);
        if (message.methodResponse?.fault) {
          this.log.error("Selve gateway rejected a command", JSON.stringify(message.methodResponse.fault));
          continue;
        }
        const parsed = parseCommeoStateMessage(input);
        if (parsed) {
          this.eventEmitter.emit(parsed.device, parsed.state);
        } else {
          this.log.debug("Ignoring unknown Selve message", input);
        }
      } catch (error) {
        this.log.warn("Unable to read Selve message", String(error));
      }
    }
    if (connection.buffer.length > 65536) {
      connection.buffer = "";
      this.log.warn("Discarding oversized incomplete Selve message");
    }
  }

  private closeConnection(connection: Connection): void {
    if (connection.opening || connection.closing) {
      return;
    }
    if (!connection.port.isOpen) {
      if (this.connection === connection) {
        this.connection = undefined;
      }
      return;
    }
    connection.closing = true;
    connection.port.close((error?: Error | null) => {
      connection.closing = false;
      if (error) {
        this.log.error("Unable to close Selve USB port", error.message);
      }
      // Never open a second connection while this one still owns the port.
      if (!connection.port.isOpen && this.connection === connection) {
        this.connection = undefined;
      }
    });
  }

  private invalidate(connection: Connection, error: Error): void {
    if (!connection.invalid) {
      connection.invalid = true;
      connection.buffer = "";
      connection.port.removeListener("data", connection.onData);
      connection.rejectReady(error);
      if (this.connection === connection) {
        this.rejectCommand?.(error);
        this.eventEmitter.emit("unavailable");
      }
    }
    this.closeConnection(connection);
  }

  private openPort(): Connection {
    if (this.stopped) {
      throw new Error("Selve USB service has shut down");
    }
    if (this.connection) {
      if (this.connection.invalid) {
        throw new Error("Selve USB connection is still closing; try again");
      }
      return this.connection;
    }
    const port = this.serialPortFactory(this.port, 115200);
    let resolveReady!: () => void;
    let rejectReady!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    // Errors may arrive synchronously from a test binding or during shutdown.
    void ready.catch(() => undefined);
    const connection: Connection = {
      port, ready, rejectReady, invalid: false, opening: true, closing: false,
      buffer: "", onData: (data) => this.handleData(connection, data),
    };
    this.connection = connection;
    port.on("data", connection.onData);
    port.on("error", (error: Error) => {
      this.log.error("Selve USB error", error.message);
      this.invalidate(connection, error);
    });
    port.on("close", () => {
      this.invalidate(connection, new Error("Selve USB connection closed"));
    });
    try {
      port.open((error?: Error | null) => {
        connection.opening = false;
        if (error) {
          this.invalidate(connection, error);
        } else if (connection.invalid || this.stopped) {
          this.invalidate(connection, new Error("Selve USB operation was cancelled"));
        } else {
          resolveReady();
        }
      });
    } catch (error) {
      connection.opening = false;
      this.invalidate(connection, error instanceof Error ? error : new Error(String(error)));
    }
    return connection;
  }

  private writeSerial(data: string): Promise<void> {
    const command = this.commandQueue.then(() => this.writeSerialNow(data));
    this.commandQueue = command.catch(() => undefined).then(() =>
      this.stopped ? undefined : new Promise<void>((resolve) => setTimeout(resolve, this.commandDelayMs)));
    return command;
  }

  private writeSerialNow(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let connection: Connection | undefined;
      const finish = (error?: Error | null) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        this.rejectCommand = undefined;
        if (error) {
          if (connection) {
            this.invalidate(connection, error);
          }
          reject(error);
        } else {
          resolve();
        }
      };
      const timeout = setTimeout(() => finish(new Error("Selve USB command timeout")), this.timeoutMs);
      this.rejectCommand = finish;
      try {
        connection = this.openPort();
        const current = connection;
        void current.ready.then(() => {
          // A timed-out open must never send the abandoned command later.
          if (settled || current.invalid || this.stopped) {
            return;
          }
          current.port.write(data, (error?: Error | null) => {
            if (settled) {
              return;
            }
            if (error) {
              finish(error);
            } else {
              current.port.drain(finish);
            }
          });
        }).catch(finish);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public shutdown(): void {
    this.stopped = true;
    const error = new Error("Selve USB service has shut down");
    this.rejectCommand?.(error);
    if (this.connection) {
      this.invalidate(this.connection, error);
    }
  }

  public sendMovePosition(
    device: number,
    targetPos: number
  ): Promise<void> {
    return this.writeSerial(createMovePositionCommand(device, targetPos));
  }

  public sendStop(device: number): Promise<void> {
    return this.writeSerial(createStopCommand(device));
  }

  public sendMoveIntermediatePosition(
    device: number,
    pos: 1 | 2
  ): Promise<void> {
    return this.writeSerial(createMoveIntermediatePositionCommand(device, pos));
  }

  public requestUpdate(device: number): Promise<void> {
    return this.writeSerial(createRequestUpdateCommand(device));
  }
}
