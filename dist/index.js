'use strict';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }

  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}

function _asyncToGenerator(fn) {
  return function () {
    var self = this,
        args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);

      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
      }

      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
      }

      _next(undefined);
    });
  };
}

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

  this.CurrentPosition = 0;
  this.TargetPosition = 0;
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

var XmlDocument = require('xmldoc').XmlDocument;

var USBRfService =
/*#__PURE__*/
function () {
  _createClass(USBRfService, null, [{
    key: "getInstance",

    /* Make sure we have singletons (each port opens only once) */
    value: function getInstance(port, baud, log) {
      if (this.instances.get(port) !== undefined) {
        return this.instances.get(port);
      } else {
        var instance = new USBRfService(port, baud, log);
        this.instances.set(port, instance);
        return instance;
      }
    }
  }]);

  function USBRfService(port) {
    var _this = this;

    var baud = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 115200;
    var log = arguments.length > 2 ? arguments[2] : undefined;

    _classCallCheck(this, USBRfService);

    _defineProperty(this, "port", void 0);

    _defineProperty(this, "baud", void 0);

    _defineProperty(this, "activePort", void 0);

    _defineProperty(this, "log", void 0);

    _defineProperty(this, "eventEmitter", new EventEmitter());

    this.port = port;
    this.baud = baud;
    this.log = log;
    var parser = new SerialPort.parsers.Delimiter({
      delimiter: '\r\n' //'</xml>'

    });
    this.activePort = new SerialPort(this.port, {
      baudRate: this.baud
    }, function (err) {
      _this.log(err ? err.message : `Port ${_this.port} opened.`);
    });
    this.activePort.pipe(parser);
    parser.on('data', this.parseXML.bind(this));
  }

  _createClass(USBRfService, [{
    key: "parseXML",
    value: function parseXML(data) {
      //console.log(data.toString());
      var util = require('util');

      console.log(util.inspect(data.toString(), {
        showHidden: true,
        depth: null
      }));
      return;
      var xml = XmlDocument(data.toString());
      console.log(xml); // update 

      /*shutterService
          .getCharacteristic(Characteristic.ObstructionDetected)
           CurrentPosition: number; // percentage 0 - 100, READ, NOTIFY
          TargetPosition: number; // percentage 0 - 100, READ, WRITE, NOTIFY
          PositionState: HomebridgePositionState; // READ, NOTIFY
          ObstructionDetected: boolean; // READ, NOTIFY
           */
      // this.eventEmitter.emit(new CommeoState())
    }
  }, {
    key: "sendPosition",
    value: function () {
      var _sendPosition = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee(device, targetPos, cb) {
        var commeoTargetPos;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                commeoTargetPos = targetPos > 0 ? Math.round(targetPos * 65535 / 100) : 0;
                this.activePort.write(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${device}</int><int>7</int><int>${commeoTargetPos}</int><int>0</int></array></methodCall>`, cb);

              case 2:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      return function sendPosition(_x, _x2, _x3) {
        return _sendPosition.apply(this, arguments);
      };
    }()
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
    return cb(_this.state.CurrentPosition);
  });

  _defineProperty(this, "getTargetPosition", function (cb) {
    return cb(_this.state.TargetPosition);
  });

  _defineProperty(this, "setTargetPosition", function (newPosition, cb) {
    _this.log("Set new position to", newPosition);

    _this.state.TargetPosition = newPosition;

    _this.usbService.sendPosition(_this.state.device, _this.state.TargetPosition, cb);
  });

  _defineProperty(this, "getPositionState", function (cb) {
    return cb(_this.state.PositionState);
  });

  _defineProperty(this, "getObstructionDetected", function (cb) {
    return cb(_this.state.ObstructionDetected);
  });

  this.log = log;
  this.name = config["name"];
  this.manufacturer = config["manufacturer"] || "no manufacturer";
  this.model = config["model"] || "Model not available";
  this.serial = config["serial"] || "Non-defined serial"; // serial port config

  var port = config["port"];

  if (port === undefined) {
    throw new Error('Option "port" needs to be set');
  }

  try {
    this.usbService = USBRfService.getInstance(port, config["baud"], log);
  } catch (error) {
    log.error(error.message);
  } // device config


  this.device = Number(config['device']);

  if (this.device === undefined) {
    throw new Error('Option "device" needs to be set');
  } // setup services


  this.shutterService = new Service.WindowCovering(this.name, `shutter`);
  this.state = new CommeoState(this.device);
  this.shutterService.getCharacteristic(Characteristic.CurrentPosition).on("get", this.getCurrentPosition.bind(this));
  this.shutterService.getCharacteristic(Characteristic.TargetPosition).on("get", this.getTargetPosition.bind(this)).on("set", this.setTargetPosition.bind(this));
  this.shutterService.getCharacteristic(Characteristic.PositionState).on("get", this.getPositionState.bind(this));
  this.shutterService.getCharacteristic(Characteristic.ObstructionDetected).on("get", this.getObstructionDetected.bind(this)); // setup info service

  this.informationService = new Service.AccessoryInformation();
  this.informationService.setCharacteristic(Characteristic.Manufacturer, this.manufacturer).setCharacteristic(Characteristic.Model, this.model).setCharacteristic(Characteristic.SerialNumber, this.serial);
};

module.exports = index;
