import {
  AccessoryPlugin,

  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from 'homebridge';
import { CommeoState } from './data/commeo-state';
import { SelveAcessoryConfig } from './data/selve-accessory-config';
import { USBRfService } from './util/usb-rf.service';



export class SelveShutter implements AccessoryPlugin {
  private readonly log: Logging;
  name: string;


  private readonly usbService: USBRfService;
  private readonly informationService: Service;
  private readonly shutterService: Service;
  private readonly switchService1: Service;
  private readonly switchService2: Service;
  private readonly device: number;
  private state: CommeoState;
  private services: Array<Service>;
  private targetPosition = 100;

  constructor(hap: HAP, log: Logging, config: SelveAcessoryConfig, usbService: USBRfService) {
    this.log = log;
    this.name = config.name;
    this.device = config.device!;
    this.usbService = usbService;

    this.state = new CommeoState();

    // initialize services
    this.shutterService = new hap.Service.WindowCovering(this.name);
    this.informationService = new hap.Service.AccessoryInformation();
    this.switchService1 = new hap.Service.Switch('Position 1', '1');
    this.switchService2 = new hap.Service.Switch('Position 2', '2');

    // setup shutter services
    this.shutterService.getCharacteristic(hap.Characteristic.CurrentPosition)
      .on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback<number>) => cb(null, this.state.CurrentPosition));

    this.shutterService.getCharacteristic(hap.Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback<number>) => cb(null, this.targetPosition))
      .on(CharacteristicEventTypes.SET, (newPosition: CharacteristicValue, cb: CharacteristicSetCallback) => {
        this.log.info(`[${this.name}] Set new target position to ${newPosition}`);
        this.targetPosition = Number(newPosition);
        this.usbService.sendMovePosition(this.device, this.targetPosition, cb)
      });

    this.shutterService.getCharacteristic(hap.Characteristic.PositionState)
      .on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback<number>) => cb(null, this.state.PositionState));

    this.shutterService.getCharacteristic(hap.Characteristic.ObstructionDetected)
      .on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback<boolean>) => cb(null, this.state.ObstructionDetected));

    // setup optional intermediate button services
    this.switchService1.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
        if (!value) return cb();
        this.log.info(`[${this.name}] Set to move to intermediate position 1`);
        this.usbService.sendMoveIntermediatePosition(this.device, 1, cb);
      });

    this.switchService2.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
        if (!value) return cb();
        this.log.info(`[${this.name}] Set to move to intermediate position 2`);
        this.usbService.sendMoveIntermediatePosition(this.device, 2, cb);
      });

    // setup info service
    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Selve")
      .setCharacteristic(hap.Characteristic.Model, "Selve");

    // handle status updates
    this.usbService.eventEmitter.on(String(this.device), (newState: CommeoState) => {
      this.log.info(`[${this.name}] New state`, newState);
      this.state = newState
      this.shutterService.getCharacteristic(hap.Characteristic.CurrentPosition)
        .updateValue(this.state.CurrentPosition);
      this.shutterService.getCharacteristic(hap.Characteristic.PositionState)
        .updateValue(this.state.PositionState);
      this.shutterService.getCharacteristic(hap.Characteristic.ObstructionDetected)
        .updateValue(this.state.ObstructionDetected);

      // little hack to correctly show "opening" and "closing" status in Home app
      if (this.state.PositionState === hap.Characteristic.PositionState.STOPPED) {
        this.shutterService.getCharacteristic(hap.Characteristic.TargetPosition)
          .updateValue(this.state.CurrentPosition);
        this.targetPosition = this.state.CurrentPosition;
      } else if (this.state.PositionState === hap.Characteristic.PositionState.INCREASING) {
        this.shutterService.getCharacteristic(hap.Characteristic.TargetPosition)
          .updateValue(Math.min(100, this.state.CurrentPosition + 1));
      } else {
        this.shutterService.getCharacteristic(hap.Characteristic.TargetPosition)
          .updateValue(Math.max(0, this.state.CurrentPosition - 1));
      }

      // always turn intermediate position switches off
      this.switchService1.getCharacteristic(hap.Characteristic.On)
        .updateValue(false);
      this.switchService2.getCharacteristic(hap.Characteristic.On)
        .updateValue(false);
      
    });

    // request current position on startup
    this.usbService.requestUpdate(this.device, err => !!err && log.error(err.message));

    this.services = [
      this.informationService,
      this.shutterService,
      config.showIntermediate1 ? this.switchService1 : null,
      config.showIntermediate2 ? this.switchService2 : null
    ].filter(s => !!s) as Array<Service>;

    log.info("Selve shutter '%s' created!", this.name);
  }

  public getServices(): Array<Service> {
    return this.services;
  }
}