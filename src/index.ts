import callbackify from './util/callbackify';
import { CommeoState } from './util/commeo-state';
import { wait } from './util/wait';

require("@babel/polyfill");
const util = require("util");

let Service: any, Characteristic: any;

export default function(homebridge: any) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory("homebridge-selve-commeo", "Selve", SelveAccessory);
}

class SelveAccessory {
  log: Function;
  states: Array<CommeoState>;

  constructor(log, config) {
    this.log = log;
    this.states = new Array<CommeoState>();

    for(let channel = 1; channel<65; channel++) {
      const name = config[`channel${channel}`];
      if (name === undefined) continue;

      const shutterService = new Service.WindowCovering(name, "shutter");
      const state = new CommeoState(shutterService);

      shutterService
      .getCharacteristic(Characteristic.CurrentPosition)
      .on("get", callbackify(this.getCurrentPosition)(state));

      shutterService
      .getCharacteristic(Characteristic.TargetPosition)
      .on("get", callbackify(this.getTargetPosition)(state))
      .on("set", callbackify(this.setTargetPosition)(state));

      shutterService
      .getCharacteristic(Characteristic.PositionState)
      .on("get", callbackify(this.getPositionState)(state));

      shutterService
      .getCharacteristic(Characteristic.ObstructionDetected)
      .on("get", callbackify(this.getObstructionDetected)(state));

      this.states.push(state);
    }
  }

  getServices() {
    return this.states.map(srv => srv.service);
  }

  getCurrentPosition = async (state: CommeoState) => {
    return state.CurrentPosition;
  }

  getTargetPosition = async (state: CommeoState) => {
    return state.TargetPosition;
  }

  setTargetPosition = async (state: CommeoState, newPosition: number) => {
    this.log("Set new position to", newPosition);

    state.TargetPosition = newPosition;

    /*if (state === Characteristic.LockTargetState.SECURED) {
      throw new Error("Cannot close an open frunk.");
    } else {
      await api("openTrunk", options, tesla.FRUNK);
    }*/

    // We succeeded, so update the "current" state as well.
    // We need to update the current state "later" because Siri can't
    // handle receiving the change event inside the same "set target state"
    // response.
    await wait(1);

    state.service.setCharacteristic(Characteristic.TargetPosition, newPosition);
  };

  getPositionState = async (state: CommeoState) => {
    return state.ObstructionDetected;
  }

  getObstructionDetected = async (state: CommeoState) => {
    return state.ObstructionDetected;
  }
}
