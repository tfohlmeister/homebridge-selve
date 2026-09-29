import {
  type API,
  type DynamicPlatformPlugin,
  type Logging,
  type PlatformAccessory,
} from 'homebridge';
import { SelveAcessoryConfig } from './data/selve-accessory-config.js';
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
    const shutters: SelveAcessoryConfig[] = [];
    let hasInvalidEntries = false;
    for (const [index, shutter] of this.config.shutters.entries()) {
      const validName = typeof shutter?.name === 'string' && shutter.name.trim().length > 0;
      const validDevice = Number.isInteger(shutter?.device) && shutter.device >= 0 && shutter.device <= 63;
      const label = `shutters[${index}]${validName ? ` (${JSON.stringify(shutter.name)})` : ''}`;
      if (validName && names.has(shutter.name)) {
        this.log.error(`Selve is inactive: ${label} has a duplicate name. Names must be unique; cached accessories are retained.`);
        return;
      }
      if (validDevice && devices.has(shutter.device)) {
        this.log.error(`Selve is inactive: ${label} has duplicate device ID ${shutter.device}. Device IDs must be unique; cached accessories are retained.`);
        return;
      }
      if (validName) {
        names.add(shutter.name);
      }
      if (validDevice) {
        devices.add(shutter.device);
      }
      if (!validName || !validDevice) {
        hasInvalidEntries = true;
        const reason = !validName ? 'name must be a non-empty string' : 'device must be an integer from 0 to 63';
        this.log.error(`Skipping ${label}: ${reason}. Valid shutters will run; cached accessories will not be removed until settings are corrected.`);
        continue;
      }

      const normalized = {...shutter};
      for (const option of ['showIntermediate1', 'showIntermediate2', 'showStop'] as const) {
        if (shutter[option] !== undefined && typeof shutter[option] !== 'boolean') {
          this.log.warn(`${label}: ${option} must be a boolean; preserving the legacy ${shutter[option] ? 'enabled' : 'disabled'} behavior. Use true or false in the configuration.`);
        }
        normalized[option] = Boolean(shutter[option]);
      }
      shutters.push(normalized);
    }

    const configured = new Set<string>();
    if (shutters.length > 0) {
      this.usbService = new USBRfService(this.log, this.config.usbPort);
    }
    for (const shutter of shutters) {
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
    // An invalid entry may refer to a cached shutter whose identity we cannot
    // recover. Only prune against a fully valid configuration snapshot.
    const removed = hasInvalidEntries ? [] : [...this.accessories.values()].filter(accessory => !configured.has(accessory.UUID));
    if (removed.length > 0) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removed);
      for (const accessory of removed) {
        this.accessories.delete(accessory.UUID);
      }
    }
    this.log.info(`Finished initializing ${configured.size} shutter(s)!`);
  }
}
