"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hap_nodejs_1 = require("hap-nodejs");
class CommeoState {
    constructor() {
        this.CurrentPosition = 100; // assume default open
        this.PositionState = hap_nodejs_1.Characteristic.PositionState.STOPPED; // HomebridgeStatusState.STOPPED;
        this.ObstructionDetected = false;
    }
}
exports.CommeoState = CommeoState;
var CommeoStatusState;
(function (CommeoStatusState) {
    CommeoStatusState[CommeoStatusState["UNKNOWN"] = 0] = "UNKNOWN";
    CommeoStatusState[CommeoStatusState["STOPPED"] = 1] = "STOPPED";
    CommeoStatusState[CommeoStatusState["MOVING_UP"] = 2] = "MOVING_UP";
    CommeoStatusState[CommeoStatusState["MOVING_DOWN"] = 3] = "MOVING_DOWN";
})(CommeoStatusState = exports.CommeoStatusState || (exports.CommeoStatusState = {}));
