import callbackify from './util/callbackify';
import { CommeoState } from './util/commeo-state';
import { wait } from './util/wait';

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
  manufacturer: string;
  model: string;
  serial: string;

  constructor(log, config) {
    this.log = log;
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
      delimiter: '</xml>'
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

      const shutterService = new Service.WindowCovering(name, "shutter");
      const state = new CommeoState(shutterService);

      shutterService
      .getCharacteristic(Characteristic.CurrentPosition)
      .on("get", callbackify(this.getCurrentPosition)(state));

      shutterService
      .getCharacteristic(Characteristic.TargetPosition)
      .on("get", callbackify(this.getTargetPosition)(state))
      .on("set", callbackify(this.setTargetPosition)(state));

      shutterService
      .getCharacteristic(Characteristic.PositionState)
      .on("get", callbackify(this.getPositionState)(state));

      shutterService
      .getCharacteristic(Characteristic.ObstructionDetected)
      .on("get", callbackify(this.getObstructionDetected)(state));

      this.states.push(state);
    }

    // setup info service
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);
  }

  parseXML(data: String) {
    const xml = XmlDocument(data);
    console.log(xml);
  }

  getServices() {
    return [this.informationService, ...this.states.map(srv => srv.service)];
  }

  getCurrentPosition = async (state: CommeoState) => {
    return state.CurrentPosition;
  }

  getTargetPosition = async (state: CommeoState) => {
    return state.TargetPosition;
  }

  setTargetPosition = async (state: CommeoState, newPosition: number) => {
    this.log("Set new position to", newPosition);

    state.TargetPosition = newPosition;

    // TODO

    // We succeeded, so update the "current" state as well.
    // We need to update the current state "later" because Siri can't
    // handle receiving the change event inside the same "set target state"
    // response.
    await wait(1);

    state.service.setCharacteristic(Characteristic.TargetPosition, newPosition);
  };

  getPositionState = async (state: CommeoState) => {
    return state.ObstructionDetected;
  }

  getObstructionDetected = async (state: CommeoState) => {
    return state.ObstructionDetected;
  }
}