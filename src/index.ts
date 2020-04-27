import {
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
} from 'homebridge';

import { CommeoState, HomebridgePositionState } from './data/commeo-state';
import { SelveShutterAcessoryConfig } from './data/selve-config';
import { USBRfService } from './util/usb-rf.service';

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("SelveShutter", SelveShutter);
};

class SelveShutter implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly usbService: USBRfService;
  private readonly informationService: Service;
  private readonly shutterService: Service;
  private readonly device: number;
  private readonly name: string;
  private state: CommeoState;

  constructor(log: Logging, config: SelveShutterAcessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    // device config
    this.device = Number(config.device);
    if (this.device === undefined) {
      throw new Error('Option "device" needs to be set');
    }

    // serial port config
    const port = config.port;
    if (port === undefined) {
      throw new Error('Option "port" needs to be set');
    }
    const baud = Number(config.baud);
    if (baud === undefined) {
      throw new Error('Option "baud" needs to be set');
    }

    this.state = new CommeoState(this.device);

    // setup services
    this.usbService = USBRfService.getInstance(port, baud);
    this.shutterService = new hap.Service.WindowCovering(this.name);
    this.informationService = new hap.Service.AccessoryInformation();

    this.shutterService
      .getCharacteristic(hap.Characteristic.CurrentPosition)
      .on(CharacteristicEventTypes.GET, this.getCurrentPosition.bind(this));

    this.shutterService
      .getCharacteristic(hap.Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.GET, this.getTargetPosition.bind(this))
      .on(CharacteristicEventTypes.SET, this.setTargetPosition.bind(this));

    this.shutterService
      .getCharacteristic(hap.Characteristic.PositionState)
      .on(CharacteristicEventTypes.GET, this.getPositionState.bind(this));

    this.shutterService
      .getCharacteristic(hap.Characteristic.ObstructionDetected)
      .on(CharacteristicEventTypes.GET, this.getObstructionDetected.bind(this));


    // setup info service
    this.informationService = new Service.AccessoryInformation();
    if (config.manufacturer) {
      this.informationService.setCharacteristic(Characteristic.Manufacturer, config.manufacturer);
    }
    if (config.model) {
      this.informationService.setCharacteristic(Characteristic.Model, config.model);
    }
    if (config.serial) {
      this.informationService.setCharacteristic(Characteristic.SerialNumber, config.serial);
    }

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

  getCurrentPosition = (cb: CharacteristicGetCallback<number>) => cb(null, this.state.CurrentPosition);
  getTargetPosition = (cb: CharacteristicGetCallback<number>) => cb(null, this.state.TargetPosition);
  setTargetPosition = (newPosition: CharacteristicValue, cb: CharacteristicSetCallback) => {
    this.log("Set new target position to", newPosition);
    this.state.TargetPosition = Number(newPosition);
    this.usbService.sendPosition(this.state.device, this.state.TargetPosition)
      .then(() => cb())
      .catch(error => cb(error));
  };
  getPositionState = (cb: CharacteristicGetCallback<HomebridgePositionState>) => cb(null, this.state.PositionState);
  getObstructionDetected = (cb: CharacteristicGetCallback<boolean>) => cb(null, this.state.ObstructionDetected);
}