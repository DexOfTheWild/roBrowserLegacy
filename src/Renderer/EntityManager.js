/**
 * Renderer/EntityManager.js
 *
 * Manage Entity
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function( require )
{
	'use strict';


	// Load dependencies
	var Session        = require('Engine/SessionStorage');
	var Entity         = require('./Entity/Entity');
	var Network = require('Network/NetworkManager');
	var PACKETVER = require('Network/PacketVerManager');
	var PACKET = require('Network/PacketStructure');
	var SpriteRenderer = require('./SpriteRenderer');
	var Mouse          = require('Controls/MouseEventHandler');
	var KEYS           = require('Controls/KeyEventHandler');
	var PathFinding	   = require('Utils/PathFinding');
	var Altitude       = require('Renderer/Map/Altitude');
	var Renderer = require('Renderer/Renderer');
	var NPCInterceptor = require('Engine/NPCInterceptor');

	var _list = [];

	/**
	 * Find an Entity and return its index
	 *
	 * @param {number} gid
	 * @returns {number} position
	 */
	function getEntityIndex( gid )
	{
		if (gid < 0) {
			return -1;
		}

		var i, count = _list.length;

		for (i = 0; i < count; ++i) {
			if (_list[i].GID === gid) {
				return i;
			}
		}

		return -1;
	}


	/**
	 * Fetch all entities using a callback
	 *
	 * @param {function} callback
	 */
	function forEach( callback )
	{
		var i, count = _list.length;

		for (i = 0; i < count; ++i) {
			if (callback(_list[i]) === false) {
				return;
			}
		}
	}


	/**
	 * Find an Entity and return it
	 *
	 * @param {number} gid
	 * @returns {object} Entity
	 */
	function getEntity( gid )
	{
		// Reason for this check:
		// - Most packets your received is for the main character, so
		//   this check speed up the process.
		// - When you load a map, the main character is not in the list yet
		//   so we skip a lot of vital informations
		if (Session.Entity.GID === gid) {
			return Session.Entity;
		}

		var index = getEntityIndex(gid);
		if (index < 0) {
			return null;
		}

		return _list[index];
	}


	/**
	 * Add or replace entity
	 *
	 * @param {object} entity
	 * @return {object}
	 */
	function addEntity( entity )
	{
		var index = getEntityIndex( entity.GID );
		if (index < 0) {
			index = _list.push( entity ) - 1;
		}
		else {
			_list[index].set(entity);
		}

		return _list[index];
	}


	/**
	 * Clean up entities from list
	 */
	function free()
	{
		var i, count = _list.length;

		for (i = 0; i < count; ++i) {
			_list[i].clean();
		}

		_list.length = 0;
	}


	/**
	 * Remove an entity
	 * @param {number} gid
	 */
	function removeEntity( gid )
	{
		var index = getEntityIndex( gid );

		if (index > -1) {
			_list[index].clean();
			_list.splice( index, 1 );
		}
	}


	/**
	 * @var {Entity} mouse over
	 */
	var _over = null;


	/**
	 * Return the entity the mouse is over
	 */
	function getOverEntity()
	{
		return _over;
	}


	/**
	 * Set over entity
	 */
	var _saveShift = false;
	function setOverEntity( target )
	{
		var current = _over;

		if (target === current && _saveShift === KEYS.SHIFT) {
			return;
		}

		_saveShift = KEYS.SHIFT;

		if (current) {
			current.onMouseOut();
		}

		if (target) {
			_over = target;
			target.onMouseOver();
		}
		else {
			_over = null;
		}
	}


	/**
	 * @var {Entity} target
	 */
	var _focus = null;


	/**
	 * Return the entity selected by the user
	 */
	function getFocusEntity()
	{
		return _focus;
	}


	/**
	 * Set over entity
	 * @param {Entity} entity
	 */
	function setFocusEntity( entity )
	{
		_focus = entity;
	}


	/**
	 * Sort entities by z-Index
	 *
	 * @param {Entity} a
	 * @param {Entity} b
	 */
	function sort(  a, b )
	{
		var aDepth = a.depth + (a.GID%100) / 1000;
		var bDepth = b.depth + (b.GID%100) / 1000;

		return bDepth - aDepth;
	}

	var _supportPriority = false;

	/**
	 * Set reverse priority for entity sorting (for supportive skills)
	 * @param {boolean} true/false
	 */
	function setSupportPicking(v){
		_supportPriority = v;
	}

	/**
	 * Sort entities by z-index and priorities
	 *
	 * @param {Entity} a
	 * @param {Entity} b
	 */
	function sortByPriority( a, b )
	{
		var aDepth = a.depth + ((!isNaN(a.GID)) ? a.GID%100 : 0) / 1000;
		var bDepth = b.depth + ((!isNaN(b.GID)) ? b.GID%100 : 0) / 1000;

		if (_supportPriority) {
			aDepth -= Entity.PickingPriority.Support[a.objecttype] * 100;
			bDepth -= Entity.PickingPriority.Support[b.objecttype] * 100;
		} else {
			aDepth -= Entity.PickingPriority.Normal[a.objecttype] * 100;
			bDepth -= Entity.PickingPriority.Normal[b.objecttype] * 100;
		}

		return aDepth - bDepth;
	}


	/**
	 * Render all entities (picking or not)
	 *
	 * @param {object} gl webgl context
	 * @param {mat4} modelView
	 * @param {mat4} projection
	 * @param {object} fog structure
	 * @param {object} render effect entities? true/false
	 *
	 * Infos: RO Game doesn't seems to render ambiant and diffuse on Sprites
	 */
	function render( gl, modelView, projection, fog, renderEffects )
	{
		var i, count;
		var tick = Date.now();

		// Stop rendering if no units to render (should never happened...)
		if (!_list.length) {
			return;
		}

		_list.sort(sort);

		// Use program
		SpriteRenderer.bind3DContext( gl, modelView, projection, fog );

		// Rendering
		for (i = 0, count = _list.length; i < count; ++i) {
			if((_list[i].objecttype != _list[i].constructor.TYPE_EFFECT && !renderEffects) || (_list[i].objecttype == _list[i].constructor.TYPE_EFFECT && renderEffects)){
				// Remove from list
				if (_list[i].remove_tick && _list[i].remove_tick + _list[i].remove_delay < tick) {

					// Remove focus
					var entityFocus = getFocusEntity();
					if( entityFocus && entityFocus.GID === _list[i].GID ){
						entityFocus.onFocusEnd();
						setFocusEntity(null);
					}

					_list[i].clean();
					_list.splice(i, 1);
					i--;
					count--;
					continue;
				}

				// Add pre-render hook for NPCs
				if (_list[i].objecttype === Entity.TYPE_NPC) {
					NPCInterceptor.onPreRender(_list[i], modelView, projection);
				}

				_list[i].render( modelView, projection);

				// Add post-render hook for NPCs
				if (_list[i].objecttype === Entity.TYPE_NPC) {
					NPCInterceptor.onPostRender(_list[i], modelView, projection);
				}
			}
		}

		// Clean program
		SpriteRenderer.unbind( gl );
	}

	/**
	 * Intersect Entities
	 */
	function intersect()
	{
		var i, count;
		var entity;

		// Stop rendering if no units to render (should never happened...)
		if (!_list.length) {
			return;
		}

		_list.sort(sortByPriority);

		var x = Mouse.screen.x;
		var y = Mouse.screen.y;

		for (i = 0, count = _list.length; i < count; ++i) {
			entity = _list[i];

			// No picking on dead entites
			if ((entity.action !== entity.ACTION.DIE || entity.objecttype === Entity.TYPE_PC) && entity.remove_tick === 0) {
				if (x > entity.boundingRect.x1 &&
				    x < entity.boundingRect.x2 &&
				    y > entity.boundingRect.y1 &&
				    y < entity.boundingRect.y2) {
					return entity;
				}
			}
		}

		return null;
	}

	/**
	 * Returns the closest entity to the source entity
	 *
	 * @param {entity} source entity
	 * @param {type} entity type to look for
	 */
	function getClosestEntity(sourceEntity, type){
		var closestEntity = false;
		var distance = Infinity;

		_list.forEach((entity) => {
			if( entity.GID !== sourceEntity.GID && entity.objecttype === type && entity.action !== entity.ACTION.DIE && entity.remove_tick === 0 ){
				var dst = Infinity;
				if( closestEntity ){
					dst = getPathDistance(sourceEntity, entity);
					if( dst && dst < distance ){
						closestEntity = entity;
						distance = dst;
					}
				} else {
					dst = getPathDistance(sourceEntity, entity);
					if( dst ){
						closestEntity = entity;
						distance = dst;
					}
				}
			}
		});

		return closestEntity;
	}

	/**
	 * Returns the distance between two entities based on direct walkpath
	 *
	 * @param {entity} from entity
	 * @param {entity} to entity
	 */
	function getPathDistance(fromEntity, toEntity){
		var out   = [];
		var count = PathFinding.search(
			fromEntity.position[0] | 0, fromEntity.position[1] | 0,
			toEntity.position[0] | 0, toEntity.position[1] | 0,
			1,
			out,
			Altitude.TYPE.WALKABLE
		);
		return count;
	}

	/**
	 * Check for items near the player and initiate magnetic pickup
	 * @param {Entity} playerEntity - The player's entity
	 * @param {number} radius - Pickup radius in game units
	 */
	function checkNearbyItems(playerEntity, radius) {
		if (!playerEntity || playerEntity.action === playerEntity.ACTION.DIE) {
			return;
		}

		_list.forEach((entity) => {
			// Only process items that aren't already being picked up
			if (entity.objecttype === Entity.TYPE_ITEM && !entity.magneticPickup) {
				var distance = getPathDistance(playerEntity, entity);

				// If within radius, start magnetic pickup
				if (distance && distance <= radius) {
					entity.magneticPickup = true;
					entity.pickupStartPosition = entity.position.slice();
					entity.pickupStartTime = Renderer.tick;
					entity.pickupPhase = 'hover'; // Start with hover phase

					// Store original height for hover animation
					entity.originalHeight = entity.position[2];
					// Make item float up slightly (reduced height)
					entity.position[2] += 0.05;
				}
			}
		});
	}

	/**
	 * Update magnetic pickup movement
	 * @param {Entity} playerEntity - The player's entity
	 */
	function updateMagneticPickups(playerEntity) {
		if (!playerEntity) return;

		_list.forEach((entity) => {
			if (entity.magneticPickup) {
				const hoverDuration = 1000; // 1 second hover
				const moveDuration = 500; // 0.5 second movement
				const serverTimeout = 10000; // 3 second timeout for server response
				const timeSinceStart = Renderer.tick - entity.pickupStartTime;

				// Check for server timeout after item starts moving
				if (entity.pickupPhase === 'move' &&
					(Renderer.tick - entity.moveStartTime) > serverTimeout &&
					!entity.serverRequestedRemoval) {

					// Reset item position and state
					entity.magneticPickup = false;
					entity.position = entity.pickupStartPosition.slice();
					entity.position[2] = entity.originalHeight; // Reset height
					return;
				}

				if (entity.pickupPhase === 'hover') {
					// Wobbly hover animation
					const hoverProgress = timeSinceStart / hoverDuration;
					const wobbleFrequency = 3;
					const wobbleAmplitude = 0.3;

					entity.position[2] = entity.originalHeight + 0.1 + 
						Math.sin(hoverProgress * Math.PI * wobbleFrequency) * wobbleAmplitude;

					// Switch to move phase after hover duration
					if (timeSinceStart >= hoverDuration) {
						entity.pickupPhase = 'move';
						entity.moveStartTime = Renderer.tick;
						entity.moveStartPosition = entity.position.slice();

						// Send pickup packet as soon as item starts moving to player
						var pkt;
						if (PACKETVER.value >= 20180307) {
							pkt = new PACKET.CZ.ITEM_PICKUP2();
						} else {
							pkt = new PACKET.CZ.ITEM_PICKUP();
						}
						pkt.ITAID = entity.GID;
						Network.sendPacket(pkt);
					}
				}
				else if (entity.pickupPhase === 'move') {
					const moveProgress = Math.min(1.0, (Renderer.tick - entity.moveStartTime) / moveDuration);

					// Interpolate position towards player with slight arc
					const t = moveProgress;
					entity.position[0] = entity.moveStartPosition[0] + (playerEntity.position[0] - entity.moveStartPosition[0]) * t;
					entity.position[1] = entity.moveStartPosition[1] + (playerEntity.position[1] - entity.moveStartPosition[1]) * t;

					const arcHeight = 0.45;
					entity.position[2] = entity.moveStartPosition[2] + 
						arcHeight * Math.sin(Math.PI * t);

					// When animation completes, mark entity as ready for removal
					if (moveProgress >= 1.0) {
						entity.readyForRemoval = true;

						// If server already sent removal packet, remove now
						if (entity.serverRequestedRemoval) {
							if (entity.dropEffect) {
								entity.dropEffect.free();
							}
							EntityManager.remove(entity.GID);
						}
					}
				}
			}
		});
	}

	var EntityManager = {
		free:                 free,
		add:                  addEntity,
		remove:               removeEntity,
		get:                  getEntity,
		forEach:              forEach,

		getOverEntity:        getOverEntity,
		setOverEntity:        setOverEntity,
		getFocusEntity:       getFocusEntity,
		setFocusEntity:       setFocusEntity,

		getClosestEntity:     getClosestEntity,

		render:               render,
		intersect:            intersect,
		setSupportPicking:    setSupportPicking,
		getPathDistance: getPathDistance,
		checkNearbyItems: checkNearbyItems,
		updateMagneticPickups: updateMagneticPickups,
	};


	/**
	 * Get access to manager from Entity object
	 */
	Entity.Manager = EntityManager;


	/**
	 * Export
	 */
	return EntityManager;
});
