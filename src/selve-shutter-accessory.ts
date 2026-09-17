import {
  type AccessoryPlugin,
  type CharacteristicValue,
  type HAP,
  type Logging,
  type Service,
} from "homebridge";
import { CommeoState, HomebridgeStatusState } from "./data/commeo-state.js";
import { SelveAcessoryConfig } from "./data/selve-accessory-config.js";
import { USBRfService } from "./util/usb-rf.service.js";

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
  private stateKnown = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryDelayMs = 1000;
  private updatePending = false;
  private stopped = false;
  private targetRevision = 0;

  constructor(hap: HAP, log: Logging, config: SelveAcessoryConfig, usbService: USBRfService) {
    this.log = log;
    this.name = config.name;
    this.device = config.device;
    this.usbService = usbService;

    this.state = new CommeoState();

    this.shutterService = new hap.Service.WindowCovering(this.name);
    this.informationService = new hap.Service.AccessoryInformation();
    this.intermediate1SwitchService = new hap.Service.Switch(`${this.name} Position 1`, "1");
    this.intermediate2SwitchService = new hap.Service.Switch(`${this.name} Position 2`, "2");
    this.stopSwitchService = new hap.Service.Switch(`${this.name} Stop`, "3");

    const requireState = () => {
      if (!this.stateKnown) {
        throw new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      }
    };
    this.usbService.eventEmitter.on("unavailable", () => {
      this.stateKnown = false;
      this.shutterService.updateCharacteristic(hap.Characteristic.CurrentPosition,
        new hap.HapStatusError(hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
      this.scheduleUpdate();
    });
    this.usbService.eventEmitter.once("shutdown", () => {
      this.stopped = true;
      clearTimeout(this.retryTimer);
    });

    this.shutterService
      .getCharacteristic(hap.Characteristic.CurrentPosition)
      .onGet(() => { requireState(); return this.state.CurrentPosition; });

    this.shutterService
      .getCharacteristic(hap.Characteristic.TargetPosition)
      .onGet(() => { requireState(); return this.targetPosition; })
      .onSet(async (newPosition: CharacteristicValue) => {
        this.log.info(`[${this.name}] Set new target position to ${newPosition}`);
        const previousTarget = this.targetPosition;
        const revision = ++this.targetRevision;
        this.targetPosition = Number(newPosition);
        try {
          await this.usbService.sendMovePosition(this.device, this.targetPosition);
        } catch (error) {
          if (this.targetRevision === revision) {
            this.targetPosition = previousTarget;
          }
          throw error;
        }
      });

    this.shutterService
      .getCharacteristic(hap.Characteristic.PositionState)
      .onGet(() => { requireState(); return this.state.PositionState; });

    this.shutterService
      .getCharacteristic(hap.Characteristic.ObstructionDetected)
      .onGet(() => { requireState(); return this.state.ObstructionDetected; });

    this.intermediate1SwitchService
      .getCharacteristic(hap.Characteristic.On)
      .onSet(async (value: CharacteristicValue) => {
        if (!value) {
          return;
        }
        this.log.info(`[${this.name}] Set to move to intermediate position 1`);
        try {
          await this.usbService.sendMoveIntermediatePosition(this.device, 1);
        } finally {
          setTimeout(() => {
            this.intermediate1SwitchService.getCharacteristic(hap.Characteristic.On).updateValue(false);
          }, 500);
        }
      });

    this.intermediate2SwitchService
      .getCharacteristic(hap.Characteristic.On)
      .onSet(async (value: CharacteristicValue) => {
        if (!value) {
          return;
        }
        this.log.info(`[${this.name}] Set to move to intermediate position 2`);
        try {
          await this.usbService.sendMoveIntermediatePosition(this.device, 2);
        } finally {
          setTimeout(() => {
            this.intermediate2SwitchService.getCharacteristic(hap.Characteristic.On).updateValue(false);
          }, 500);
        }
      });

    this.stopSwitchService
      .getCharacteristic(hap.Characteristic.On)
      .onSet(async (value: CharacteristicValue) => {
        if (!value) {
          return;
        }
        this.log.info(`[${this.name}] Set to stop`);
        try {
          await this.usbService.sendStop(this.device);
        } finally {
          setTimeout(() => {
            this.stopSwitchService.getCharacteristic(hap.Characteristic.On).updateValue(false);
          }, 500);
        }
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Selve")
      .setCharacteristic(hap.Characteristic.Model, "Selve")
      .setCharacteristic(hap.Characteristic.SerialNumber, this.name);

    this.usbService.eventEmitter.on(String(this.device), (newState: CommeoState) => {
      this.log.info(`[${this.name}] New state`, newState);
      this.state = newState;
      this.stateKnown = true;
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
      this.retryDelayMs = 1000;

      this.shutterService.getCharacteristic(hap.Characteristic.PositionState).updateValue(this.state.PositionState);
      this.shutterService
        .getCharacteristic(hap.Characteristic.ObstructionDetected)
        .updateValue(this.state.ObstructionDetected);

      const wasMovedFromExternal =
        (this.state.PositionState === HomebridgeStatusState.INCREASING &&
          this.targetPosition <= this.state.CurrentPosition) ||
        (this.state.PositionState === HomebridgeStatusState.DECREASING &&
          this.targetPosition >= this.state.CurrentPosition);

      if (wasMovedFromExternal) {
        // Offset the current position so Home shows movement triggered by another remote.
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
        this.targetRevision++;
        this.targetPosition = this.state.CurrentPosition;
        this.shutterService
          .getCharacteristic(hap.Characteristic.TargetPosition)
          .updateValue(this.state.CurrentPosition);
      }
    });

    void this.requestUpdate();

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

  private scheduleUpdate(): void {
    if (this.stopped || this.stateKnown || this.updatePending || this.retryTimer) {
      return;
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.requestUpdate();
    }, this.retryDelayMs);
    this.retryTimer.unref();
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, 30000);
  }

  private async requestUpdate(): Promise<void> {
    this.updatePending = true;
    try {
      await this.usbService.requestUpdate(this.device);
    } catch (error) {
      if (!this.stopped) {
        this.log.warn(`[${this.name}] Status request failed; retrying`, String(error));
      }
    } finally {
      this.updatePending = false;
      this.scheduleUpdate();
    }
  }
}
