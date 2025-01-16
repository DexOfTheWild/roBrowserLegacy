define(function (require) {
  'use strict';

  /**
   * Hook configuration type
   * @typedef {Object} HookConfig
   * @property {string} id - Unique identifier for this hook
   * @property {Function} callback - The hook callback function
   * @property {Object} filter - Filter configuration
   * @property {Array<string>} [filter.names] - Array of NPC names to include
   * @property {Array<number>} [filter.ids] - Array of NPC IDs to include
   * @property {Array<number>} [filter.types] - Array of NPC types to include
   * @property {boolean} [filter.partialNameMatch] - Whether to use partial name matching
   */

  /**
   * Private storage for interceptors with their filters
   */
  var _preCreateHooks = [];
  var _postCreateHooks = [];
  var _preRenderHooks = [];
  var _postRenderHooks = [];
  var _preInteractHooks = [];
  var _postInteractHooks = [];
  var _preClickHooks = [];
  var _postClickHooks = [];
  var _preContextMenuHooks = [];
  var _postContextMenuHooks = [];

  var NPCInterceptor = {};

  /**
   * Check if an NPC matches the filter
   * @private
   * @param {Entity|Object} npc - NPC entity or data
   * @param {Object} filter - Filter configuration
   * @returns {boolean} - True if NPC matches filter
   */
  function _matchesFilter(npc, filter) {
    // If no filter specified, match all NPCs
    if (!filter || (!filter.names && !filter.ids && !filter.types)) {
      return true;
    }

    // Check name filter
    if (filter.names) {
      const npcName = npc.display?.name || npc.name;
      if (filter.partialNameMatch) {
        if (filter.names.some(filterName =>
          npcName.toLowerCase().includes(filterName.toLowerCase())
        )) {
          return true;
        }
      } else {
        if (filter.names.includes(npcName)) {
          return true;
        }
      }
    }

    // Check ID filter
    if (filter.ids) {
      const npcId = npc.id || npc.NPCID;
      if (filter.ids.includes(npcId)) {
        return true;
      }
    }

    // Check type filter
    if (filter.types) {
      const npcType = npc.objecttype || npc.type;
      if (filter.types.includes(npcType)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a hook ID already exists in an array
   * @private
   * @param {Array} hookArray - Array to check
   * @param {string} id - Hook ID to check
   * @returns {boolean} - True if ID exists
   */
  function _hookExists(hookArray, id) {
    return hookArray.some(hook => hook.id === id);
  }

  /**
   * Register a hook with required ID and optional filter
   * @private
   * @param {Array} hookArray - Array to store the hook
   * @param {string} id - Unique identifier for this hook
   * @param {Function} callback - Hook callback
   * @param {Object} [filter] - Filter configuration
   * @returns {boolean} - True if hook was added, false if ID already exists
   */
  function _addHook(hookArray, id, callback, filter) {
    if (_hookExists(hookArray, id)) {
      console.warn(`Hook with ID "${id}" already exists and will not be added again.`);
      return false;
    }
    hookArray.push({ id, callback, filter });
    return true;
  }

  /**
   * Remove a hook by ID
   * @private
   * @param {Array} hookArray - Array containing the hooks
   * @param {string} id - ID of hook to remove
   * @returns {boolean} - True if hook was removed
   */
  function _removeHook(hookArray, id) {
    const initialLength = hookArray.length;
    const index = hookArray.findIndex(hook => hook.id === id);
    if (index !== -1) {
      hookArray.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Execute hooks with filtering
   * @private
   * @param {Array} hookArray - Array of hooks to execute
   * @param {Entity|Object} npc - NPC entity or data
   * @param {...*} args - Additional arguments to pass to hooks
   * @returns {boolean|void} - Returns false if any hook returns false
   */
  function _executeHooks(hookArray, npc, ...args) {
    let shouldContinue = true;
    hookArray.forEach(({ callback, filter }) => {
      if (_matchesFilter(npc, filter)) {
        const result = callback(npc, ...args);
        if (result === false) {
          shouldContinue = false;
        }
      }
    });
    return shouldContinue;
  }

  // Update all add*Hook methods to require IDs
  NPCInterceptor.addPreCreateHook = function (id, callback, filter) {
    return _addHook(_preCreateHooks, id, callback, filter);
  };

  NPCInterceptor.addPostCreateHook = function (id, callback, filter) {
    return _addHook(_postCreateHooks, id, callback, filter);
  };

  NPCInterceptor.addPreRenderHook = function (id, callback, filter) {
    return _addHook(_preRenderHooks, id, callback, filter);
  };

  NPCInterceptor.addPostRenderHook = function (id, callback, filter) {
    return _addHook(_postRenderHooks, id, callback, filter);
  };

  NPCInterceptor.addPreInteractHook = function (id, callback, filter) {
    return _addHook(_preInteractHooks, id, callback, filter);
  };

  NPCInterceptor.addPostInteractHook = function (id, callback, filter) {
    return _addHook(_postInteractHooks, id, callback, filter);
  };

  NPCInterceptor.addPreInteract = function (id, callback, filter) {
    return _addHook(_preClickHooks, id, callback, filter);
  };

  NPCInterceptor.addPostInteract = function (id, callback, filter) {
    return _addHook(_postClickHooks, id, callback, filter);
  };

  NPCInterceptor.addPreContextMenuHook = function (id, callback, filter) {
    return _addHook(_preContextMenuHooks, id, callback, filter);
  };

  NPCInterceptor.addPostContextMenuHook = function (id, callback, filter) {
    return _addHook(_postContextMenuHooks, id, callback, filter);
  };

  // Update all event handlers to use _executeHooks
  NPCInterceptor.onPreCreate = function (npcData) {
    _executeHooks(_preCreateHooks, npcData);
  };

  NPCInterceptor.onPostCreate = function (npcEntity) {
    _executeHooks(_postCreateHooks, npcEntity);
  };

  NPCInterceptor.onPreRender = function (npcEntity, modelView, projection) {
    _executeHooks(_preRenderHooks, npcEntity, modelView, projection);
  };

  NPCInterceptor.onPostRender = function (npcEntity, modelView, projection) {
    _executeHooks(_postRenderHooks, npcEntity, modelView, projection);
  };

  NPCInterceptor.onPreInteract = function (npcEntity) {
    return _executeHooks(_preInteractHooks, npcEntity);
  };

  NPCInterceptor.onPostInteract = function (npcEntity) {
    _executeHooks(_postInteractHooks, npcEntity);
  };

  NPCInterceptor.onPreContextMenu = function (npcEntity) {
    return _executeHooks(_preContextMenuHooks, npcEntity);
  };

  NPCInterceptor.onPostContextMenu = function (npcEntity) {
    return _executeHooks(_postContextMenuHooks, npcEntity);
  };

  // Add methods to remove specific hooks
  NPCInterceptor.removeHook = function (id) {
    return _removeHook(_preCreateHooks, id) ||
      _removeHook(_postCreateHooks, id) ||
      _removeHook(_preRenderHooks, id) ||
      _removeHook(_postRenderHooks, id) ||
      _removeHook(_preInteractHooks, id) ||
      _removeHook(_postInteractHooks, id) ||
      _removeHook(_preClickHooks, id) ||
      _removeHook(_postClickHooks, id) ||
      _removeHook(_preContextMenuHooks, id) ||
      _removeHook(_postContextMenuHooks, id);
  };

  /**
   * Clear all hooks
   */
  NPCInterceptor.clear = function () {
    _preCreateHooks = [];
    _postCreateHooks = [];
    _preRenderHooks = [];
    _postRenderHooks = [];
    _preInteractHooks = [];
    _postInteractHooks = [];
    _preClickHooks = [];
    _postClickHooks = [];
    _preContextMenuHooks = [];
    _postContextMenuHooks = [];
  };

  return NPCInterceptor;
});
