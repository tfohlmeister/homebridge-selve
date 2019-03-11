export class CommeoState {
    CurrentPosition: number; // percentage 0 - 100, READ, NOTIFY
    TargetPosition: number; // percentage 0 - 100, READ, WRITE, NOTIFY
    PositionState: CommeoPositionState; // READ, NOTIFY
    ObstructionDetected: boolean; // READ, NOTIFY
    service: any;

    constructor(service) {
        this.CurrentPosition = -1;
        this.TargetPosition = -1;
        this.PositionState = CommeoPositionState.STOPPED;
        this.ObstructionDetected = false;
        this.service = service;
    }
}

export enum CommeoPositionState {
    DECREASING = 0,
    INCREASING = 1,
    STOPPED = 2
}