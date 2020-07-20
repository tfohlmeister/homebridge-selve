"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const fast_xml_parser_1 = __importDefault(require("fast-xml-parser"));
const serialport_1 = __importDefault(require("serialport"));
const commeo_state_1 = require("../data/commeo-state");
const seqqueue = require('seq-queue');
const queue = seqqueue.createQueue(100);
const COMMEO_MAX_POSITION = 65535;
const COMMEO_TIMEOUT = 10000;
class USBRfService {
    constructor(port) {
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
    openPort(cb) {
        if (this.activePort !== undefined && this.activePort.isOpen) {
            return cb();
        }
        this.activePort = new serialport_1.default(this.port, {
            baudRate: this.baud
        }, (err) => {
            if (err) {
                console.error(err.message);
                this.activePort = undefined;
                return cb(err);
            }
            else {
                return cb();
            }
        });
        this.activePort.pipe(this.parser);
    }
    writeSerial(data, cb) {
        queue.push((task) => {
            this.openPort((error) => {
                if (error) {
                    return cb(error);
                }
                this.activePort.write(data, (err) => {
                    cb(err ? err : undefined);
                    setTimeout(task.done, 250); // give device time to settle
                });
            });
        }, () => cb(new Error('Timeout')), COMMEO_TIMEOUT);
    }
    convertPositionToHomekit(commeoPos) {
        return Math.min(100, Math.round(100 - (commeoPos / COMMEO_MAX_POSITION * 100)));
    }
    convertPositionToCommeo(homekitPos) {
        return homekitPos > 0 ? COMMEO_MAX_POSITION - Math.min(Math.round(homekitPos / 100 * COMMEO_MAX_POSITION), COMMEO_MAX_POSITION) : COMMEO_MAX_POSITION;
    }
    sendMovePosition(device, targetPos, cb) {
        const commeoTargetPos = this.convertPositionToCommeo(targetPos);
        this.writeSerial(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>1</int><int>${commeoTargetPos}</int></array></methodCall>`, cb);
    }
    sendStop(device, cb) {
        this.writeSerial(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>0</int><int>1</int><int>0</int></array></methodCall>`, cb);
    }
    sendMoveIntermediatePosition(device, pos, cb) {
        this.writeSerial(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>${pos === 1 ? 3 : 5}</int><int>1</int><int>0</int></array></methodCall>`, cb);
    }
    requestUpdate(device, cb) {
        this.writeSerial(`<methodCall><methodName>selve.GW.device.getValues</methodName><array><int>${device}</int></array></methodCall>`, cb);
    }
}
exports.USBRfService = USBRfService;
/* Make sure we have singletons (each port opens only once) */
USBRfService.instances = new Map();
