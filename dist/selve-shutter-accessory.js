"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commeo_state_1 = require("./data/commeo-state");
class SelveShutter {
    constructor(hap, log, config, usbService) {
        this.targetPosition = 100;
        this.log = log;
        this.name = config.name;
        this.device = config.device;
        this.usbService = usbService;
        this.state = new commeo_state_1.CommeoState();
        // initialize services
        this.shutterService = new hap.Service.WindowCovering(this.name);
        this.informationService = new hap.Service.AccessoryInformation();
        this.switchService1 = new hap.Service.Switch('Position 1', '1');
        this.switchService2 = new hap.Service.Switch('Position 2', '2');
        // setup shutter services
        this.shutterService.getCharacteristic(hap.Characteristic.CurrentPosition)
            .on("get" /* GET */, (cb) => cb(null, this.state.CurrentPosition));
        this.shutterService.getCharacteristic(hap.Characteristic.TargetPosition)
            .on("get" /* GET */, (cb) => cb(null, this.targetPosition))
            .on("set" /* SET */, (newPosition, cb) => {
            this.log.info(`[${this.name}] Set new target position to ${newPosition}`);
            this.targetPosition = Number(newPosition);
            this.usbService.sendMovePosition(this.device, this.targetPosition, cb);
        });
        this.shutterService.getCharacteristic(hap.Characteristic.PositionState)
            .on("get" /* GET */, (cb) => cb(null, this.state.PositionState));
        this.shutterService.getCharacteristic(hap.Characteristic.ObstructionDetected)
            .on("get" /* GET */, (cb) => cb(null, this.state.ObstructionDetected));
        // setup optional intermediate button services
        this.switchService1.getCharacteristic(hap.Characteristic.On)
            .on("set" /* SET */, (value, cb) => {
            if (!value)
                return cb();
            this.log.info(`[${this.name}] Set to move to intermediate position 1`);
            this.usbService.sendMoveIntermediatePosition(this.device, 1, cb);
        });
        this.switchService2.getCharacteristic(hap.Characteristic.On)
            .on("set" /* SET */, (value, cb) => {
            if (!value)
                return cb();
            this.log.info(`[${this.name}] Set to move to intermediate position 2`);
            this.usbService.sendMoveIntermediatePosition(this.device, 2, cb);
        });
        // setup info service
        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, "Selve")
            .setCharacteristic(hap.Characteristic.Model, "Selve");
        // handle status updates
        this.usbService.eventEmitter.on(String(this.device), (newState) => {
            this.log.info(`[${this.name}] New state`, newState);
            this.state = newState;
            this.shutterService.getCharacteristic(hap.Characteristic.PositionState)
                .updateValue(this.state.PositionState);
            this.shutterService.getCharacteristic(hap.Characteristic.ObstructionDetected)
                .updateValue(this.state.ObstructionDetected);
            const wasMovedFromExternal = // whether the device was operated from an external source (e.g. switch, other remote)
             (this.state.PositionState === commeo_state_1.HomebridgeStatusState.INCREASING && this.targetPosition <= this.state.CurrentPosition) ||
                (this.state.PositionState === commeo_state_1.HomebridgeStatusState.DECREASING && this.targetPosition >= this.state.CurrentPosition);
            if (wasMovedFromExternal) {
                // little hack to correctly show "opening" and "closing" status in Home app
                if (this.state.PositionState === commeo_state_1.HomebridgeStatusState.INCREASING) {
                    this.shutterService.getCharacteristic(hap.Characteristic.CurrentPosition)
                        .updateValue(Math.max(0, this.state.CurrentPosition - 1));
                }
                else {
                    this.shutterService.getCharacteristic(hap.Characteristic.CurrentPosition)
                        .updateValue(Math.min(100, this.state.CurrentPosition + 1));
                }
                this.shutterService.getCharacteristic(hap.Characteristic.TargetPosition)
                    .updateValue(this.state.CurrentPosition);
            }
            else {
                this.shutterService.getCharacteristic(hap.Characteristic.CurrentPosition)
                    .updateValue(this.state.CurrentPosition);
            }
            if (this.state.PositionState === commeo_state_1.HomebridgeStatusState.STOPPED) {
                this.targetPosition = this.state.CurrentPosition;
                this.shutterService.getCharacteristic(hap.Characteristic.TargetPosition)
                    .updateValue(this.state.CurrentPosition);
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
        ].filter(s => !!s);
        log.info("Selve shutter '%s' created!", this.name);
    }
    getServices() {
        return this.services;
    }
}
exports.SelveShutter = SelveShutter;
