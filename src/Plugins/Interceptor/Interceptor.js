/**
 * NPC Interceptor Plugin
 *
 * This file is a plugin for ROBrowser, (http://www.robrowser.com/).
 */
define(function (require) {
  'use strict';

  var NPCInterceptor = require('Engine/NPCInterceptor');
  var Session = require('Engine/SessionStorage');

  /**
   * Initialize the hooks
   */
  function initHooks() {
    console.log('[Interceptor] Initializing hooks...');

    NPCInterceptor.addPreInteractHook("iron_ore_preclick", function (npcData) {
      console.log('[Interceptor] Intercepting NPC click:', npcData);
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

    // Initialize hooks immediately
    initHooks();

    // Re-initialize hooks when changing maps
    Session.onMapChange = function () {
      console.log('[Interceptor] Map changed, reinitializing hooks...');
      initHooks();
    };
  };
});
