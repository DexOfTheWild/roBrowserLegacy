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

    /**
 * Focuses the nearest monster to the player.
 * 
 * @returns {Object|null} The newly focused entity, or null if none found.
 */
    function focusNearestEnemy() {
      Session.EnhancedTargeting = true;

      // The player's entity
      var Player = Session.Entity;
      // Whatever is currently targeted
      var entityFocus = EntityManager.getFocusEntity();
      // console.log('[EnhancedTargeting] Current focus:', entityFocus);
      // Grab the nearest monster entity
      var closestEntity = EntityManager.getClosestEntity(Player, Entity.TYPE_MOB);
      // console.log('[EnhancedTargeting] Closest entity:', closestEntity);

      if (closestEntity) {
        // If we had a focus already, but it's a different monster, clear old focus
        if (entityFocus && closestEntity.GID !== entityFocus.GID) {
          // console.log('[EnhancedTargeting] Clearing old focus:', entityFocus);
          if (entityFocus.onFocusEnd) {
            entityFocus.onFocusEnd();
          }
          EntityManager.setFocusEntity(null);
          // console.log('[EnhancedTargeting] Cleared old focus:', entityFocus);
          // Activate focus on the new monster
          if (closestEntity.onFocus) {
            // console.log('[EnhancedTargeting] Activating new focus:', closestEntity);
            closestEntity.onFocus();
          }
          EntityManager.setFocusEntity(closestEntity);
          // console.log('[EnhancedTargeting] Set new focus:', closestEntity);
        }
        // If we didn’t have any focus, just set the new monster
        else if (!entityFocus) {
          if (closestEntity.onFocus) {
            // console.log('[EnhancedTargeting] Activating new focus:', closestEntity);
            closestEntity.onFocus();
          }
          EntityManager.setFocusEntity(closestEntity);
          // console.log('[EnhancedTargeting] Set new focus:', closestEntity);
        }
      }

      // Return whichever monster became our focus (or null if none found)
      return closestEntity || null;
    }

    // Handle right click
    // jQuery(window).on('contextmenu.target', function (event) {
    //   // Skip if not playing
    //   if (!Session.Playing) {
    //     return true;
    //   }

    //   // Get entity under mouse
    //   var entity = EntityManager.getOverEntity();

    //   // If entity exists and is a monster
    //   if (entity && entity.objecttype === Entity.TYPE_MOB) {
    //     console.log('[EnhancedTargeting] Targeting entity:', entity);
    //     // Set as focus entity
    //     if (EntityManager.getFocusEntity()) {
    //       EntityManager.getFocusEntity().onFocusEnd();
    //     }

    //     entity.onFocus();
    //     EntityManager.setFocusEntity(entity);

    //     // Prevent default context menu
    //     event.preventDefault();
    //     return false;
    //   }

    //   return true;
    // });
    // Somewhere in your main game script or UI initialization code:
    document.addEventListener('keydown', function (event) {
      // 'Tab' is keyCode 9, but you can also check event.key === 'Tab'
      if (event.key === 'Tab') {
    // Prevent the browser from moving focus to the next element
        event.preventDefault();

        // Call your function that finds/focuses the nearest monster
        focusNearestEnemy();
      }
    });


    // Return success
    return true;
  };
});
