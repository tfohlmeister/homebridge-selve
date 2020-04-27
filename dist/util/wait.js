"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Returns a Promise that waits for the given number of milliseconds
 * (via setTimeout), then resolves.
 */
async function wait(ms = 0) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
exports.wait = wait;
