"use strict";
const util_1 = require("util");
const selve_shutter_accessory_1 = require("./selve-shutter-accessory");
const usb_rf_service_1 = require("./util/usb-rf.service");
const PLATFORM_NAME = "selve";
let hap;
class SelvePlatform {
    constructor(log, config, api) {
        this.log = log;
        if (!config.usbPort) {
            throw Error("Config 'usbPort' is required and can't be undefined!");
        }
        this.usbService = new usb_rf_service_1.USBRfService(log, config.usbPort);
        const shutterConfigs = config.shutters || [];
        if (shutterConfigs.length === 0) {
            this.log.warn("No shutter configs defined!");
        }
        this.shutters = shutterConfigs.map(config => {
            if (!config.name) {
                this.log.error("Shutter name not set!");
                return null;
            }
            else if (!util_1.isNumber(config.device)) {
                this.log.error("Shutter device undefined or not a number!");
                return null;
            }
            return new selve_shutter_accessory_1.SelveShutter(hap, log, config, this.usbService);
        }).filter(s => !!s);
        log.info(`Finished initializing ${this.shutters.length} shutter(s)!`);
    }
    accessories(callback) {
        callback(this.shutters);
    }
}
module.exports = (api) => {
    hap = api.hap;
    api.registerPlatform(PLATFORM_NAME, SelvePlatform);
};
