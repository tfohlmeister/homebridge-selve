export class CommeoState {
    CurrentPosition: number; // percentage 0 - 100, READ, NOTIFY
    TargetPosition: number; // percentage 0 - 100, READ, WRITE, NOTIFY
    PositionState: HomebridgePositionState; // READ, NOTIFY
    ObstructionDetected: boolean; // READ, NOTIFY
    device: number;

    constructor(device: number) {
        this.CurrentPosition = 0;
        this.TargetPosition = 0;
        this.PositionState = HomebridgePositionState.STOPPED;
        this.ObstructionDetected = false;
        this.device = device;
    }
}

export enum HomebridgePositionState {
    DECREASING = 0,
    INCREASING = 1,
    STOPPED = 2
}