import events from "events";
import xmlParser from "fast-xml-parser";
import { Logging } from "homebridge";
import SerialPort from "serialport";
import {
  CommeoState,
  CommeoStatusState,
  HomebridgeStatusState,
} from "../data/commeo-state";
import { ErrorValueCallback } from "../data/error-value.callback";
import { SeqqueueTask } from "../data/seqqueue-task";

const seqqueue = require("seq-queue");
const queue = seqqueue.createQueue(100);

const COMMEO_MAX_POSITION = 65535;
const COMMEO_TIMEOUT = 10000;

export class USBRfService {
  private port: string;
  private log: Logging;
  private baud: number = 115200;
  private activePort: SerialPort | undefined;
  private parser: SerialPort.parsers.Delimiter;
  public eventEmitter = new events.EventEmitter();
  private eventString = "";

  constructor(log: Logging, port: string) {
    this.log = log;
    this.port = port;

    this.parser = new SerialPort.parsers.Delimiter({
      delimiter: "\r\n",
    });
    this.parser.on("data", this.handleData.bind(this));
  }

  private handleData(data: Buffer) {
    this.eventString += data.toString();
    if (
      data.toString() === "</methodResponse>" ||
      data.toString() === "</methodCall>"
    ) {
      this.parseXML(this.eventString);
      this.eventString = "";
    }
  }

  private parseXML(input: string) {
    const data = xmlParser.parse(input);
    if (!data.methodCall && !data.methodResponse) {
      this.log.debug("Ignoring unknown format", JSON.stringify(data));
      return;
    } else if (data.methodResponse && data.methodResponse.fault) {
      this.log.error("ERROR", data.methodResponse.fault);
      return;
    } else if (
      (data.methodCall &&
        data.methodCall.methodName !== "selve.GW.event.device") ||
      (data.methodResponse &&
        data.methodResponse.array?.string[0] !== "selve.GW.device.getValues")
    ) {
      this.log.debug("Ignoring unknown message", JSON.stringify(data));
      return;
    }
    const payload = data.methodCall
      ? data.methodCall.array.int
      : data.methodResponse.array.int;
    const device = String(payload[0]);
    const stateStatus: CommeoStatusState = payload[1];
    const PositionState =
      stateStatus === CommeoStatusState.MOVING_UP
        ? HomebridgeStatusState.INCREASING
        : stateStatus === CommeoStatusState.MOVING_DOWN
        ? HomebridgeStatusState.DECREASING
        : HomebridgeStatusState.STOPPED;
    const CurrentPosition = this.convertPositionToHomekit(payload[2]);
    const flags = String(payload[4]).split("");
    const ObstructionDetected =
      flags[0] === "1" || flags[1] === "1" || flags[2] === "1";

    this.eventEmitter.emit(device, {
      CurrentPosition,
      PositionState,
      ObstructionDetected,
    } as CommeoState);
  }

  private openPort(cb: ErrorValueCallback) {
    if (this.activePort !== undefined && this.activePort.isOpen) {
      return cb();
    }
    this.activePort = new SerialPort(
      this.port,
      {
        baudRate: this.baud,
      },
      (err) => {
        if (err) {
          this.log.error(err.message);
          this.activePort = undefined;
          return cb(err);
        } else {
          return cb();
        }
      }
    );
    this.activePort.pipe(this.parser);
  }

  private writeSerial(data: string, cb: ErrorValueCallback) {
    queue.push(
      (task: SeqqueueTask) => {
        this.openPort((error) => {
          if (error) {
            cb(error);
            task.done();
            return;
          }
          this.activePort!.write(data, (err) => {
            cb(err ? err : undefined);
            setTimeout(task.done, 500); // give usb sender time to handle command
          });
        });
      },
      () => cb(new Error("Timeout")),
      COMMEO_TIMEOUT
    );
  }

  private convertPositionToHomekit(commeoPos: number): number {
    return Math.min(
      100,
      Math.round(100 - (commeoPos / COMMEO_MAX_POSITION) * 100)
    );
  }

  private convertPositionToCommeo(homekitPos: number): number {
    return homekitPos > 0
      ? COMMEO_MAX_POSITION -
          Math.min(
            Math.round((homekitPos / 100) * COMMEO_MAX_POSITION),
            COMMEO_MAX_POSITION
          )
      : COMMEO_MAX_POSITION;
  }

  public sendMovePosition(
    device: number,
    targetPos: number,
    cb: ErrorValueCallback
  ): void {
    const commeoTargetPos = this.convertPositionToCommeo(targetPos);
    this.writeSerial(
      `<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>1</int><int>${commeoTargetPos}</int></array></methodCall>`,
      cb
    );
  }

  public sendStop(device: number, cb: ErrorValueCallback): void {
    this.writeSerial(
      `<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>0</int><int>1</int><int>0</int></array></methodCall>`,
      cb
    );
  }

  public sendMoveIntermediatePosition(
    device: number,
    pos: 1 | 2,
    cb: ErrorValueCallback
  ): void {
    this.writeSerial(
      `<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>${
        pos === 1 ? 3 : 5
      }</int><int>1</int><int>0</int></array></methodCall>`,
      cb
    );
  }

  public requestUpdate(device: number, cb: ErrorValueCallback): void {
    this.writeSerial(
      `<methodCall><methodName>selve.GW.device.getValues</methodName><array><int>${device}</int></array></methodCall>`,
      cb
    );
  }
}
