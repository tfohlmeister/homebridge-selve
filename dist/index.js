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
            this.usbService.sendMovePosition(this.device, this.state.TargetPosition, cb);
        };
        this.setIntermediatePosition = (pos) => (value, cb) => {
            if (!value) {
                return cb();
            }
            this.log("Set to move to intermediate position", pos);
            this.usbService.sendMoveIntermediatePosition(this.device, pos, cb);
        };
        this.getPositionState = (cb) => cb(null, this.state.PositionState);
        this.getObstructionDetected = (cb) => cb(null, this.state.ObstructionDetected);
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
        this.state = new commeo_state_1.CommeoState();
        // initialize services
        this.usbService = usb_rf_service_1.USBRfService.getInstance(port);
        this.shutterService = new hap.Service.WindowCovering(this.name);
        this.informationService = new hap.Service.AccessoryInformation();
        this.switchService1 = new hap.Service.Switch('Position 1', '1');
        this.switchService2 = new hap.Service.Switch('Position 2', '2');
        // setup shutter services
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
        // setup optional intermediate button services
        this.switchService1
            .getCharacteristic(hap.Characteristic.On)
            .on("set" /* SET */, this.setIntermediatePosition(1).bind(this));
        this.switchService2
            .getCharacteristic(hap.Characteristic.On)
            .on("set" /* SET */, this.setIntermediatePosition(2).bind(this));
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
            this.state = {
                ...this.state,
                ...newState
            };
            this.shutterService.getCharacteristic(hap.Characteristic.CurrentPosition).updateValue(this.state.CurrentPosition);
            this.shutterService.getCharacteristic(hap.Characteristic.PositionState).updateValue(this.state.PositionState);
            this.shutterService.getCharacteristic(hap.Characteristic.ObstructionDetected).updateValue(this.state.ObstructionDetected);
            this.switchService1.getCharacteristic(hap.Characteristic.On).updateValue(false);
            this.switchService2.getCharacteristic(hap.Characteristic.On).updateValue(false);
            // upgrade current state with new data
        });
        // request current position
        this.usbService.requestUpdate(this.device, err => !!err && log.error(err.message));
    }
    getServices() {
        return [
            this.informationService,
            this.shutterService,
            this.config.showIntermediate1 ? this.switchService1 : null,
            this.config.showIntermediate2 ? this.switchService2 : null
        ].filter(s => !!s);
    }
}
module.exports = (api) => {
    hap = api.hap;
    api.registerAccessory("Selve", SelveShutter);
};
