define(function (require) {
	'use strict';

	// Dependencies
	var Network = require('Network/NetworkManager');
	var PACKET = require('Network/PacketStructure');
	var NPCHandlers = require('./NPCHandlers');

	class NPCPackets {
		constructor() {
			this.handlers = null;
			this.activeHooks = new Map();
		}

		initialize() {
			this.handlers = NPCHandlers;
			const packets = [
				'SAY_DIALOG',
				'WAIT_DIALOG',
				'CLOSE_DIALOG',
				'OPEN_EDITDLG',
				'OPEN_EDITDLGSTR',
				'MENU_LIST',
				'SELECT_DEALTYPE',
				'SHOW_IMAGE',
				'SHOW_IMAGE2',
				'COMPASS',
				'PROGRESS',
				'PROGRESS_CANCEL',
				'SOUND',
				'PLAY_NPC_BGM',
				'CLOSE_SCRIPT'
			];

			// Hook all packets
			packets.forEach(packetName => {
				const handler = this.handlers.getHandler(packetName);
				if (handler) {
					Network.hookPacket(PACKET.ZC[packetName], handler);
					this.activeHooks.set(PACKET.ZC[packetName], packetName);
				}
			});
		}

		cleanup() {
			// Remove all hooks
			this.activeHooks.forEach((handlerType, packet) => {
				Network.clearHook(packet);
			});
			this.activeHooks.clear();
		}

		// Utility method to rehook a specific packet
		rehookPacket(packet) {
			const handlerType = this.activeHooks.get(packet);
			if (handlerType) {
				const handler = this.handlers.getHandler(handlerType);
				if (handler) {
					Network.hookPacket(packet, handler);
				}
			}
		}
	}

	let instance = null;
	return function getNPCPackets() {
		if (!instance) {
			instance = new NPCPackets();
		}
		return instance.initialize();
	};
});
