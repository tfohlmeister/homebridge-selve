require("@babel/polyfill");

const EventEmitter = require('events');
const SerialPort = require('serialport');
const XmlDocument = require('xmldoc').XmlDocument;

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

    constructor(port: string, baud: number = 115200, log: Function) {
        this.port = port;
        this.baud = baud;
        this.log = log;

        const parser = new SerialPort.parsers.Delimiter({
            delimiter: '\r\n' //'</xml>'
        });
        this.activePort = new SerialPort(this.port, {
            baudRate: this.baud
        }, (err) => {
            this.log(err ? err.message : `Port ${this.port} opened.`);
        });
        this.activePort.pipe(parser);
        parser.on('data', this.parseXML.bind(this));
    }

    private parseXML(data: Buffer) {
    
        //console.log(data.toString());
        const util = require('util')
        console.log(util.inspect(data.toString(), {showHidden: true, depth: null}))
        return;
        const xml = XmlDocument(data.toString());
        console.log(xml);

        // update 
        /*shutterService
            .getCharacteristic(Characteristic.ObstructionDetected)

            CurrentPosition: number; // percentage 0 - 100, READ, NOTIFY
            TargetPosition: number; // percentage 0 - 100, READ, WRITE, NOTIFY
            PositionState: HomebridgePositionState; // READ, NOTIFY
            ObstructionDetected: boolean; // READ, NOTIFY

            */

        // this.eventEmitter.emit(new CommeoState())
    }

    public sendPosition(device: number, targetPos: number, cb: Function) {
        const commeoTargetPos = targetPos > 0 ? Math.round(targetPos * 65535 / 100) : 0;
        this.activePort.write(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>${commeoTargetPos}</int><int>0</int></array></methodCall>`, cb);
    }

    public requestUpdate(device: number, cb: Function) {
        this.activePort.write(`<methodCall><methodName>selve.GW.device.getValues</methodName><int>${device}</int></methodCall>`, cb);
    }
}