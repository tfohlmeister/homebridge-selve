import { CommeoState } from './util/commeo-state';
import { USBRfService } from './util/usb-rf.service';

require("@babel/polyfill");

let Service: any, Characteristic: any;

export default function(homebridge: any) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-selve-commeo", "Selve", SelveAccessory);
}

class SelveAccessory {
  log: Function;
  usbService: USBRfService;
  state: CommeoState;
  device: number;
  name: string;
  manufacturer: string;
  model: string;
  serial: string;
  informationService;
  shutterService;

  constructor(log, config) {
    this.log = log;
    this.name = config["name"];
    this.manufacturer = config["manufacturer"] || "no manufacturer";
    this.model = config["model"] || "Model not available";
    this.serial = config["serial"] || "Non-defined serial";

    // serial port config
    const port = config["port"];
    if (port === undefined) {
      throw new Error('Option "port" needs to be set');
    }

    // device config
    this.device = Number(config['device']);
    if (this.device === undefined) {
      throw new Error('Option "device" needs to be set');
    }

    this.usbService = USBRfService.getInstance(port, config["baud"]);

    // setup services
    this.shutterService = new Service.WindowCovering(this.name, `shutter`);
    this.state = new CommeoState(this.device);

    this.shutterService
    .getCharacteristic(Characteristic.CurrentPosition)
    .on("get", this.getCurrentPosition.bind(this));

    this.shutterService
    .getCharacteristic(Characteristic.TargetPosition)
    .on("get", this.getTargetPosition.bind(this))
    .on("set", this.setTargetPosition.bind(this));

    this.shutterService
    .getCharacteristic(Characteristic.PositionState)
    .on("get", this.getPositionState.bind(this));

    this.shutterService
    .getCharacteristic(Characteristic.ObstructionDetected)
    .on("get", this.getObstructionDetected.bind(this));


    // setup info service
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);

    // handle status updates
    this.usbService.eventEmitter.on(String(this.device), (newState: Partial<CommeoState>) => {
      log("New status", newState);
      if (newState.CurrentPosition !== undefined) {
        this.shutterService.getCharacteristic(Characteristic.CurrentPosition).setValue(newState.CurrentPosition);
      }
      if (newState.PositionState !== undefined) {
        this.shutterService.getCharacteristic(Characteristic.PositionState).setValue(newState.PositionState);
      }
      if (newState.ObstructionDetected !== undefined) {
        this.shutterService.getCharacteristic(Characteristic.ObstructionDetected).setValue(newState.ObstructionDetected);
      }
      
      // upgrade current state with new data
      this.state = {
        ...this.state,
        ...newState
      }
    });

    // get current position
    this.usbService.requestUpdate(this.device);
  }

  getServices = () => [this.informationService, this.shutterService];

  getCurrentPosition = (cb) => cb(null, this.state.CurrentPosition);
  getTargetPosition = (cb) => cb(null, this.state.TargetPosition);
  setTargetPosition = (newPosition: number, cb: Function) => {
    this.log("Set new target position to", newPosition);
    this.state.TargetPosition = newPosition;
    this.usbService.sendPosition(this.state.device, this.state.TargetPosition, cb);
  };
  getPositionState = (cb) => cb(null, this.state.PositionState);
  getObstructionDetected = (cb) => cb(null, this.state.ObstructionDetected);
}