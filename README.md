# Selve Roller Shutter Accessory
Exposes up to 64 roller shutters using a Selve USB-RF module paired with Selve Commeo receivers.


## Maintained fork status
This fork is focused on keeping the existing Selve USB-RF integration compatible with current Homebridge and Node.js releases without changing the existing HomeKit or Selve setup.

The plugin targets Homebridge `^1.8.0 || ^2.0.0` and Node.js `^22.12.0 || ^24.0.0`.
The current candidate is `2.3.0-beta.1`; it has not been published to the npm registry.
The package name and `selve` platform alias are retained for local upgrade testing.
Public distribution of the fork will need its own package name or transfer of the original package.

This continues [Thorben Fohlmeister's original plugin](https://github.com/tfohlmeister/homebridge-selve).
The original author and MIT license are retained.

### Reliability changes

- SerialPort 13 uses Node-API bindings, addressing the Node.js upgrade failure described in [upstream issue #18](https://github.com/tfohlmeister/homebridge-selve/issues/18).
- Serial commands are sent in order, drained to the USB port, and spaced by 500 ms.
- A command that times out before opening the port is cancelled. Failed movement commands are never automatically replayed. Commands already transmitted cannot be retracted.
- USB errors are handled; a subsequent command can reconnect after the old port has closed. Shutdown closes the port and cancels pending commands.
- Fragmented, combined, malformed and oversized XML messages are handled. Gateway faults are logged.
- HomeKit reports unavailable until a receiver state is known, and after a USB failure, instead of reporting an assumed open position.

## Safe upgrade notes
This plugin does not pair, unpair, renumber, or discover Selve devices. Pairing lives in the Selve USB-RF gateway and receivers. The plugin only sends commands to the `device` IDs already configured in Homebridge.

To avoid HomeKit churn while testing this fork:

1. Back up your Homebridge config directory before testing, including `config.json`, `accessories/`, and `persist/`.
2. Do not re-pair Selve devices with the Selve tools.
3. Do not delete Homebridge caches, accessories, rooms, scenes, or automations as part of this upgrade.
4. Keep the same `device` IDs and shutter names in your `shutters` config.
5. Test the fork first in a separate Homebridge user directory with a copied config, separate bridge username, separate port, and separate PIN.
6. Stop the production Homebridge instance before real USB-RF testing so only one process owns the serial port.
7. Test one shutter first before validating the full set.


## Setup
1. Pair roller shutters and USB-RF Gateway using the official Selve tools
2. Once paired, use [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x) to setup your config and skip the following steps.
3. Manual setup: Update your `config.json` and add "Selve" as a new platform. Make sure you set the `usbPort` to the corresponding path of the usb dongle on your system (typically something like `/dev/ttyUSB0` on Linux machines). Also make sure the system user running homebridge has read and write access to this device.
4. Add as many `shutters` to the config as you have. Each shutter has a `name`, a `device` (the same ActorID (0-63) that was used in the tools app during pairing), and optional parameters to show virtual buttons for intermediate positions.

**Example config.json:**

```JSON
"platforms": [
  {
    "name": "Selve",
    "platform": "selve",
    "usbPort": "/dev/ttyUSB0",
    "shutters": [
        {
            "name": "Livingroom",
            "device": 4
        }
    ]
  }
]
```

### Add virtual buttons to move to saved intermediate positions (optional)

You can add up to two virtual buttons to move your shutters to predefined, saved intermediate positions (position 1 or 2). At the moment this plugin can't detect whether the current position is an intermediate position or not, so it simply turns off the virtual button immediately after turning it on and triggering the command.

To add the buttons, simply add `showIntermediate1` and/or `showIntermediate2` to the config:

```JSON
"platforms": [
  {
    "name": "Selve",
    "platform": "selve",
    "usbPort": "/dev/ttyUSB0",
    "shutters": [
        {
            "name": "Livingroom",
            "device": 4,
            "showIntermediate1": true,
            "showIntermediate2": true
        }
    ]
  }
]
```

### Add a virtual button to stop any movement (optional)

You can add another virtual button for stopping any current movement. Simply add `showStop` to any shutter in your config, in the same style as above.
```JSON
...
"showStop": true,
...

```


## Plugin Development

Use Node.js 24 and the pnpm version declared in `package.json` for development.
The runtime also supports Node.js 22.12+, but pnpm 11 itself requires 22.13+.

Watch mode uses `.homebridge-dev` as a separate Homebridge user directory. Create a development config there with a distinct bridge identity before starting it, and allow only one process to use the USB device.
You can run in watch mode to automatically transpile code as you write it:

```sh
  pnpm watch
```

Run the compatibility checks before publishing or installing into a production Homebridge instance:

```sh
  pnpm install --frozen-lockfile
  pnpm lint
  pnpm test
  pnpm test:runtime
  pnpm pack --dry-run
```

The runtime smoke test creates a temporary, unpaired Homebridge instance with a deliberately missing USB path, verifies plugin loading and accessory registration, then shuts it down. CI runs against Homebridge 1.8.0 and 2.4.0 on Node.js 22 and 24.

Build an installable candidate with `pnpm build && pnpm pack`. Keep the tarball at a durable path on the Homebridge host if its package manifest refers to it. A build or unit-test pass does not replace a real gateway test or a backup of existing HomeKit persistence.
