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

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Easing = require('./Easing');
var InteractionManager = require('./InteractionManager');
var Interpolation = require('./Interpolation');
var React = require('react');
var Set = require('./Set');
var SpringConfig = require('./SpringConfig');
var ViewStylePropTypes = {};

var flattenStyle = require('./flattenStyle');
var invariant = require('fbjs/lib/invariant');
var requestAnimationFrame = require('fbjs/lib/requestAnimationFrame');

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
      !(config.tension === undefined && config.friction === undefined) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'You can only define bounciness/speed or tension/friction but not both') : invariant(false) : undefined;
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
      !(value.x instanceof AnimatedValue && value.y instanceof AnimatedValue) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'AnimatedValueXY must be initalized with an object of numbers or ' + 'AnimatedValues.') : invariant(false) : undefined;
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
    !(typeof parentValue === 'number') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Cannot interpolate an input which is not a number.') : invariant(false) : undefined;
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
        !(recMapping instanceof AnimatedValue) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Bad mapping of type ' + typeof recMapping + ' for key ' + key + ', event value must map to AnimatedValue') : invariant(false) : undefined;
        recMapping.setValue(recEvt);
        return;
      }
      !(typeof recMapping === 'object') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Bad mapping of type ' + typeof recMapping + ' for key ' + key) : invariant(false) : undefined;
      !(typeof recEvt === 'object') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Bad event of type ' + typeof recEvt + ' for key ' + key) : invariant(false) : undefined;
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