/**
 * KeyToMove Plugin
 *
 * Enables the player to control the character movement with the arrow keys.
 *
 * This file is a plugin for ROBrowser, (http://www.robrowser.com/).
 *
 * @author Antares
 * Based on Vincent Thibault's gist: https://gist.github.com/vthibault/9d5c08c111db2eabfc37
 */
define(function (require) {
  // Dependencies
  var jQuery = require('Utils/jquery');
  var glMatrix = require('Vendors/gl-matrix');
  var Session = require('Engine/SessionStorage');
  var Network = require('Network/NetworkManager');
  var PACKET = require('Network/PacketStructure');
  var Camera = require('Renderer/Camera');
  var KEYS = require('Controls/KeyEventHandler');
  var vec2 = glMatrix.vec2;
  var mat2 = glMatrix.mat2;

  // Object to initialize
  var direction = vec2.create();
  var rotate = mat2.create();

  //Configure keys here
  var MOVE = {
    RIGHT: [KEYS.RIGHT, KEYS.D],
    LEFT: [KEYS.LEFT, KEYS.A],
    UP: [KEYS.UP, KEYS.W],
    DOWN: [KEYS.DOWN, KEYS.S]
  };

  //Multiple keys held
  var KeyEvent = {};

  //Memory
  var targetPos = [0, 0];
  var keysDownTimeout = null;

  //---- Now the job ----
  function processKeyDownEvent(event) {
    if (MOVE.RIGHT.includes(event.which) ||
      MOVE.LEFT.includes(event.which) ||
      MOVE.UP.includes(event.which) ||
      MOVE.DOWN.includes(event.which)) {

      // Skip if typing
      if (document.activeElement.tagName === 'INPUT') {
        return true;
      }

      // Skip if dialog is active //TODO: Expand with more to skip when active
      if (jQuery('#NpcMenu, #NpcBox').length) {
        return true;
      }

      if (Session.Playing && Session.Entity) {
        event.stopImmediatePropagation();
        KeyEvent[event.which] = { pressed: true, continuous: event.originalEvent.repeat };
        processKeysDown();
        return false;
      }

      // Skip
      return true;
    }

    // Skip
    return true;
  }

  function processKeyUpEvent(event) {
    if (MOVE.RIGHT.includes(event.which) ||
      MOVE.LEFT.includes(event.which) ||
      MOVE.UP.includes(event.which) ||
      MOVE.DOWN.includes(event.which)) {
      delete KeyEvent[event.which];
    }
  }

  function processKeysDown() {
    clearTimeout(keysDownTimeout);

    if (Session.Entity && Object.keys(KeyEvent).length > 0) {
      direction[0] = 0;
      direction[1] = 0;

      // Get direction from keyboard
      MOVE.RIGHT.forEach(key => { if (KeyEvent[key] && KeyEvent[key].pressed) direction[0] += 1; });
      MOVE.LEFT.forEach(key => { if (KeyEvent[key] && KeyEvent[key].pressed) direction[0] -= 1; });
      MOVE.UP.forEach(key => { if (KeyEvent[key] && KeyEvent[key].pressed) direction[1] += 1; });
      MOVE.DOWN.forEach(key => { if (KeyEvent[key] && KeyEvent[key].pressed) direction[1] -= 1; });

      // Initialize matrix, based on Camera direction
      mat2.identity(rotate);
      mat2.rotate(rotate, rotate, -Camera.direction * 45 / 180 * Math.PI);

      // Apply matrix to vector
      vec2.transformMat2(direction, direction, rotate);

      var newPos = [
        Math.round(Session.Entity.position[0] + direction[0]),
        Math.round(Session.Entity.position[1] + direction[1])
      ];

      // Only send new movement packet if:
      // 1. We're not already moving to this position
      // 2. We're in motion (to maintain animation) OR starting from idle
      if ((targetPos[0] !== newPos[0] || targetPos[1] !== newPos[1]) &&
        (Session.Entity.action === Session.Entity.ACTION.WALK ||
          Session.Entity.action === Session.Entity.ACTION.IDLE)) {

        targetPos[0] = newPos[0];
        targetPos[1] = newPos[1];
        var pkt = new PACKET.CZ.REQUEST_MOVE();
        pkt.dest[0] = newPos[0];
        pkt.dest[1] = newPos[1];
        Network.sendPacket(pkt);
      }

      // Reduce the timeout to make movement more responsive
      keysDownTimeout = setTimeout(processKeysDown, 50);
    }
  }

  return function Init() {
    jQuery(window).on('keydown.map', function (event) {
      processKeyDownEvent(event);
    });

    jQuery(window).on('keyup.map', function (event) {
      processKeyUpEvent(event);
    });

    //Return true to signal successful initialization
    return true;
  }
});
