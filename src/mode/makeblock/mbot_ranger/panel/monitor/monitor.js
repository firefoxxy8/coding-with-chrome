/**
 * @fileoverview Monitor for the EV3 modification.
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
goog.provide('cwc.mode.makeblock.mbotRanger.Monitor');

goog.require('cwc.mode.makeblock.mbotRanger.SensorEvents');
goog.require('cwc.soy.mode.makeblock.mbotRanger.Monitor');
goog.require('cwc.utils.Events');
goog.require('cwc.utils.Helper');

goog.require('goog.events');
goog.require('goog.events.EventType');


/**
 * @constructor
 * @param {!cwc.utils.Helper} helper
 * @param {!cwc.mode.makeblock.mbotRanger.Connection} connection
 * @struct
 * @final
 */
cwc.mode.makeblock.mbotRanger.Monitor = function(helper, connection) {
  /** @type {string} */
  this.name = 'mBot Ranger Monitor';

  /** @type {string} */
  this.prefix = helper.getPrefix('mbot-ranger-monitor');

  /** @type {Element} */
  this.node = null;

  /** @type {!Object.<Element>} */
  this.nodeCache = {};

  /** @type {!cwc.utils.Helper} */
  this.helper = helper;

  /** @type {!cwc.mode.makeblock.mbotRanger.Connection} */
  this.connection = connection;

  /** @type {boolean} */
  this.prepared = false;

  /** @private {!cwc.protocol.lego.ev3.Api} */
  this.api_ = this.connection.getApi();

  /** @private {!cwc.utils.Events} */
  this.events_ = new cwc.utils.Events(this.name, this.prefix, this);
};


/**
 * Decorates the EV3 monitor window.
 * @param {!Element} node
 */
cwc.mode.makeblock.mbotRanger.Monitor.prototype.decorate = function(node) {
  this.node = node;

  goog.soy.renderElement(
    this.node,
    cwc.soy.mode.makeblock.mbotRanger.Monitor.template, {
      prefix: this.prefix,
    }
  );


  // Unload event
  let layoutInstance = this.helper.getInstance('layout');
  if (layoutInstance) {
    let eventHandler = layoutInstance.getEventHandler();
    this.events_.listen(
      eventHandler, goog.events.EventType.UNLOAD, this.cleanUp);
  }
};


/**
 * Cleans up the event listener and any other modification.
 */
cwc.mode.makeblock.mbotRanger.Monitor.prototype.cleanUp = function() {
  console.log('Clean up EV3 monitor panel...');
  this.events_.clear();
};
