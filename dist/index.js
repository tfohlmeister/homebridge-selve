'use strict';

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    var ownKeys = Object.keys(source);

    if (typeof Object.getOwnPropertySymbols === 'function') {
      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }

    ownKeys.forEach(function (key) {
      _defineProperty(target, key, source[key]);
    });
  }

  return target;
}

var CommeoState = // percentage 0 - 100, READ, NOTIFY
// percentage 0 - 100, READ, WRITE, NOTIFY
// READ, NOTIFY
// READ, NOTIFY
function CommeoState(device) {
  _classCallCheck(this, CommeoState);

  _defineProperty(this, "CurrentPosition", void 0);

  _defineProperty(this, "TargetPosition", void 0);

  _defineProperty(this, "PositionState", void 0);

  _defineProperty(this, "ObstructionDetected", void 0);

  _defineProperty(this, "device", void 0);

  this.CurrentPosition = 100; // assume default open

  this.TargetPosition = 100; // assume default open

  this.PositionState = HomebridgePositionState.STOPPED;
  this.ObstructionDetected = false;
  this.device = device;
};
var HomebridgePositionState;

(function (HomebridgePositionState) {
  HomebridgePositionState[HomebridgePositionState["DECREASING"] = 0] = "DECREASING";
  HomebridgePositionState[HomebridgePositionState["INCREASING"] = 1] = "INCREASING";
  HomebridgePositionState[HomebridgePositionState["STOPPED"] = 2] = "STOPPED";
})(HomebridgePositionState || (HomebridgePositionState = {}));

require("@babel/polyfill");

var EventEmitter = require('events');

var SerialPort = require('serialport');

var xmlParser = require('fast-xml-parser');

var seqqueue = require('seq-queue');

var queue = seqqueue.createQueue(100);
var maxPosition = 65535;
var timeout = 10000;
var USBRfService =
/*#__PURE__*/
function () {
  _createClass(USBRfService, null, [{
    key: "getInstance",

    /* Make sure we have singletons (each port opens only once) */
    value: function getInstance(port, baud) {
      if (this.instances.get(port) !== undefined) {
        return this.instances.get(port);
      } else {
        var instance = new USBRfService(port, baud);
        this.instances.set(port, instance);
        return instance;
      }
    }
  }]);

  function USBRfService(port) {
    var baud = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 115200;

    _classCallCheck(this, USBRfService);

    _defineProperty(this, "port", void 0);

    _defineProperty(this, "baud", void 0);

    _defineProperty(this, "activePort", void 0);

    _defineProperty(this, "parser", void 0);

    _defineProperty(this, "eventEmitter", new EventEmitter());

    _defineProperty(this, "eventString", '');

    this.port = port;
    this.baud = baud;
    this.parser = new SerialPort.parsers.Delimiter({
      delimiter: '\r\n'
    });
    this.parser.on('data', this.handleData.bind(this));
  }

  _createClass(USBRfService, [{
    key: "handleData",
    value: function handleData(data) {
      this.eventString += data.toString();

      if (data.toString() === '</methodResponse>' || data.toString() === '</methodCall>') {
        this.parseXML(this.eventString);
        this.eventString = '';
      }
    }
  }, {
    key: "parseXML",
    value: function parseXML(input) {
      var data = xmlParser.parse(input);

      if (!data.methodCall && !data.methodResponse) {
        console.log("Ignoring", data);
        return;
      } else if (data.methodResponse && data.methodResponse.fault) {
        console.error('ERROR', data.methodResponse.fault);
        return;
      }

      var payload = data.methodCall ? data.methodCall.array.int : data.methodResponse.array.int;
      var device = payload[0];
      var PositionState = payload[1] === 1 ? HomebridgePositionState.STOPPED : payload[1] === 2 ? HomebridgePositionState.DECREASING : HomebridgePositionState.INCREASING;
      var CurrentPosition = Math.min(100, Math.round(100 - payload[2] / maxPosition * 100));
      var flags = String(payload[4]).split('');
      var ObstructionDetected = flags[0] === '1' || flags[1] === '1' || flags[2] === '1';
      this.eventEmitter.emit(String(device), {
        CurrentPosition,
        PositionState,
        ObstructionDetected
      });
    }
  }, {
    key: "openPort",
    value: function openPort() {
      var _this = this;

      var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

      if (this.activePort !== undefined && this.activePort.isOpen) {
        return cb(true);
      }

      this.activePort = new SerialPort(this.port, {
        baudRate: this.baud
      }, function (err) {
        if (err) {
          console.error(err.message);
          _this.activePort = undefined;
          return cb(false);
        } else {
          return cb(true);
        }
      });
      this.activePort.pipe(this.parser);
    }
  }, {
    key: "write",
    value: function write(data, cb) {
      var _this2 = this;

      queue.push(function (task) {
        _this2.openPort(function (isOpen) {
          if (isOpen) {
            _this2.activePort.write(data, function (err) {
              cb(err);
              setTimeout(task.done, 250); // give device time to settle
            });
          } else {
            cb(new Error("Port not open"));
            task.done();
          }
        });
      }, function () {
        return cb(new Error("Timeout"));
      }, timeout);
    }
  }, {
    key: "sendPosition",
    value: function sendPosition(device, targetPos) {
      var cb = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : function () {};
      var commeoTargetPos = targetPos > 0 ? maxPosition - Math.min(Math.round(targetPos / 100 * maxPosition), maxPosition) : maxPosition;
      this.write(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>1</int><int>${commeoTargetPos}</int></array></methodCall>`, cb);
    }
  }, {
    key: "requestUpdate",
    value: function requestUpdate(device) {
      var cb = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
      this.write(`<methodCall><methodName>selve.GW.device.getValues</methodName><array><int>${device}</int></array></methodCall>`, cb);
    }
  }]);

  return USBRfService;
}();

_defineProperty(USBRfService, "instances", new Map());

require("@babel/polyfill");

var Service, Characteristic;
function index (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-selve-commeo", "Selve", SelveAccessory);
}

var SelveAccessory = function SelveAccessory(log, config) {
  var _this = this;

  _classCallCheck(this, SelveAccessory);

  _defineProperty(this, "log", void 0);

  _defineProperty(this, "usbService", void 0);

  _defineProperty(this, "state", void 0);

  _defineProperty(this, "device", void 0);

  _defineProperty(this, "name", void 0);

  _defineProperty(this, "manufacturer", void 0);

  _defineProperty(this, "model", void 0);

  _defineProperty(this, "serial", void 0);

  _defineProperty(this, "informationService", void 0);

  _defineProperty(this, "shutterService", void 0);

  _defineProperty(this, "getServices", function () {
    return [_this.informationService, _this.shutterService];
  });

  _defineProperty(this, "getCurrentPosition", function (cb) {
    return cb(null, _this.state.CurrentPosition);
  });

  _defineProperty(this, "getTargetPosition", function (cb) {
    return cb(null, _this.state.TargetPosition);
  });

  _defineProperty(this, "setTargetPosition", function (newPosition, cb) {
    _this.log("Set new target position to", newPosition);

    _this.state.TargetPosition = newPosition;

    _this.usbService.sendPosition(_this.state.device, _this.state.TargetPosition, cb);
  });

  _defineProperty(this, "getPositionState", function (cb) {
    return cb(null, _this.state.PositionState);
  });

  _defineProperty(this, "getObstructionDetected", function (cb) {
    return cb(null, _this.state.ObstructionDetected);
  });

  this.log = log;
  this.name = config["name"];
  this.manufacturer = config["manufacturer"] || "no manufacturer";
  this.model = config["model"] || "Model not available";
  this.serial = config["serial"] || "Non-defined serial"; // serial port config

  var port = config["port"];

  if (port === undefined) {
    throw new Error('Option "port" needs to be set');
  } // device config


  this.device = Number(config['device']);

  if (this.device === undefined) {
    throw new Error('Option "device" needs to be set');
  }

  this.usbService = USBRfService.getInstance(port, config["baud"]); // setup services

  this.shutterService = new Service.WindowCovering(this.name, `shutter`);
  this.state = new CommeoState(this.device);
  this.shutterService.getCharacteristic(Characteristic.CurrentPosition).on("get", this.getCurrentPosition.bind(this));
  this.shutterService.getCharacteristic(Characteristic.TargetPosition).on("get", this.getTargetPosition.bind(this)).on("set", this.setTargetPosition.bind(this));
  this.shutterService.getCharacteristic(Characteristic.PositionState).on("get", this.getPositionState.bind(this));
  this.shutterService.getCharacteristic(Characteristic.ObstructionDetected).on("get", this.getObstructionDetected.bind(this)); // setup info service

  this.informationService = new Service.AccessoryInformation();
  this.informationService.setCharacteristic(Characteristic.Manufacturer, this.manufacturer).setCharacteristic(Characteristic.Model, this.model).setCharacteristic(Characteristic.SerialNumber, this.serial); // handle status updates

  this.usbService.eventEmitter.on(String(this.device), function (newState) {
    log("New status", newState);

    if (newState.CurrentPosition !== undefined) {
      _this.shutterService.getCharacteristic(Characteristic.CurrentPosition).setValue(newState.CurrentPosition);
    }

    if (newState.PositionState !== undefined) {
      _this.shutterService.getCharacteristic(Characteristic.PositionState).setValue(newState.PositionState);
    }

    if (newState.ObstructionDetected !== undefined) {
      _this.shutterService.getCharacteristic(Characteristic.ObstructionDetected).setValue(newState.ObstructionDetected);
    } // upgrade current state with new data


    _this.state = _objectSpread({}, _this.state, newState);
  }); // get current position

  this.usbService.requestUpdate(this.device);
};

module.exports = index;
