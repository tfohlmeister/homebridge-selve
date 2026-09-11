# Compatibility validation — 2026-09-10

Candidate: `homebridge-selve@2.3.0-beta.1` (unpublished).

## Automated checks

- macOS arm64, Node.js 24.19.0: lint, TypeScript build, 22 tests, package contents checked.
- Ubuntu x64 containers, Node.js 24.20.0: Homebridge 1.8.0, 2.0.2 and 2.4.0; 22 tests and real Homebridge startup/shutdown checks pass.
- Ubuntu x64, Node.js 22.12.0: Homebridge 1.8.0 and 2.4.0; the same installed native dependencies and compiled plugin used on Node.js 24 pass all 22 tests and startup/shutdown without rebuilding SerialPort.
- Runtime startup checks use a missing USB device and confirm that one shutter is registered without crashing Homebridge.
- Regression cases include late USB opens after timeout, disconnects during writes, failed opens, shutdown during opening/writing, hardware-drain ordering, frame splitting/concatenation, malformed/oversized XML, actual HomeKit characteristic handlers and legacy service subtypes.

The pnpm 11 development tool requires Node.js 22.13 or newer. Minimum-runtime tests on 22.12 use the already-installed build directly; CI builds use maintained Node.js 22/24 releases.

## Real Selve USB-RF validation

- Bare-metal Ubuntu x64; FTDI USB gateway; seven configured Commeo receivers.
- Production Homebridge stopped while a separate test process held the gateway.
- All seven receivers returned valid status and no obstruction indication.
- Device 0 moved from 57% to 62% open and returned to 57%, with both movement and stopped events received.
- A stop command was transmitted after the return. Other receivers retained their initial positions.
- Full stopped-state Homebridge backup was extracted and recursively compared with the source before live installation.

## Live installation

- Installed the tarball into the existing Homebridge 2.4.0 / Node.js 24.20.0 container as a local file dependency; the archive is retained in the Homebridge data directory for future container starts.
- All seven receivers reported their original positions after startup and after a full container restart; the local tarball dependency survived the restart.
- Config contents, both bridge pairing records (keys, clients and setup IDs), and both complete accessory/service/characteristic identifier caches matched the stopped-state backup.
- The other installed platform remained at its original version. Homebridge UI returned HTTP success; the existing Homebridge UI monitor is present in Uptime Kuma.
- Existing configured names with parentheses produce HAP naming warnings. Names were retained to preserve legacy accessory identities.

## Limits

- Optional intermediate-position buttons are covered by handler tests; stored physical intermediate positions were not changed or exercised.
- No physical USB unplug/replug was performed. Disconnect and late-open behavior is covered by injected-port tests.
- Gateway command acknowledgements are not correlated with HomeKit writes; successful writes confirm USB transmission, while gateway faults are logged separately.
- No Windows, Raspberry Pi or musl installation was tested.
- A future scoped npm package requires migration testing. This beta preserves the existing package name, platform alias, configured names and service subtypes.
- The operator confirmed on 2026-09-10 that Apple Home remained intact, including the requested room and automation check. This is operator confirmation, separate from the automated persistence comparisons.
