import callbackify from './util/callbackify';
import { CommeoPositionState, CommeoState } from './util/commeo-state';

const SerialPort = require('serialport');
const XmlDocument = require('xmldoc').XmlDocument;
require("@babel/polyfill");
const util = require("util");

let Service: any, Characteristic: any;

export default function(homebridge: any) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory("homebridge-selve-commeo", "Selve", SelveAccessory);
}

class SelveAccessory {
  log: Function;
  states: Array<CommeoState>;
  port: String;
  baud: number = 115200;
  activePort: typeof SerialPort;
  informationService;
  name: string;
  manufacturer: string;
  model: string;
  serial: string;

  constructor(log, config) {
    this.log = log;
    this.name = config["name"];
    this.manufacturer = config["manufacturer"] || "no manufacturer";
    this.model = config["model"] || "Model not available";
    this.serial = config["serial"] || "Non-defined serial";

    // setup serial port
    this.port = config["device"];
    if (this.port === undefined) {
      throw new Error('Option "device" needs to be set');
    }
    if (config["baud"]) {
      this.baud = config["baud"];
    }

    const parser = new SerialPort.parsers.Delimiter({
      delimiter: '\r\n' //'</xml>'
    });
    this.activePort = new SerialPort(this.port, {
      baudRate: this.baud
    });
    this.activePort.pipe(parser);
    this.activePort.on('open', () => this.log('USB-RF port open'));
    parser.on('data', this.parseXML.bind(this));

    // setup services
    this.states = new Array<CommeoState>();
    for(let channel = 1; channel<65; channel++) {
      const name = config[`channel${channel}`];
      if (name === undefined) continue;
      log(name);
      log(channel);
      const shutterService = new Service.WindowCovering(`${name} ${this.name}`, `shutter${channel}`);
      const state = new CommeoState(channel, shutterService);

      shutterService
      .getCharacteristic(Characteristic.CurrentPosition)
      .on("get", this.getCurrentPosition(state));

      shutterService
      .getCharacteristic(Characteristic.TargetPosition)
      .on("get", this.getTargetPosition(state))
      .on("set", this.setTargetPosition(state));

      shutterService
      .getCharacteristic(Characteristic.PositionState)
      .on("get", this.getPositionState(state));

      shutterService
      .getCharacteristic(Characteristic.ObstructionDetected)
      .on("get", this.getObstructionDetected(state));

      this.states.push(state);
    }

    // setup info service
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);
  }

  getServices() {
    return [this.informationService, ...this.states.map(srv => srv.service)]; 
  }

  getCurrentPosition = (state: CommeoState) => {
    return (cb) => cb(state.CurrentPosition);
  }

  getTargetPosition = (state: CommeoState) => {
    return (cb) => cb(state.TargetPosition);
  }

  setTargetPosition = (state: CommeoState) => {
    return callbackify(async (newPosition: number) => {
      this.log("Set new position to", newPosition);

      state.TargetPosition = newPosition;

      // TODO
      this.sendXML(state.channel, state.toCommeoState());


      // We succeeded, so update the "current" state as well.
      // We need to update the current state "later" because Siri can't
      // handle receiving the change event inside the same "set target state"
      // response.
      //await wait(1);

      //state.service.setCharacteristic(Characteristic.TargetPosition, newPosition);
    });
  };

  getPositionState = (state: CommeoState) => {
    return (cb) => cb(state.PositionState);
  }

  getObstructionDetected = (state: CommeoState) => {
    return (cb) => cb(state.ObstructionDetected);
  }

  private parseXML(data: Buffer) {
    
    //console.log(data.toString());
    const util = require('util')
    console.log(util.inspect(data.toString(), {showHidden: true, depth: null}))
    return;
    const xml = XmlDocument(data.toString());
    console.log(xml);
  }

  private sendXML(channel: number, dir: CommeoPositionState) {

    const result = this.activePort.write(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${channel}</int><int>${dir}</int><int>1</int><int>0</int></array></methodCall>`);
    console.log(result);
  }
}