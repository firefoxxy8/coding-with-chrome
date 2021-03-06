/**
 * @fileoverview Basic modifications.
 *
 * @license Copyright 2015 The Coding with Chrome Authors.
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
goog.provide('cwc.mode.basic.simple.Mod');

goog.require('cwc.mode.basic.Hints');
goog.require('cwc.mode.default.Mod');


/**
 * @constructor
 * @param {!cwc.utils.Helper} helper
 */
cwc.mode.basic.simple.Mod = function(helper) {
  /** @type {!cwc.mode.default.Mod} */
  this.mod = new cwc.mode.default.Mod(helper);
};


/**
 * Decorates the different parts of the modification.
 * @async
 */
cwc.mode.basic.simple.Mod.prototype.decorate = async function() {
  await this.mod.decorate();
  this.mod.editor.setLocalHints(cwc.mode.basic.Hints);
};
