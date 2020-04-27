import events from 'events';
import xmlParser from 'fast-xml-parser';
import queue from 'queue';
import SerialPort from 'serialport';
import { promisify } from 'util';

import { CommeoState, HomebridgePositionState } from '../data/commeo-state';
import { wait } from './wait';


const COMMEO_MAX_POSITION = 65535;

export class USBRfService {
    /* Make sure we have singletons (each port opens only once) */
    static instances = new Map<string, USBRfService>();
    static getInstance(port: string): USBRfService {
        if (this.instances.get(port) !== undefined) {
            return this.instances.get(port) as USBRfService;
        } else {
            const instance = new USBRfService(port);
            this.instances.set(port, instance);
            return instance;
        }
    }

    // queue to safely handle multiple commands. Timeout 15 seconds.
    private q = queue({ concurrency: 1, autostart: true, timeout: 15 * 1000 });
    private port: string;
    private baud: number = 115200;
    private activePort: SerialPort | undefined;
    private parser: SerialPort.parsers.Delimiter;
    public eventEmitter = new events.EventEmitter();
    private eventString = '';

    constructor(port: string) {
        this.port = port;

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

        const device = String(payload[0]);
        const PositionState = payload[1] === 1 ? HomebridgePositionState.STOPPED
            : payload[1] === 2 ? HomebridgePositionState.DECREASING
            : HomebridgePositionState.INCREASING
        const CurrentPosition = this.convertPositionToHomekit(payload[2]);
        const flags = String(payload[4]).split('');
        const ObstructionDetected = flags[0] === '1' || flags[1] === '1' || flags[2] === '1';
        
        this.eventEmitter.emit(device, {
            CurrentPosition,
            PositionState,
            ObstructionDetected
        } as Partial<CommeoState>);
    }

    private openPort(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.activePort !== undefined && this.activePort.isOpen) {
                return resolve();
            }

            this.activePort = new SerialPort(this.port, {
                baudRate: this.baud
            }, (err) => {
                if (err) {
                    this.activePort = undefined;
                    return reject(err.message);
                } else {
                    return resolve();
                }
            });
            this.activePort.pipe(this.parser);
        })        
    }

    private writeSerial(data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const job = () => this.openPort()
            .then(() => {
                return promisify(this.activePort!.write)(data) as Promise<void>;
            })
            .then(() => {
                resolve();
                return wait(100); // give device time to settle
            })
            .catch(error => {
                reject(error);
                throw Error(error);
            });

            this.q.push(job);
        });
    }

    private convertPositionToHomekit(commeoPos: number) : number {
        return Math.min(100, Math.round(100 - (commeoPos / COMMEO_MAX_POSITION * 100)));
    }

    private convertPositionToCommeo(homekitPos: number): number {
        return homekitPos > 0 ? COMMEO_MAX_POSITION - Math.min(Math.round(homekitPos / 100 * COMMEO_MAX_POSITION), COMMEO_MAX_POSITION) : COMMEO_MAX_POSITION;
    }

    public sendPosition(device: number, targetPos: number): Promise<void> {
        const commeoTargetPos = this.convertPositionToCommeo(targetPos);
        return this.writeSerial(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>1</int><int>${commeoTargetPos}</int></array></methodCall>`);
    }

    public requestUpdate(device: number): Promise<void> {
        return this.writeSerial(`<methodCall><methodName>selve.GW.device.getValues</methodName><array><int>${device}</int></array></methodCall>`);
    }
}