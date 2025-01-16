/**
 * NPC Interceptor Plugin
 *
 * This file is a plugin for ROBrowser, (http://www.robrowser.com/).
 */
define(function (require) {
  'use strict';

  var NPCInterceptor = require('Engine/NPCInterceptor');
  var Session = require('Engine/SessionStorage');
  var Sound = require('Audio/SoundManager');

  /**
   * Initialize the hooks
   */
  function initHooks() {
    console.log('[Interceptor] Initializing hooks...');

    let lastTime = 0;
    const COOLDOWN = 300; // ms between sounds

    // Pre-render hook for mining animation
    NPCInterceptor.addPreRenderHook("iron_ore_animation", function (npcEntity, modelView, projection) {
      // Store animation data on the entity itself
      npcEntity._miningAnimation = npcEntity._miningAnimation || {
        isActive: false,
        startTime: 0,
        wiggleAmount: 0.25,
        wiggleSpeed: 20,
        timeoutId: null
      };

      if (npcEntity._miningAnimation.isActive) {
        const time = Date.now();
        const elapsed = (time - npcEntity._miningAnimation.startTime) / 1000;

        const wiggle = Math.sin(elapsed * npcEntity._miningAnimation.wiggleSpeed)
          * npcEntity._miningAnimation.wiggleAmount;

        const bounce = Math.cos(elapsed * npcEntity._miningAnimation.wiggleSpeed * 2)
          * npcEntity._miningAnimation.wiggleAmount * 0.5;

        // Set the sprite properties
        npcEntity.xSize = 5 + wiggle * 2;
        npcEntity.ySize = 5 - Math.abs(wiggle) + bounce;
      } else {
        // Reset size when not animating
        npcEntity.xSize = 5;
        npcEntity.ySize = 5;
      }
    }, {
      names: ['Iron Ore'],
      partialNameMatch: true
    });

    // Pre-interact hook to start mining animation
    NPCInterceptor.addPreInteractHook("iron_ore_preclick", function (npcEntity) {
      console.log('[Interceptor] Starting mining animation for:', npcEntity);

      // Initialize animation state if needed
      npcEntity._miningAnimation = npcEntity._miningAnimation || {
        isActive: false,
        startTime: 0,
        wiggleAmount: 0.15,
        wiggleSpeed: 15,
        timeoutId: null
      };

      // If already animating, clear the existing timeout
      if (npcEntity._miningAnimation.timeoutId) {
        clearTimeout(npcEntity._miningAnimation.timeoutId);
      }

      // Start mining animation
      npcEntity._miningAnimation.isActive = true;
      npcEntity._miningAnimation.startTime = Date.now();

      // Check sound cooldown
      const currentTime = Date.now();
      if (currentTime - lastTime >= COOLDOWN) {
        Sound.play('osrs_pickaxe-thud.wav', 1.0);
        lastTime = currentTime;
      } else {
        return false;
      }

      // Store the timeout ID so we can clear it if needed
      npcEntity._miningAnimation.timeoutId = setTimeout(() => {
        if (npcEntity._miningAnimation) {
          npcEntity._miningAnimation.isActive = false;
          npcEntity._miningAnimation.timeoutId = null;
        }
      }, 150);  // Reduced animation time for quicker response

      return true;
    }, {
      names: ['Iron Ore'],
      partialNameMatch: true
    });
  }

  /**
   * Plugin initialization
   */
  return function Init() {
    console.log('[Interceptor] Plugin loading...');
    initHooks();

    Session.onMapChange = function () {
      console.log('[Interceptor] Map changed, reinitializing hooks...');
      initHooks();
    };
  };
});
