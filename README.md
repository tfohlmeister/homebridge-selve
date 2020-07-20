# Selve Roller Shutter Accessory

Exposes up to 64 roller shutters using a Selve USB-RF module paired with Selve Commeo receivers.

## Setup
1. Pair roller shutters and USB-RF Gateway using the official Selve tools
2. Once paired, update your `config.json` and add as many "Selve" accessories as needed (see example below). Make sure you set the `device` to the same ActorID (0-63) used in the tools app, so that this plugin can handle actions and status updates correctly. 

**Example config.json:**

    {
      "accessories": [
        {
          "accessory": "Selve",
          "name": "Livingroom",
          "port": "/dev/ttyUSB0",
          "device": 1
        }
      ]
    }


### Add virtual buttons to move to intermediate positions (optional, experimental)

You can add up to two virtual buttons to move your shutters to predefined intermediate positions (position 1 or 2). At the moment this plugin can't detect whether the current position is an intermediate position or not, so it simply turns off the virtual button immediately after turning it on and triggering the command. *This is still experimental, feedback is welcome!*

To add the buttons, simply add `showIntermediate1` and/or `showIntermediate2` to the config:

```
{
  "accessories": [
    {
      "accessory": "Selve",
      "name": "Livingroom",
      "port": "/dev/ttyUSB0",
      "device": 1,
      "showIntermediate1": true,
      "showIntermediate2": true
    }
  ]
}
```



## Plugin Development

You can run in watch mode to automatically transpile code as you write it:

```sh
  npm run debug
```
