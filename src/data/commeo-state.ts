import { Characteristic } from 'hap-nodejs';

export class CommeoState {
    CurrentPosition: number; // percentage 0 - 100, READ, NOTIFY
    PositionState: typeof Characteristic.PositionState.STOPPED | typeof Characteristic.PositionState.INCREASING | typeof Characteristic.PositionState.DECREASING; // READ, NOTIFY
    ObstructionDetected: boolean; // READ, NOTIFY

    constructor() {
        this.CurrentPosition = 100; // assume default open
        this.PositionState = Characteristic.PositionState.STOPPED; // HomebridgeStatusState.STOPPED;
        this.ObstructionDetected = false;
    }
}

export enum CommeoStatusState {
    UNKNOWN = 0,
    STOPPED = 1,
    MOVING_UP = 2,
    MOVING_DOWN = 3
}