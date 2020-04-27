"use strict";
const commeo_state_1 = require("./data/commeo-state");
const usb_rf_service_1 = require("./util/usb-rf.service");
let hap;
class SelveShutter {
    constructor(log, config, api) {
        this.getCurrentPosition = (cb) => cb(null, this.state.CurrentPosition);
        this.getTargetPosition = (cb) => cb(null, this.state.TargetPosition);
        this.setTargetPosition = (newPosition, cb) => {
            this.log("Set new target position to", newPosition);
            this.state.TargetPosition = Number(newPosition);
            this.usbService.sendPosition(this.state.device, this.state.TargetPosition)
                .then(() => cb())
                .catch(error => cb(error));
        };
        this.getPositionState = (cb) => cb(null, this.state.PositionState);
        this.getObstructionDetected = (cb) => cb(null, this.state.ObstructionDetected);
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
        this.state = new commeo_state_1.CommeoState(this.device);
        // setup services
        this.usbService = usb_rf_service_1.USBRfService.getInstance(port);
        this.shutterService = new hap.Service.WindowCovering(this.name);
        this.informationService = new hap.Service.AccessoryInformation();
        this.shutterService
            .getCharacteristic(hap.Characteristic.CurrentPosition)
            .on("get" /* GET */, this.getCurrentPosition.bind(this));
        this.shutterService
            .getCharacteristic(hap.Characteristic.TargetPosition)
            .on("get" /* GET */, this.getTargetPosition.bind(this))
            .on("set" /* SET */, this.setTargetPosition.bind(this));
        this.shutterService
            .getCharacteristic(hap.Characteristic.PositionState)
            .on("get" /* GET */, this.getPositionState.bind(this));
        this.shutterService
            .getCharacteristic(hap.Characteristic.ObstructionDetected)
            .on("get" /* GET */, this.getObstructionDetected.bind(this));
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
        this.usbService.eventEmitter.on(String(this.device), (newState) => {
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
            };
        });
        // get current position
        this.usbService.requestUpdate(this.device).catch(error => {
            log.error(error);
        });
    }
    getServices() {
        return [
            this.informationService,
            this.shutterService,
        ];
    }
}
module.exports = (api) => {
    hap = api.hap;
    api.registerAccessory("Selve", SelveShutter);
};
