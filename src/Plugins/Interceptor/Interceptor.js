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
  var Network = require('Network/NetworkManager');
  var PACKET = require('Network/PacketStructure');

  const MAX_DISTANCE = 4;   // Maximum distance in grid spaces
  const COOLDOWN = 250;     // ms between valid clicks/sounds

  // Track remaining items per node
  const nodeRemainingItems = new Map();

  function onGatherResult(pkt) {
    console.log('[Interceptor] Received gather result:', pkt.gathersLeft, 'for node:', pkt.nodeId);
    nodeRemainingItems.set(pkt.nodeId, pkt.gathersLeft);
  }

  /**
   * Calculate distance between two points
   * @param {Array} pos1 - [x, y] position
   * @param {Array} pos2 - [x, y] position
   * @returns {number} Distance in grid spaces
   */
  function calculateDistance(pos1, pos2) {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function initHooks() {
    let lastTime = 0;

    // Hook the gather result packet
    Network.hookPacket(PACKET.ZC.GATHER_RESULT, onGatherResult);

    // Add pre-render hook for animation
    NPCInterceptor.addPreRenderHook("iron_ore_animation", function (npcEntity) {
      if (npcEntity._miningAnimation && npcEntity._miningAnimation.isActive) {
        const time = Date.now();
        const elapsed = (time - npcEntity._miningAnimation.startTime) / 1000;

        const wiggle = Math.sin(elapsed * npcEntity._miningAnimation.wiggleSpeed)
          * npcEntity._miningAnimation.wiggleAmount;

        npcEntity.xSize = 5 + wiggle * 2;
        npcEntity.ySize = 5 - Math.abs(wiggle);
      }
    }, {
      names: ['Iron Ore'],
      partialNameMatch: true
    });

    NPCInterceptor.addPreInteractHook("iron_ore_preclick", function (npcEntity) {
      console.log('[Interceptor] Processing mining click:', npcEntity);

      const distance = calculateDistance(
        Session.Entity.position,
        npcEntity.position
      );

      if (distance > MAX_DISTANCE) {
        console.log('[Interceptor] Too far from node:', distance);
        return false; // Prevent interaction
      }

      // Initialize animation state
      npcEntity._miningAnimation = npcEntity._miningAnimation || {
        isActive: false,
        startTime: 0,
        wiggleAmount: 0.15,
        wiggleSpeed: 15,
        timeoutId: null
      };

      // Clear existing animation timeout
      if (npcEntity._miningAnimation.timeoutId) {
        clearTimeout(npcEntity._miningAnimation.timeoutId);
      }

      // Always start animation on click
      npcEntity._miningAnimation.isActive = true;
      npcEntity._miningAnimation.startTime = Date.now();

      // Store the timeout ID for animation
      npcEntity._miningAnimation.timeoutId = setTimeout(() => {
        if (npcEntity._miningAnimation) {
          npcEntity._miningAnimation.isActive = false;
          npcEntity._miningAnimation.timeoutId = null;
        }
      }, 250);

      // Check cooldown
      const currentTime = Date.now();
      if (currentTime - lastTime < COOLDOWN) {
        console.log('[Interceptor] Too soon, preventing interaction');
        return false; // Too soon, prevent interaction
      }

      // Valid click, update time and process
      lastTime = currentTime;

      // Check remaining items for this specific node
      const remainingItems = nodeRemainingItems.get(npcEntity.GID);
      console.log('[Interceptor] Node', npcEntity.GID, 'remaining items:', remainingItems);

      if (remainingItems > 1 || remainingItems === undefined) {
        Sound.play('dex_pickaxe-thud.wav', 2.0);
      } else {
        nodeRemainingItems.delete(npcEntity.GID); // Clean up depleted node
        Sound.play('dex_mining-depleted.wav', 2.0);
      }
      return true; // Tell server to process the gather
    }, {
      names: ['Iron Ore'],
      partialNameMatch: true
    });
  }

  return function Init() {
    console.log('[Interceptor] Plugin loading...');
    initHooks();

    Session.onMapChange = function () {
      console.log('[Interceptor] Map changed, reinitializing hooks...');
      nodeRemainingItems.clear();  // Reset all nodes on map change
      initHooks();
    };
  };
});
