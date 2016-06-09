/**
 * Animated v
 */
var Animated =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

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

	var _extends = Object.assign || function (target) {
	  for (var i = 1; i < arguments.length; i++) {
	    var source = arguments[i];for (var key in source) {
	      if (Object.prototype.hasOwnProperty.call(source, key)) {
	        target[key] = source[key];
	      }
	    }
	  }return target;
	};

	var AnimatedImplementation = __webpack_require__(1);

	module.exports = _extends({}, AnimatedImplementation, {
	  div: AnimatedImplementation.createAnimatedComponent('div'),
	  span: AnimatedImplementation.createAnimatedComponent('span'),
	  img: AnimatedImplementation.createAnimatedComponent('img')
	});

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Copyright (c) 2015-present, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 *
	 * @providesModule AnimatedImplementation
	 * 
	 */
	'use strict';

	var _extends = Object.assign || function (target) {
	  for (var i = 1; i < arguments.length; i++) {
	    var source = arguments[i];for (var key in source) {
	      if (Object.prototype.hasOwnProperty.call(source, key)) {
	        target[key] = source[key];
	      }
	    }
	  }return target;
	};

	function _inherits(subClass, superClass) {
	  if (typeof superClass !== 'function' && superClass !== null) {
	    throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass);
	  }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
	}

	function _classCallCheck(instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError('Cannot call a class as a function');
	  }
	}

	var Easing = __webpack_require__(2);
	var InteractionManager = __webpack_require__(3);
	var Interpolation = __webpack_require__(4);
	var React = __webpack_require__(14);
	var Set = __webpack_require__(5);
	var SpringConfig = __webpack_require__(6);
	var ViewStylePropTypes = {};

	var flattenStyle = __webpack_require__(8);
	var invariant = __webpack_require__(11);
	var requestAnimationFrame = __webpack_require__(13);

	// Note(vjeux): this would be better as an interface but flow doesn't
	// support them yet

	var Animated = (function () {
	  function Animated() {
	    _classCallCheck(this, Animated);
	  }

	  Animated.prototype.__attach = function __attach() {};

	  Animated.prototype.__detach = function __detach() {};

	  Animated.prototype.__getValue = function __getValue() {};

	  Animated.prototype.__getAnimatedValue = function __getAnimatedValue() {
	    return this.__getValue();
	  };

	  Animated.prototype.__addChild = function __addChild(child) {};

	  Animated.prototype.__removeChild = function __removeChild(child) {};

	  Animated.prototype.__getChildren = function __getChildren() {
	    return [];
	  };

	  return Animated;
	})();

	// Important note: start() and stop() will only be called at most once.
	// Once an animation has been stopped or finished its course, it will
	// not be reused.

	var Animation = (function () {
	  function Animation() {
	    _classCallCheck(this, Animation);
	  }

	  Animation.prototype.start = function start(fromValue, onUpdate, onEnd, previousAnimation) {};

	  Animation.prototype.stop = function stop() {};

	  // Helper function for subclasses to make sure onEnd is only called once.

	  Animation.prototype.__debouncedOnEnd = function __debouncedOnEnd(result) {
	    var onEnd = this.__onEnd;
	    this.__onEnd = null;
	    onEnd && onEnd(result);
	  };

	  return Animation;
	})();

	var AnimatedWithChildren = (function (_Animated) {
	  _inherits(AnimatedWithChildren, _Animated);

	  function AnimatedWithChildren() {
	    _classCallCheck(this, AnimatedWithChildren);

	    _Animated.call(this);
	    this._children = [];
	  }

	  /**
	   * Animated works by building a directed acyclic graph of dependencies
	   * transparently when you render your Animated components.
	   *
	   *               new Animated.Value(0)
	   *     .interpolate()        .interpolate()    new Animated.Value(1)
	   *         opacity               translateY      scale
	   *          style                         transform
	   *         View#234                         style
	   *                                         View#123
	   *
	   * A) Top Down phase
	   * When an Animated.Value is updated, we recursively go down through this
	   * graph in order to find leaf nodes: the views that we flag as needing
	   * an update.
	   *
	   * B) Bottom Up phase
	   * When a view is flagged as needing an update, we recursively go back up
	   * in order to build the new value that it needs. The reason why we need
	   * this two-phases process is to deal with composite props such as
	   * transform which can receive values from multiple parents.
	   */

	  AnimatedWithChildren.prototype.__addChild = function __addChild(child) {
	    if (this._children.length === 0) {
	      this.__attach();
	    }
	    this._children.push(child);
	  };

	  AnimatedWithChildren.prototype.__removeChild = function __removeChild(child) {
	    var index = this._children.indexOf(child);
	    if (index === -1) {
	      console.warn('Trying to remove a child that doesn\'t exist');
	      return;
	    }
	    this._children.splice(index, 1);
	    if (this._children.length === 0) {
	      this.__detach();
	    }
	  };

	  AnimatedWithChildren.prototype.__getChildren = function __getChildren() {
	    return this._children;
	  };

	  return AnimatedWithChildren;
	})(Animated);

	function _flush(rootNode) {
	  var animatedStyles = new Set();
	  function findAnimatedStyles(node) {
	    if (typeof node.update === 'function') {
	      animatedStyles.add(node);
	    } else {
	      node.__getChildren().forEach(findAnimatedStyles);
	    }
	  }
	  findAnimatedStyles(rootNode);
	  animatedStyles.forEach(function (animatedStyle) {
	    return animatedStyle.update();
	  });
	}

	var easeInOut = Easing.inOut(Easing.ease);

	var TimingAnimation = (function (_Animation) {
	  _inherits(TimingAnimation, _Animation);

	  function TimingAnimation(config) {
	    _classCallCheck(this, TimingAnimation);

	    _Animation.call(this);
	    this._toValue = config.toValue;
	    this._easing = config.easing || easeInOut;
	    this._duration = config.duration !== undefined ? config.duration : 500;
	    this._delay = config.delay || 0;
	    this.__isInteraction = config.isInteraction !== undefined ? config.isInteraction : true;
	  }

	  TimingAnimation.prototype.start = function start(fromValue, onUpdate, onEnd) {
	    var _this = this;

	    this.__active = true;
	    this._fromValue = fromValue;
	    this._onUpdate = onUpdate;
	    this.__onEnd = onEnd;

	    var start = function start() {
	      if (_this._duration === 0) {
	        _this._onUpdate(_this._toValue);
	        _this.__debouncedOnEnd({ finished: true });
	      } else {
	        _this._startTime = Date.now();
	        _this._animationFrame = requestAnimationFrame(_this.onUpdate.bind(_this));
	      }
	    };
	    if (this._delay) {
	      this._timeout = setTimeout(start, this._delay);
	    } else {
	      start();
	    }
	  };

	  TimingAnimation.prototype.onUpdate = function onUpdate() {
	    var now = Date.now();
	    if (now >= this._startTime + this._duration) {
	      if (this._duration === 0) {
	        this._onUpdate(this._toValue);
	      } else {
	        this._onUpdate(this._fromValue + this._easing(1) * (this._toValue - this._fromValue));
	      }
	      this.__debouncedOnEnd({ finished: true });
	      return;
	    }

	    this._onUpdate(this._fromValue + this._easing((now - this._startTime) / this._duration) * (this._toValue - this._fromValue));
	    if (this.__active) {
	      this._animationFrame = requestAnimationFrame(this.onUpdate.bind(this));
	    }
	  };

	  TimingAnimation.prototype.stop = function stop() {
	    this.__active = false;
	    clearTimeout(this._timeout);
	    window.cancelAnimationFrame(this._animationFrame);
	    this.__debouncedOnEnd({ finished: false });
	  };

	  return TimingAnimation;
	})(Animation);

	var DecayAnimation = (function (_Animation2) {
	  _inherits(DecayAnimation, _Animation2);

	  function DecayAnimation(config) {
	    _classCallCheck(this, DecayAnimation);

	    _Animation2.call(this);
	    this._deceleration = config.deceleration || 0.998;
	    this._velocity = config.velocity;
	    this.__isInteraction = config.isInteraction !== undefined ? config.isInteraction : true;
	  }

	  DecayAnimation.prototype.start = function start(fromValue, onUpdate, onEnd) {
	    this.__active = true;
	    this._lastValue = fromValue;
	    this._fromValue = fromValue;
	    this._onUpdate = onUpdate;
	    this.__onEnd = onEnd;
	    this._startTime = Date.now();
	    this._animationFrame = requestAnimationFrame(this.onUpdate.bind(this));
	  };

	  DecayAnimation.prototype.onUpdate = function onUpdate() {
	    var now = Date.now();

	    var value = this._fromValue + this._velocity / (1 - this._deceleration) * (1 - Math.exp(-(1 - this._deceleration) * (now - this._startTime)));

	    this._onUpdate(value);

	    if (Math.abs(this._lastValue - value) < 0.1) {
	      this.__debouncedOnEnd({ finished: true });
	      return;
	    }

	    this._lastValue = value;
	    if (this.__active) {
	      this._animationFrame = requestAnimationFrame(this.onUpdate.bind(this));
	    }
	  };

	  DecayAnimation.prototype.stop = function stop() {
	    this.__active = false;
	    window.cancelAnimationFrame(this._animationFrame);
	    this.__debouncedOnEnd({ finished: false });
	  };

	  return DecayAnimation;
	})(Animation);

	function withDefault(value, defaultValue) {
	  if (value === undefined || value === null) {
	    return defaultValue;
	  }
	  return value;
	}

	var SpringAnimation = (function (_Animation3) {
	  _inherits(SpringAnimation, _Animation3);

	  function SpringAnimation(config) {
	    _classCallCheck(this, SpringAnimation);

	    _Animation3.call(this);

	    this._overshootClamping = withDefault(config.overshootClamping, false);
	    this._restDisplacementThreshold = withDefault(config.restDisplacementThreshold, 0.001);
	    this._restSpeedThreshold = withDefault(config.restSpeedThreshold, 0.001);
	    this._initialVelocity = config.velocity;
	    this._lastVelocity = withDefault(config.velocity, 0);
	    this._toValue = config.toValue;
	    this.__isInteraction = config.isInteraction !== undefined ? config.isInteraction : true;

	    var springConfig;
	    if (config.bounciness !== undefined || config.speed !== undefined) {
	      !(config.tension === undefined && config.friction === undefined) ?  true ? invariant(false, 'You can only define bounciness/speed or tension/friction but not both') : invariant(false) : undefined;
	      springConfig = SpringConfig.fromBouncinessAndSpeed(withDefault(config.bounciness, 8), withDefault(config.speed, 12));
	    } else {
	      springConfig = SpringConfig.fromOrigamiTensionAndFriction(withDefault(config.tension, 40), withDefault(config.friction, 7));
	    }
	    this._tension = springConfig.tension;
	    this._friction = springConfig.friction;
	  }

	  SpringAnimation.prototype.start = function start(fromValue, onUpdate, onEnd, previousAnimation) {
	    this.__active = true;
	    this._startPosition = fromValue;
	    this._lastPosition = this._startPosition;

	    this._onUpdate = onUpdate;
	    this.__onEnd = onEnd;
	    this._lastTime = Date.now();

	    if (previousAnimation instanceof SpringAnimation) {
	      var internalState = previousAnimation.getInternalState();
	      this._lastPosition = internalState.lastPosition;
	      this._lastVelocity = internalState.lastVelocity;
	      this._lastTime = internalState.lastTime;
	    }
	    if (this._initialVelocity !== undefined && this._initialVelocity !== null) {
	      this._lastVelocity = this._initialVelocity;
	    }
	    this.onUpdate();
	  };

	  SpringAnimation.prototype.getInternalState = function getInternalState() {
	    return {
	      lastPosition: this._lastPosition,
	      lastVelocity: this._lastVelocity,
	      lastTime: this._lastTime
	    };
	  };

	  SpringAnimation.prototype.onUpdate = function onUpdate() {
	    var position = this._lastPosition;
	    var velocity = this._lastVelocity;

	    var tempPosition = this._lastPosition;
	    var tempVelocity = this._lastVelocity;

	    // If for some reason we lost a lot of frames (e.g. process large payload or
	    // stopped in the debugger), we only advance by 4 frames worth of
	    // computation and will continue on the next frame. It's better to have it
	    // running at faster speed than jumping to the end.
	    var MAX_STEPS = 64;
	    var now = Date.now();
	    if (now > this._lastTime + MAX_STEPS) {
	      now = this._lastTime + MAX_STEPS;
	    }

	    // We are using a fixed time step and a maximum number of iterations.
	    // The following post provides a lot of thoughts into how to build this
	    // loop: http://gafferongames.com/game-physics/fix-your-timestep/
	    var TIMESTEP_MSEC = 1;
	    var numSteps = Math.floor((now - this._lastTime) / TIMESTEP_MSEC);

	    for (var i = 0; i < numSteps; ++i) {
	      // Velocity is based on seconds instead of milliseconds
	      var step = TIMESTEP_MSEC / 1000;

	      // This is using RK4. A good blog post to understand how it works:
	      // http://gafferongames.com/game-physics/integration-basics/
	      var aVelocity = velocity;
	      var aAcceleration = this._tension * (this._toValue - tempPosition) - this._friction * tempVelocity;
	      var tempPosition = position + aVelocity * step / 2;
	      var tempVelocity = velocity + aAcceleration * step / 2;

	      var bVelocity = tempVelocity;
	      var bAcceleration = this._tension * (this._toValue - tempPosition) - this._friction * tempVelocity;
	      tempPosition = position + bVelocity * step / 2;
	      tempVelocity = velocity + bAcceleration * step / 2;

	      var cVelocity = tempVelocity;
	      var cAcceleration = this._tension * (this._toValue - tempPosition) - this._friction * tempVelocity;
	      tempPosition = position + cVelocity * step / 2;
	      tempVelocity = velocity + cAcceleration * step / 2;

	      var dVelocity = tempVelocity;
	      var dAcceleration = this._tension * (this._toValue - tempPosition) - this._friction * tempVelocity;
	      tempPosition = position + cVelocity * step / 2;
	      tempVelocity = velocity + cAcceleration * step / 2;

	      var dxdt = (aVelocity + 2 * (bVelocity + cVelocity) + dVelocity) / 6;
	      var dvdt = (aAcceleration + 2 * (bAcceleration + cAcceleration) + dAcceleration) / 6;

	      position += dxdt * step;
	      velocity += dvdt * step;
	    }

	    this._lastTime = now;
	    this._lastPosition = position;
	    this._lastVelocity = velocity;

	    this._onUpdate(position);
	    if (!this.__active) {
	      // a listener might have stopped us in _onUpdate
	      return;
	    }

	    // Conditions for stopping the spring animation
	    var isOvershooting = false;
	    if (this._overshootClamping && this._tension !== 0) {
	      if (this._startPosition < this._toValue) {
	        isOvershooting = position > this._toValue;
	      } else {
	        isOvershooting = position < this._toValue;
	      }
	    }
	    var isVelocity = Math.abs(velocity) <= this._restSpeedThreshold;
	    var isDisplacement = true;
	    if (this._tension !== 0) {
	      isDisplacement = Math.abs(this._toValue - position) <= this._restDisplacementThreshold;
	    }

	    if (isOvershooting || isVelocity && isDisplacement) {
	      if (this._tension !== 0) {
	        // Ensure that we end up with a round value
	        this._onUpdate(this._toValue);
	      }

	      this.__debouncedOnEnd({ finished: true });
	      return;
	    }
	    this._animationFrame = requestAnimationFrame(this.onUpdate.bind(this));
	  };

	  SpringAnimation.prototype.stop = function stop() {
	    this.__active = false;
	    window.cancelAnimationFrame(this._animationFrame);
	    this.__debouncedOnEnd({ finished: false });
	  };

	  return SpringAnimation;
	})(Animation);

	var _uniqueId = 1;

	/**
	 * Standard value for driving animations.  One `Animated.Value` can drive
	 * multiple properties in a synchronized fashion, but can only be driven by one
	 * mechanism at a time.  Using a new mechanism (e.g. starting a new animation,
	 * or calling `setValue`) will stop any previous ones.
	 */

	var AnimatedValue = (function (_AnimatedWithChildren) {
	  _inherits(AnimatedValue, _AnimatedWithChildren);

	  function AnimatedValue(value) {
	    _classCallCheck(this, AnimatedValue);

	    _AnimatedWithChildren.call(this);
	    this._value = value;
	    this._offset = 0;
	    this._animation = null;
	    this._listeners = {};
	  }

	  AnimatedValue.prototype.__detach = function __detach() {
	    this.stopAnimation();
	  };

	  AnimatedValue.prototype.__getValue = function __getValue() {
	    return this._value + this._offset;
	  };

	  /**
	   * Directly set the value.  This will stop any animations running on the value
	   * and update all the bound properties.
	   */

	  AnimatedValue.prototype.setValue = function setValue(value) {
	    if (this._animation) {
	      this._animation.stop();
	      this._animation = null;
	    }
	    this._updateValue(value);
	  };

	  /**
	   * Sets an offset that is applied on top of whatever value is set, whether via
	   * `setValue`, an animation, or `Animated.event`.  Useful for compensating
	   * things like the start of a pan gesture.
	   */

	  AnimatedValue.prototype.setOffset = function setOffset(offset) {
	    this._offset = offset;
	  };

	  /**
	   * Merges the offset value into the base value and resets the offset to zero.
	   * The final output of the value is unchanged.
	   */

	  AnimatedValue.prototype.flattenOffset = function flattenOffset() {
	    this._value += this._offset;
	    this._offset = 0;
	  };

	  /**
	   * Adds an asynchronous listener to the value so you can observe updates from
	   * animations.  This is useful because there is no way to
	   * synchronously read the value because it might be driven natively.
	   */

	  AnimatedValue.prototype.addListener = function addListener(callback) {
	    var id = String(_uniqueId++);
	    this._listeners[id] = callback;
	    return id;
	  };

	  AnimatedValue.prototype.removeListener = function removeListener(id) {
	    delete this._listeners[id];
	  };

	  AnimatedValue.prototype.removeAllListeners = function removeAllListeners() {
	    this._listeners = {};
	  };

	  /**
	   * Stops any running animation or tracking.  `callback` is invoked with the
	   * final value after stopping the animation, which is useful for updating
	   * state to match the animation position with layout.
	   */

	  AnimatedValue.prototype.stopAnimation = function stopAnimation(callback) {
	    this.stopTracking();
	    this._animation && this._animation.stop();
	    this._animation = null;
	    callback && callback(this.__getValue());
	  };

	  /**
	   * Interpolates the value before updating the property, e.g. mapping 0-1 to
	   * 0-10.
	   */

	  AnimatedValue.prototype.interpolate = function interpolate(config) {
	    return new AnimatedInterpolation(this, Interpolation.create(config));
	  };

	  /**
	   * Typically only used internally, but could be used by a custom Animation
	   * class.
	   */

	  AnimatedValue.prototype.animate = function animate(animation, callback) {
	    var _this2 = this;

	    var handle = null;
	    if (animation.__isInteraction) {
	      handle = InteractionManager.createInteractionHandle();
	    }
	    var previousAnimation = this._animation;
	    this._animation && this._animation.stop();
	    this._animation = animation;
	    animation.start(this._value, function (value) {
	      _this2._updateValue(value);
	    }, function (result) {
	      _this2._animation = null;
	      if (handle !== null) {
	        InteractionManager.clearInteractionHandle(handle);
	      }
	      callback && callback(result);
	    }, previousAnimation);
	  };

	  /**
	   * Typically only used internally.
	   */

	  AnimatedValue.prototype.stopTracking = function stopTracking() {
	    this._tracking && this._tracking.__detach();
	    this._tracking = null;
	  };

	  /**
	   * Typically only used internally.
	   */

	  AnimatedValue.prototype.track = function track(tracking) {
	    this.stopTracking();
	    this._tracking = tracking;
	  };

	  AnimatedValue.prototype._updateValue = function _updateValue(value) {
	    this._value = value;
	    _flush(this);
	    for (var key in this._listeners) {
	      this._listeners[key]({ value: this.__getValue() });
	    }
	  };

	  return AnimatedValue;
	})(AnimatedWithChildren);

	/**
	 * 2D Value for driving 2D animations, such as pan gestures.  Almost identical
	 * API to normal `Animated.Value`, but multiplexed.  Contains two regular
	 * `Animated.Value`s under the hood.  Example:
	 *
	 *```javascript
	 *  class DraggableView extends React.Component {
	 *    constructor(props) {
	 *      super(props);
	 *      this.state = {
	 *        pan: new Animated.ValueXY(), // inits to zero
	 *      };
	 *      this.state.panResponder = PanResponder.create({
	 *        onStartShouldSetPanResponder: () => true,
	 *        onPanResponderMove: Animated.event([null, {
	 *          dx: this.state.pan.x, // x,y are Animated.Value
	 *          dy: this.state.pan.y,
	 *        }]),
	 *        onPanResponderRelease: () => {
	 *          Animated.spring(
	 *            this.state.pan,         // Auto-multiplexed
	 *            {toValue: {x: 0, y: 0}} // Back to zero
	 *          ).start();
	 *        },
	 *      });
	 *    }
	 *    render() {
	 *      return (
	 *        <Animated.View
	 *          {...this.state.panResponder.panHandlers}
	 *          style={this.state.pan.getLayout()}>
	 *          {this.props.children}
	 *        </Animated.View>
	 *      );
	 *    }
	 *  }
	 *```
	 */

	var AnimatedValueXY = (function (_AnimatedWithChildren2) {
	  _inherits(AnimatedValueXY, _AnimatedWithChildren2);

	  function AnimatedValueXY(valueIn) {
	    _classCallCheck(this, AnimatedValueXY);

	    _AnimatedWithChildren2.call(this);
	    var value = valueIn || { x: 0, y: 0 }; // fixme: shouldn't need `: any`
	    if (typeof value.x === 'number' && typeof value.y === 'number') {
	      this.x = new AnimatedValue(value.x);
	      this.y = new AnimatedValue(value.y);
	    } else {
	      !(value.x instanceof AnimatedValue && value.y instanceof AnimatedValue) ?  true ? invariant(false, 'AnimatedValueXY must be initalized with an object of numbers or ' + 'AnimatedValues.') : invariant(false) : undefined;
	      this.x = value.x;
	      this.y = value.y;
	    }
	    this._listeners = {};
	  }

	  AnimatedValueXY.prototype.setValue = function setValue(value) {
	    this.x.setValue(value.x);
	    this.y.setValue(value.y);
	  };

	  AnimatedValueXY.prototype.setOffset = function setOffset(offset) {
	    this.x.setOffset(offset.x);
	    this.y.setOffset(offset.y);
	  };

	  AnimatedValueXY.prototype.flattenOffset = function flattenOffset() {
	    this.x.flattenOffset();
	    this.y.flattenOffset();
	  };

	  AnimatedValueXY.prototype.__getValue = function __getValue() {
	    return {
	      x: this.x.__getValue(),
	      y: this.y.__getValue()
	    };
	  };

	  AnimatedValueXY.prototype.stopAnimation = function stopAnimation(callback) {
	    this.x.stopAnimation();
	    this.y.stopAnimation();
	    callback && callback(this.__getValue());
	  };

	  AnimatedValueXY.prototype.addListener = function addListener(callback) {
	    var _this3 = this;

	    var id = String(_uniqueId++);
	    var jointCallback = function jointCallback(_ref) {
	      var number = _ref.value;

	      callback(_this3.__getValue());
	    };
	    this._listeners[id] = {
	      x: this.x.addListener(jointCallback),
	      y: this.y.addListener(jointCallback)
	    };
	    return id;
	  };

	  AnimatedValueXY.prototype.removeListener = function removeListener(id) {
	    this.x.removeListener(this._listeners[id].x);
	    this.y.removeListener(this._listeners[id].y);
	    delete this._listeners[id];
	  };

	  /**
	   * Converts `{x, y}` into `{left, top}` for use in style, e.g.
	   *
	   *```javascript
	   *  style={this.state.anim.getLayout()}
	   *```
	   */

	  AnimatedValueXY.prototype.getLayout = function getLayout() {
	    return {
	      left: this.x,
	      top: this.y
	    };
	  };

	  /**
	   * Converts `{x, y}` into a useable translation transform, e.g.
	   *
	   *```javascript
	   *  style={{
	   *    transform: this.state.anim.getTranslateTransform()
	   *  }}
	   *```
	   */

	  AnimatedValueXY.prototype.getTranslateTransform = function getTranslateTransform() {
	    return [{ translateX: this.x }, { translateY: this.y }];
	  };

	  return AnimatedValueXY;
	})(AnimatedWithChildren);

	var AnimatedInterpolation = (function (_AnimatedWithChildren3) {
	  _inherits(AnimatedInterpolation, _AnimatedWithChildren3);

	  function AnimatedInterpolation(parent, interpolation) {
	    _classCallCheck(this, AnimatedInterpolation);

	    _AnimatedWithChildren3.call(this);
	    this._parent = parent;
	    this._interpolation = interpolation;
	  }

	  AnimatedInterpolation.prototype.__getValue = function __getValue() {
	    var parentValue = this._parent.__getValue();
	    !(typeof parentValue === 'number') ?  true ? invariant(false, 'Cannot interpolate an input which is not a number.') : invariant(false) : undefined;
	    return this._interpolation(parentValue);
	  };

	  AnimatedInterpolation.prototype.interpolate = function interpolate(config) {
	    return new AnimatedInterpolation(this, Interpolation.create(config));
	  };

	  AnimatedInterpolation.prototype.__attach = function __attach() {
	    this._parent.__addChild(this);
	  };

	  AnimatedInterpolation.prototype.__detach = function __detach() {
	    this._parent.__removeChild(this);
	  };

	  return AnimatedInterpolation;
	})(AnimatedWithChildren);

	var AnimatedAddition = (function (_AnimatedWithChildren4) {
	  _inherits(AnimatedAddition, _AnimatedWithChildren4);

	  function AnimatedAddition(a, b) {
	    _classCallCheck(this, AnimatedAddition);

	    _AnimatedWithChildren4.call(this);
	    this._a = a;
	    this._b = b;
	  }

	  AnimatedAddition.prototype.__getValue = function __getValue() {
	    return this._a.__getValue() + this._b.__getValue();
	  };

	  AnimatedAddition.prototype.interpolate = function interpolate(config) {
	    return new AnimatedInterpolation(this, Interpolation.create(config));
	  };

	  AnimatedAddition.prototype.__attach = function __attach() {
	    this._a.__addChild(this);
	    this._b.__addChild(this);
	  };

	  AnimatedAddition.prototype.__detach = function __detach() {
	    this._a.__removeChild(this);
	    this._b.__removeChild(this);
	  };

	  return AnimatedAddition;
	})(AnimatedWithChildren);

	var AnimatedMultiplication = (function (_AnimatedWithChildren5) {
	  _inherits(AnimatedMultiplication, _AnimatedWithChildren5);

	  function AnimatedMultiplication(a, b) {
	    _classCallCheck(this, AnimatedMultiplication);

	    _AnimatedWithChildren5.call(this);
	    this._a = a;
	    this._b = b;
	  }

	  AnimatedMultiplication.prototype.__getValue = function __getValue() {
	    return this._a.__getValue() * this._b.__getValue();
	  };

	  AnimatedMultiplication.prototype.interpolate = function interpolate(config) {
	    return new AnimatedInterpolation(this, Interpolation.create(config));
	  };

	  AnimatedMultiplication.prototype.__attach = function __attach() {
	    this._a.__addChild(this);
	    this._b.__addChild(this);
	  };

	  AnimatedMultiplication.prototype.__detach = function __detach() {
	    this._a.__removeChild(this);
	    this._b.__removeChild(this);
	  };

	  return AnimatedMultiplication;
	})(AnimatedWithChildren);

	var AnimatedTransform = (function (_AnimatedWithChildren6) {
	  _inherits(AnimatedTransform, _AnimatedWithChildren6);

	  function AnimatedTransform(transforms) {
	    _classCallCheck(this, AnimatedTransform);

	    _AnimatedWithChildren6.call(this);
	    this._transforms = transforms;
	  }

	  AnimatedTransform.prototype.__getValue = function __getValue() {
	    return this._transforms.map(function (transform) {
	      var result = {};
	      for (var key in transform) {
	        var value = transform[key];
	        if (value instanceof Animated) {
	          result[key] = value.__getValue();
	        } else {
	          result[key] = value;
	        }
	      }
	      return result;
	    });
	  };

	  AnimatedTransform.prototype.__getAnimatedValue = function __getAnimatedValue() {
	    return this._transforms.map(function (transform) {
	      var result = {};
	      for (var key in transform) {
	        var value = transform[key];
	        if (value instanceof Animated) {
	          result[key] = value.__getAnimatedValue();
	        } else {
	          // All transform components needed to recompose matrix
	          result[key] = value;
	        }
	      }
	      return result;
	    });
	  };

	  AnimatedTransform.prototype.__attach = function __attach() {
	    var _this4 = this;

	    this._transforms.forEach(function (transform) {
	      for (var key in transform) {
	        var value = transform[key];
	        if (value instanceof Animated) {
	          value.__addChild(_this4);
	        }
	      }
	    });
	  };

	  AnimatedTransform.prototype.__detach = function __detach() {
	    var _this5 = this;

	    this._transforms.forEach(function (transform) {
	      for (var key in transform) {
	        var value = transform[key];
	        if (value instanceof Animated) {
	          value.__removeChild(_this5);
	        }
	      }
	    });
	  };

	  return AnimatedTransform;
	})(AnimatedWithChildren);

	var AnimatedStyle = (function (_AnimatedWithChildren7) {
	  _inherits(AnimatedStyle, _AnimatedWithChildren7);

	  function AnimatedStyle(style) {
	    _classCallCheck(this, AnimatedStyle);

	    _AnimatedWithChildren7.call(this);
	    style = flattenStyle(style) || {};
	    if (style.transform) {
	      style = _extends({}, style, {
	        transform: new AnimatedTransform(style.transform)
	      });
	    }
	    this._style = style;
	  }

	  AnimatedStyle.prototype.__getValue = function __getValue() {
	    var style = {};
	    for (var key in this._style) {
	      var value = this._style[key];
	      if (value instanceof Animated) {
	        style[key] = value.__getValue();
	      } else {
	        style[key] = value;
	      }
	    }
	    return style;
	  };

	  AnimatedStyle.prototype.__getAnimatedValue = function __getAnimatedValue() {
	    var style = {};
	    for (var key in this._style) {
	      var value = this._style[key];
	      if (value instanceof Animated) {
	        style[key] = value.__getAnimatedValue();
	      }
	    }
	    return style;
	  };

	  AnimatedStyle.prototype.__attach = function __attach() {
	    for (var key in this._style) {
	      var value = this._style[key];
	      if (value instanceof Animated) {
	        value.__addChild(this);
	      }
	    }
	  };

	  AnimatedStyle.prototype.__detach = function __detach() {
	    for (var key in this._style) {
	      var value = this._style[key];
	      if (value instanceof Animated) {
	        value.__removeChild(this);
	      }
	    }
	  };

	  return AnimatedStyle;
	})(AnimatedWithChildren);

	var AnimatedProps = (function (_Animated2) {
	  _inherits(AnimatedProps, _Animated2);

	  function AnimatedProps(props, callback) {
	    _classCallCheck(this, AnimatedProps);

	    _Animated2.call(this);
	    if (props.style) {
	      props = _extends({}, props, {
	        style: new AnimatedStyle(props.style)
	      });
	    }
	    this._props = props;
	    this._callback = callback;
	    this.__attach();
	  }

	  AnimatedProps.prototype.__getValue = function __getValue() {
	    var props = {};
	    for (var key in this._props) {
	      var value = this._props[key];
	      if (value instanceof Animated) {
	        props[key] = value.__getValue();
	      } else {
	        props[key] = value;
	      }
	    }
	    return props;
	  };

	  AnimatedProps.prototype.__getAnimatedValue = function __getAnimatedValue() {
	    var props = {};
	    for (var key in this._props) {
	      var value = this._props[key];
	      if (value instanceof Animated) {
	        props[key] = value.__getAnimatedValue();
	      }
	    }
	    return props;
	  };

	  AnimatedProps.prototype.__attach = function __attach() {
	    for (var key in this._props) {
	      var value = this._props[key];
	      if (value instanceof Animated) {
	        value.__addChild(this);
	      }
	    }
	  };

	  AnimatedProps.prototype.__detach = function __detach() {
	    for (var key in this._props) {
	      var value = this._props[key];
	      if (value instanceof Animated) {
	        value.__removeChild(this);
	      }
	    }
	  };

	  AnimatedProps.prototype.update = function update() {
	    this._callback();
	  };

	  return AnimatedProps;
	})(Animated);

	function createAnimatedComponent(Component) {
	  var refName = 'node';

	  var AnimatedComponent = (function (_React$Component) {
	    _inherits(AnimatedComponent, _React$Component);

	    function AnimatedComponent() {
	      _classCallCheck(this, AnimatedComponent);

	      _React$Component.apply(this, arguments);
	    }

	    AnimatedComponent.prototype.componentWillUnmount = function componentWillUnmount() {
	      this._propsAnimated && this._propsAnimated.__detach();
	    };

	    AnimatedComponent.prototype.setNativeProps = function setNativeProps(props) {
	      this.refs[refName].setNativeProps(props);
	    };

	    AnimatedComponent.prototype.componentWillMount = function componentWillMount() {
	      this.attachProps(this.props);
	    };

	    AnimatedComponent.prototype.attachProps = function attachProps(nextProps) {
	      var _this6 = this;

	      var oldPropsAnimated = this._propsAnimated;

	      // The system is best designed when setNativeProps is implemented. It is
	      // able to avoid re-rendering and directly set the attributes that
	      // changed. However, setNativeProps can only be implemented on leaf
	      // native components. If you want to animate a composite component, you
	      // need to re-render it. In this case, we have a fallback that uses
	      // forceUpdate.
	      var callback = function callback() {
	        if (_this6.refs[refName].setNativeProps) {
	          var value = _this6._propsAnimated.__getAnimatedValue();
	          _this6.refs[refName].setNativeProps(value);
	        } else {
	          _this6.forceUpdate();
	        }
	      };

	      this._propsAnimated = new AnimatedProps(nextProps, callback);

	      // When you call detach, it removes the element from the parent list
	      // of children. If it goes to 0, then the parent also detaches itself
	      // and so on.
	      // An optimization is to attach the new elements and THEN detach the old
	      // ones instead of detaching and THEN attaching.
	      // This way the intermediate state isn't to go to 0 and trigger
	      // this expensive recursive detaching to then re-attach everything on
	      // the very next operation.
	      oldPropsAnimated && oldPropsAnimated.__detach();
	    };

	    AnimatedComponent.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
	      this.attachProps(nextProps);
	    };

	    AnimatedComponent.prototype.render = function render() {
	      return React.createElement(Component, _extends({}, this._propsAnimated.__getValue(), {
	        ref: refName
	      }));
	    };

	    return AnimatedComponent;
	  })(React.Component);

	  AnimatedComponent.propTypes = {
	    style: function style(props, propName, componentName) {
	      if (!Component.propTypes) {
	        return;
	      }

	      for (var key in ViewStylePropTypes) {
	        if (!Component.propTypes[key] && props[key] !== undefined) {
	          console.error('You are setting the style `{ ' + key + ': ... }` as a prop. You ' + 'should nest it in a style object. ' + 'E.g. `{ style: { ' + key + ': ... } }`');
	        }
	      }
	    }
	  };

	  return AnimatedComponent;
	}

	var AnimatedTracking = (function (_Animated3) {
	  _inherits(AnimatedTracking, _Animated3);

	  function AnimatedTracking(value, parent, animationClass, animationConfig, callback) {
	    _classCallCheck(this, AnimatedTracking);

	    _Animated3.call(this);
	    this._value = value;
	    this._parent = parent;
	    this._animationClass = animationClass;
	    this._animationConfig = animationConfig;
	    this._callback = callback;
	    this.__attach();
	  }

	  AnimatedTracking.prototype.__getValue = function __getValue() {
	    return this._parent.__getValue();
	  };

	  AnimatedTracking.prototype.__attach = function __attach() {
	    this._parent.__addChild(this);
	  };

	  AnimatedTracking.prototype.__detach = function __detach() {
	    this._parent.__removeChild(this);
	  };

	  AnimatedTracking.prototype.update = function update() {
	    this._value.animate(new this._animationClass(_extends({}, this._animationConfig, {
	      toValue: this._animationConfig.toValue.__getValue()
	    })), this._callback);
	  };

	  return AnimatedTracking;
	})(Animated);

	var add = function add(a, b) {
	  return new AnimatedAddition(a, b);
	};

	var multiply = function multiply(a, b) {
	  return new AnimatedMultiplication(a, b);
	};

	var maybeVectorAnim = function maybeVectorAnim(value, config, anim) {
	  if (value instanceof AnimatedValueXY) {
	    var configX = _extends({}, config);
	    var configY = _extends({}, config);
	    for (var key in config) {
	      var _config$key = config[key];
	      var x = _config$key.x;
	      var y = _config$key.y;

	      if (x !== undefined && y !== undefined) {
	        configX[key] = x;
	        configY[key] = y;
	      }
	    }
	    var aX = anim(value.x, configX);
	    var aY = anim(value.y, configY);
	    // We use `stopTogether: false` here because otherwise tracking will break
	    // because the second animation will get stopped before it can update.
	    return parallel([aX, aY], { stopTogether: false });
	  }
	  return null;
	};

	var spring = function spring(value, config) {
	  return maybeVectorAnim(value, config, spring) || {
	    start: function start(callback) {
	      var singleValue = value;
	      var singleConfig = config;
	      singleValue.stopTracking();
	      if (config.toValue instanceof Animated) {
	        singleValue.track(new AnimatedTracking(singleValue, config.toValue, SpringAnimation, singleConfig, callback));
	      } else {
	        singleValue.animate(new SpringAnimation(singleConfig), callback);
	      }
	    },

	    stop: function stop() {
	      value.stopAnimation();
	    }
	  };
	};

	var timing = function timing(value, config) {
	  return maybeVectorAnim(value, config, timing) || {
	    start: function start(callback) {
	      var singleValue = value;
	      var singleConfig = config;
	      singleValue.stopTracking();
	      if (config.toValue instanceof Animated) {
	        singleValue.track(new AnimatedTracking(singleValue, config.toValue, TimingAnimation, singleConfig, callback));
	      } else {
	        singleValue.animate(new TimingAnimation(singleConfig), callback);
	      }
	    },

	    stop: function stop() {
	      value.stopAnimation();
	    }
	  };
	};

	var decay = function decay(value, config) {
	  return maybeVectorAnim(value, config, decay) || {
	    start: function start(callback) {
	      var singleValue = value;
	      var singleConfig = config;
	      singleValue.stopTracking();
	      singleValue.animate(new DecayAnimation(singleConfig), callback);
	    },

	    stop: function stop() {
	      value.stopAnimation();
	    }
	  };
	};

	var sequence = function sequence(animations) {
	  var current = 0;
	  return {
	    start: function start(callback) {
	      var onComplete = function onComplete(result) {
	        if (!result.finished) {
	          callback && callback(result);
	          return;
	        }

	        current++;

	        if (current === animations.length) {
	          callback && callback(result);
	          return;
	        }

	        animations[current].start(onComplete);
	      };

	      if (animations.length === 0) {
	        callback && callback({ finished: true });
	      } else {
	        animations[current].start(onComplete);
	      }
	    },

	    stop: function stop() {
	      if (current < animations.length) {
	        animations[current].stop();
	      }
	    }
	  };
	};

	// If one is stopped, stop all.  default: true

	var parallel = function parallel(animations, config) {
	  var doneCount = 0;
	  // Make sure we only call stop() at most once for each animation
	  var hasEnded = {};
	  var stopTogether = !(config && config.stopTogether === false);

	  var result = {
	    start: function start(callback) {
	      if (doneCount === animations.length) {
	        callback && callback({ finished: true });
	        return;
	      }

	      animations.forEach(function (animation, idx) {
	        var cb = function cb(endResult) {
	          hasEnded[idx] = true;
	          doneCount++;
	          if (doneCount === animations.length) {
	            doneCount = 0;
	            callback && callback(endResult);
	            return;
	          }

	          if (!endResult.finished && stopTogether) {
	            result.stop();
	          }
	        };

	        if (!animation) {
	          cb({ finished: true });
	        } else {
	          animation.start(cb);
	        }
	      });
	    },

	    stop: function stop() {
	      animations.forEach(function (animation, idx) {
	        !hasEnded[idx] && animation.stop();
	        hasEnded[idx] = true;
	      });
	    }
	  };

	  return result;
	};

	var delay = function delay(time) {
	  // Would be nice to make a specialized implementation
	  return timing(new AnimatedValue(0), { toValue: 0, delay: time, duration: 0 });
	};

	var stagger = function stagger(time, animations) {
	  return parallel(animations.map(function (animation, i) {
	    return sequence([delay(time * i), animation]);
	  }));
	};

	var event = function event(argMapping, config) {
	  return function () {
	    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
	      args[_key] = arguments[_key];
	    }

	    var traverse = function traverse(recMapping, recEvt, key) {
	      if (typeof recEvt === 'number') {
	        !(recMapping instanceof AnimatedValue) ?  true ? invariant(false, 'Bad mapping of type ' + typeof recMapping + ' for key ' + key + ', event value must map to AnimatedValue') : invariant(false) : undefined;
	        recMapping.setValue(recEvt);
	        return;
	      }
	      !(typeof recMapping === 'object') ?  true ? invariant(false, 'Bad mapping of type ' + typeof recMapping + ' for key ' + key) : invariant(false) : undefined;
	      !(typeof recEvt === 'object') ?  true ? invariant(false, 'Bad event of type ' + typeof recEvt + ' for key ' + key) : invariant(false) : undefined;
	      for (var key in recMapping) {
	        traverse(recMapping[key], recEvt[key], key);
	      }
	    };
	    argMapping.forEach(function (mapping, idx) {
	      traverse(mapping, args[idx], 'arg' + idx);
	    });
	    if (config && config.listener) {
	      config.listener.apply(null, args);
	    }
	  };
	};

	/**
	 * Animations are an important part of modern UX, and the `Animated`
	 * library is designed to make them fluid, powerful, and easy to build and
	 * maintain.
	 *
	 * The simplest workflow is to create an `Animated.Value`, hook it up to one or
	 * more style attributes of an animated component, and then drive updates either
	 * via animations, such as `Animated.timing`, or by hooking into gestures like
	 * panning or scrolling via `Animated.event`.  `Animated.Value` can also bind to
	 * props other than style, and can be interpolated as well.  Here is a basic
	 * example of a container view that will fade in when it's mounted:
	 *
	 *```javascript
	 *  class FadeInView extends React.Component {
	 *    constructor(props) {
	 *      super(props);
	 *      this.state = {
	 *        fadeAnim: new Animated.Value(0), // init opacity 0
	 *      };
	 *    }
	 *    componentDidMount() {
	 *      Animated.timing(          // Uses easing functions
	 *        this.state.fadeAnim,    // The value to drive
	 *        {toValue: 1},           // Configuration
	 *      ).start();                // Don't forget start!
	 *    }
	 *    render() {
	 *      return (
	 *        <Animated.View          // Special animatable View
	 *          style={{opacity: this.state.fadeAnim}}> // Binds
	 *          {this.props.children}
	 *        </Animated.View>
	 *      );
	 *    }
	 *  }
	 *```
	 *
	 * Note that only animatable components can be animated.  `View`, `Text`, and
	 * `Image` are already provided, and you can create custom ones with
	 * `createAnimatedComponent`.  These special components do the magic of binding
	 * the animated values to the properties, and do targeted native updates to
	 * avoid the cost of the react render and reconciliation process on every frame.
	 * They also handle cleanup on unmount so they are safe by default.
	 *
	 * Animations are heavily configurable.  Custom and pre-defined easing
	 * functions, delays, durations, decay factors, spring constants, and more can
	 * all be tweaked depending on the type of animation.
	 *
	 * A single `Animated.Value` can drive any number of properties, and each
	 * property can be run through an interpolation first.  An interpolation maps
	 * input ranges to output ranges, typically using a linear interpolation but
	 * also supports easing functions.  By default, it will extrapolate the curve
	 * beyond the ranges given, but you can also have it clamp the output value.
	 *
	 * For example, you may want to think about your `Animated.Value` as going from
	 * 0 to 1, but animate the position from 150px to 0px and the opacity from 0 to
	 * 1. This can easily be done by modifying `style` in the example above like so:
	 *
	 *```javascript
	 *  style={{
	 *    opacity: this.state.fadeAnim, // Binds directly
	 *    transform: [{
	 *      translateY: this.state.fadeAnim.interpolate({
	 *        inputRange: [0, 1],
	 *        outputRange: [150, 0]  // 0 : 150, 0.5 : 75, 1 : 0
	 *      }),
	 *    }],
	 *  }}>
	 *```
	 *
	 * Animations can also be combined in complex ways using composition functions
	 * such as `sequence` and `parallel`, and can also be chained together simply
	 * by setting the `toValue` of one animation to be another `Animated.Value`.
	 *
	 * `Animated.ValueXY` is handy for 2D animations, like panning, and there are
	 * other helpful additions like `setOffset` and `getLayout` to aid with typical
	 * interaction patterns, like drag-and-drop.
	 *
	 * You can see more example usage in `AnimationExample.js`, the Gratuitous
	 * Animation App, and [Animations documentation guide](http://facebook.github.io/react-native/docs/animations.html).
	 *
	 * Note that `Animated` is designed to be fully serializable so that animations
	 * can be run in a high performance way, independent of the normal JavaScript
	 * event loop. This does influence the API, so keep that in mind when it seems a
	 * little trickier to do something compared to a fully synchronous system.
	 * Checkout `Animated.Value.addListener` as a way to work around some of these
	 * limitations, but use it sparingly since it might have performance
	 * implications in the future.
	 */
	module.exports = {
	  /**
	   * Standard value class for driving animations.  Typically initialized with
	   * `new Animated.Value(0);`
	   */
	  Value: AnimatedValue,
	  /**
	   * 2D value class for driving 2D animations, such as pan gestures.
	   */
	  ValueXY: AnimatedValueXY,

	  /**
	   * Animates a value from an initial velocity to zero based on a decay
	   * coefficient.
	   */
	  decay: decay,
	  /**
	   * Animates a value along a timed easing curve.  The `Easing` module has tons
	   * of pre-defined curves, or you can use your own function.
	   */
	  timing: timing,
	  /**
	   * Spring animation based on Rebound and Origami.  Tracks velocity state to
	   * create fluid motions as the `toValue` updates, and can be chained together.
	   */
	  spring: spring,

	  /**
	   * Creates a new Animated value composed from two Animated values added
	   * together.
	   */
	  add: add,
	  /**
	   * Creates a new Animated value composed from two Animated values multiplied
	   * together.
	   */
	  multiply: multiply,

	  /**
	   * Starts an animation after the given delay.
	   */
	  delay: delay,
	  /**
	   * Starts an array of animations in order, waiting for each to complete
	   * before starting the next.  If the current running animation is stopped, no
	   * following animations will be started.
	   */
	  sequence: sequence,
	  /**
	   * Starts an array of animations all at the same time.  By default, if one
	   * of the animations is stopped, they will all be stopped.  You can override
	   * this with the `stopTogether` flag.
	   */
	  parallel: parallel,
	  /**
	   * Array of animations may run in parallel (overlap), but are started in
	   * sequence with successive delays.  Nice for doing trailing effects.
	   */
	  stagger: stagger,

	  /**
	   *  Takes an array of mappings and extracts values from each arg accordingly,
	   *  then calls `setValue` on the mapped outputs.  e.g.
	   *
	   *```javascript
	   *  onScroll={Animated.event(
	   *    [{nativeEvent: {contentOffset: {x: this._scrollX}}}]
	   *    {listener},          // Optional async listener
	   *  )
	   *  ...
	   *  onPanResponderMove: Animated.event([
	   *    null,                // raw event arg ignored
	   *    {dx: this._panX},    // gestureState arg
	   *  ]),
	   *```
	   */
	  event: event,

	  /**
	   * Make any React component Animatable.  Used to create `Animated.View`, etc.
	   */
	  createAnimatedComponent: createAnimatedComponent,

	  __PropsOnlyForTests: AnimatedProps
	};

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Copyright (c) 2015-present, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 *
	 * @providesModule Easing
	 * 
	 */
	'use strict';

	function _classCallCheck(instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError('Cannot call a class as a function');
	  }
	}

	var _bezier = __webpack_require__(7);

	/**
	 * This class implements common easing functions. The math is pretty obscure,
	 * but this cool website has nice visual illustrations of what they represent:
	 * http://xaedes.de/dev/transitions/
	 */

	var Easing = (function () {
	  function Easing() {
	    _classCallCheck(this, Easing);
	  }

	  Easing.step0 = function step0(n) {
	    return n > 0 ? 1 : 0;
	  };

	  Easing.step1 = function step1(n) {
	    return n >= 1 ? 1 : 0;
	  };

	  Easing.linear = function linear(t) {
	    return t;
	  };

	  Easing.ease = function ease(t) {
	    return _ease(t);
	  };

	  Easing.quad = function quad(t) {
	    return t * t;
	  };

	  Easing.cubic = function cubic(t) {
	    return t * t * t;
	  };

	  Easing.poly = function poly(n) {
	    return function (t) {
	      return Math.pow(t, n);
	    };
	  };

	  Easing.sin = function sin(t) {
	    return 1 - Math.cos(t * Math.PI / 2);
	  };

	  Easing.circle = function circle(t) {
	    return 1 - Math.sqrt(1 - t * t);
	  };

	  Easing.exp = function exp(t) {
	    return Math.pow(2, 10 * (t - 1));
	  };

	  /**
	   * A simple elastic interaction, similar to a spring.  Default bounciness
	   * is 1, which overshoots a little bit once.  0 bounciness doesn't overshoot
	   * at all, and bounciness of N > 1 will overshoot about N times.
	   *
	   * Wolfram Plots:
	   *
	   *   http://tiny.cc/elastic_b_1 (default bounciness = 1)
	   *   http://tiny.cc/elastic_b_3 (bounciness = 3)
	   */

	  Easing.elastic = function elastic() {
	    var bounciness = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];

	    var p = bounciness * Math.PI;
	    return function (t) {
	      return 1 - Math.pow(Math.cos(t * Math.PI / 2), 3) * Math.cos(t * p);
	    };
	  };

	  Easing.back = function back(s) {
	    if (s === undefined) {
	      s = 1.70158;
	    }
	    return function (t) {
	      return t * t * ((s + 1) * t - s);
	    };
	  };

	  Easing.bounce = function bounce(t) {
	    if (t < 1 / 2.75) {
	      return 7.5625 * t * t;
	    }

	    if (t < 2 / 2.75) {
	      t -= 1.5 / 2.75;
	      return 7.5625 * t * t + 0.75;
	    }

	    if (t < 2.5 / 2.75) {
	      t -= 2.25 / 2.75;
	      return 7.5625 * t * t + 0.9375;
	    }

	    t -= 2.625 / 2.75;
	    return 7.5625 * t * t + 0.984375;
	  };

	  Easing.bezier = function bezier(x1, y1, x2, y2, epsilon) {
	    if (epsilon === undefined) {
	      // epsilon determines the precision of the solved values
	      // a good approximation is:
	      var duration = 500; // duration of animation in milliseconds.
	      epsilon = 1000 / 60 / duration / 4;
	    }

	    return _bezier(x1, y1, x2, y2, epsilon);
	  };

	  Easing['in'] = function _in(easing) {
	    return easing;
	  };

	  /**
	   * Runs an easing function backwards.
	   */

	  Easing.out = function out(easing) {
	    return function (t) {
	      return 1 - easing(1 - t);
	    };
	  };

	  /**
	   * Makes any easing function symmetrical.
	   */

	  Easing.inOut = function inOut(easing) {
	    return function (t) {
	      if (t < 0.5) {
	        return easing(t * 2) / 2;
	      }
	      return 1 - easing((1 - t) * 2) / 2;
	    };
	  };

	  return Easing;
	})();

	var _ease = Easing.bezier(0.42, 0, 1, 1);

	module.exports = Easing;

/***/ },
/* 3 */
/***/ function(module, exports) {

	/**
	 * Copyright (c) 2015-present, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 */

	'use strict';

	module.exports = {
	  createInteractionHandle: function createInteractionHandle() {},
	  clearInteractionHandle: function clearInteractionHandle() {}
	};

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

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

	var _extends = Object.assign || function (target) {
	  for (var i = 1; i < arguments.length; i++) {
	    var source = arguments[i];for (var key in source) {
	      if (Object.prototype.hasOwnProperty.call(source, key)) {
	        target[key] = source[key];
	      }
	    }
	  }return target;
	};

	function _classCallCheck(instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError('Cannot call a class as a function');
	  }
	}

	var tinycolor = __webpack_require__(9);

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

	    !(inputRange.length === outputRange.length) ?  true ? invariant(false, 'inputRange (' + inputRange.length + ') and outputRange (' + outputRange.length + ') must have the same length') : invariant(false) : undefined;

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
	      !(typeof input === 'number') ?  true ? invariant(false, 'Cannot interpolation an input which is not a number') : invariant(false) : undefined;

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
	  !(outputRange.length >= 2) ?  true ? invariant(false, 'Bad output range') : invariant(false) : undefined;
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
	    !(pattern === arr[i].replace(stringShapeRegex, '')) ?  true ? invariant(false, 'invalid pattern ' + arr[0] + ' and ' + arr[i]) : invariant(false) : undefined;
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
	  !(arr.length >= 2) ?  true ? invariant(false, 'inputRange must have at least 2 elements') : invariant(false) : undefined;
	  for (var i = 1; i < arr.length; ++i) {
	    !(arr[i] >= arr[i - 1]) ?  true ? invariant(false,
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
	  !(arr.length >= 2) ?  true ? invariant(false, name + ' must have at least 2 elements') : invariant(false) : undefined;
	  !(arr.length !== 2 || arr[0] !== -Infinity || arr[1] !== Infinity) ?  true ? invariant(false,
	  /* $FlowFixMe(>=0.13.0) - In the addition expression below this comment,
	   * one or both of the operands may be something that doesn't cleanly convert
	   * to a string, like undefined, null, and object, etc. If you really mean
	   * this implicit string conversion, you can do something like
	   * String(myThing)
	   */
	  name + 'cannot be ]-infinity;+infinity[ ' + arr) : invariant(false) : undefined;
	}

	module.exports = Interpolation;

/***/ },
/* 5 */
/***/ function(module, exports) {

	/**
	 * Copyright (c) 2015-present, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 */

	'use strict';

	function SetPolyfill() {
	  this._cache = [];
	}

	SetPolyfill.prototype.add = function (e) {
	  if (this._cache.indexOf(e) === -1) {
	    this._cache.push(e);
	  }
	};

	SetPolyfill.prototype.forEach = function (cb) {
	  this._cache.forEach(cb);
	};

	module.exports = SetPolyfill;

/***/ },
/* 6 */
/***/ function(module, exports) {

	/**
	 * Copyright (c) 2015-present, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 *
	 * @providesModule SpringConfig
	 * 
	 */

	'use strict';

	function tensionFromOrigamiValue(oValue) {
	  return (oValue - 30) * 3.62 + 194;
	}

	function frictionFromOrigamiValue(oValue) {
	  return (oValue - 8) * 3 + 25;
	}

	function fromOrigamiTensionAndFriction(tension, friction) {
	  return {
	    tension: tensionFromOrigamiValue(tension),
	    friction: frictionFromOrigamiValue(friction)
	  };
	}

	function fromBouncinessAndSpeed(bounciness, speed) {
	  function normalize(value, startValue, endValue) {
	    return (value - startValue) / (endValue - startValue);
	  }

	  function projectNormal(n, start, end) {
	    return start + n * (end - start);
	  }

	  function linearInterpolation(t, start, end) {
	    return t * end + (1 - t) * start;
	  }

	  function quadraticOutInterpolation(t, start, end) {
	    return linearInterpolation(2 * t - t * t, start, end);
	  }

	  function b3Friction1(x) {
	    return 0.0007 * Math.pow(x, 3) - 0.031 * Math.pow(x, 2) + 0.64 * x + 1.28;
	  }

	  function b3Friction2(x) {
	    return 0.000044 * Math.pow(x, 3) - 0.006 * Math.pow(x, 2) + 0.36 * x + 2;
	  }

	  function b3Friction3(x) {
	    return 0.00000045 * Math.pow(x, 3) - 0.000332 * Math.pow(x, 2) + 0.1078 * x + 5.84;
	  }

	  function b3Nobounce(tension) {
	    if (tension <= 18) {
	      return b3Friction1(tension);
	    } else if (tension > 18 && tension <= 44) {
	      return b3Friction2(tension);
	    } else {
	      return b3Friction3(tension);
	    }
	  }

	  var b = normalize(bounciness / 1.7, 0, 20);
	  b = projectNormal(b, 0, 0.8);
	  var s = normalize(speed / 1.7, 0, 20);
	  var bouncyTension = projectNormal(s, 0.5, 200);
	  var bouncyFriction = quadraticOutInterpolation(b, b3Nobounce(bouncyTension), 0.01);

	  return {
	    tension: tensionFromOrigamiValue(bouncyTension),
	    friction: frictionFromOrigamiValue(bouncyFriction)
	  };
	}

	module.exports = {
	  fromOrigamiTensionAndFriction: fromOrigamiTensionAndFriction,
	  fromBouncinessAndSpeed: fromBouncinessAndSpeed
	};

/***/ },
/* 7 */
/***/ function(module, exports) {

	/**
	 * https://github.com/arian/cubic-bezier
	 *
	 * MIT License
	 *
	 * Copyright (c) 2013 Arian Stolwijk
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining
	 * a copy of this software and associated documentation files (the
	 * "Software"), to deal in the Software without restriction, including
	 * without limitation the rights to use, copy, modify, merge, publish,
	 * distribute, sublicense, and/or sell copies of the Software, and to
	 * permit persons to whom the Software is furnished to do so, subject to
	 * the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be
	 * included in all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
	 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
	 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
	 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
	 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
	 *
	 * @providesModule bezier
	 * @nolint
	 */

	"use strict";

	module.exports = function (x1, y1, x2, y2, epsilon) {

	  var curveX = function curveX(t) {
	    var v = 1 - t;
	    return 3 * v * v * t * x1 + 3 * v * t * t * x2 + t * t * t;
	  };

	  var curveY = function curveY(t) {
	    var v = 1 - t;
	    return 3 * v * v * t * y1 + 3 * v * t * t * y2 + t * t * t;
	  };

	  var derivativeCurveX = function derivativeCurveX(t) {
	    var v = 1 - t;
	    return 3 * (2 * (t - 1) * t + v * v) * x1 + 3 * (-t * t * t + 2 * v * t) * x2;
	  };

	  return function (t) {

	    var x = t,
	        t0,
	        t1,
	        t2,
	        x2,
	        d2,
	        i;

	    // First try a few iterations of Newton's method -- normally very fast.
	    for (t2 = x, i = 0; i < 8; i++) {
	      x2 = curveX(t2) - x;
	      if (Math.abs(x2) < epsilon) {
	        return curveY(t2);
	      }
	      d2 = derivativeCurveX(t2);
	      if (Math.abs(d2) < 1e-6) {
	        break;
	      }
	      t2 = t2 - x2 / d2;
	    }

	    t0 = 0;
	    t1 = 1;
	    t2 = x;

	    if (t2 < t0) {
	      return curveY(t0);
	    }
	    if (t2 > t1) {
	      return curveY(t1);
	    }

	    // Fallback to the bisection method for reliability.
	    while (t0 < t1) {
	      x2 = curveX(t2);
	      if (Math.abs(x2 - x) < epsilon) {
	        return curveY(t2);
	      }
	      if (x > x2) {
	        t0 = t2;
	      } else {
	        t1 = t2;
	      }
	      t2 = (t1 - t0) * 0.5 + t0;
	    }

	    // Failure
	    return curveY(t2);
	  };
	};

/***/ },
/* 8 */
/***/ function(module, exports) {

	/**
	 * Copyright (c) 2015-present, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 */
	'use strict';
	module.exports = function (style) {
	  return style;
	};

/***/ },
/* 9 */
/***/ function(module, exports) {

	/**
	 * @providesModule tinycolor
	 * @nolint
	 */
	'use strict';

	// TinyColor v1.2.1
	// https://github.com/bgrins/TinyColor
	// Brian Grinstead, MIT License

	var trimLeft = /^[\s,#]+/,
	    trimRight = /\s+$/,
	    tinyCounter = 0,
	    mathRound = Math.round,
	    mathMin = Math.min,
	    mathMax = Math.max;

	function tinycolor(color, opts) {
	    // If we are called as a function, call using new instead
	    if (!(this instanceof tinycolor)) {
	        return new tinycolor(color, opts);
	    }

	    color = color ? color : '';
	    opts = opts || {};

	    var rgb = inputToRGB(color);
	    this._r = rgb.r, this._g = rgb.g, this._b = rgb.b, this._a = rgb.a, this._ok = rgb.ok;
	}

	tinycolor.prototype = {
	    toRgb: function toRgb() {
	        return { r: mathRound(this._r), g: mathRound(this._g), b: mathRound(this._b), a: this._a };
	    },
	    isValid: function isValid() {
	        return this._ok;
	    }
	};

	// Given a string or object, convert that input to RGB
	// Possible string inputs:
	//
	//     "red"
	//     "#f00" or "f00"
	//     "#f00f" or "f00f"
	//     "#ff0000" or "ff0000"
	//     "#ff0000ff" or "ff0000ff"
	//     "rgb 255 0 0" or "rgb (255, 0, 0)"
	//     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
	//     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
	//     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
	//     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
	//     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
	//     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
	//
	function inputToRGB(color) {
	    var rgb = { r: 0, g: 0, b: 0 };
	    var a = 1;
	    var ok = false;
	    var format = false;

	    if (typeof color == "string") {
	        color = stringInputToObject(color);
	    }

	    if (typeof color == "object") {
	        if (color.hasOwnProperty("r") && color.hasOwnProperty("g") && color.hasOwnProperty("b")) {
	            rgb = rgbToRgb(color.r, color.g, color.b);
	            ok = true;
	        } else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("v")) {
	            color.s = convertToPercentage(color.s);
	            color.v = convertToPercentage(color.v);
	            rgb = hsvToRgb(color.h, color.s, color.v);
	            ok = true;
	        } else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("l")) {
	            color.s = convertToPercentage(color.s);
	            color.l = convertToPercentage(color.l);
	            rgb = hslToRgb(color.h, color.s, color.l);
	            ok = true;
	        }

	        if (color.hasOwnProperty("a")) {
	            a = color.a;
	        }
	    }

	    a = boundAlpha(a);

	    return {
	        ok: ok,
	        r: mathMin(255, mathMax(rgb.r, 0)),
	        g: mathMin(255, mathMax(rgb.g, 0)),
	        b: mathMin(255, mathMax(rgb.b, 0)),
	        a: a
	    };
	}

	// Conversion Functions
	// --------------------

	// `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
	// <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

	// `rgbToRgb`
	// Handle bounds / percentage checking to conform to CSS color spec
	// <http://www.w3.org/TR/css3-color/>
	// *Assumes:* r, g, b in [0, 255] or [0, 1]
	// *Returns:* { r, g, b } in [0, 255]
	function rgbToRgb(r, g, b) {
	    return {
	        r: bound01(r, 255) * 255,
	        g: bound01(g, 255) * 255,
	        b: bound01(b, 255) * 255
	    };
	}

	// `hslToRgb`
	// Converts an HSL color value to RGB.
	// *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
	// *Returns:* { r, g, b } in the set [0, 255]
	function hslToRgb(h, s, l) {
	    var r, g, b;

	    h = bound01(h, 360);
	    s = bound01(s, 100);
	    l = bound01(l, 100);

	    function hue2rgb(p, q, t) {
	        if (t < 0) t += 1;
	        if (t > 1) t -= 1;
	        if (t < 1 / 6) return p + (q - p) * 6 * t;
	        if (t < 1 / 2) return q;
	        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
	        return p;
	    }

	    if (s === 0) {
	        r = g = b = l; // achromatic
	    } else {
	            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	            var p = 2 * l - q;
	            r = hue2rgb(p, q, h + 1 / 3);
	            g = hue2rgb(p, q, h);
	            b = hue2rgb(p, q, h - 1 / 3);
	        }

	    return { r: r * 255, g: g * 255, b: b * 255 };
	}

	// `hsvToRgb`
	// Converts an HSV color value to RGB.
	// *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
	// *Returns:* { r, g, b } in the set [0, 255]
	function hsvToRgb(h, s, v) {
	    h = bound01(h, 360) * 6;
	    s = bound01(s, 100);
	    v = bound01(v, 100);

	    var i = math.floor(h),
	        f = h - i,
	        p = v * (1 - s),
	        q = v * (1 - f * s),
	        t = v * (1 - (1 - f) * s),
	        mod = i % 6,
	        r = [v, q, p, p, t, v][mod],
	        g = [t, v, v, q, p, p][mod],
	        b = [p, p, t, v, v, q][mod];

	    return { r: r * 255, g: g * 255, b: b * 255 };
	}

	// Big List of Colors
	// ------------------
	// <http://www.w3.org/TR/css3-color/#svg-color>
	var names = tinycolor.names = {
	    aliceblue: "f0f8ff",
	    antiquewhite: "faebd7",
	    aqua: "0ff",
	    aquamarine: "7fffd4",
	    azure: "f0ffff",
	    beige: "f5f5dc",
	    bisque: "ffe4c4",
	    black: "000",
	    blanchedalmond: "ffebcd",
	    blue: "00f",
	    blueviolet: "8a2be2",
	    brown: "a52a2a",
	    burlywood: "deb887",
	    burntsienna: "ea7e5d",
	    cadetblue: "5f9ea0",
	    chartreuse: "7fff00",
	    chocolate: "d2691e",
	    coral: "ff7f50",
	    cornflowerblue: "6495ed",
	    cornsilk: "fff8dc",
	    crimson: "dc143c",
	    cyan: "0ff",
	    darkblue: "00008b",
	    darkcyan: "008b8b",
	    darkgoldenrod: "b8860b",
	    darkgray: "a9a9a9",
	    darkgreen: "006400",
	    darkgrey: "a9a9a9",
	    darkkhaki: "bdb76b",
	    darkmagenta: "8b008b",
	    darkolivegreen: "556b2f",
	    darkorange: "ff8c00",
	    darkorchid: "9932cc",
	    darkred: "8b0000",
	    darksalmon: "e9967a",
	    darkseagreen: "8fbc8f",
	    darkslateblue: "483d8b",
	    darkslategray: "2f4f4f",
	    darkslategrey: "2f4f4f",
	    darkturquoise: "00ced1",
	    darkviolet: "9400d3",
	    deeppink: "ff1493",
	    deepskyblue: "00bfff",
	    dimgray: "696969",
	    dimgrey: "696969",
	    dodgerblue: "1e90ff",
	    firebrick: "b22222",
	    floralwhite: "fffaf0",
	    forestgreen: "228b22",
	    fuchsia: "f0f",
	    gainsboro: "dcdcdc",
	    ghostwhite: "f8f8ff",
	    gold: "ffd700",
	    goldenrod: "daa520",
	    gray: "808080",
	    green: "008000",
	    greenyellow: "adff2f",
	    grey: "808080",
	    honeydew: "f0fff0",
	    hotpink: "ff69b4",
	    indianred: "cd5c5c",
	    indigo: "4b0082",
	    ivory: "fffff0",
	    khaki: "f0e68c",
	    lavender: "e6e6fa",
	    lavenderblush: "fff0f5",
	    lawngreen: "7cfc00",
	    lemonchiffon: "fffacd",
	    lightblue: "add8e6",
	    lightcoral: "f08080",
	    lightcyan: "e0ffff",
	    lightgoldenrodyellow: "fafad2",
	    lightgray: "d3d3d3",
	    lightgreen: "90ee90",
	    lightgrey: "d3d3d3",
	    lightpink: "ffb6c1",
	    lightsalmon: "ffa07a",
	    lightseagreen: "20b2aa",
	    lightskyblue: "87cefa",
	    lightslategray: "789",
	    lightslategrey: "789",
	    lightsteelblue: "b0c4de",
	    lightyellow: "ffffe0",
	    lime: "0f0",
	    limegreen: "32cd32",
	    linen: "faf0e6",
	    magenta: "f0f",
	    maroon: "800000",
	    mediumaquamarine: "66cdaa",
	    mediumblue: "0000cd",
	    mediumorchid: "ba55d3",
	    mediumpurple: "9370db",
	    mediumseagreen: "3cb371",
	    mediumslateblue: "7b68ee",
	    mediumspringgreen: "00fa9a",
	    mediumturquoise: "48d1cc",
	    mediumvioletred: "c71585",
	    midnightblue: "191970",
	    mintcream: "f5fffa",
	    mistyrose: "ffe4e1",
	    moccasin: "ffe4b5",
	    navajowhite: "ffdead",
	    navy: "000080",
	    oldlace: "fdf5e6",
	    olive: "808000",
	    olivedrab: "6b8e23",
	    orange: "ffa500",
	    orangered: "ff4500",
	    orchid: "da70d6",
	    palegoldenrod: "eee8aa",
	    palegreen: "98fb98",
	    paleturquoise: "afeeee",
	    palevioletred: "db7093",
	    papayawhip: "ffefd5",
	    peachpuff: "ffdab9",
	    peru: "cd853f",
	    pink: "ffc0cb",
	    plum: "dda0dd",
	    powderblue: "b0e0e6",
	    purple: "800080",
	    rebeccapurple: "663399",
	    red: "f00",
	    rosybrown: "bc8f8f",
	    royalblue: "4169e1",
	    saddlebrown: "8b4513",
	    salmon: "fa8072",
	    sandybrown: "f4a460",
	    seagreen: "2e8b57",
	    seashell: "fff5ee",
	    sienna: "a0522d",
	    silver: "c0c0c0",
	    skyblue: "87ceeb",
	    slateblue: "6a5acd",
	    slategray: "708090",
	    slategrey: "708090",
	    snow: "fffafa",
	    springgreen: "00ff7f",
	    steelblue: "4682b4",
	    tan: "d2b48c",
	    teal: "008080",
	    thistle: "d8bfd8",
	    tomato: "ff6347",
	    turquoise: "40e0d0",
	    violet: "ee82ee",
	    wheat: "f5deb3",
	    white: "fff",
	    whitesmoke: "f5f5f5",
	    yellow: "ff0",
	    yellowgreen: "9acd32"
	};

	// Return a valid alpha value [0,1] with all invalid values being set to 1
	function boundAlpha(a) {
	    a = parseFloat(a);

	    if (isNaN(a) || a < 0 || a > 1) {
	        a = 1;
	    }

	    return a;
	}

	// Take input from [0, n] and return it as [0, 1]
	function bound01(n, max) {
	    if (isOnePointZero(n)) {
	        n = "100%";
	    }

	    var processPercent = isPercentage(n);
	    n = mathMin(max, mathMax(0, parseFloat(n)));

	    // Automatically convert percentage into number
	    if (processPercent) {
	        n = parseInt(n * max, 10) / 100;
	    }

	    // Handle floating point rounding errors
	    if (Math.abs(n - max) < 0.000001) {
	        return 1;
	    }

	    // Convert into [0, 1] range if it isn't already
	    return n % max / parseFloat(max);
	}

	// Parse a base-16 hex value into a base-10 integer
	function parseIntFromHex(val) {
	    return parseInt(val, 16);
	}

	// Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
	// <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
	function isOnePointZero(n) {
	    return typeof n == "string" && n.indexOf('.') != -1 && parseFloat(n) === 1;
	}

	// Check to see if string passed in is a percentage
	function isPercentage(n) {
	    return typeof n === "string" && n.indexOf('%') != -1;
	}

	// Replace a decimal with it's percentage value
	function convertToPercentage(n) {
	    if (n <= 1) {
	        n = n * 100 + "%";
	    }

	    return n;
	}

	// Converts a hex value to a decimal
	function convertHexToDecimal(h) {
	    return parseIntFromHex(h) / 255;
	}

	var matchers = (function () {
	    // <http://www.w3.org/TR/css3-values/#integers>
	    var CSS_INTEGER = "[-\\+]?\\d+%?";

	    // <http://www.w3.org/TR/css3-values/#number-value>
	    var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

	    // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
	    var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

	    // Actual matching.
	    // Parentheses and commas are optional, but not required.
	    // Whitespace can take the place of commas or opening paren
	    var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
	    var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

	    return {
	        rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
	        rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
	        hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
	        hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
	        hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
	        hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
	        hex3: /^([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
	        hex4: /^([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
	        hex6: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
	        hex8: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
	    };
	})();

	// `stringInputToObject`
	// Permissive string parsing.  Take in a number of formats, and output an object
	// based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
	function stringInputToObject(color) {
	    color = color.replace(trimLeft, '').replace(trimRight, '').toLowerCase();
	    var named = false;
	    if (names[color]) {
	        color = names[color];
	        named = true;
	    } else if (color == 'transparent') {
	        return { r: 0, g: 0, b: 0, a: 0, format: "name" };
	    }

	    // Try to match string input using regular expressions.
	    // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
	    // Just return an object and let the conversion functions handle that.
	    // This way the result will be the same whether the tinycolor is initialized with string or object.
	    var match;
	    if (match = matchers.rgb.exec(color)) {
	        return { r: match[1], g: match[2], b: match[3] };
	    }
	    if (match = matchers.rgba.exec(color)) {
	        return { r: match[1], g: match[2], b: match[3], a: match[4] };
	    }
	    if (match = matchers.hsl.exec(color)) {
	        return { h: match[1], s: match[2], l: match[3] };
	    }
	    if (match = matchers.hsla.exec(color)) {
	        return { h: match[1], s: match[2], l: match[3], a: match[4] };
	    }
	    if (match = matchers.hsv.exec(color)) {
	        return { h: match[1], s: match[2], v: match[3] };
	    }
	    if (match = matchers.hsva.exec(color)) {
	        return { h: match[1], s: match[2], v: match[3], a: match[4] };
	    }
	    if (match = matchers.hex8.exec(color)) {
	        return {
	            r: parseIntFromHex(match[1]),
	            g: parseIntFromHex(match[2]),
	            b: parseIntFromHex(match[3]),
	            a: convertHexToDecimal(match[4]),
	            format: named ? "name" : "hex"
	        };
	    }
	    if (match = matchers.hex6.exec(color)) {
	        return {
	            r: parseIntFromHex(match[1]),
	            g: parseIntFromHex(match[2]),
	            b: parseIntFromHex(match[3]),
	            format: named ? "name" : "hex"
	        };
	    }
	    if (match = matchers.hex4.exec(color)) {
	        return {
	            r: parseIntFromHex(match[1] + '' + match[1]),
	            g: parseIntFromHex(match[2] + '' + match[2]),
	            b: parseIntFromHex(match[3] + '' + match[3]),
	            a: convertHexToDecimal(match[4] + '' + match[4]),
	            format: named ? "name" : "hex"
	        };
	    }
	    if (match = matchers.hex3.exec(color)) {
	        return {
	            r: parseIntFromHex(match[1] + '' + match[1]),
	            g: parseIntFromHex(match[2] + '' + match[2]),
	            b: parseIntFromHex(match[3] + '' + match[3]),
	            format: named ? "name" : "hex"
	        };
	    }

	    return false;
	}

	module.exports = tinycolor;

/***/ },
/* 10 */
/***/ function(module, exports) {

	/**
	 * Copyright 2013-2015, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 *
	 * @providesModule emptyFunction
	 */

	"use strict";

	function makeEmptyFunction(arg) {
	  return function () {
	    return arg;
	  };
	}

	/**
	 * This function accepts and discards inputs; it has no side effects. This is
	 * primarily useful idiomatically for overridable function endpoints which
	 * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
	 */
	function emptyFunction() {}

	emptyFunction.thatReturns = makeEmptyFunction;
	emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
	emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
	emptyFunction.thatReturnsNull = makeEmptyFunction(null);
	emptyFunction.thatReturnsThis = function () {
	  return this;
	};
	emptyFunction.thatReturnsArgument = function (arg) {
	  return arg;
	};

	module.exports = emptyFunction;

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Copyright 2013-2015, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 *
	 * @providesModule invariant
	 */

	"use strict";

	/**
	 * Use invariant() to assert state which your program assumes to be true.
	 *
	 * Provide sprintf-style format (only %s is supported) and arguments
	 * to provide information about what broke and what you were
	 * expecting.
	 *
	 * The invariant message will be stripped in production, but the invariant
	 * will remain to ensure logic does not differ in production.
	 */

	var invariant = function invariant(condition, format, a, b, c, d, e, f) {
	  if (true) {
	    if (format === undefined) {
	      throw new Error('invariant requires an error message argument');
	    }
	  }

	  if (!condition) {
	    var error;
	    if (format === undefined) {
	      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
	    } else {
	      var args = [a, b, c, d, e, f];
	      var argIndex = 0;
	      error = new Error('Invariant Violation: ' + format.replace(/%s/g, function () {
	        return args[argIndex++];
	      }));
	    }

	    error.framesToPop = 1; // we don't care about invariant's own frame
	    throw error;
	  }
	};

	module.exports = invariant;

/***/ },
/* 12 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Copyright 2013-2015, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 *
	 * @providesModule nativeRequestAnimationFrame
	 */

	"use strict";

	var nativeRequestAnimationFrame = global.requestAnimationFrame || global.webkitRequestAnimationFrame || global.mozRequestAnimationFrame || global.oRequestAnimationFrame || global.msRequestAnimationFrame;

	module.exports = nativeRequestAnimationFrame;
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Copyright 2014-2015, Facebook, Inc.
	 * All rights reserved.
	 *
	 * This source code is licensed under the BSD-style license found in the
	 * LICENSE file in the root directory of this source tree. An additional grant
	 * of patent rights can be found in the PATENTS file in the same directory.
	 *
	 * @providesModule requestAnimationFrame
	 */

	'use strict';

	var emptyFunction = __webpack_require__(10);
	var nativeRequestAnimationFrame = __webpack_require__(12);

	var lastTime = 0;

	var requestAnimationFrame = nativeRequestAnimationFrame || function (callback) {
	  var currTime = Date.now();
	  var timeDelay = Math.max(0, 16 - (currTime - lastTime));
	  lastTime = currTime + timeDelay;
	  return global.setTimeout(function () {
	    callback(Date.now());
	  }, timeDelay);
	};

	// Works around a rare bug in Safari 6 where the first request is never invoked.
	requestAnimationFrame(emptyFunction);

	module.exports = requestAnimationFrame;
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 14 */
/***/ function(module, exports) {

	module.exports = React;

/***/ }
/******/ ]);