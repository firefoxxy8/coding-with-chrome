/**
 * @fileoverview Renderer for the Coding with Chrome editor.
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
goog.provide('cwc.renderer.Renderer');

goog.require('cwc.file.Files');
goog.require('cwc.framework.External');
goog.require('cwc.framework.Internal');
goog.require('cwc.framework.StyleSheet');
goog.require('cwc.renderer.Helper');
goog.require('cwc.utils.Helper');
goog.require('cwc.utils.Logger');
goog.require('cwc.utils.Resources');
goog.require('cwc.utils.mime.getTypeByExtension');


/**
 * @param {!cwc.utils.Helper} helper
 * @constructor
 * @struct
 * @final
 */
cwc.renderer.Renderer = function(helper) {
  /** @type {string} */
  this.name = 'Renderer';

  /** @type {!cwc.utils.Helper} */
  this.helper = helper;

  /** @type {Function} */
  this.renderer = null;

  /** @type {!cwc.renderer.Helper} */
  this.rendererHelper = new cwc.renderer.Helper();

  /** @type {cwc.ui.Editor} */
  this.editorInstance_ = null;

  /** @type {!boolean} */
  this.serverMode_ = false;

  /** @private {!cwc.utils.Logger} */
  this.log_ = new cwc.utils.Logger(this.name);

  /** @private {!cwc.file.Files} */
  this.libraryFiles_ = new cwc.file.Files();
};


/**
 * @return {!cwc.renderer.Helper}
 * @export
 */
cwc.renderer.Renderer.prototype.getRendererHelper = function() {
  return this.rendererHelper;
};


/**
 * Sets the renderer for the content.
 * @param {Function} renderer
 * @return {Promise}
 * @export
 */
cwc.renderer.Renderer.prototype.setRenderer = function(renderer) {
  return new Promise((resolve, reject) => {
    if (!goog.isFunction(renderer)) {
      this.log_.error('Renderer is not an function !');
      reject();
    }
    let fileInstance = this.helper.getInstance('file');
    if (fileInstance) {
      this.libraryFiles_ = fileInstance.getFiles();
    }
    this.editorInstance_ = this.helper.getInstance('editor');
    this.renderer = renderer;
    resolve();
  });
};


/**
 * @param {!boolean} enable
 */
cwc.renderer.Renderer.prototype.setServerMode = function(enable) {
  this.serverMode_ = enable;
};


/**
 * @return {string} Data URL with the rendered content.
 */
cwc.renderer.Renderer.prototype.getContentUrl = function() {
  let content = this.getRenderedContent();
  if (this.serverMode_) {
    let serverInstance = this.helper.getInstance('server');
    if (serverInstance) {
      return serverInstance.getPreviewURL();
    }
  }
  return this.rendererHelper.getDataURL(content);
};


/**
 * Renders the JavaScript, CSS and HTML content together with all settings.
 * @return {!string}
 * @export
 */
cwc.renderer.Renderer.prototype.getRenderedContent = function() {
  let enviroment = {
    'baseURL': this.helper.getBaseURL(),
    'currentView': this.editorInstance_.getCurrentView(),
  };

  let html = this.renderer(
      this.editorInstance_.getEditorContent(),
      this.libraryFiles_,
      this.rendererHelper,
      enviroment
  );

  if (this.serverMode_) {
    let serverInstance = this.helper.getInstance('server');
    if (serverInstance) {
      serverInstance.setPreview(html);
    }
  }

  return html || '';
};
