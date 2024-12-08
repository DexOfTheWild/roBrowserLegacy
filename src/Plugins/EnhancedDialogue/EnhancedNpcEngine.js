define(function(require) {
  'use strict';

  // Dependencies
  var jQuery      = require('Utils/jquery');
  var Network     = require('Network/NetworkManager');
  var PACKET      = require('Network/PacketStructure');
  var NpcBox      = require('UI/Components/NpcBox/NpcBox');
  var NpcMenu     = require('UI/Components/NpcMenu/NpcMenu');
  var Client      = require('Core/Client');
  var DB          = require('DB/DBManager');

  /**
   * Store original packet handlers
   */
  var originalHandlers = {
      onMessage: null,
      onMenuAppear: null,
      onCutin: null,
      onCloseScript: null
  };

  /**
   * Enhanced packet handlers
   */
  var enhancedHandlers = {
      /**
       * Enhanced message handler
       */
      onMessage: function(pkt) {
          NpcBox.append();
          NpcBox.ui.find('.content').show();
          NpcBox.setText(pkt.msg, pkt.NAID);
      },

      /**
       * Enhanced menu handler
       */
      onMenuAppear: function(pkt) {
          if (NpcBox?.typer.isTyping) {
              return NpcBox.typer.onCompletion().then(() => {
                  enhancedHandlers.onMenuAppear(pkt);
              });
          }
          
          NpcMenu.append();
          NpcMenu.setMenu(pkt.msg, pkt.NAID);

          NpcMenu.onSelectMenu = function onSelectMenu(NAID, index) {
              NpcMenu.remove();

              if (index === 255) {
                  NpcBox.remove();
              }
              if (document.getElementById("NpcBox")) {
                  NpcBox.resetMessage();
              }
              
              var menuPkt = new PACKET.CZ.CHOOSE_MENU();
              menuPkt.NAID = NAID;
              menuPkt.num = index;
              Network.sendPacket(menuPkt);
          };
      },

      /**
       * Enhanced cutin handler
       */
      onCutin: function(pkt) {
          const _target = NpcBox.ui.find('.border .portrait');
          
          var cutin = document.getElementById('cutin');
          if (cutin) {
              _target.children().remove();
          }

          if (!pkt.imageName.length) {
              return;
          }

          if (pkt.imageName.indexOf('.') === -1) {
              pkt.imageName += '.bmp';
          }

          Client.loadFile(DB.INTERFACE_PATH + 'illust/' + pkt.imageName, function(url) {
              var img = new Image();
              img.src = url;
              img.id = 'cutin';
              img.draggable = false;
              _target.append(img);
          });
      },

      /**
       * Enhanced close script handler
       */
      onCloseScript: function(pkt) {
          if (NpcBox.ownerID === pkt.NAID) {
              NpcBox.remove();
              NpcMenu.remove();
          }
      }
  };

  /**
   * Store original packet handlers and apply enhanced ones
   */
  function enhanceHandlers() {
      // Apply enhanced handlers
      Network.hookPacket(PACKET.ZC.SAY_DIALOG, enhancedHandlers.onMessage);
      Network.hookPacket(PACKET.ZC.MENU_LIST, enhancedHandlers.onMenuAppear);
      Network.hookPacket(PACKET.ZC.SHOW_IMAGE, enhancedHandlers.onCutin);
      Network.hookPacket(PACKET.ZC.SHOW_IMAGE2, enhancedHandlers.onCutin);
      Network.hookPacket(PACKET.ZC.CLOSE_SCRIPT, enhancedHandlers.onCloseScript);
  }

  // Initialize enhanced handlers
  enhanceHandlers();
});
