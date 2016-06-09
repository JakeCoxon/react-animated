/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Interpolation
 * 
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var tinycolor = require('./tinycolor');

// TODO(#7644673): fix this hack once github jest actually checks invariants
var invariant = function invariant(condition, message) {
  if (!condition) {
    var error = new Error(message);
    error.framesToPop = 1; // $FlowIssue
    throw error;
  }
};

var linear = function linear(t) {
  return t;
};

/**
 * Very handy helper to map input ranges to output ranges with an easing
 * function and custom behavior outside of the ranges.
 */

var Interpolation = (function () {
  function Interpolation() {
    _classCallCheck(this, Interpolation);
  }

  Interpolation.create = function create(config) {

    if (config.outputRange && typeof config.outputRange[0] === 'string') {
      return createInterpolationFromStringOutputRange(config);
    }

    var outputRange = config.outputRange;
    checkInfiniteRange('outputRange', outputRange);

    var inputRange = config.inputRange;
    checkInfiniteRange('inputRange', inputRange);
    checkValidInputRange(inputRange);

    !(inputRange.length === outputRange.length) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'inputRange (' + inputRange.length + ') and outputRange (' + outputRange.length + ') must have the same length') : invariant(false) : undefined;

    var easing = config.easing || linear;

    var extrapolateLeft = 'extend';
    if (config.extrapolateLeft !== undefined) {
      extrapolateLeft = config.extrapolateLeft;
    } else if (config.extrapolate !== undefined) {
      extrapolateLeft = config.extrapolate;
    }

    var extrapolateRight = 'extend';
    if (config.extrapolateRight !== undefined) {
      extrapolateRight = config.extrapolateRight;
    } else if (config.extrapolate !== undefined) {
      extrapolateRight = config.extrapolate;
    }

    return function (input) {
      !(typeof input === 'number') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Cannot interpolation an input which is not a number') : invariant(false) : undefined;

      var range = findRange(input, inputRange);
      return interpolate(input, inputRange[range], inputRange[range + 1], outputRange[range], outputRange[range + 1], easing, extrapolateLeft, extrapolateRight);
    };
  };

  return Interpolation;
})();

function interpolate(input, inputMin, inputMax, outputMin, outputMax, easing, extrapolateLeft, extrapolateRight) {
  var result = input;

  // Extrapolate
  if (result < inputMin) {
    if (extrapolateLeft === 'identity') {
      return result;
    } else if (extrapolateLeft === 'clamp') {
      result = inputMin;
    } else if (extrapolateLeft === 'extend') {
      // noop
    }
  }

  if (result > inputMax) {
    if (extrapolateRight === 'identity') {
      return result;
    } else if (extrapolateRight === 'clamp') {
      result = inputMax;
    } else if (extrapolateRight === 'extend') {
      // noop
    }
  }

  if (outputMin === outputMax) {
    return outputMin;
  }

  if (inputMin === inputMax) {
    if (input <= inputMin) {
      return outputMin;
    }
    return outputMax;
  }

  // Input Range
  if (inputMin === -Infinity) {
    result = -result;
  } else if (inputMax === Infinity) {
    result = result - inputMin;
  } else {
    result = (result - inputMin) / (inputMax - inputMin);
  }

  // Easing
  result = easing(result);

  // Output Range
  if (outputMin === -Infinity) {
    result = -result;
  } else if (outputMax === Infinity) {
    result = result + outputMin;
  } else {
    result = result * (outputMax - outputMin) + outputMin;
  }

  return result;
}

function colorToRgba(input) {
  var color = tinycolor(input);
  if (color.isValid()) {
    var _color$toRgb = color.toRgb();

    var r = _color$toRgb.r;
    var g = _color$toRgb.g;
    var b = _color$toRgb.b;
    var a = _color$toRgb.a;

    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (a === undefined ? 1 : a) + ')';
  } else {
    return input;
  }
}

var stringShapeRegex = /[0-9\.-]+/g;

/**
 * Supports string shapes by extracting numbers so new values can be computed,
 * and recombines those values into new strings of the same shape.  Supports
 * things like:
 *
 *   rgba(123, 42, 99, 0.36) // colors
 *   -45deg                  // values with units
 */
function createInterpolationFromStringOutputRange(config) {
  var outputRange = config.outputRange;
  !(outputRange.length >= 2) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Bad output range') : invariant(false) : undefined;
  outputRange = outputRange.map(colorToRgba);
  checkPattern(outputRange);

  // ['rgba(0, 100, 200, 0)', 'rgba(50, 150, 250, 0.5)']
  // ->
  // [
  //   [0, 50],
  //   [100, 150],
  //   [200, 250],
  //   [0, 0.5],
  // ]
  /* $FlowFixMe(>=0.18.0): `outputRange[0].match()` can return `null`. Need to
   * guard against this possibility.
   */
  var outputRanges = outputRange[0].match(stringShapeRegex).map(function () {
    return [];
  });
  outputRange.forEach(function (value) {
    /* $FlowFixMe(>=0.18.0): `value.match()` can return `null`. Need to guard
     * against this possibility.
     */
    value.match(stringShapeRegex).forEach(function (number, i) {
      outputRanges[i].push(+number);
    });
  });

  /* $FlowFixMe(>=0.18.0): `outputRange[0].match()` can return `null`. Need to
   * guard against this possibility.
   */
  var interpolations = outputRange[0].match(stringShapeRegex).map(function (value, i) {
    return Interpolation.create(_extends({}, config, {
      outputRange: outputRanges[i]
    }));
  });

  return function (input) {
    var i = 0;
    // 'rgba(0, 100, 200, 0)'
    // ->
    // 'rgba(${interpolations[0](input)}, ${interpolations[1](input)}, ...'
    return outputRange[0].replace(stringShapeRegex, function () {
      return String(interpolations[i++](input));
    });
  };
}

function checkPattern(arr) {
  var pattern = arr[0].replace(stringShapeRegex, '');
  for (var i = 1; i < arr.length; ++i) {
    !(pattern === arr[i].replace(stringShapeRegex, '')) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'invalid pattern ' + arr[0] + ' and ' + arr[i]) : invariant(false) : undefined;
  }
}

function findRange(input, inputRange) {
  for (var i = 1; i < inputRange.length - 1; ++i) {
    if (inputRange[i] >= input) {
      break;
    }
  }
  return i - 1;
}

function checkValidInputRange(arr) {
  !(arr.length >= 2) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'inputRange must have at least 2 elements') : invariant(false) : undefined;
  for (var i = 1; i < arr.length; ++i) {
    !(arr[i] >= arr[i - 1]) ? process.env.NODE_ENV !== 'production' ? invariant(false,
    /* $FlowFixMe(>=0.13.0) - In the addition expression below this comment,
     * one or both of the operands may be something that doesn't cleanly
     * convert to a string, like undefined, null, and object, etc. If you really
     * mean this implicit string conversion, you can do something like
     * String(myThing)
     */
    'inputRange must be monotonically increasing ' + arr) : invariant(false) : undefined;
  }
}

function checkInfiniteRange(name, arr) {
  !(arr.length >= 2) ? process.env.NODE_ENV !== 'production' ? invariant(false, name + ' must have at least 2 elements') : invariant(false) : undefined;
  !(arr.length !== 2 || arr[0] !== -Infinity || arr[1] !== Infinity) ? process.env.NODE_ENV !== 'production' ? invariant(false,
  /* $FlowFixMe(>=0.13.0) - In the addition expression below this comment,
   * one or both of the operands may be something that doesn't cleanly convert
   * to a string, like undefined, null, and object, etc. If you really mean
   * this implicit string conversion, you can do something like
   * String(myThing)
   */
  name + 'cannot be ]-infinity;+infinity[ ' + arr) : invariant(false) : undefined;
}

module.exports = Interpolation;