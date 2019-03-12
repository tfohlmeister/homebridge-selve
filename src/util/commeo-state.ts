export class CommeoState {
    CurrentPosition: number; // percentage 0 - 100, READ, NOTIFY
    TargetPosition: number; // percentage 0 - 100, READ, WRITE, NOTIFY
    PositionState: HomebridgePositionState; // READ, NOTIFY
    ObstructionDetected: boolean; // READ, NOTIFY
    service: any;
    channel: number;

    constructor(channel, service) {
        this.CurrentPosition = 0;
        this.TargetPosition = 0;
        this.PositionState = HomebridgePositionState.STOPPED;
        this.ObstructionDetected = false;
        this.service = service;
        this.channel = channel;
    }

    toCommeoState(): CommeoPositionState {
        if (this.CurrentPosition < this.TargetPosition) {
            return CommeoPositionState.INCREASING;
        } else if(this.CurrentPosition > this.TargetPosition) {
            return CommeoPositionState.DECREASING;
        } else {
            return CommeoPositionState.STOPPED;
        }
    }
}

export enum HomebridgePositionState {
    DECREASING = 0,
    INCREASING = 1,
    STOPPED = 2
}

export enum CommeoPositionState {
    DECREASING = 2,
    INCREASING = 1,
    STOPPED = 0
}