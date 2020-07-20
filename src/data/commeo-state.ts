export class CommeoState {
    CurrentPosition: number; // percentage 0 - 100, READ, NOTIFY
    TargetPosition: number; // percentage 0 - 100, READ, WRITE, NOTIFY
    PositionState: HomebridgePositionState; // READ, NOTIFY
    ObstructionDetected: boolean; // READ, NOTIFY

    constructor() {
        this.CurrentPosition = 100; // assume default open
        this.TargetPosition = 100; // assume default open
        this.PositionState = HomebridgePositionState.STOPPED;
        this.ObstructionDetected = false;
    }
}

export enum HomebridgePositionState {
    DECREASING = 0,
    INCREASING = 1,
    STOPPED = 2
}