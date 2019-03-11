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

var tesla = require('teslajs'); //tesla.setLogLevel(tesla.API_LOG_ALL);
// Wrapper for TeslaJS functions that don't throw Error objects!


function api(_x) {
  return _api.apply(this, arguments);
}

function _api() {
  _api = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee(name) {
    var _len,
        args,
        _key,
        _args = arguments;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;

            for (_len = _args.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
              args[_key - 1] = _args[_key];
            }

            _context.next = 4;
            return tesla[name + 'Async'].apply(tesla, args);

          case 4:
            return _context.abrupt("return", _context.sent);

          case 7:
            _context.prev = 7;
            _context.t0 = _context["catch"](0);

            if (!(typeof _context.t0 === 'string')) {
              _context.next = 11;
              break;
            }

            throw new Error(_context.t0);

          case 11:
            throw _context.t0;

          case 12:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this, [[0, 7]]);
  }));
  return _api.apply(this, arguments);
}

var queue = new Map();

var debug = function debug() {//console.log(...args);
};

function lock(_x, _x2) {
  return _lock.apply(this, arguments);
}

function _lock() {
  _lock = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee(value, timeout) {
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            return _context.abrupt("return", new Promise(function (resolve) {
              var timeoutID; // Get either the existing wait list or a new one.

              var waitList = queue.get(value) || [];
              queue.set(value, waitList); // Create our processing callback. This will be called when it's our turn
              // to own the mutex.

              var process = function process() {
                // Erase any pending timeouts.
                timeoutID && clearTimeout(timeoutID); // We may have accumulated process functions that never got called before
                // us. So remove anything before us that should be done already.

                removeUpTo(waitList, process);

                var unlock = function unlock() {
                  // call the next one if necessary.

                  removeUpToAndIncluding(waitList, process);
                  var nextProcess = waitList[0];

                  if (nextProcess) {
                    nextProcess();
                  } else {
                    // Delete the wait list entire for this value to save memory.
                    queue.delete(value);
                  }
                };

                resolve(unlock);
              }; // Add ourself to the list.


              waitList.push(process); // If we are the only thing on this list, we can process immediately.

              if (waitList.length === 1) {
                process();
              } else {
                debug(`${waitList.length - 1} others are processing on ${value}; waiting.`); // Wait up to `timeout` milliseconds to be called back before just calling
                // the process function anyway.

                timeoutID = setTimeout(function () {
                  process();
                }, timeout);
              }
            }));

          case 2:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));
  return _lock.apply(this, arguments);
}

function removeUpTo(array, target) {
  var index = array.indexOf(target);
  index >= 0 && array.splice(0, index);
}

function removeUpToAndIncluding(array, target) {
  var index = array.indexOf(target);
  index >= 0 && array.splice(0, index + 1);
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

require("@babel/polyfill");

var util = require("util");

var tesla$1 = require("teslajs");

var Service, Characteristic;
function index (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-tesla", "Tesla", TeslaAccessory);
}

var TeslaAccessory =
/*#__PURE__*/
function () {
  // From config.
  // Runtime state.
  // Services exposed.
  function TeslaAccessory(log, config) {
    var _this = this;

    _classCallCheck(this, TeslaAccessory);

    _defineProperty(this, "log", void 0);

    _defineProperty(this, "name", void 0);

    _defineProperty(this, "trunk", void 0);

    _defineProperty(this, "frunk", void 0);

    _defineProperty(this, "chargePort", void 0);

    _defineProperty(this, "vin", void 0);

    _defineProperty(this, "username", void 0);

    _defineProperty(this, "password", void 0);

    _defineProperty(this, "waitMinutes", void 0);

    _defineProperty(this, "authToken", void 0);

    _defineProperty(this, "vehicleID", void 0);

    _defineProperty(this, "lockService", void 0);

    _defineProperty(this, "trunkService", void 0);

    _defineProperty(this, "frunkService", void 0);

    _defineProperty(this, "chargePortService", void 0);

    _defineProperty(this, "climateService", void 0);

    _defineProperty(this, "getLockCurrentState",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee() {
      var options, state;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return _this.getOptions();

            case 2:
              options = _context.sent;
              _context.next = 5;
              return api("vehicleState", options);

            case 5:
              state = _context.sent;
              return _context.abrupt("return", state.locked ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);

            case 7:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    })));

    _defineProperty(this, "getLockTargetState",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee2() {
      var options, state;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              _context2.next = 2;
              return _this.getOptions();

            case 2:
              options = _context2.sent;
              _context2.next = 5;
              return api("vehicleState", options);

            case 5:
              state = _context2.sent;
              return _context2.abrupt("return", state.locked ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED);

            case 7:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, this);
    })));

    _defineProperty(this, "setLockTargetState",
    /*#__PURE__*/
    function () {
      var _ref3 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3(state) {
        var options;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return _this.getOptions();

              case 2:
                options = _context3.sent;
                _context3.next = 5;
                return _this.wakeUp();

              case 5:
                _this.log("Set lock state to", state);

                if (!(state === Characteristic.LockTargetState.SECURED)) {
                  _context3.next = 11;
                  break;
                }

                _context3.next = 9;
                return api("doorLock", options);

              case 9:
                _context3.next = 13;
                break;

              case 11:
                _context3.next = 13;
                return api("doorUnlock", options);

              case 13:
                _context3.next = 15;
                return wait(1);

              case 15:
                if (state == Characteristic.LockTargetState.SECURED) {
                  _this.lockService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
                } else {
                  _this.lockService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
                }

              case 16:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      return function (_x) {
        return _ref3.apply(this, arguments);
      };
    }());

    _defineProperty(this, "getClimateOn",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee4() {
      var options, state, on;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return _this.getOptions();

            case 2:
              options = _context4.sent;
              _context4.next = 5;
              return api("climateState", options);

            case 5:
              state = _context4.sent;
              on = state.is_auto_conditioning_on;

              _this.log("Climate on?", on);

              return _context4.abrupt("return", on);

            case 9:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4, this);
    })));

    _defineProperty(this, "setClimateOn",
    /*#__PURE__*/
    function () {
      var _ref5 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5(on) {
        var options;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return _this.getOptions();

              case 2:
                options = _context5.sent;
                _context5.next = 5;
                return _this.wakeUp();

              case 5:
                _this.log("Set climate to", on);

                if (!on) {
                  _context5.next = 11;
                  break;
                }

                _context5.next = 9;
                return api("climateStart", options);

              case 9:
                _context5.next = 13;
                break;

              case 11:
                _context5.next = 13;
                return api("climateStop", options);

              case 13:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      return function (_x2) {
        return _ref5.apply(this, arguments);
      };
    }());

    _defineProperty(this, "getTrunkCurrentState",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee6() {
      var options, state;
      return regeneratorRuntime.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              _context6.next = 2;
              return _this.getOptions();

            case 2:
              options = _context6.sent;
              _context6.next = 5;
              return api("vehicleState", options);

            case 5:
              state = _context6.sent;
              return _context6.abrupt("return", state.rt ? Characteristic.LockCurrentState.UNSECURED : Characteristic.LockCurrentState.SECURED);

            case 7:
            case "end":
              return _context6.stop();
          }
        }
      }, _callee6, this);
    })));

    _defineProperty(this, "getTrunkTargetState",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee7() {
      var options, state;
      return regeneratorRuntime.wrap(function _callee7$(_context7) {
        while (1) {
          switch (_context7.prev = _context7.next) {
            case 0:
              _context7.next = 2;
              return _this.getOptions();

            case 2:
              options = _context7.sent;
              _context7.next = 5;
              return api("vehicleState", options);

            case 5:
              state = _context7.sent;
              return _context7.abrupt("return", state.rt ? Characteristic.LockTargetState.UNSECURED : Characteristic.LockTargetState.SECURED);

            case 7:
            case "end":
              return _context7.stop();
          }
        }
      }, _callee7, this);
    })));

    _defineProperty(this, "setTrunkTargetState",
    /*#__PURE__*/
    function () {
      var _ref8 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee8(state) {
        var options;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return _this.getOptions();

              case 2:
                options = _context8.sent;
                _context8.next = 5;
                return _this.wakeUp();

              case 5:
                _this.log("Set trunk state to", state); // Now technically we are just "actuating" the state here; if you asked
                // to open the trunk, we will just "actuate" it. On the Model 3, that means
                // pop it no matter what you say - if you say "Close" it'll do nothing.
                // On the Model S/X with power liftgates, if you say "Open" or "Close"
                // it will do the same thing: "actuate" which means to just toggle it.


                _context8.next = 8;
                return api("openTrunk", options, tesla$1.TRUNK);

              case 8:
                _context8.next = 10;
                return wait(1);

              case 10:
                if (state == Characteristic.LockTargetState.SECURED) {
                  _this.trunkService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
                } else {
                  _this.trunkService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
                }

              case 11:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      return function (_x3) {
        return _ref8.apply(this, arguments);
      };
    }());

    _defineProperty(this, "getFrunkCurrentState",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee9() {
      var options, state;
      return regeneratorRuntime.wrap(function _callee9$(_context9) {
        while (1) {
          switch (_context9.prev = _context9.next) {
            case 0:
              _context9.next = 2;
              return _this.getOptions();

            case 2:
              options = _context9.sent;
              _context9.next = 5;
              return api("vehicleState", options);

            case 5:
              state = _context9.sent;
              return _context9.abrupt("return", state.ft ? Characteristic.LockCurrentState.UNSECURED : Characteristic.LockCurrentState.SECURED);

            case 7:
            case "end":
              return _context9.stop();
          }
        }
      }, _callee9, this);
    })));

    _defineProperty(this, "getFrunkTargetState",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee10() {
      var options, state;
      return regeneratorRuntime.wrap(function _callee10$(_context10) {
        while (1) {
          switch (_context10.prev = _context10.next) {
            case 0:
              _context10.next = 2;
              return _this.getOptions();

            case 2:
              options = _context10.sent;
              _context10.next = 5;
              return api("vehicleState", options);

            case 5:
              state = _context10.sent;
              return _context10.abrupt("return", state.ft ? Characteristic.LockTargetState.UNSECURED : Characteristic.LockTargetState.SECURED);

            case 7:
            case "end":
              return _context10.stop();
          }
        }
      }, _callee10, this);
    })));

    _defineProperty(this, "setFrunkTargetState",
    /*#__PURE__*/
    function () {
      var _ref11 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee11(state) {
        var options, frunkService;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                _context11.next = 2;
                return _this.getOptions();

              case 2:
                options = _context11.sent;
                _context11.next = 5;
                return _this.wakeUp();

              case 5:
                _this.log("Set frunk state to", state);

                if (!(state === Characteristic.LockTargetState.SECURED)) {
                  _context11.next = 10;
                  break;
                }

                throw new Error("Cannot close an open frunk.");

              case 10:
                _context11.next = 12;
                return api("openTrunk", options, tesla$1.FRUNK);

              case 12:
                _context11.next = 14;
                return wait(1);

              case 14:
                frunkService = _this.frunkService;
                frunkService && frunkService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);

              case 16:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      return function (_x4) {
        return _ref11.apply(this, arguments);
      };
    }());

    _defineProperty(this, "getChargePortCurrentState",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee12() {
      var options, state;
      return regeneratorRuntime.wrap(function _callee12$(_context12) {
        while (1) {
          switch (_context12.prev = _context12.next) {
            case 0:
              _context12.next = 2;
              return _this.getOptions();

            case 2:
              options = _context12.sent;
              _context12.next = 5;
              return api("vehicleData", options);

            case 5:
              state = _context12.sent;
              return _context12.abrupt("return", state.charge_state.charge_port_door_open ? Characteristic.LockCurrentState.UNSECURED : Characteristic.LockCurrentState.SECURED);

            case 7:
            case "end":
              return _context12.stop();
          }
        }
      }, _callee12, this);
    })));

    _defineProperty(this, "getChargePortTargetState",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee13() {
      var options, state;
      return regeneratorRuntime.wrap(function _callee13$(_context13) {
        while (1) {
          switch (_context13.prev = _context13.next) {
            case 0:
              _context13.next = 2;
              return _this.getOptions();

            case 2:
              options = _context13.sent;
              _context13.next = 5;
              return api("vehicleData", options);

            case 5:
              state = _context13.sent;
              return _context13.abrupt("return", state.charge_state.charge_port_door_open ? Characteristic.LockTargetState.UNSECURED : Characteristic.LockTargetState.SECURED);

            case 7:
            case "end":
              return _context13.stop();
          }
        }
      }, _callee13, this);
    })));

    _defineProperty(this, "setChargePortTargetState",
    /*#__PURE__*/
    function () {
      var _ref14 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee14(state) {
        var options;
        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                _context14.next = 2;
                return _this.getOptions();

              case 2:
                options = _context14.sent;
                _context14.next = 5;
                return _this.wakeUp();

              case 5:
                _this.log("Set charge port state to", state);

                if (!(state === Characteristic.LockTargetState.SECURED)) {
                  _context14.next = 11;
                  break;
                }

                _context14.next = 9;
                return api("closeChargePort", options);

              case 9:
                _context14.next = 13;
                break;

              case 11:
                _context14.next = 13;
                return api("openChargePort", options);

              case 13:
                _context14.next = 15;
                return wait(1);

              case 15:
                if (state == Characteristic.LockTargetState.SECURED) {
                  _this.chargePortService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
                } else {
                  _this.chargePortService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
                }

              case 16:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      return function (_x5) {
        return _ref14.apply(this, arguments);
      };
    }());

    _defineProperty(this, "getOptions",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee15() {
      var unlock, _authToken, _ref16, _vehicleID;

      return regeneratorRuntime.wrap(function _callee15$(_context15) {
        while (1) {
          switch (_context15.prev = _context15.next) {
            case 0:
              _context15.next = 2;
              return lock("getOptions", 20000);

            case 2:
              unlock = _context15.sent;
              _context15.prev = 3;
              _context15.next = 6;
              return _this.getAuthToken();

            case 6:
              _authToken = _context15.sent;
              _context15.next = 9;
              return _this.getVehicle();

            case 9:
              _ref16 = _context15.sent;
              _vehicleID = _ref16.id_s;
              return _context15.abrupt("return", {
                authToken: _authToken,
                vehicleID: _vehicleID
              });

            case 12:
              _context15.prev = 12;
              unlock();
              return _context15.finish(12);

            case 15:
            case "end":
              return _context15.stop();
          }
        }
      }, _callee15, this, [[3,, 12, 15]]);
    })));

    _defineProperty(this, "getAuthToken",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee16() {
      var username, password, authToken, result, token;
      return regeneratorRuntime.wrap(function _callee16$(_context16) {
        while (1) {
          switch (_context16.prev = _context16.next) {
            case 0:
              username = _this.username, password = _this.password, authToken = _this.authToken; // Return cached value if we have one.

              if (!authToken) {
                _context16.next = 3;
                break;
              }

              return _context16.abrupt("return", authToken);

            case 3:
              _this.log("Logging into Tesla with username/password…");

              _context16.next = 6;
              return api("login", username, password);

            case 6:
              result = _context16.sent;
              token = result.authToken; // Save it in memory for future API calls.

              _this.log("Got a login token.");

              _this.authToken = token;
              return _context16.abrupt("return", token);

            case 11:
            case "end":
              return _context16.stop();
          }
        }
      }, _callee16, this);
    })));

    _defineProperty(this, "getVehicle",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee17() {
      var vin, authToken, vehicles, vehicle, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _vehicle;

      return regeneratorRuntime.wrap(function _callee17$(_context17) {
        while (1) {
          switch (_context17.prev = _context17.next) {
            case 0:
              vin = _this.vin; // Only way to do this is to get ALL vehicles then filter out the one
              // we want.

              _context17.next = 3;
              return _this.getAuthToken();

            case 3:
              authToken = _context17.sent;
              _context17.next = 6;
              return api("allVehicles", {
                authToken
              });

            case 6:
              vehicles = _context17.sent;
              // Now figure out which vehicle matches your VIN.
              // `vehicles` is something like:
              // [ { id_s: '18488650400306554', vin: '5YJ3E1EA8JF006024', state: 'asleep', ... }, ... ]
              vehicle = vehicles.find(function (v) {
                return v.vin === vin;
              });

              if (vehicle) {
                _context17.next = 30;
                break;
              }

              _this.log("No vehicles were found matching the VIN ${vin} entered in your config.json. Available vehicles:");

              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context17.prev = 13;

              for (_iterator = vehicles[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                _vehicle = _step.value;

                _this.log("${vehicle.vin} [${vehicle.display_name}]");
              }

              _context17.next = 21;
              break;

            case 17:
              _context17.prev = 17;
              _context17.t0 = _context17["catch"](13);
              _didIteratorError = true;
              _iteratorError = _context17.t0;

            case 21:
              _context17.prev = 21;
              _context17.prev = 22;

              if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
              }

            case 24:
              _context17.prev = 24;

              if (!_didIteratorError) {
                _context17.next = 27;
                break;
              }

              throw _iteratorError;

            case 27:
              return _context17.finish(24);

            case 28:
              return _context17.finish(21);

            case 29:
              throw new Error(`Couldn't find vehicle with VIN ${vin}.`);

            case 30:
              _this.log(`Using vehicle "${vehicle.display_name}" with state "${vehicle.state}"`);

              return _context17.abrupt("return", vehicle);

            case 32:
            case "end":
              return _context17.stop();
          }
        }
      }, _callee17, this, [[13, 17, 21, 29], [22,, 24, 28]]);
    })));

    _defineProperty(this, "wakeUp",
    /*#__PURE__*/
    _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee18() {
      var options, start, waitTime, _ref20, state;

      return regeneratorRuntime.wrap(function _callee18$(_context18) {
        while (1) {
          switch (_context18.prev = _context18.next) {
            case 0:
              _context18.next = 2;
              return _this.getOptions();

            case 2:
              options = _context18.sent;
              _context18.next = 5;
              return api("wakeUp", options);

            case 5:
              // Wait up to 30 seconds for the car to wake up.
              start = Date.now();
              waitTime = 1000;

            case 7:
              if (!(Date.now() - start < _this.waitMinutes * 60 * 1000)) {
                _context18.next = 20;
                break;
              }

              _context18.next = 10;
              return _this.getVehicle();

            case 10:
              _ref20 = _context18.sent;
              state = _ref20.state;

              if (!(state === "online")) {
                _context18.next = 14;
                break;
              }

              return _context18.abrupt("return");

            case 14:
              _this.log("Waiting for vehicle to wake up…");

              _context18.next = 17;
              return wait(waitTime);

            case 17:
              // Use exponential backoff with a max wait of 5 seconds.
              waitTime = Math.min(waitTime * 2, 5000);
              _context18.next = 7;
              break;

            case 20:
              throw new Error(`Vehicle did not wake up within ${_this.waitMinutes} minutes.`);

            case 21:
            case "end":
              return _context18.stop();
          }
        }
      }, _callee18, this);
    })));

    this.log = log;
    this.name = config["name"];
    this.trunk = config["trunk"];
    this.frunk = config["frunk"];
    this.chargePort = config["chargePort"];
    this.vin = config["vin"];
    this.username = config["username"];
    this.password = config["password"];
    this.waitMinutes = config["waitMinutes"] || 1; // default to one minute.

    var lockService = new Service.LockMechanism(this.name, "vehicle");
    lockService.getCharacteristic(Characteristic.LockCurrentState).on("get", callbackify(this.getLockCurrentState));
    lockService.getCharacteristic(Characteristic.LockTargetState).on("get", callbackify(this.getLockTargetState)).on("set", callbackify(this.setLockTargetState));
    this.lockService = lockService;
    var climateService = new Service.Switch(this.name);
    climateService.getCharacteristic(Characteristic.On).on("get", callbackify(this.getClimateOn)).on("set", callbackify(this.setClimateOn));
    this.climateService = climateService;

    if (this.trunk) {
      // Enable the rear trunk lock service if requested. Use the name given
      // in your config.
      var trunkService = new Service.LockMechanism(this.trunk, "trunk");
      trunkService.getCharacteristic(Characteristic.LockCurrentState).on("get", callbackify(this.getTrunkCurrentState));
      trunkService.getCharacteristic(Characteristic.LockTargetState).on("get", callbackify(this.getTrunkTargetState)).on("set", callbackify(this.setTrunkTargetState));
      this.trunkService = trunkService;
    }

    if (this.frunk) {
      // Enable the front trunk lock service if requested. Use the name given
      // in your config.
      var frunkService = new Service.LockMechanism(this.frunk, "frunk");
      frunkService.getCharacteristic(Characteristic.LockCurrentState).on("get", callbackify(this.getFrunkCurrentState));
      frunkService.getCharacteristic(Characteristic.LockTargetState).on("get", callbackify(this.getFrunkTargetState)).on("set", callbackify(this.setFrunkTargetState));
      this.frunkService = frunkService;
    }

    if (this.chargePort) {
      // Enable the charge port trunk lock service if requested. Use the name given
      // in your config.
      var chargePortService = new Service.LockMechanism(this.chargePort, "chargePort");
      chargePortService.getCharacteristic(Characteristic.LockCurrentState).on("get", callbackify(this.getChargePortCurrentState));
      chargePortService.getCharacteristic(Characteristic.LockTargetState).on("get", callbackify(this.getChargePortTargetState)).on("set", callbackify(this.setChargePortTargetState));
      this.chargePortService = chargePortService;
    }
  }

  _createClass(TeslaAccessory, [{
    key: "getServices",
    value: function getServices() {
      var lockService = this.lockService,
          climateService = this.climateService,
          trunkService = this.trunkService,
          frunkService = this.frunkService,
          chargePortService = this.chargePortService;
      return [lockService, climateService].concat(_toConsumableArray(trunkService ? [trunkService] : []), _toConsumableArray(frunkService ? [frunkService] : []), _toConsumableArray(chargePortService ? [chargePortService] : []));
    } //
    // Vehicle Lock
    //

  }]);

  return TeslaAccessory;
}();

module.exports = index;
