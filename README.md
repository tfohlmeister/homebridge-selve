# Selve Roller Shutter Accessory

Exposes up to 64 roller shutters using a Selve USB-RF module paired with Selve Commeo receivers.

## Setup
1. Pair roller shutters and USB-RF Gateway using the official Selve tools
2. Once paired, update your `config.json` and add as many "Selve" accessories as needed (see example above). Make sure you set the `device` to the same ActorID (0-63) used in the tools app, so that this plugin can handle actions and status updates correctly. 

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


## Plugin Development

You can run in watch mode to automatically transpile code as you write it:

```sh
  npm run debug
```
