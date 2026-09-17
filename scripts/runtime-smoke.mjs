import console from "node:console";
import { setTimeout, clearTimeout } from "node:timers";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const homebridgeRoot = dirname(dirname(require.resolve("homebridge")));
const executable = ["homebridge.js", "homebridge"].map(name => join(homebridgeRoot, "bin", name)).find(existsSync);
assert.ok(executable, "Homebridge executable exists");
const directory = mkdtempSync(join(tmpdir(), "selve-smoke-"));
writeFileSync(join(directory, "config.json"), JSON.stringify({
  bridge: {name: "Selve Test", username: "02:00:00:00:00:18", port: 51918, pin: "031-45-154", advertiser: "ciao"},
  plugins: ["homebridge-selve"],
  platforms: [{platform: "selve", name: "Selve Test", usbPort: "/dev/selve-test-missing", shutters: [{name: "Test Shutter", device: 4}]}],
}));
let output = "";
let started = false;
let timedOut = false;
const child = spawn(process.execPath, [executable, "-P", process.cwd(), "-U", directory, "--no-qrcode"], {stdio: ["ignore", "pipe", "pipe"]});
const timeout = setTimeout(() => {timedOut = true; child.kill("SIGKILL");}, 30000);
function collect(data) {
  output += data.toString();
  if (!started && /Homebridge v[\d.]+.*running on port/.test(output) && /ENOENT|No such file/i.test(output)) {
    started = true;
    child.kill("SIGTERM");
  }
}
child.stdout.on("data", collect);
child.stderr.on("data", collect);
try {
  const [code, signal] = await once(child, "exit");
  assert.equal(timedOut, false, "Homebridge starts and shuts down within 30 seconds");
  assert.equal(started, true, output);
  assert.match(output, /Registering platform 'homebridge-selve.selve'/);
  assert.match(output, /Finished initializing 1 shutter/);
  assert.match(output, /Got SIGTERM, shutting down Homebridge/);
  assert.ok((code === 0 || code === 143) && signal === null, `Unexpected exit: code=${code}, signal=${signal}: ${output}`);
  console.log(`Homebridge loaded Selve, registered its accessory, survived missing USB, and exited after SIGTERM (code=${code}, signal=${signal}).`);
} finally {
  clearTimeout(timeout);
  child.kill("SIGKILL");
  rmSync(directory, {recursive: true, force: true});
}
