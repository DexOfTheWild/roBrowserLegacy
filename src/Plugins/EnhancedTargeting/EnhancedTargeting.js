define(function (require) {
  'use strict';

  // Required modules
  var Session = require('Engine/SessionStorage');
  var EntityManager = require('Renderer/EntityManager');
  var PathFinding = require('Utils/PathFinding');
  var PACKETVER = require('Network/PacketVerManager');
  var PACKET = require('Network/PacketStructure');
  var Network = require('Network/NetworkManager');
  var Events = require('Core/Events');

  // Timer ref & delay
  var autoTargetTimer = null;
  var C_AUTOTARGET_DELAY = 500;  // e.g. 500ms

  /**
   * TargetingPlugin
   *
   * Provides auto-targeting, attack routines, etc.
   */
  var TargetingPlugin = {

    /**
     * Toggles the auto-targeting system on/off
     */
    toggleAutoTargeting: function () {
      if (Session.AutoTargeting) {
        Session.AutoTargeting = false;
        this.stopAutoTarget();
      } else {
        Session.AutoTargeting = true;
        this.autoTarget(); // Kick off initial targeting
      }
    },

    /**
     * Picks the closest enemy and focuses it.
     * If auto-target is on, schedules the next call in a loop.
     */
    autoTarget: function () {
      var Player = Session.Entity;
      var entityFocus = EntityManager.getFocusEntity();
      var closestEntity = EntityManager.getClosestEntity(Player, EntityManager.TYPE_MOB);

      if (closestEntity) {
        // If we already have a focus but it's a different monster, update the focus
        if (entityFocus && closestEntity.GID !== entityFocus.GID) {
          entityFocus.onFocusEnd && entityFocus.onFocusEnd();
          EntityManager.setFocusEntity(null);

          closestEntity.onFocus && closestEntity.onFocus();
          EntityManager.setFocusEntity(closestEntity);
        }
        else if (!entityFocus) {
          // If we have no focus, set the new monster
          closestEntity.onFocus && closestEntity.onFocus();
          EntityManager.setFocusEntity(closestEntity);
        }
      }

      // Continue auto-targeting if it's still enabled
      if (Session.AutoTargeting && Session.Playing) {
        this.startAutoTarget();
      }
    },

    /**
     * Delays the next autoTarget() call by C_AUTOTARGET_DELAY ms
     */
    startAutoTarget: function () {
      var self = this;
      autoTargetTimer = window.setTimeout(function () {
        self.autoTarget();
      }, C_AUTOTARGET_DELAY);
    },

    /**
     * Stops the auto-targeting cycle
     */
    stopAutoTarget: function () {
      if (autoTargetTimer) {
        window.clearTimeout(autoTargetTimer);
        autoTargetTimer = null;
      }
    },

    /**
     * Attempts to attack the current focus.
     * If none is focused or it’s dead, tries autoTarget() first.
     */
    attackTargeted: function () {
      var main = Session.Entity;
      var entityFocus = EntityManager.getFocusEntity();

      // If no valid target, try picking one
      if (!entityFocus || entityFocus.action === entityFocus.ACTION.DIE) {
        this.autoTarget();
        entityFocus = EntityManager.getFocusEntity();
      }

      if (entityFocus) {
        var out = [];
        var count = PathFinding.search(
          main.position[0] | 0, main.position[1] | 0,
          entityFocus.position[0] | 0, entityFocus.position[1] | 0,
          main.attack_range + 1,
          out
        );

        // If we can’t path to the entity, do nothing
        if (!count) return;

        // Attack packet depends on PACKETVER
        var pkt;
        if (PACKETVER.value >= 20180307) {
          pkt = new PACKET.CZ.REQUEST_ACT2();
        } else {
          pkt = new PACKET.CZ.REQUEST_ACT();
        }
        pkt.action = 7;
        pkt.targetGID = entityFocus.GID;

        // If in range => send attack packet
        if (count < 2) {
          Network.sendPacket(pkt);
          return;
        }

        // Otherwise, move into range, then attack
        Session.moveAction = pkt; // Store the pending action
        if (PACKETVER.value >= 20180307) {
          pkt = new PACKET.CZ.REQUEST_MOVE2();
        } else {
          pkt = new PACKET.CZ.REQUEST_MOVE();
        }
        pkt.dest[0] = out[(count - 1) * 2 + 0];
        pkt.dest[1] = out[(count - 1) * 2 + 1];
        Network.sendPacket(pkt);
      }
    }
  };

  return TargetingPlugin;
});
