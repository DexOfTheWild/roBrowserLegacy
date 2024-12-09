define(function (require) {
    'use strict';

    // Dependencies
    var Network = require('Network/NetworkManager');
    var PACKET = require('Network/PacketStructure');
    var NpcBox = require('UI/Components/NpcBox/NpcBox');
    var NpcMenu = require('UI/Components/NpcMenu/NpcMenu');
    var Client = require('Core/Client');
    var DB = require('DB/DBManager');
    var NPCHandlers = require('Engine/MapEngine/NPCHandlers');

    function enhanceNpcHandlers() {

    /**
     * Enhanced NPC message handler
     */
        function onMessage(pkt) {
            NpcBox.append();
            NpcBox.ui.find('.content').show();
            NpcBox.setText(pkt.msg, pkt.NAID);
        }

        /**
         * Enhanced menu appear handler
         */
        function onMenuAppear(pkt) {
            if (NpcBox?.typer.isTyping) {
                return NpcBox.typer.onCompletion().then(() => {
                    onMenuAppear(pkt);
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
        }

        /**
         * Enhanced cutin handler
         */
        function onCutin(pkt) {
            // const _target = document.body;

            const _target = NpcBox.ui.find('.border .portrait');
            // Only one instance of cutin
            var cutin = document.getElementById('cutin');
            if (cutin) {
                _target.children().remove();
            }

            // Sending empty string just hide the cutin
            if (!pkt.imageName.length) {
                return;
            }

            if (pkt.imageName.indexOf('.') === -1) {
                pkt.imageName += '.bmp';
            }

            Client.loadFile(DB.INTERFACE_PATH + 'illust/' + pkt.imageName, function (url) {
                var img = new Image();
                img.src = url;
                img.id = 'cutin';
                img.draggable = false;

                _target.append(img);
            });
        }

        /**
         * Enhanced close script handler
         */
        function onCloseScript(pkt) {
            if (NpcBox.ownerID === pkt.NAID) {
                NpcBox.remove();
                NpcMenu.remove();
            }
        }

        const handlers = {
            SAY_DIALOG: onMessage,
            MENU_LIST: onMenuAppear,
            SHOW_IMAGE: onCutin,
            SHOW_IMAGE2: onCutin,
            CLOSE_SCRIPT: onCloseScript
        }

        Object.keys(handlers).forEach(key => {
            NPCHandlers.setHandler(key, handlers[key]);
        });
    }

    enhanceNpcHandlers();

    return NPCHandlers;
});
