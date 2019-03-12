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

function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
}

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  }
}

function _iterableToArray(iter) {
  if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
}

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance");
}

function callbackify(func) {
  return function () {
    var onlyArgs = [];
    var maybeCallback = null;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    for (var _i = 0; _i < args.length; _i++) {
      var arg = args[_i];

      if (typeof arg === 'function') {
        maybeCallback = arg;
        break;
      }

      onlyArgs.push(arg);
    }

    if (!maybeCallback) {
      throw new Error("Missing callback parameter!");
    }

    var callback = maybeCallback;
    func.apply(void 0, onlyArgs).then(function (data) {
      return callback(null, data);
    }).catch(function (err) {
      return callback(err);
    });
  };
}

var CommeoState =
/*#__PURE__*/
function () {
  // percentage 0 - 100, READ, NOTIFY
  // percentage 0 - 100, READ, WRITE, NOTIFY
  // READ, NOTIFY
  // READ, NOTIFY
  function CommeoState(channel, service) {
    _classCallCheck(this, CommeoState);

    _defineProperty(this, "CurrentPosition", void 0);

    _defineProperty(this, "TargetPosition", void 0);

    _defineProperty(this, "PositionState", void 0);

    _defineProperty(this, "ObstructionDetected", void 0);

    _defineProperty(this, "service", void 0);

    _defineProperty(this, "channel", void 0);

    this.CurrentPosition = 0;
    this.TargetPosition = 0;
    this.PositionState = HomebridgePositionState.STOPPED;
    this.ObstructionDetected = false;
    this.service = service;
    this.channel = channel;
  }

  _createClass(CommeoState, [{
    key: "toCommeoState",
    value: function toCommeoState() {
      if (this.CurrentPosition < this.TargetPosition) {
        return CommeoPositionState.INCREASING;
      } else if (this.CurrentPosition > this.TargetPosition) {
        return CommeoPositionState.DECREASING;
      } else {
        return CommeoPositionState.STOPPED;
      }
    }
  }]);

  return CommeoState;
}();
var HomebridgePositionState;

(function (HomebridgePositionState) {
  HomebridgePositionState[HomebridgePositionState["DECREASING"] = 0] = "DECREASING";
  HomebridgePositionState[HomebridgePositionState["INCREASING"] = 1] = "INCREASING";
  HomebridgePositionState[HomebridgePositionState["STOPPED"] = 2] = "STOPPED";
})(HomebridgePositionState || (HomebridgePositionState = {}));

var CommeoPositionState;

(function (CommeoPositionState) {
  CommeoPositionState[CommeoPositionState["DECREASING"] = 2] = "DECREASING";
  CommeoPositionState[CommeoPositionState["INCREASING"] = 1] = "INCREASING";
  CommeoPositionState[CommeoPositionState["STOPPED"] = 0] = "STOPPED";
})(CommeoPositionState || (CommeoPositionState = {}));

var SerialPort = require('serialport');

var XmlDocument = require('xmldoc').XmlDocument;

require("@babel/polyfill");

var util = require("util");

var Service, Characteristic;
function index (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-selve-commeo", "Selve", SelveAccessory);
}

var SelveAccessory =
/*#__PURE__*/
function () {
  function SelveAccessory(log, config) {
    var _this = this;

    _classCallCheck(this, SelveAccessory);

    _defineProperty(this, "log", void 0);

    _defineProperty(this, "states", void 0);

    _defineProperty(this, "port", void 0);

    _defineProperty(this, "baud", 115200);

    _defineProperty(this, "activePort", void 0);

    _defineProperty(this, "informationService", void 0);

    _defineProperty(this, "name", void 0);

    _defineProperty(this, "manufacturer", void 0);

    _defineProperty(this, "model", void 0);

    _defineProperty(this, "serial", void 0);

    _defineProperty(this, "getCurrentPosition", function (state) {
      return function (cb) {
        return cb(state.CurrentPosition);
      };
    });

    _defineProperty(this, "getTargetPosition", function (state) {
      return function (cb) {
        return cb(state.TargetPosition);
      };
    });

    _defineProperty(this, "setTargetPosition", function (state) {
      return callbackify(
      /*#__PURE__*/
      function () {
        var _ref = _asyncToGenerator(
        /*#__PURE__*/
        regeneratorRuntime.mark(function _callee(newPosition) {
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  _this.log("Set new position to", newPosition);

                  state.TargetPosition = newPosition; // TODO

                  _this.sendXML(state.channel, state.toCommeoState()); // We succeeded, so update the "current" state as well.
                  // We need to update the current state "later" because Siri can't
                  // handle receiving the change event inside the same "set target state"
                  // response.
                  //await wait(1);
                  //state.service.setCharacteristic(Characteristic.TargetPosition, newPosition);


                case 3:
                case "end":
                  return _context.stop();
              }
            }
          }, _callee, this);
        }));

        return function (_x) {
          return _ref.apply(this, arguments);
        };
      }());
    });

    _defineProperty(this, "getPositionState", function (state) {
      return function (cb) {
        return cb(state.PositionState);
      };
    });

    _defineProperty(this, "getObstructionDetected", function (state) {
      return function (cb) {
        return cb(state.ObstructionDetected);
      };
    });

    this.log = log;
    this.name = config["name"];
    this.manufacturer = config["manufacturer"] || "no manufacturer";
    this.model = config["model"] || "Model not available";
    this.serial = config["serial"] || "Non-defined serial"; // setup serial port

    this.port = config["device"];

    if (this.port === undefined) {
      throw new Error('Option "device" needs to be set');
    }

    if (config["baud"]) {
      this.baud = config["baud"];
    }

    var parser = new SerialPort.parsers.Delimiter({
      delimiter: '\r\n' //'</xml>'

    });
    this.activePort = new SerialPort(this.port, {
      baudRate: this.baud
    });
    this.activePort.pipe(parser);
    this.activePort.on('open', function () {
      return _this.log('USB-RF port open');
    });
    parser.on('data', this.parseXML.bind(this)); // setup services

    this.states = new Array();

    for (var channel = 1; channel < 65; channel++) {
      var name = config[`channel${channel}`];
      if (name === undefined) continue;
      log(name);
      log(channel);
      var shutterService = new Service.WindowCovering(`${name} ${this.name}`, `shutter${channel}`);
      var state = new CommeoState(channel, shutterService);
      shutterService.getCharacteristic(Characteristic.CurrentPosition).on("get", this.getCurrentPosition(state));
      shutterService.getCharacteristic(Characteristic.TargetPosition).on("get", this.getTargetPosition(state)).on("set", this.setTargetPosition(state));
      shutterService.getCharacteristic(Characteristic.PositionState).on("get", this.getPositionState(state));
      shutterService.getCharacteristic(Characteristic.ObstructionDetected).on("get", this.getObstructionDetected(state));
      this.states.push(state);
    } // setup info service


    this.informationService = new Service.AccessoryInformation();
    this.informationService.setCharacteristic(Characteristic.Manufacturer, this.manufacturer).setCharacteristic(Characteristic.Model, this.model).setCharacteristic(Characteristic.SerialNumber, this.serial);
  }

  _createClass(SelveAccessory, [{
    key: "getServices",
    value: function getServices() {
      return [this.informationService].concat(_toConsumableArray(this.states.map(function (srv) {
        return srv.service;
      })));
    }
  }, {
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
      console.log(xml);
    }
  }, {
    key: "sendXML",
    value: function sendXML(channel, dir) {
      var result = this.activePort.write(`<methodCall><methodName>selve.GW.command.device</methodName><array><int>${channel}</int><int>${dir}</int><int>1</int><int>0</int></array></methodCall>`);
      console.log(result);
    }
  }]);

  return SelveAccessory;
}();

module.exports = index;
