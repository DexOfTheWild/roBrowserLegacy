/**
 * RightClickTarget Plugin
 *
 * Enables targeting monsters by right-clicking them.
 *
 * This file is a plugin for ROBrowser, (http://www.robrowser.com/).
 */
define(function (require) {
  'use strict';

  // Dependencies
  var jQuery = require('Utils/jquery');
  var Session = require('Engine/SessionStorage');
  var EntityManager = require('Renderer/EntityManager');
  var Mouse = require('Controls/MouseEventHandler');
  var Entity = require('Renderer/Entity/Entity');

  /**
   * @returns {boolean} success
   */
  return function Init() {
    // Handle right click
    jQuery(window).on('contextmenu.target', function (event) {
      // Skip if not playing
      if (!Session.Playing) {
        return true;
      }

      // Get entity under mouse
      var entity = EntityManager.getOverEntity();

      // If entity exists and is a monster
      if (entity && entity.objecttype === Entity.TYPE_MOB) {
        console.log('Targeting entity:', entity);
        // Set as focus entity
        if (EntityManager.getFocusEntity()) {
          EntityManager.getFocusEntity().onFocusEnd();
        }

        entity.onFocus();
        EntityManager.setFocusEntity(entity);

        // Prevent default context menu
        event.preventDefault();
        return false;
      }

      return true;
    });

    // Return success
    return true;
  };
});
