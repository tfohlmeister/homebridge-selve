import console from 'node:console';
import { setTimeout, clearTimeout } from 'node:timers';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';

const require = createRequire(import.meta.url);
const homebridgeRoot = dirname(dirname(require.resolve('homebridge')));
const executable = ['homebridge.js', 'homebridge'].map(name => join(homebridgeRoot, 'bin', name)).find(existsSync);
assert.ok(executable, 'Homebridge executable exists');
const directory = mkdtempSync(join(tmpdir(), 'selve-smoke-'));
const username = ['02', ...randomBytes(5).toString('hex').match(/../g)].join(':').toUpperCase();
const legacy = join(directory, 'legacy');
mkdirSync(legacy);
copyFileSync('test/fixtures/legacy-platform.mjs', join(legacy, 'index.mjs'));
writeFileSync(join(legacy, 'package.json'), JSON.stringify({
  name: 'homebridge-selve', version: '3.0.0', main: 'index.mjs', keywords: ['homebridge-plugin'],
  engines: {homebridge: '^1.8.0 || ^2.0.0', node: '>=22.12.0'},
}));
const platform = {
  platform: 'selve', name: 'Selve Test', usbPort: '/dev/selve-test-missing',
  shutters: [{name: 'Test Shutter', device: 4, showIntermediate1: true, showIntermediate2: true, showStop: true}],
};

async function run(label, pluginPath, platforms, expected, storage = join(directory, 'bridge')) {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  mkdirSync(storage, {recursive: true});
  writeFileSync(join(storage, 'config.json'), JSON.stringify({
    bridge: {name: 'Selve Test', username, port, pin: '031-45-154', advertiser: 'ciao'},
    plugins: ['homebridge-selve'], platforms,
  }));
  let output = '';
  let started = false;
  let timedOut = false;
  const child = spawn(process.execPath, [executable, '-P', pluginPath, '-U', storage, '--no-qrcode'], {stdio: ['ignore', 'pipe', 'pipe']});
  const timeout = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 30000);
  function collect(data) {
    output += data.toString();
    if (!started && /Homebridge v[\d.]+.*running on port/.test(output) && expected.test(output)) {
      started = true;
      child.kill('SIGTERM');
    }
  }
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  try {
    const [code, signal] = await once(child, 'exit');
    assert.equal(timedOut, false, `${label}: startup timed out\n${output}`);
    assert.equal(started, true, output);
    assert.match(output, /Registering platform 'homebridge-selve.selve'/);
    assert.match(output, /Got SIGTERM, shutting down Homebridge/);
    assert.doesNotMatch(output, /uncaught|unhandled|Cannot add a bridged Accessory with the same UUID|Failed to restore/i);
    assert.ok((code === 0 || code === 143) && signal === null, `${label}: code=${code}, signal=${signal}\n${output}`);
    console.log(`${label}: passed (exit ${code}${code === 143 ? ', Homebridge shutdown fallback' : ''}).`);
  } finally {
    clearTimeout(timeout);
    child.kill('SIGKILL');
  }
  return storage;
}
function identifiers(storage) {
  const persist = join(storage, 'persist');
  const file = readdirSync(persist).find(name => name.startsWith('IdentifierCache.'));
  assert.ok(file, 'Homebridge saved its identifier cache');
  return JSON.parse(readFileSync(join(persist, file), 'utf8')).cache;
}
function cached(storage) {
  return JSON.parse(readFileSync(join(storage, 'accessories', 'cachedAccessories'), 'utf8'));
}

try {
  const storage = await run('Legacy static platform', legacy, [platform], /Initializing platform accessory 'Test Shutter'/);
  const before = identifiers(storage);
  // Compare every persisted ID, including services and characteristics, across the upgrade.
  assert.ok(Object.keys(before).length > 15, 'Legacy accessory and characteristic IDs were allocated');
  await run('Dynamic upgrade with missing USB', process.cwd(), [platform], /ENOENT|No such file/i);
  const after = identifiers(storage);
  for (const [key, value] of Object.entries(before)) {
    if (key !== '|nextAID' && !key.endsWith('|nextIID')) {
      assert.equal(after[key], value, `Upgrade changed persisted ID ${key}`);
    }
  }
  const firstCache = cached(storage);
  assert.equal(firstCache.length, 1);
  assert.ok(firstCache[0].UUID);
  await run('Dynamic cached restart', process.cwd(), [platform], /ENOENT|No such file/i);
  assert.equal(cached(storage).length, 1);
  assert.deepEqual(identifiers(storage), after, 'Restart retains all AIDs and IIDs');
  await run('Invalid configuration retains cache', process.cwd(), [{...platform, usbPort: ''}], /Selve is inactive/);
  assert.equal(cached(storage)[0].UUID, firstCache[0].UUID);
  await run('Explicit removal', process.cwd(), [{...platform, shutters: []}], /Finished initializing 0 shutter/);
  assert.deepEqual(cached(storage), []);
  await run('Installed without configuration', process.cwd(), [], /Registering platform/, join(directory, 'unconfigured'));
  console.log('Static-to-dynamic AIDs/IIDs, cached restart, invalid configuration, removal, and unconfigured startup verified. No real USB device was used.');
} finally {
  rmSync(directory, {recursive: true, force: true});
}
