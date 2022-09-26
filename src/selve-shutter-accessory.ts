import {
  AccessoryPlugin,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service,
} from "homebridge";
import { CommeoState, HomebridgeStatusState } from "./data/commeo-state";
import { SelveAcessoryConfig } from "./data/selve-accessory-config";
import { USBRfService } from "./util/usb-rf.service";

export class SelveShutter implements AccessoryPlugin {
  private readonly log: Logging;
  name: string;

  private readonly usbService: USBRfService;
  private readonly informationService: Service;
  private readonly shutterService: Service;
  private readonly intermediate1SwitchService: Service;
  private readonly intermediate2SwitchService: Service;
  private readonly stopSwitchService: Service;
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
    this.intermediate1SwitchService = new hap.Service.Switch(`${this.name} Position 1`, "1");
    this.intermediate2SwitchService = new hap.Service.Switch(`${this.name} Position 2`, "2");
    this.stopSwitchService = new hap.Service.Switch(`${this.name} Stop`, "3");

    // setup shutter services
    this.shutterService
      .getCharacteristic(hap.Characteristic.CurrentPosition)
      .on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => cb(null, this.state.CurrentPosition));

    this.shutterService
      .getCharacteristic(hap.Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => cb(null, this.targetPosition))
      .on(CharacteristicEventTypes.SET, (newPosition: CharacteristicValue, cb: CharacteristicSetCallback) => {
        this.log.info(`[${this.name}] Set new target position to ${newPosition}`);
        this.targetPosition = Number(newPosition);
        this.usbService.sendMovePosition(this.device, this.targetPosition, cb);
      });

    this.shutterService
      .getCharacteristic(hap.Characteristic.PositionState)
      .on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => cb(null, this.state.PositionState));

    this.shutterService
      .getCharacteristic(hap.Characteristic.ObstructionDetected)
      .on(CharacteristicEventTypes.GET, (cb: CharacteristicGetCallback) => cb(null, this.state.ObstructionDetected));

    // setup optional intermediate button services
    this.intermediate1SwitchService
      .getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
        if (!value) {
          return cb();
        }
        this.log.info(`[${this.name}] Set to move to intermediate position 1`);
        this.usbService.sendMoveIntermediatePosition(this.device, 1, cb);

        // toggle off button after some cooldown
        setTimeout(() => {
          this.intermediate1SwitchService.getCharacteristic(hap.Characteristic.On).updateValue(false);
        }, 500);
      });

    this.intermediate2SwitchService
      .getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
        if (!value) {
          return cb();
        }
        this.log.info(`[${this.name}] Set to move to intermediate position 2`);
        this.usbService.sendMoveIntermediatePosition(this.device, 2, cb);

        // toggle off button after some cooldown
        setTimeout(() => {
          this.intermediate2SwitchService.getCharacteristic(hap.Characteristic.On).updateValue(false);
        }, 500);
      });

    this.stopSwitchService
      .getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, cb: CharacteristicSetCallback) => {
        if (!value) {
          return cb();
        }
        this.log.info(`[${this.name}] Set to stop`);
        this.usbService.sendStop(this.device, cb);

        // toggle off button after some cooldown
        setTimeout(() => {
          this.stopSwitchService.getCharacteristic(hap.Characteristic.On).updateValue(false);
        }, 500);
      });

    // setup info service
    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Selve")
      .setCharacteristic(hap.Characteristic.Model, "Selve")
      .setCharacteristic(hap.Characteristic.SerialNumber, this.name);

    // handle status updates
    this.usbService.eventEmitter.on(String(this.device), (newState: CommeoState) => {
      this.log.info(`[${this.name}] New state`, newState);
      this.state = newState;

      this.shutterService.getCharacteristic(hap.Characteristic.PositionState).updateValue(this.state.PositionState);
      this.shutterService
        .getCharacteristic(hap.Characteristic.ObstructionDetected)
        .updateValue(this.state.ObstructionDetected);

      const wasMovedFromExternal = // whether the device was operated from an external source (e.g. switch, other remote)
        (this.state.PositionState === HomebridgeStatusState.INCREASING &&
          this.targetPosition <= this.state.CurrentPosition) ||
        (this.state.PositionState === HomebridgeStatusState.DECREASING &&
          this.targetPosition >= this.state.CurrentPosition);

      if (wasMovedFromExternal) {
        // little hack to correctly show "opening" and "closing" status in Home app
        if (this.state.PositionState === HomebridgeStatusState.INCREASING) {
          this.shutterService
            .getCharacteristic(hap.Characteristic.CurrentPosition)
            .updateValue(Math.max(0, this.state.CurrentPosition - 1));
        } else {
          this.shutterService
            .getCharacteristic(hap.Characteristic.CurrentPosition)
            .updateValue(Math.min(100, this.state.CurrentPosition + 1));
        }
        this.shutterService
          .getCharacteristic(hap.Characteristic.TargetPosition)
          .updateValue(this.state.CurrentPosition);
      } else {
        this.shutterService
          .getCharacteristic(hap.Characteristic.CurrentPosition)
          .updateValue(this.state.CurrentPosition);
      }
      if (this.state.PositionState === HomebridgeStatusState.STOPPED) {
        this.targetPosition = this.state.CurrentPosition;
        this.shutterService
          .getCharacteristic(hap.Characteristic.TargetPosition)
          .updateValue(this.state.CurrentPosition);
      }
    });

    // request current position on startup
    this.usbService.requestUpdate(this.device, (err) => !!err && log.error(err.message));

    this.services = [
      this.informationService,
      this.shutterService,
      config.showIntermediate1 ? this.intermediate1SwitchService : null,
      config.showIntermediate2 ? this.intermediate2SwitchService : null,
      config.showStop ? this.stopSwitchService : null,
    ].filter((s) => !!s) as Array<Service>;

    log.info(`Selve shutter ${this.name} created!`);
  }

  public getServices(): Array<Service> {
    return this.services;
  }
}
