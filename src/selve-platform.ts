import {
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  StaticPlatformPlugin,
} from "homebridge";
import { SelvePlatformConfig } from "./data/selve-platform-config";
import { SelveShutter } from "./selve-shutter-accessory";
import { USBRfService } from "./util/usb-rf.service";

const PLATFORM_NAME = "selve";

let hap: HAP;

export = (api: API) => {
  hap = api.hap;

  api.registerPlatform(PLATFORM_NAME, SelvePlatform);
};

class SelvePlatform implements StaticPlatformPlugin {
  private readonly log: Logging;
  private readonly usbService: USBRfService;
  private readonly shutters: Array<SelveShutter>;

  constructor(log: Logging, config: SelvePlatformConfig, api: API) {
    this.log = log;

    if (!config.usbPort) {
      throw Error("Config 'usbPort' is required and can't be undefined!");
    }

    this.usbService = new USBRfService(log, config.usbPort);

    const shutterConfigs = config.shutters || [];
    if (shutterConfigs.length === 0) {
      this.log.warn("No shutter configs defined!");
    }

    this.shutters = shutterConfigs
      .map((config) => {
        if (!config.name) {
          this.log.error("Shutter name not set!");
          return null;
        } else if (typeof config.device !== "number") {
          this.log.error("Shutter device undefined or not a number!");
          return null;
        }
        return new SelveShutter(hap, log, config, this.usbService);
      })
      .filter((s) => !!s) as Array<SelveShutter>;

    log.info(`Finished initializing ${this.shutters.length} shutter(s)!`);
  }

  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
    callback(this.shutters);
  }
}
