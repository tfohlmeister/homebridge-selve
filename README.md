# Selve Roller Shutter Accessory

Example config.json:

    {
      "accessories": [
        {
          "accessory": "Selve",
          "name": "Livingroom",
          "port": "/dev/tty.usbserial-DM00BGGT",
          "device": "1"
        }
      ]
    }

Exposes up to 64 roller shutters using a Selve USB-RF module paired with Selve Commeo receivers.

## Setup
1. Pair roller shutters and USB-RF Gateway using the official Selve tools
2. Once paired, update your `config.json` and add as many `"channelX": "name"` pairs as needed (see example above). Make sure you set the `name` to be the same as in the tools app, so that this plugin can match status updates correctly. 

## Development

You can run Rollup in watch mode to automatically transpile code as you write it:

```sh
  npm run dev
```
