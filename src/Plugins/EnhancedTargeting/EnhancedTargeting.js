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
  var Sound = require('Audio/SoundManager');

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
      // The player's entity
      var Player = Session.Entity;
      // Whatever is currently targeted
      var entityFocus = EntityManager.getFocusEntity();
      // console.log('[EnhancedTargeting] Current focus:', entityFocus);
      // Grab the nearest monster entity
      var closestEntity = EntityManager.getClosestEntity(Player, Entity.TYPE_MOB);
      // console.log('[EnhancedTargeting] Closest entity:', closestEntity);

      // If we're already targeting the closest entity, find the next closest one
      if (entityFocus && closestEntity && entityFocus.GID === closestEntity.GID) {
        // Create a list of mobs sorted by distance
        var mobList = [];
        EntityManager.forEach(function (entity) {
          if (entity.objecttype === Entity.TYPE_MOB &&
            entity.action !== entity.ACTION.DIE &&
            entity.remove_tick === 0) {
            mobList.push(entity);
          }
        });

        // Sort mobs by distance to player
        mobList.sort(function (a, b) {
          var distA = EntityManager.getPathDistance(Player, a) || Infinity;
          var distB = EntityManager.getPathDistance(Player, b) || Infinity;
          return distA - distB;
        });

        // Find the next mob after our current target
        for (var i = 0; i < mobList.length; i++) {
          if (mobList[i].GID === entityFocus.GID && i + 1 < mobList.length) {
            closestEntity = mobList[i + 1];
            break;
          }
        }
      }

      if (closestEntity) {
        // Clear old focus if it exists and is different
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

      if (closestEntity) {
        Sound.play("click.wav", 1);
      }
      // Return whichever monster became our focus (or null if none found)
      return closestEntity || null;
    }

    Session.EnhancedTargeting = true;

    document.addEventListener('keydown', function (event) {
      // 'Tab' is keyCode 9, but you can also check event.key === 'Tab'
      if (event.key === 'Tab') {
    // Prevent the browser from moving focus to the next element
        event.preventDefault();

        // Call your function that finds/focuses the nearest monster
        focusNearestEnemy();
      }
    });

    jQuery(window).on('contextmenu.target', function (event) {
      // Skip if not playing
      if (!Session.Playing) {
        return true;
      }

      // Get entity under mouse
      var entity = EntityManager.getOverEntity();

      // If entity exists and is a monster
      if (entity && entity.objecttype === Entity.TYPE_MOB) {
        console.log('[EnhancedTargeting] Targeting entity:', entity);
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
