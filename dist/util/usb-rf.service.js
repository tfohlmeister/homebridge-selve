"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const fast_xml_parser_1 = __importDefault(require("fast-xml-parser"));
const queue_1 = __importDefault(require("queue"));
const serialport_1 = __importDefault(require("serialport"));
const commeo_state_1 = require("../data/commeo-state");
const wait_1 = require("./wait");
const COMMEO_MAX_POSITION = 65535;
class USBRfService {
    constructor(port) {
        // queue to safely handle multiple commands. Timeout 15 seconds.
        this.q = queue_1.default({ concurrency: 1, autostart: true, timeout: 15 * 1000 });
        this.baud = 115200;
        this.eventEmitter = new events_1.default.EventEmitter();
        this.eventString = '';
        this.port = port;
        this.parser = new serialport_1.default.parsers.Delimiter({
            delimiter: '\r\n'
        });
        this.parser.on('data', this.handleData.bind(this));
    }
    static getInstance(port) {
        if (this.instances.get(port) !== undefined) {
            return this.instances.get(port);
        }
        else {
            const instance = new USBRfService(port);
            this.instances.set(port, instance);
            return instance;
        }
    }
    handleData(data) {
        this.eventString += data.toString();
        if (data.toString() === '</methodResponse>' || data.toString() === '</methodCall>') {
            this.parseXML(this.eventString);
            this.eventString = '';
        }
    }
    parseXML(input) {
        const data = fast_xml_parser_1.default.parse(input);
        if (!data.methodCall && !data.methodResponse) {
            console.log("Ignoring", data);
            return;
        }
        else if (data.methodResponse && data.methodResponse.fault) {
            console.error('ERROR', data.methodResponse.fault);
            return;
        }
        const payload = data.methodCall ? data.methodCall.array.int : data.methodResponse.array.int;
        const device = String(payload[0]);
        const PositionState = payload[1] === 1 ? commeo_state_1.HomebridgePositionState.STOPPED
            : payload[1] === 2 ? commeo_state_1.HomebridgePositionState.DECREASING
                : commeo_state_1.HomebridgePositionState.INCREASING;
        const CurrentPosition = this.convertPositionToHomekit(payload[2]);
        const flags = String(payload[4]).split('');
        const ObstructionDetected = flags[0] === '1' || flags[1] === '1' || flags[2] === '1';
        this.eventEmitter.emit(device, {
            CurrentPosition,
            PositionState,
            ObstructionDetected
        });
    }
    openPort() {
        return new Promise((resolve, reject) => {
            if (this.activePort !== undefined && this.activePort.isOpen) {
                return resolve();
            }
            this.activePort = new serialport_1.default(this.port, {
                baudRate: this.baud
            }, (err) => {
                if (err) {
                    this.activePort = undefined;
                    return reject(err.message);
                }
                else {
                    return resolve();
                }
            });
            this.activePort.pipe(this.parser);
        });
    }
    writeSerial(data) {
        return new Promise((resolve, reject) => {
            const job = () => this.openPort()
                .then(() => {
                return new Promise((writeResolve, writeReject) => {
                    this.activePort.write(data, error => {
                        if (error) {
                            return writeReject(error);
                        }
                        writeResolve();
                    });
                });
            })
                .then((res) => {
                resolve();
                return wait_1.wait(100); // give device time to settle
            })
                .catch(error => {
                reject(error);
                throw new Error(error);
            });
            this.q.push(job);
        });
    }
    convertPositionToHomekit(commeoPos) {
        return Math.min(100, Math.round(100 - (commeoPos / COMMEO_MAX_POSITION * 100)));
    }
    convertPositionToCommeo(homekitPos) {
        return homekitPos > 0 ? COMMEO_MAX_POSITION - Math.min(Math.round(homekitPos / 100 * COMMEO_MAX_POSITION), COMMEO_MAX_POSITION) : COMMEO_MAX_POSITION;
    }
    sendPosition(device, targetPos) {
        const commeoTargetPos = this.convertPositionToCommeo(targetPos);
        return this.writeSerial(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>1</int><int>${commeoTargetPos}</int></array></methodCall>`);
    }
    requestUpdate(device) {
        return this.writeSerial(`<methodCall><methodName>selve.GW.device.getValues</methodName><array><int>${device}</int></array></methodCall>`);
    }
}
exports.USBRfService = USBRfService;
/* Make sure we have singletons (each port opens only once) */
USBRfService.instances = new Map();
