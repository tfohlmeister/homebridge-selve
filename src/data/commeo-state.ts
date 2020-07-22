

export class CommeoState {
    CurrentPosition: number; // percentage 0 - 100, READ, NOTIFY
    PositionState: HomebridgeStatusState; // READ, NOTIFY
    ObstructionDetected: boolean; // READ, NOTIFY

    constructor() {
        this.CurrentPosition = 100; // assume default open
        this.PositionState = HomebridgeStatusState.STOPPED;
        this.ObstructionDetected = false;
    }
}

export enum HomebridgeStatusState {
    // based on Characteristic.PositionState
    STOPPED = 2,
    INCREASING = 1,
    DECREASING = 0
}

export enum CommeoStatusState {
    UNKNOWN = 0,
    STOPPED = 1,
    MOVING_UP = 2,
    MOVING_DOWN = 3
}