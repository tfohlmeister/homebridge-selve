import {
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from 'homebridge';
import { CommeoState, HomebridgePositionState } from './data/commeo-state';
import { SelveShutterAcessoryConfig } from './data/selve-config';
import { USBRfService } from './util/usb-rf.service';


let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("Selve", SelveShutter);
};

class SelveShutter implements AccessoryPlugin {
  private readonly log: Logging;
  private readonly usbService: USBRfService;
  private readonly informationService: Service;
  private readonly shutterService: Service;
  private readonly switchService1: Service;
  private readonly switchService2: Service;
  private readonly device: number;
  private readonly name: string;
  private readonly config: SelveShutterAcessoryConfig;
  private state: CommeoState;

  constructor(log: Logging, config: SelveShutterAcessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.config = config;

    // device config
    this.device = Number(config.device);
    if (this.device === undefined) {
      throw new Error('Option "device" is required and needs to be set!');
    }

    // serial port config
    const port = config.port;
    if (port === undefined) {
      throw new Error('Option "port" is required and needs to be set!');
    }

    this.state = new CommeoState(this.device);

    // initialize services
    this.usbService = USBRfService.getInstance(port);

    this.shutterService = new hap.Service.WindowCovering(this.name);
    this.informationService = new hap.Service.AccessoryInformation();
    this.switchService1 = new hap.Service.StatelessProgrammableSwitch(this.name);
    this.switchService2 = new hap.Service.StatelessProgrammableSwitch(this.name);

    // setup shutter services
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

    // setup optional intermediate button services
    this.switchService1
      .getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent)
      .on(CharacteristicEventTypes.SET, this.setIntermediatePosition(1).bind(this))

    this.switchService2
      .getCharacteristic(hap.Characteristic.ProgrammableSwitchEvent)
      .on(CharacteristicEventTypes.SET, this.setIntermediatePosition(2).bind(this))

    // setup info service
    this.informationService = new hap.Service.AccessoryInformation();
    if (config.manufacturer) {
      this.informationService.setCharacteristic(hap.Characteristic.Manufacturer, config.manufacturer);
    }
    if (config.model) {
      this.informationService.setCharacteristic(hap.Characteristic.Model, config.model);
    }
    if (config.serial) {
      this.informationService.setCharacteristic(hap.Characteristic.SerialNumber, config.serial);
    }

    // handle status updates
    this.usbService.eventEmitter.on(String(this.device), (newState: Partial<CommeoState>) => {
      log("New status", newState);
      if (newState.CurrentPosition !== undefined) {
        this.shutterService.getCharacteristic(hap.Characteristic.CurrentPosition).setValue(newState.CurrentPosition);
      }
      if (newState.PositionState !== undefined) {
        this.shutterService.getCharacteristic(hap.Characteristic.PositionState).setValue(newState.PositionState);
      }
      if (newState.ObstructionDetected !== undefined) {
        this.shutterService.getCharacteristic(hap.Characteristic.ObstructionDetected).setValue(newState.ObstructionDetected);
      }
      
      // upgrade current state with new data
      this.state = {
        ...this.state,
        ...newState
      }
    });

    // request current position
    this.usbService.requestUpdate(this.device, err => !!err && log.error(err.message));
  }

  public getServices(): Array<Service> {
    return [
      this.informationService,
      this.shutterService,
      this.config.showIntermediate1 ? this.switchService1 : null,
      this.config.showIntermediate2 ? this.switchService2 : null
    ].filter(s => !!s) as Array<Service>;
  }

  private getCurrentPosition = (cb: CharacteristicGetCallback<number>) => cb(null, this.state.CurrentPosition);
  private getTargetPosition = (cb: CharacteristicGetCallback<number>) => cb(null, this.state.TargetPosition);
  private setTargetPosition = (newPosition: CharacteristicValue, cb: CharacteristicSetCallback) => {
    this.log("Set new target position to", newPosition);
    this.state.TargetPosition = Number(newPosition);
    this.usbService.sendMovePosition(this.state.device, this.state.TargetPosition, cb)
  };
  private setIntermediatePosition = (pos: 1 | 2) => (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
    if (!value) {
      return cb();
    }

    this.log("Set to move to intermediate position", pos);
    this.usbService.sendMoveIntermediatePosition(this.state.device, pos, cb);
  };

  private getPositionState = (cb: CharacteristicGetCallback<HomebridgePositionState>) => cb(null, this.state.PositionState);
  private getObstructionDetected = (cb: CharacteristicGetCallback<boolean>) => cb(null, this.state.ObstructionDetected);
}