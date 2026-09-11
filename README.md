# Selve Roller Shutter Accessory
Exposes up to 64 roller shutters using a Selve USB-RF module paired with Selve Commeo receivers.


This fork of [Thorben Fohlmeister's plugin](https://github.com/tfohlmeister/homebridge-selve) supports Homebridge `^1.8.0 || ^2.0.0` and Node.js `^22.12.0 || ^24.0.0`.
The current beta has not been published to npm.

When upgrading, back up your Homebridge configuration and keep the existing shutter names and device IDs to preserve your HomeKit setup.

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

Use Node.js 24 and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm test:runtime
```

`pnpm watch` uses `.homebridge-dev/config.json`. Give this test bridge a separate identity and stop other instances using the same USB gateway.
Build an installable package with `pnpm build && pnpm pack`.
