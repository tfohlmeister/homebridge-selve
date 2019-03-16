import { HomebridgePositionState } from './commeo-state';

require("@babel/polyfill");

const EventEmitter = require('events');
const SerialPort = require('serialport');
const parser = require('fast-xml-parser');

const maxPosition = 65535;

export class USBRfService {
    /* Make sure we have singletons (each port opens only once) */
    static instances = new Map<string, USBRfService>();
    static getInstance(port: string, baud: number, log: Function): USBRfService {
        if (this.instances.get(port) !== undefined) {
            return this.instances.get(port) as USBRfService;
        } else {
            const instance = new USBRfService(port, baud, log);
            this.instances.set(port, instance);
            return instance;
        }
    }

    private port: string;
    private baud: number;
    private activePort;
    private log: Function;
    public eventEmitter = new EventEmitter();
    private eventString = '';

    constructor(port: string, baud: number = 115200, log: Function) {
        this.port = port;
        this.baud = baud;
        this.log = log;

        const parser = new SerialPort.parsers.Delimiter({
            delimiter: '\r\n'
        });
        parser.on('data', this.handleData.bind(this));
        this.openPort();
    }

    private handleData(data: Buffer) {
        this.eventString += data.toString();
        if (data.toString() === '</methodResponse>') {
            this.eventString = '';
        } else if (data.toString() === '</methodCall>') {
            this.parseXML(this.eventString);
            this.eventString = '';
        }
    }

    private parseXML(input: string) {
        const data = parser.parse(input);
        if (!data.methodCall || data.methodCall.methodName !== 'selve.GW.event.device') {
            return;
        }
        const payload = data.methodCall.array.int;

        const device = payload[0];
        const PositionState = payload[1] === 1 ? HomebridgePositionState.STOPPED
            : payload[1] === 2 ? HomebridgePositionState.DECREASING
            : HomebridgePositionState.INCREASING
        const CurrentPosition = Math.min(100, Math.round(100 - (payload[2] / maxPosition * 100)));
        const flags = String(payload[4]).split('');
        const ObstructionDetected = flags[0] === '1' || flags[1] === '1' || flags[2] === '1';
        
        this.eventEmitter.emit(device, {
            CurrentPosition,
            PositionState,
            ObstructionDetected
        });
    }

    private openPort(cb: Function = () => {}) {
        if (this.activePort !== undefined && this.activePort.isOpen) {
            cb(true);
            return
        }
        this.activePort = new SerialPort(this.port, {
            baudRate: this.baud
        }, (err) => {
            if (err) {
                this.log(err.message);
                this.activePort = undefined;
            } else {
                this.log(`Port ${this.port} opened.`);
                this.activePort.pipe(parser);
            }
            cb(!!!err);
        });
    }

    public sendPosition(device: number, targetPos: number, cb: Function = () => {}) {
        const commeoTargetPos = targetPos > 0 ? maxPosition - Math.min(Math.round(targetPos / 100 * maxPosition), maxPosition) : maxPosition;
        this.openPort(() => {
            this.activePort.write(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>1</int><int>${commeoTargetPos}</int></array></methodCall>`, cb);
        });
    }

    public requestUpdate(device: number, cb: Function = () => {}) {
        this.openPort(() => {
            this.activePort.write(`<methodCall><methodName>selve.GW.device.getValues</methodName><int>${device}</int></methodCall>`, cb);
        });
    }
}