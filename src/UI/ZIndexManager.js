/**
 * UI/ZIndexManager.js
 *
 * Manages z-index ordering of UI components
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */
define(function (require) {
  'use strict';

  var KEYS = require('Controls/KeyEventHandler');
  var jQuery = require('Utils/jquery');

  var ZIndexManager = {};

  /**
   * Base z-index for UI components
   */
  ZIndexManager.BASE_INDEX = 50;

  /**
   * Track the currently focused component
   * @type {UIComponent|null}
   */
  ZIndexManager.topComponent = null;

  /**
   * Internal map to track component z-indexes
   * @type {Map<string, number>}
   */
  ZIndexManager._zIndexMap = new Map();

  ZIndexManager.manager = null;  // Will be set by UIManager

  /**
   * Get all active components
   * @returns {Object}
   * @returns {Error} if manager is not initialized
   */
  Object.defineProperty(ZIndexManager, 'components', {
    get: function () {
      if (!this.manager) {
        return new Error('ZIndexManager: No UI manager initialized');
      }
      return this.manager.components;
    }
  });

  /**
   * Initialize the manager
   * @param {UIManager} manager - The UI manager instance
   */
  ZIndexManager.init = function init(manager) {
    if (!manager) {
      return new Error('ZIndexManager: Manager is required for initialization');
    }

    this.manager = manager;

    // Set up ESC key handler
    jQuery(window).on('keydown.zindexmanager', function (event) {
      if (event.which === KEYS.ESCAPE) {
        var topEscapable = ZIndexManager.getTopEscapableComponent();
        if (topEscapable) {
          topEscapable.ui.hide();
          event.stopImmediatePropagation();
        }
      }
    });

    // Initialize z-indexes for any existing components
    Object.values(this.manager.components).forEach(component => {
      if (!component.uid) {
        component.uid = 'component_' + Math.random().toString(36).substr(2, 9);
      }
      this.setZIndex(component, this.BASE_INDEX);
    });
  };

  /**
   * Set z-index for a component
   * @param {UIComponent} component 
   * @param {number} zIndex 
   * @returns {Error} if component is invalid
   */
  ZIndexManager.setZIndex = function setZIndex(component, zIndex) {
    if (!component || !component.uid) {
      return new Error('ZIndexManager: Invalid component');
    }
    this._zIndexMap.set(component.uid, zIndex);
    if (component.__visible) {
      component.ui.css('zIndex', zIndex);
    }
  };

  /**
   * Get z-index for a component
   * @param {UIComponent} component 
   * @returns {number}
   */
  ZIndexManager.getZIndex = function getZIndex(component) {
    return component && component.uid ?
      (this._zIndexMap.get(component.uid) || this.BASE_INDEX) :
      this.BASE_INDEX;
  };

  /**
   * Place component on top of all others
   * @param {UIComponent} component 
   */
  ZIndexManager.placeOnTop = function placeOnTop(component) {
    const highestZ = Math.max(
      this.BASE_INDEX,
      ...Array.from(this._zIndexMap.values())
    );
    this.setZIndex(component, highestZ + 1);
    this.topComponent = component;
  };

  /**
   * Focus a component, preserving relative z-index differences
   * @param {UIComponent} component 
   */
  ZIndexManager.focusComponent = function focusComponent(component) {
    if (!component.needFocus) {
      return;
    }

    const currentZ = this.getZIndex(component);
    const highestZ = Math.max(
      this.BASE_INDEX,
      ...Array.from(this._zIndexMap.values())
    );

    // Only move component above highest if it's not already there
    if (currentZ <= highestZ) {
      this.setZIndex(component, highestZ + 1);
      this.topComponent = component;
    }
  };

  /**
   * Get escapable components in order of z-index
   * @returns {Array}
   */
  ZIndexManager.getEscapableComponents = function getEscapableComponents() {
    try {
      return Object.values(this.manager.components)
        .filter(component =>
          component.__visible &&
          component.closeOnEsc !== false &&
          !component.isEscapeMenu);  // Using semantic property instead of name check
    } catch (e) {
      console.error('Failed to get escapable components:', e);
      return [];
    }
  };

  /**
   * Get the topmost escapable component
   * @returns {UIComponent|null}
   */
  ZIndexManager.getTopEscapableComponent = function getTopEscapableComponent() {
    const escapableComponents = Object.values(this.manager.components)
      .filter(component =>
        component.__visible &&
        component.name !== 'Escape' &&
        component.closeOnEsc !== false);

    if (!escapableComponents.length) {
      return null;
    }

    return escapableComponents.reduce((highest, current) =>
      this.getZIndex(current) > this.getZIndex(highest) ? current : highest
    );
  };

  /**
   * Remove component from z-index management
   * @param {UIComponent} component 
   */
  ZIndexManager.removeComponent = function removeComponent(component) {
    this._zIndexMap.delete(component.name);
    if (this.topComponent === component) {
      this.topComponent = null;
    }
  };

  /**
   * Check if there are any escapable components currently open
   * @returns {boolean}
   */
  ZIndexManager.hasEscapableComponents = function hasEscapableComponents() {
    return this.getTopEscapableComponent() !== null;
  };

  /**
   * Clear z-index when component is removed
   * @param {UIComponent} component 
   */
  ZIndexManager.onHideComponent = function onHideComponent(component) {
    this._zIndexMap.delete(component.name);
    if (this.topComponent === component) {
      this.topComponent = null;
    }
  };

  /**
   * Set initial z-index when component is added
   * @param {UIComponent} component 
   */
  ZIndexManager.onShowComponent = function onShowComponent(component) {
    if (component.__visible) {
      this.focusComponent(component);
    } else {
      this.setZIndex(component, this.BASE_INDEX);
    }
  };

  /**
   * Reset the manager
   */
  ZIndexManager.reset = function reset() {
    this._zIndexMap.clear();
    this.topComponent = null;
  };

  /**
   * Remove all components from z-index management
   */
  ZIndexManager.removeComponents = function removeComponents() {
    this._zIndexMap.clear();
    this.topComponent = null;
    jQuery(window).off('keydown.zindexmanager');
    // Only reinitialize if we still have a manager
    if (this.manager) {
      this.init(this.manager);
    }
  };

  ZIndexManager.init();

  return ZIndexManager;
});
