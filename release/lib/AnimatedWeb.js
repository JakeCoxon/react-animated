/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * 
 */
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var AnimatedImplementation = require('./AnimatedImplementation');

module.exports = _extends({}, AnimatedImplementation, {
  div: AnimatedImplementation.createAnimatedComponent('div'),
  span: AnimatedImplementation.createAnimatedComponent('span'),
  img: AnimatedImplementation.createAnimatedComponent('img')
});