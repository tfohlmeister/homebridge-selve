import {
  type API,
  type DynamicPlatformPlugin,
  type Logging,
  type PlatformAccessory,
} from 'homebridge';
import { SelvePlatformConfig } from './data/selve-platform-config.js';
import { SelveShutter } from './selve-shutter-accessory.js';
import { USBRfService } from './util/usb-rf.service.js';

export const PLUGIN_NAME = 'homebridge-selve';
export const PLATFORM_NAME = 'selve';

export class SelvePlatform implements DynamicPlatformPlugin {
  private readonly accessories = new Map<string, PlatformAccessory>();
  private usbService?: USBRfService;
  private stopped = false;
  private launched = false;

  constructor(
    private readonly log: Logging,
    private readonly config: SelvePlatformConfig,
    private readonly api: API,
  ) {
    api.on('shutdown', () => {
      this.stopped = true;
      this.usbService?.shutdown();
    });
    api.on('didFinishLaunching', () => {
      if (this.stopped || this.launched) {
        return;
      }
      this.launched = true;
      try {
        this.initialize();
      } catch (error) {
        this.usbService?.shutdown();
        for (const accessory of this.accessories.values()) {
          this.markUnavailable(accessory);
        }
        this.log.error('Unable to initialize Selve; cached accessories retained:', String(error));
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.set(accessory.UUID, accessory);
    this.markUnavailable(accessory);
  }

  private markUnavailable(accessory: PlatformAccessory): void {
    const { Characteristic, HAPStatus, HapStatusError, Service } = this.api.hap;
    const unavailable = () => { throw new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE); };
    for (const service of accessory.services) {
      if (service.UUID === Service.WindowCovering.UUID) {
        for (const type of [Characteristic.CurrentPosition, Characteristic.TargetPosition,
          Characteristic.PositionState, Characteristic.ObstructionDetected]) {
          service.getCharacteristic(type).onGet(unavailable);
        }
        service.getCharacteristic(Characteristic.TargetPosition).onSet(unavailable);
        service.updateCharacteristic(Characteristic.CurrentPosition, new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE));
      } else if (service.UUID === Service.Switch.UUID) {
        service.getCharacteristic(Characteristic.On).onGet(unavailable).onSet(unavailable);
      }
    }
  }

  private initialize(): void {
    if (Number(process.versions.node.split('.')[0]) === 26 && !this.api.versionGreaterOrEqual('2.3.0')) {
      this.log.error('Selve on Node.js 26 requires Homebridge 2.3.0 or newer; upgrade Homebridge or use Node.js 24.');
      return;
    }
    // Validate the whole snapshot before opening USB or removing any cached accessory.
    // An explicitly empty array removes shutters; absent or malformed configuration does not.
    if (typeof this.config?.usbPort !== 'string' || !this.config.usbPort.trim() || !Array.isArray(this.config.shutters)) {
      this.log.warn('Selve is inactive: configure usbPort and a shutters array. Cached accessories are retained.');
      return;
    }
    const names = new Set<string>();
    const devices = new Set<number>();
    for (const shutter of this.config.shutters) {
      if (!shutter || typeof shutter.name !== 'string' || !shutter.name.trim() ||
          !Number.isInteger(shutter.device) || shutter.device < 0 || shutter.device > 63 ||
          names.has(shutter.name) || devices.has(shutter.device) ||
          [shutter.showIntermediate1, shutter.showIntermediate2, shutter.showStop]
            .some(value => value !== undefined && typeof value !== 'boolean')) {
        this.log.error('Selve is inactive: shutters need unique names, unique integer device IDs (0–63), and boolean button options. Cached accessories are retained.');
        return;
      }
      names.add(shutter.name);
      devices.add(shutter.device);
    }

    const configured = new Set<string>();
    if (this.config.shutters.length > 0) {
      this.usbService = new USBRfService(this.log, this.config.usbPort);
    }
    for (const shutter of this.config.shutters) {
      // Homebridge's static-platform loader uses `${platformIdentifier}:${name}`.
      // Keep that exact identity, including the qualified alias if present in config.
      const uuid = this.api.hap.uuid.generate(`${this.config.platform || PLATFORM_NAME}:${shutter.name}`);
      configured.add(uuid);
      const cached = this.accessories.get(uuid);
      const accessory = cached ?? new this.api.platformAccessory(shutter.name, uuid);
      new SelveShutter(this.api.hap, this.log, shutter, this.usbService!, accessory);
      if (cached) {
        this.api.updatePlatformAccessories([accessory]);
      } else {
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.set(uuid, accessory);
      }
    }
    const removed = [...this.accessories.values()].filter(accessory => !configured.has(accessory.UUID));
    if (removed.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removed);
      for (const accessory of removed) {
        this.accessories.delete(accessory.UUID);
      }
    }
    this.log.info(`Finished initializing ${configured.size} shutter(s)!`);
  }
}
