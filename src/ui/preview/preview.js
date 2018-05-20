/**
 * @fileoverview Preview for the Coding with Chrome editor.
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
goog.provide('cwc.ui.Preview');

goog.require('cwc.Messenger');
goog.require('cwc.soy.ui.Preview');
goog.require('cwc.ui.PreviewInfobar');
goog.require('cwc.ui.PreviewStatus');
goog.require('cwc.ui.StatusButton');
goog.require('cwc.ui.Statusbar');
goog.require('cwc.ui.StatusbarState');
goog.require('cwc.utils.Events');
goog.require('cwc.utils.Logger');

goog.require('goog.async.Throttle');
goog.require('goog.dom');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.events.EventTarget');
goog.require('goog.events.EventType');
goog.require('goog.soy');
goog.require('goog.ui.Component.EventType');


/**
 * @param {!cwc.utils.Helper} helper
 * @constructor
 * @struct
 * @final
 */
cwc.ui.Preview = function(helper) {
  /** @type {string} */
  this.name = 'Preview';

  /** @type {!cwc.utils.Helper} */
  this.helper = helper;

  /** @type {string} */
  this.prefix = this.helper.getPrefix('preview');

  /** @type {Element} */
  this.node = null;

  /** @type {Element} */
  this.nodeRuntime = null;

  /** @type {boolean} */
  this.autoUpdate = false;

  /** @type {number} */
  this.autoUpdateDelay = 750;

  /** @type {number|null} */
  this.autoUpdateDelayer = null;

  /** @type {goog.events.ListenableKey|number} */
  this.autoUpdateEvent = null;

  /** @type {Object} */
  this.content = null;

  /** @type {!cwc.ui.Statusbar} */
  this.statusbar = new cwc.ui.Statusbar(this.helper);

  /** @type {!cwc.ui.StatusButton} */
  this.statusButton = new cwc.ui.StatusButton(this.helper);

  /** @type {cwc.ui.PreviewInfobar} */
  this.infobar = null;

  /** @private {!cwc.utils.Events} */
  this.events_ = new cwc.utils.Events(this.name, '', this);

  /** @private {!goog.events.EventTarget} */
  this.eventHandler_ = new goog.events.EventTarget();

  /** @private {!boolean} */
  this.enableMessenger_ = false;

  /** @private {!cwc.ui.PreviewStatus} */
  this.previewStatus_ = new cwc.ui.PreviewStatus(
    this.helper, this.eventHandler_)
    .setStatusbar(this.statusbar)
    .setStatusButton(this.statusButton);

  /** @private {!cwc.Messenger} */
  this.messenger_ = new cwc.Messenger();

  /** @private {!string} */
  this.partition_ = 'preview';

  /** @private {!number} */
  this.runThrottleTime_ = 1500;

  /** @private {goog.async.Throttle} */
  this.runThrottle_ = new goog.async.Throttle(
    this.run_.bind(this), this.runThrottleTime_);

  /** @private {!boolean} */
  this.webviewSupport_ = this.helper.checkChromeFeature('webview');

  /** @private {!cwc.utils.Logger|null} */
  this.log_ = new cwc.utils.Logger(this.name);
};


/**
 * Decorates the given node and adds the preview window.
 * @param {Element=} node The target node to add the preview window.
 */
cwc.ui.Preview.prototype.decorate = function(node) {
  this.node = node || goog.dom.getElement(this.prefix + 'chrome');
  if (!this.node) {
    console.error('Invalid Preview node:', this.node);
    return;
  }

  // Render preview template.
  this.log_.debug('Decorate', this.name, 'into node', this.node);
  goog.soy.renderElement(
    this.node, cwc.soy.ui.Preview.template, {prefix: this.prefix}
  );

  // Runtime
  if (this.enableMessenger_) {
    this.nodeRuntime = goog.dom.getElement(this.prefix + 'runner');
  } else {
    this.nodeRuntime = goog.dom.getElement(this.prefix + 'runtime');
  }
  this.render();

  // Statusbar
  let nodeStatusbar = goog.dom.getElement(this.prefix + 'statusbar');
  if (nodeStatusbar) {
    this.statusbar.decorate(nodeStatusbar);
  }

  // Status Button and actions buttons
  this.decorateStatusButton(goog.dom.getElement(this.prefix + 'statusbutton'));

  // Infobar
  let nodeInfobar = goog.dom.getElement(this.prefix + 'infobar');
  if (nodeInfobar) {
    this.infobar = new cwc.ui.PreviewInfobar(this.helper);
    this.infobar.decorate(nodeInfobar);
  }

  // Monitor Changes
  let viewportMonitor = new goog.dom.ViewportSizeMonitor();
  this.events_.listen(viewportMonitor, goog.events.EventType.RESIZE,
      this.refresh, false, this);

  let layoutInstance = this.helper.getInstance('layout');
  if (layoutInstance) {
    let eventHandler = layoutInstance.getEventHandler();
    this.events_.listen(eventHandler, goog.events.EventType.UNLOAD,
        this.cleanUp, false, this);
    this.events_.listen(eventHandler, goog.events.EventType.DRAGEND,
        this.refresh, false, this);
  }
};


/**
 * @param {!Element} node
 */
cwc.ui.Preview.prototype.decorateStatusButton = function(node) {
  if (!node) {
    return;
  }
  this.statusButton.decorate(node)
    .setBrowserAction(this.openInBrowser.bind(this))
    .setFullscreenAction(() => {
      this.helper.getInstance('layout').setFullscreenPreview(true);
      this.refresh();
    })
    .setFullscreenExitAction(() => {
      this.helper.getInstance('layout').setFullscreenPreview(false);
      this.refresh();
    })
    .setReloadAction(() => {
      this.refresh();
    })
    .setTerminateAction(this.terminate.bind(this))
    .setRunAction(() => {
      this.run();
      this.focus();
    })
    .setStopAction(this.stop.bind(this));
};


/**
 * Renders content for preview window.
 */
cwc.ui.Preview.prototype.render = function() {
  if (this.infobar) {
    this.infobar.clear();
  }

  let terminalInstance = this.helper.getInstance('terminal');
  if (terminalInstance) {
    terminalInstance.clearErrors();
  }

  this.content = this.webviewSupport_ ?
    this.renderWebview() : this.renderIframe();
  goog.dom.appendChild(this.nodeRuntime, this.content);
  this.previewStatus_.setStatus(cwc.ui.StatusbarState.INITIALIZED);
  this.messenger_.setTarget(this.content);
};


/**
 * Prepare content to be rendered in iframe element.
 * @return {!Object}
 */
cwc.ui.Preview.prototype.renderIframe = function() {
  if (this.content) {
    goog.dom.removeChildren(this.nodeRuntime);
  }
  let content = document.createElement('iframe');
  return content;
};


/**
 * Prepare content to be rendered in WebView element.
 * @return {!Object}
 */
cwc.ui.Preview.prototype.renderWebview = function() {
  let content = document.createElement('webview');
  content['setAttribute']('partition', this.partition_);
  content['setUserAgentOverride']('CwC sandbox');
  this.previewStatus_.addEventHandler(content);
  return content;
};


/**
 * @param {boolean=} enable
 */
cwc.ui.Preview.prototype.enableMessenger = function(enable = true) {
  this.enableMessenger_ = enable ? true : false;
};


/**
 * @return {!goog.events.EventTarget}
 */
cwc.ui.Preview.prototype.getEventHandler = function() {
  return this.eventHandler_;
};


/**
 * @return {!cwc.Messenger}
 */
cwc.ui.Preview.prototype.getMessenger = function() {
  return this.messenger_;
};


/**
 * Runs the preview.
 */
cwc.ui.Preview.prototype.run = function() {
  this.runThrottle_.fire();
};


/**
 * Stops the preview window.
 */
cwc.ui.Preview.prototype.stop = function() {
  if (!this.content) {
    return;
  }
  if (this.webviewSupport_) {
    this.content.stop();
  }
  this.setContentUrl('about:blank');
  this.previewStatus_.setStatus(cwc.ui.StatusbarState.STOPPED);
};


/**
 * Refreshes the preview.
 */
cwc.ui.Preview.prototype.refresh = function() {
  if (!this.content) {
    return;
  }
  let terminalInstance = this.helper.getInstance('terminal');
  if (terminalInstance) {
    terminalInstance.clearErrors();
  }

  this.previewStatus_.setStatus(cwc.ui.StatusbarState.REFRESHING);
  if (this.webviewSupport_) {
    this.content.stop();
    this.content.reload();
  } else if (this.content.contentWindow) {
    this.content.contentWindow.location.reload(true);
  }
  this.focus();
};


/**
 * Reloads the preview.
 */
cwc.ui.Preview.prototype.reload = function() {
  if (this.content) {
    this.previewStatus_.setStatus(cwc.ui.StatusbarState.RELOADING);
    this.stop();
    this.run();
  }
};


/**
 * Terminates the preview window.
 */
cwc.ui.Preview.prototype.terminate = function() {
  if (this.content) {
    this.previewStatus_.setStatus(cwc.ui.StatusbarState.TERMINATED);
    this.content.terminate();
  }
};


/**
 * Shows or hides the built in console.
 * @param {boolean} visible
 */
cwc.ui.Preview.prototype.showConsole = function(visible) {
  if (this.infobar) {
    if (visible) {
      this.infobar.showConsole();
    } else {
      this.infobar.hideConsole();
    }
  }
};


/**
 * @return {Object}
 */
cwc.ui.Preview.prototype.getContent = function() {
  return this.content;
};


/**
 * Gets the content url from the renderer.
 * @return {!string}
 */
cwc.ui.Preview.prototype.getContentUrl = function() {
  let rendererInstance = this.helper.getInstance('renderer', true);
  let contentUrl = rendererInstance.getContentUrl();
  if (!contentUrl) {
    this.log_.error('Was not able to get content url!');
  }
  return contentUrl || '';
};


/**
 * @param {!string} url
 */
cwc.ui.Preview.prototype.setContentUrl = function(url) {
  if (url && this.content) {
    this.log_.info('Update preview with', url.substring(0, 32), '...');
    if (url.length >= 1600000) {
      this.log_.warn('Content URL exceed char limit with', url.length, '!');
    }
    this.content['src'] = url;
  } else {
    this.log_.error('Was unable to set content url!');
  }
};


/**
 * Opens preview in new browser window.
 */
cwc.ui.Preview.prototype.openInBrowser = function() {
  this.helper.openUrl(this.getContentUrl());
};


/**
 * Enables or disables the automatic update of the preview.
 * @param {boolean} active
 */
cwc.ui.Preview.prototype.setAutoUpdate = function(active) {
  if (active && !this.autoUpdateEvent) {
    this.log_.info('Activate AutoUpdate...');
    let editorInstance = this.helper.getInstance('editor');
    if (editorInstance) {
      let editorEventHandler = editorInstance.getEventHandler();
      this.autoUpdateEvent = goog.events.listen(editorEventHandler,
          goog.ui.Component.EventType.CHANGE, this.delayAutoUpdate, false,
          this);
    }
    if (!this.helper.getInstance('blockly')) {
      this.run();
    }
    window.setTimeout(this.focus.bind(this), 1000);
  } else if (!active && this.autoUpdateEvent) {
    this.log_.info('Deactivate AutoUpdate...');
    goog.events.unlistenByKey(this.autoUpdateEvent);
    this.autoUpdateEvent = null;
  }
  this.autoUpdate = active;
};


/**
 * Delays the auto update by the defined time range.
 */
cwc.ui.Preview.prototype.delayAutoUpdate = function() {
  if (this.autoUpdateDelayer) {
    window.clearTimeout(this.autoUpdateDelayer);
  }
  this.autoUpdateDelayer = window.setTimeout(this.doAutoUpdate.bind(this),
      this.autoUpdateDelay);
};


/**
 * Perform the auto update.
 */
cwc.ui.Preview.prototype.doAutoUpdate = function() {
  if (!this.autoUpdate) {
    return;
  }
  this.log_.info('Perform auto update ...');
  this.run();
};


/**
 * Focus the content window.
 */
cwc.ui.Preview.prototype.focus = function() {
  if (this.content) {
    this.content['focus']();
  }
};


/**
 * Injects and executes the passed code in the preview content.
 * @param {!(string|Function)} code
 */
cwc.ui.Preview.prototype.executeScript = function(code) {
  this.messenger_.send('__exec__',
    typeof code === 'function' ? code.toString() : code);
};


/**
 * @private
 */
cwc.ui.Preview.prototype.run_ = function() {
  if (this.previewStatus_.getStatus() == cwc.ui.StatusbarState.LOADING ||
      this.previewStatus_.getStatus() == cwc.ui.StatusbarState.UNRESPONSIVE) {
    this.terminate();
  } else {
    this.stop();
  }
  this.previewStatus_.setStatus(cwc.ui.StatusbarState.RUNNING);
  this.setContentUrl(this.getContentUrl());
};


/**
 * Clears all object based events.
 */
cwc.ui.Preview.prototype.cleanUp = function() {
  this.events_.clear();
};
