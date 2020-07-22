"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CommeoState {
    constructor() {
        this.CurrentPosition = 100; // assume default open
        this.PositionState = HomebridgeStatusState.STOPPED;
        this.ObstructionDetected = false;
    }
}
exports.CommeoState = CommeoState;
var HomebridgeStatusState;
(function (HomebridgeStatusState) {
    // based on Characteristic.PositionState
    HomebridgeStatusState[HomebridgeStatusState["STOPPED"] = 2] = "STOPPED";
    HomebridgeStatusState[HomebridgeStatusState["INCREASING"] = 1] = "INCREASING";
    HomebridgeStatusState[HomebridgeStatusState["DECREASING"] = 0] = "DECREASING";
})(HomebridgeStatusState = exports.HomebridgeStatusState || (exports.HomebridgeStatusState = {}));
var CommeoStatusState;
(function (CommeoStatusState) {
    CommeoStatusState[CommeoStatusState["UNKNOWN"] = 0] = "UNKNOWN";
    CommeoStatusState[CommeoStatusState["STOPPED"] = 1] = "STOPPED";
    CommeoStatusState[CommeoStatusState["MOVING_UP"] = 2] = "MOVING_UP";
    CommeoStatusState[CommeoStatusState["MOVING_DOWN"] = 3] = "MOVING_DOWN";
})(CommeoStatusState = exports.CommeoStatusState || (exports.CommeoStatusState = {}));
