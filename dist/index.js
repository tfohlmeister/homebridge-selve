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

var CommeoState = // percentage 0 - 100, READ, NOTIFY
// percentage 0 - 100, READ, WRITE, NOTIFY
// READ, NOTIFY
// READ, NOTIFY
function CommeoState(service) {
  _classCallCheck(this, CommeoState);

  _defineProperty(this, "CurrentPosition", void 0);

  _defineProperty(this, "TargetPosition", void 0);

  _defineProperty(this, "PositionState", void 0);

  _defineProperty(this, "ObstructionDetected", void 0);

  _defineProperty(this, "service", void 0);

  this.CurrentPosition = -1;
  this.TargetPosition = -1;
  this.PositionState = CommeoPositionState.STOPPED;
  this.ObstructionDetected = false;
  this.service = service;
};
var CommeoPositionState;

(function (CommeoPositionState) {
  CommeoPositionState[CommeoPositionState["DECREASING"] = 0] = "DECREASING";
  CommeoPositionState[CommeoPositionState["INCREASING"] = 1] = "INCREASING";
  CommeoPositionState[CommeoPositionState["STOPPED"] = 2] = "STOPPED";
})(CommeoPositionState || (CommeoPositionState = {}));

/*
 * Returns a Promise that waits for the given number of milliseconds
 * (via setTimeout), then resolves.
 */
function wait() {
  return _wait.apply(this, arguments);
}

function _wait() {
  _wait = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee() {
    var ms,
        _args = arguments;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            ms = _args.length > 0 && _args[0] !== undefined ? _args[0] : 0;
            return _context.abrupt("return", new Promise(function (resolve) {
              setTimeout(resolve, ms);
            }));

          case 2:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));
  return _wait.apply(this, arguments);
}

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

    _defineProperty(this, "manufacturer", void 0);

    _defineProperty(this, "model", void 0);

    _defineProperty(this, "serial", void 0);

    _defineProperty(this, "getCurrentPosition",
    /*#__PURE__*/
    function () {
      var _ref = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee(state) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                return _context.abrupt("return", state.CurrentPosition);

              case 1:
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

    _defineProperty(this, "getTargetPosition",
    /*#__PURE__*/
    function () {
      var _ref2 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(state) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                return _context2.abrupt("return", state.TargetPosition);

              case 1:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      return function (_x2) {
        return _ref2.apply(this, arguments);
      };
    }());

    _defineProperty(this, "setTargetPosition",
    /*#__PURE__*/
    function () {
      var _ref3 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3(state, newPosition) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _this.log("Set new position to", newPosition);

                state.TargetPosition = newPosition; // TODO
                // We succeeded, so update the "current" state as well.
                // We need to update the current state "later" because Siri can't
                // handle receiving the change event inside the same "set target state"
                // response.

                _context3.next = 4;
                return wait(1);

              case 4:
                state.service.setCharacteristic(Characteristic.TargetPosition, newPosition);

              case 5:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      return function (_x3, _x4) {
        return _ref3.apply(this, arguments);
      };
    }());

    _defineProperty(this, "getPositionState",
    /*#__PURE__*/
    function () {
      var _ref4 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee4(state) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                return _context4.abrupt("return", state.ObstructionDetected);

              case 1:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      return function (_x5) {
        return _ref4.apply(this, arguments);
      };
    }());

    _defineProperty(this, "getObstructionDetected",
    /*#__PURE__*/
    function () {
      var _ref5 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5(state) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                return _context5.abrupt("return", state.ObstructionDetected);

              case 1:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      return function (_x6) {
        return _ref5.apply(this, arguments);
      };
    }());

    this.log = log;
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
      delimiter: '</xml>'
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
      var shutterService = new Service.WindowCovering(name, "shutter");
      var state = new CommeoState(shutterService);
      shutterService.getCharacteristic(Characteristic.CurrentPosition).on("get", callbackify(this.getCurrentPosition)(state));
      shutterService.getCharacteristic(Characteristic.TargetPosition).on("get", callbackify(this.getTargetPosition)(state)).on("set", callbackify(this.setTargetPosition)(state));
      shutterService.getCharacteristic(Characteristic.PositionState).on("get", callbackify(this.getPositionState)(state));
      shutterService.getCharacteristic(Characteristic.ObstructionDetected).on("get", callbackify(this.getObstructionDetected)(state));
      this.states.push(state);
    } // setup info service


    this.informationService = new Service.AccessoryInformation();
    this.informationService.setCharacteristic(Characteristic.Manufacturer, this.manufacturer).setCharacteristic(Characteristic.Model, this.model).setCharacteristic(Characteristic.SerialNumber, this.serial);
  }

  _createClass(SelveAccessory, [{
    key: "parseXML",
    value: function parseXML(data) {
      var xml = XmlDocument(data);
      console.log(xml);
    }
  }, {
    key: "getServices",
    value: function getServices() {
      return [this.informationService].concat(_toConsumableArray(this.states.map(function (srv) {
        return srv.service;
      })));
    }
  }]);

  return SelveAccessory;
}();

module.exports = index;
