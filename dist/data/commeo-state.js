"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CommeoState {
    constructor() {
        this.CurrentPosition = 100; // assume default open
        this.TargetPosition = 100; // assume default open
        this.PositionState = HomebridgePositionState.STOPPED;
        this.ObstructionDetected = false;
    }
}
exports.CommeoState = CommeoState;
var HomebridgePositionState;
(function (HomebridgePositionState) {
    HomebridgePositionState[HomebridgePositionState["DECREASING"] = 0] = "DECREASING";
    HomebridgePositionState[HomebridgePositionState["INCREASING"] = 1] = "INCREASING";
    HomebridgePositionState[HomebridgePositionState["STOPPED"] = 2] = "STOPPED";
})(HomebridgePositionState = exports.HomebridgePositionState || (exports.HomebridgePositionState = {}));
