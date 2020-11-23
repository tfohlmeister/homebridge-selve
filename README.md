# Selve Roller Shutter Accessory

Exposes up to 64 roller shutters using a Selve USB-RF module paired with Selve Commeo receivers.

## Setup
1. Pair roller shutters and USB-RF Gateway using the official Selve tools
3. Once paired, use [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x) to setup your config and skip the following steps.
2. Manual setup: Update your `config.json` and add "Selve" as a new platform. Make sure you set the `usbPort` to the corresponding path of the usb dongle on your system (typically something like `/dev/ttyUSB0` on Linux machines). Also make sure the system user running homebridge has read and write access to this device.
3. Add as many `shutters` to the config as you have. Each shutter has a `name`, a `device` (the same ActorID (0-63) that was used in the tools app during pairing), and optional parameters to show virtual buttons for intermediate positions.

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

You can run in watch mode to automatically transpile code as you write it:

```sh
  npm run debug
```
