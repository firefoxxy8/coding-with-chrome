/**
 * @fileoverview Message framework for safe cross communication.
 * Allows communication between the Coding with Chrome Editor and Webview or
 * Iframe Object over postMessage.
 *
 * @license Copyright 2018 The Coding with Chrome Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author mbordihn@google.com (Markus Bordihn)
 */
goog.provide('cwc.framework.Message');


/**
 * @constructor
 * @struct
 * @final
 * @export
 */
cwc.framework.Message = function() {
  /** @type {string} */
  this.name = 'Message Framework';

  /** @type {string} */
  this.appOrigin = '';

  /** @type {Object} */
  this.appWindow = null;

  /** @private {Object} */
  this.listener_ = {};

  /** @private {Object} */
  this.listenerScope_ = this;

  // Message handler
  window.addEventListener('message', this.handleMessage_.bind(this), false);

  // External listener
  this
    .addListener('__exec__', this.executeCode_)
    .addListener('__gamepad__', this.handleGamepad_)
    .addListener('__handshake__', this.handleHandshake_)
    .addListener('__ping__', this.handlePing_)
    .addListener('__start__', this.handleStart_);
};


/**
 * Adds the command to the listener.
 * @param {!string} name
 * @param {!Function} func
 * @param {?=} scope
 * @return {THIS}
 * @template THIS
 * @export
 */
cwc.framework.Message.prototype.addListener = function(name, func,
    scope = this.listenerScope_) {
  if (!name) {
    console.error('Listener name is undefined!');
    return;
  } else if (!func || typeof func !== 'function') {
    console.error('Listener function ' + name + ' is undefined!');
    return;
  } else if (typeof this.listener_[name] !== 'undefined') {
    console.error('Listener ' + name + ' is already defined!');
    return;
  }
  this.listener_[name] = scope ? func.bind(scope) : func;
  console.log('Added message listener ' + name);
  return this;
};


/**
 * @param {!string} appOrigin
 * @export
 */
cwc.framework.Message.prototype.setAppOrigin = function(appOrigin) {
  if (appOrigin) {
    this.appOrigin = appOrigin;
  }
};


/**
 * @param {!Object} appWindow
 * @export
 */
cwc.framework.Message.prototype.setAppWindow = function(appWindow) {
  if (appWindow) {
    this.appWindow = appWindow;
  }
};


/**
 * Sets the runner scope.
 * @param {!Function} scope
 * @return {THIS}
 * @template THIS
 * @export
 */
cwc.framework.Message.prototype.setListenerScope = function(scope) {
  if (scope && typeof scope !== 'function' && typeof scope !== 'object') {
    throw new Error('Invalid runner scope!', scope);
  } else if (scope) {
    this.listenerScope_ = scope;
  }
  return this;
};


/**
 * Sends the defined data to the runner.
 * @param {!string} name
 * @param {Object|string=} value
 * @param {number=} delay in msec
 * @export
 */
cwc.framework.Message.prototype.send = function(name, value = {}, delay = 0) {
  if (!name || !this.isReady_()) {
    throw Error('Unable so send data!');
  }
  let sendCommand = function() {
    this.appWindow.postMessage({
      'command': name,
      'value': value,
    }, this.appOrigin);
  }.bind(this);
  if (delay) {
    this.senderStack_.addCommand(sendCommand);
    this.senderStack_.addDelay(delay);
  } else {
    sendCommand();
  }
};


/**
 * Handles the received messages and executes the predefined actions.
 * @param {Event} event
 * @private
 */
cwc.framework.Message.prototype.handleMessage_ = function(event) {
  if (!event) {
    throw new Error('Was not able to get browser event!');
  }
  if (!this.appWindow && 'source' in event) {
    this.setAppWindow(event['source']);
  } else if (this.appWindow !== event['source']) {
    return;
  }
  if (!this.appOrigin && 'origin' in event) {
    this.setAppOrigin(event['origin']);
  } else if (this.appOrigin !== event['origin']) {
    return;
  }
  if (typeof this.listener_[event['data']['command']] === 'undefined') {
    throw new Error('Command ' + event['data']['command'] + ' is not defined!');
  }
  this.listener_[event['data']['command']](event['data']['value']);
};


/**
 * @param {!string} code
 * @private
 */
cwc.framework.Message.prototype.executeCode_ = function(code) {
  if (!code || typeof code !== 'string') {
    return;
  }
  // Remove trailing ";"" to avoid syntax errors for one liner
  if (code.endsWith(';')) {
    code = code.slice(0, -1);
  }
  // Skip the return parameter for more complex code
  if (code.includes(';') || code.includes('{')) {
    console.log('>>' + Function(code)());
  } else {
    console.log('>>' + Function('return (' + code + ');')());
  }
};


/**
 * @param {!Object} data
 * @private
 */
cwc.framework.Message.prototype.handleGamepad_ = function(data) {
  console.log('__gamepad__', data);
};


/**
 * Handles the received handshake message.
 * @param {!Object} data
 * @private
 */
cwc.framework.Message.prototype.handleHandshake_ = function(data) {
  if (this.isReady_()) {
    this.send('__handshake__', data);
  }
};


/**
 * Handles the received start message.
 * @private
 */
cwc.framework.Message.prototype.handleStart_ = function() {
  if (this.monitor_) {
    console.log('Initialize monitor ...');
    this.monitor_();
  }
  if (this.callback_) {
    console.log('Starting program ...');
    this.callback_(this.scope_);
  }
};


/**
 * Handles the received "ping" command.
 * @param {!number} ping_id
 */
cwc.framework.Message.prototype.handlePing_ = function(ping_id) {
  this.send('__pong__', {
    'id': ping_id,
    'time': new Date().getTime(),
  });
};


/**
 * @return {boolean}
 * @private
 */
cwc.framework.Message.prototype.isReady_ = function() {
  if (!this.appWindow || !this.appOrigin) {
    console.error('Communication channel has not yet been opened');
    return false;
  }
  return true;
};
