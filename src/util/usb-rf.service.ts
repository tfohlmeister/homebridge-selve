import { CommeoState, HomebridgePositionState } from './commeo-state';

require("@babel/polyfill");

const EventEmitter = require('events');
const SerialPort = require('serialport');
const xmlParser = require('fast-xml-parser');
const seqqueue = require('seq-queue');

const queue = seqqueue.createQueue(100);
const maxPosition = 65535;
const timeout = 10000;

export class USBRfService {
    /* Make sure we have singletons (each port opens only once) */
    static instances = new Map<string, USBRfService>();
    static getInstance(port: string, baud: number): USBRfService {
        if (this.instances.get(port) !== undefined) {
            return this.instances.get(port) as USBRfService;
        } else {
            const instance = new USBRfService(port, baud);
            this.instances.set(port, instance);
            return instance;
        }
    }

    private port: string;
    private baud: number;
    private activePort;
    private parser;
    public eventEmitter = new EventEmitter();
    private eventString = '';

    constructor(port: string, baud: number = 115200) {
        this.port = port;
        this.baud = baud;

        this.parser = new SerialPort.parsers.Delimiter({
            delimiter: '\r\n'
        });
        this.parser.on('data', this.handleData.bind(this));
    }

    private handleData(data: Buffer) {
        this.eventString += data.toString();
        if (data.toString() === '</methodResponse>' || data.toString() === '</methodCall>') {
            this.parseXML(this.eventString);
            this.eventString = '';
        }
    }

    private parseXML(input: string) {
        const data = xmlParser.parse(input);
        if (!data.methodCall && !data.methodResponse) {
            console.log("Ignoring", data);
            return;
        } else if (data.methodResponse && data.methodResponse.fault) {
            console.error('ERROR', data.methodResponse.fault);
            return;
        }
        const payload = data.methodCall ? data.methodCall.array.int : data.methodResponse.array.int;

        const device = payload[0];
        const PositionState = payload[1] === 1 ? HomebridgePositionState.STOPPED
            : payload[1] === 2 ? HomebridgePositionState.DECREASING
            : HomebridgePositionState.INCREASING
        const CurrentPosition = Math.min(100, Math.round(100 - (payload[2] / maxPosition * 100)));
        const flags = String(payload[4]).split('');
        const ObstructionDetected = flags[0] === '1' || flags[1] === '1' || flags[2] === '1';
        
        this.eventEmitter.emit(String(device), {
            CurrentPosition,
            PositionState,
            ObstructionDetected
        } as Partial<CommeoState>);
    }

    private openPort(cb: Function = () => {}) {
        if (this.activePort !== undefined && this.activePort.isOpen) {
            return cb(true);
        }
        this.activePort = new SerialPort(this.port, {
            baudRate: this.baud
        }, (err) => {
            if (err) {
                console.error(err.message);
                this.activePort = undefined;
                return cb(false);
            } else {
                return cb(true);
            }
        });
        this.activePort.pipe(this.parser);
    }

    private write(data: string, cb: Function) {
        queue.push((task) => {
            this.openPort((isOpen) => {
                if (isOpen) {
                    this.activePort.write(data, (err) => {
                        cb(null, err);
                        setTimeout(task.done, 250); // give device time to settle
                    });
                } else {
                    cb(new Error("Port not open"));
                    task.done();
                }
            });
        }, () => cb(new Error("Timeout")), timeout);
    }

    public sendPosition(device: number, targetPos: number, cb: Function = () => {}) {
        const commeoTargetPos = targetPos > 0 ? maxPosition - Math.min(Math.round(targetPos / 100 * maxPosition), maxPosition) : maxPosition;
        this.write(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>1</int><int>${commeoTargetPos}</int></array></methodCall>`, cb);
    }

    public requestUpdate(device: number, cb: Function = () => {}) {
        this.write(`<methodCall><methodName>selve.GW.device.getValues</methodName><array><int>${device}</int></array></methodCall>`, cb);
    }
}