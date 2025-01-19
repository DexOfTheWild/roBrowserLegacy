/**
 * Renderer/MapRenderer.js
 *
 * Rendering sprite in 2D or 3D context
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function( require )
{
	'use strict';


	/**
	 * Load dependencies
	 */
	var Thread         = require('Core/Thread');
	var SoundManager   = require('Audio/SoundManager');
	var BGM            = require('Audio/BGM');
	var DB             = require('DB/DBManager');
	var UIManager      = require('UI/UIManager');
	var Background     = require('UI/Background');
	var Cursor         = require('UI/CursorManager');
	var Session        = require('Engine/SessionStorage');
	var MemoryManager  = require('Core/MemoryManager');
	var Mouse          = require('Controls/MouseEventHandler');
	var Renderer       = require('Renderer/Renderer');
	var Camera         = require('Renderer/Camera');
	var EntityManager  = require('Renderer/EntityManager');
	var GridSelector   = require('Renderer/Map/GridSelector');
	var Ground         = require('Renderer/Map/Ground');
	var Altitude       = require('Renderer/Map/Altitude');
	var Water          = require('Renderer/Map/Water');
	var Models         = require('Renderer/Map/Models');
	var Sounds         = require('Renderer/Map/Sounds');
	var Effects        = require('Renderer/Map/Effects');
	var SpriteRenderer = require('Renderer/SpriteRenderer');
	var EffectManager  = require('Renderer/EffectManager');
	var Sky            = require('Renderer/Effects/Sky');
	var Damage         = require('Renderer/Effects/Damage');
	var MapPreferences = require('Preferences/Map');
	const PACKETVER   = require('Network/PacketVerManager');
	var TiltShiftEffect = require('Renderer/Effects/TiltShiftEffect');


	/**
	 * Renderer Namespace
	 */
	var MapRenderer = {};


	/**
	 * @var {string} current map's name
	 */
	MapRenderer.currentMap = '';


	/**
	 * @var {object} Global Light Structure
	 */
	MapRenderer.light = null;


	/**
	 * @var {Array} Point Lights Structure
	 */
	MapRenderer.pointLights = [];


	/**
	 * @var {number} Maximum number of point lights to process
	 * Can be adjusted based on performance requirements
	 */
	MapRenderer.MAX_POINT_LIGHTS = 10;


	/**
	 * @var {object} Water Structure
	 */
	MapRenderer.water = null;


	/**
	 * @var {array} Sounds object list
	 */
	MapRenderer.sounds = null;


	/**
	 * @var {array} Effects object list
	 */
	MapRenderer.effects = null;


	/**
	 * @var {array} is loading a map ?
	 */
	MapRenderer.loading = false;


	/**
	 * @var {Object} Fog structure
	 */
	MapRenderer.fog = {
		use:    MapPreferences.useFog,
		exist:  true,
		far:    30,
		near:   180,
		factor: 1.0,
		color:  new Float32Array([1,1,1])
	};


	/**
	 * Load a map
	 *
	 * @param {string} mapname to load
	 */
	MapRenderer.setMap = function loadMap( mapname )
	{
		// TODO: stop the map loading, and start to load the new map.
		if (this.loading) {
			return;
		}

		// DexRO - Remove intro class from MainCanvasOverlay
		window.document.getElementById('MainCanvasOverlay').classList.remove('start-screen');
		window.document.getElementById('MainCanvasOverlay').classList.add('game');

		// Support for instance map
		// Is it always 3 digits ?
		mapname = mapname
			.replace(/^(\d{3})(\d@)/, '$2') // 0061@tower   -> 1@tower
			.replace(/^\d{3}#/, '');        // 003#prontera -> prontera

		// Clean objects
		SoundManager.stop();
		Renderer.stop();
		UIManager.removeComponents();
		Cursor.setType(Cursor.ACTION.DEFAULT);

		// Don't reload a map when it's just a local teleportation
		if (this.currentMap !== mapname) {
			this.loading = true;
			BGM.stop();
			this.currentMap = mapname;

			// Parse the filename (ugly RO)
			var filename = mapname.replace(/\.gat$/i, '.rsw');

			Background.setLoading(function() {
				// Hooking Thread
				Thread.hook('MAP_PROGRESS', onProgressUpdate.bind(MapRenderer) );
				Thread.hook('MAP_WORLD',    onWorldComplete.bind(MapRenderer) );
				Thread.hook('MAP_GROUND',   onGroundComplete.bind(MapRenderer) );
				Thread.hook('MAP_ALTITUDE', onAltitudeComplete.bind(MapRenderer) );
				Thread.hook('MAP_MODELS',   onModelsComplete.bind(MapRenderer) );

				// Start Loading
				MapRenderer.free();
				Renderer.remove();
				Thread.send('LOAD_MAP', filename, onMapComplete.bind(MapRenderer) );
			});

			return;
		}

		var gl = Renderer.getContext();
		EntityManager.free();
		Damage.free( gl );
		EffectManager.free( gl );

		// Basic TP
		Background.remove(function(){
			MapRenderer.onLoad();
			Sky.setUpCloudData();

			Renderer.render( MapRenderer.onRender );
		});
	};


	/**
	 * Clean up data
	 */
	MapRenderer.free = function Free()
	{
		var gl = Renderer.getContext();

		EntityManager.free();
		GridSelector.free( gl );
		Sounds.free();
		Effects.free();
		Ground.free( gl );
		Water.free( gl );
		Models.free( gl );
		Damage.free( gl );
		EffectManager.free( gl );
		SoundManager.stop();
		BGM.stop();

		Mouse.intersect = false;

		this.initLightData();
		this.water   = null;
		this.sounds  = null;
		this.effects = null;
	};


	/**
	 * Received progress from Thread
	 *
	 * @param {number} percent (progress)
	 */
	function onProgressUpdate( percent )
	{
		Background.setPercent( percent );
	}


	/**
	 * Received parsed world
	 */
	function onWorldComplete(data) {
		// Initialize default light data
		this.initLightData();

		if (data.light) {
			// Calculate light direction
			var longitude = (data.light.longitude || 45) * Math.PI / 180;
			var latitude = (data.light.latitude || 45) * Math.PI / 180;

			this.light.direction[0] = -Math.cos(longitude) * Math.sin(latitude);
			this.light.direction[1] = -Math.cos(latitude);
			this.light.direction[2] = -Math.sin(longitude) * Math.sin(latitude);

			// Copy light properties if they exist
			if (data.light.ambient) {
				this.light.ambient.set(data.light.ambient);
			}
			if (data.light.diffuse) {
				this.light.diffuse.set(data.light.diffuse);
			}
			if (typeof data.light.opacity === 'number') {
				this.light.opacity = data.light.opacity;
			}
		}

		// Store point lights
		if (Array.isArray(data.pointLights)) {
			this.pointLights = data.pointLights.slice(0, this.MAX_POINT_LIGHTS);
		}

		// Debug output
		console.log('World Complete Light Data:', {
			direction: Array.from(this.light.direction),
			ambient: Array.from(this.light.ambient),
			diffuse: Array.from(this.light.diffuse),
			opacity: this.light.opacity,
			pointLightsCount: this.pointLights.length
		});

		this.water = data.water;
		this.sounds = data.sound;
		this.effects = data.effect;

		Thread.send('MAP_WORLD_COMPLETE');
	}


	/**
	 * Received ground data from Thread
	 */
	function onGroundComplete( data )
	{
		var gl = Renderer.getContext();

		this.water.mesh      = data.waterMesh;
		this.water.vertCount = data.waterVertCount;

		Ground.init( gl, data );
		Water.init( gl, this.water );

		// Initialize sounds
		var i, count, tmp;

		count = this.sounds.length;
		for (i = 0; i < count; ++i) {
			tmp                    = -this.sounds[i].pos[1];
			this.sounds[i].pos[0] += data.width;
			this.sounds[i].pos[1]  = this.sounds[i].pos[2] + data.height;
			this.sounds[i].pos[2]  = tmp;
			this.sounds[i].range  *= 0.2;
			this.sounds[i].tick    =   0;
			this.sounds[i].cycle    =   !this.sounds[i].cycle ? 7:this.sounds[i].cycle;
			Sounds.add(this.sounds[i]);
		}


		count = this.effects.length;
		for (i = 0; i < count; ++i) {
			// Note: effects objects do not need to be centered in a cell
			// as we apply +0.5 in the shader, we have to revert it.
			tmp                     = -this.effects[i].pos[1] + 1; //WTF????????
			this.effects[i].pos[0] += data.width - 0.5;
			this.effects[i].pos[1]  = this.effects[i].pos[2] + data.height - 0.5;
			this.effects[i].pos[2]  = tmp;

			this.effects[i].tick    = 0;

			Effects.add(this.effects[i]);
		}

		this.effects.length = 0;
		this.sounds.length  = 0;
	}


	/**
	 * Receiving parsed GAT from Thread
	 */
	function onAltitudeComplete( data )
	{
		var gl = Renderer.getContext();
		Altitude.init( data );
		GridSelector.init( gl );
	}


	/**
	 * Receiving parsed RSMs from Thread
	 */
	function onModelsComplete( data )
	{
		Models.init( Renderer.getContext(), data );
	}

	MapRenderer.getCurrentMapInfo = function () {
		return DB.getMap(MapRenderer.currentMap.replace(/\.gat$/i, '.rsw'));
	}

	/**
	 * Once the map finished to load
	 */
	function onMapComplete( success, error )
	{
		var mapInfo = MapRenderer.getCurrentMapInfo();

		// Problem during loading ?
		if (!success) {
			UIManager.showErrorBox( error ).ui.css('zIndex', 1000);
			return;
		}

		// Play BGM
		BGM.play((mapInfo && mapInfo.mp3) || '01.mp3');

		// Apply fog to map
		this.fog.exist = !!(mapInfo && mapInfo.fog);
		if (this.fog.exist) {
			this.fog.near   = mapInfo.fog.near * 240;
			this.fog.far    = mapInfo.fog.far  * 240;
			this.fog.factor = mapInfo.fog.factor;
			this.fog.color.set( mapInfo.fog.color );
		}

		// Initialize renderers
		Renderer.init({
			antialias: true,
			alpha: true,
			depth: true,
			preserveDrawingBuffer: true,
			powerPreference: "high-performance"
		});
		var gl = Renderer.getContext();
		const worldResource = MapRenderer.currentMap.replace(/\.gat$/i, '.rsw');

		SpriteRenderer.init(gl);
		Sky.init( gl, worldResource );
		Damage.init(gl);
		EffectManager.init(gl);

		// Starting to render
		Background.remove(function(){
			MapRenderer.loading = false;
			Mouse.intersect     = true;

			MapRenderer.onLoad();
			Sky.setUpCloudData();

			// Display game
			Renderer.show();
			Renderer.render( MapRenderer.onRender );
		});

		TiltShiftEffect.init(gl);
	}


	/**
	 * Rendering world
	 *
	 * @param {number} tick - game tick
	 * @param {object} gl context
	 */
	var _pos = new Uint16Array(2);
	MapRenderer.onRender = function OnRender(tick, gl) {
		// Create framebuffer if not exists
		if (!this.sceneFramebuffer) {
			this.sceneFramebuffer = gl.createFramebuffer();
			this.sceneTexture = gl.createTexture();
			this.sceneDepthBuffer = gl.createRenderbuffer();

			gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

			// Set up depth buffer
			gl.bindRenderbuffer(gl.RENDERBUFFER, this.sceneDepthBuffer);
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height);

			gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFramebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTexture, 0);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.sceneDepthBuffer);

			if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
				console.error('Framebuffer is not complete');
				return;
			}
		}

		// Render scene to framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFramebuffer);

		var fog = MapRenderer.fog;
		fog.use = MapPreferences.fog;
		var light = MapRenderer.light;

		var modelView, projection, normalMat;
		var x, y;

		// Clean mouse position in world
		Mouse.world.x = -1;
		Mouse.world.y = -1;
		Mouse.world.z = -1;

		// Clear screen, update camera
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		Camera.update(tick);

		modelView = Camera.modelView;
		projection = Camera.projection;
		normalMat = Camera.normalMat;

		// Spam map effects
		Effects.spam(Session.Entity.position, tick);

		// Create lighting data structure with safeguards
		var lightingData = {
			direction: this.light?.direction || new Float32Array([0, -1, 0]), // Default light from above
			ambient: this.light?.ambient || new Float32Array([0.6, 0.6, 0.6]),
			diffuse: this.light?.diffuse || new Float32Array([1.0, 1.0, 1.0]),
			opacity: this.light?.opacity || 1.0,
			pointLights: this.pointLights || []
		};

		// Debug output
		// console.log('Light Data:', {
		// 	direction: Array.from(lightingData.direction),
		// 	ambient: Array.from(lightingData.ambient),
		// 	diffuse: Array.from(lightingData.diffuse),
		// 	opacity: lightingData.opacity,
		// 	pointLightsCount: lightingData.pointLights.length
		// });

		// Pass lighting data to renderers
		Ground.render(gl, modelView, projection, normalMat, fog, lightingData);
		Models.render(gl, modelView, projection, normalMat, fog, lightingData);

		if (Mouse.intersect && Altitude.intersect(modelView, projection, _pos)) {
			x = _pos[0];
			y = _pos[1];
			const isWalkable = Altitude.getCellType(x, y) & Altitude.TYPE.WALKABLE;

			if (isWalkable) {
				GridSelector.render(gl, modelView, projection, fog, x, y);
				Mouse.world.x = x;
				Mouse.world.y = y;
				Mouse.world.z = Altitude.getCellHeight(x, y);
			}

			if (PACKETVER.value >= 20200101) {
				if (Cursor.getActualType() === Cursor.ACTION.NOWALK && isWalkable)
					Cursor.setType(Cursor.ACTION.DEFAULT, false);
				if (Cursor.getActualType() === Cursor.ACTION.DEFAULT && !isWalkable)
					Cursor.setType(Cursor.ACTION.NOWALK, false);
			}
		}

		// Display zone effects and entities
		Sky.render(gl, modelView, projection, fog, tick);
		EffectManager.render(gl, modelView, projection, fog, tick, true);

		// Render Entities (no effects)
		EntityManager.render(gl, modelView, projection, fog, false);

		// Rendering water
		Water.render(gl, modelView, projection, fog, light, tick);

		// Rendering effects
		Damage.render(gl, modelView, projection, fog, tick);
		EffectManager.render(gl, modelView, projection, fog, tick, false);
		EntityManager.render(gl, modelView, projection, fog, true);

		// Play sounds
		Sounds.render(Session.Entity.position, tick);

		// Find entity over the cursor
		if (Mouse.intersect) {
			var entity = EntityManager.intersect();
			EntityManager.setOverEntity(entity);
		}

		// Clean up
		MemoryManager.clean(gl, tick);

		// Now that everything is rendered to the framebuffer, apply tiltshift
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		if (TiltShiftEffect.ready) {
			TiltShiftEffect.render(gl, this.sceneTexture);
		}

		// Pass the same light info to both renderers
		Ground.render(gl, modelView, projection, normalMat, fog, lightingData);
		Models.render(gl, modelView, projection, normalMat, fog, lightingData);

		// Pass light info to sprite renderer only if program exists
		if (SpriteRenderer._program) {
			// console.log('Light values being passed to SpriteRenderer:', {
			// 	direction: Array.from(this.light.direction),
			// 	ambient: Array.from(this.light.ambient),
			// 	diffuse: Array.from(this.light.diffuse),
			// 	opacity: this.light.opacity
			// });

			// gl.useProgram(SpriteRenderer._program);
			// var uniform = SpriteRenderer._program.uniform;
			// if (!uniform) {
			// 	console.error('SpriteRenderer uniforms not initialized');
			// 	return;
			// }

			// gl.uniform3fv(uniform.uLightDirection, this.light.direction);
			// gl.uniform3fv(uniform.uLightAmbient, this.light.ambient);
			// gl.uniform3fv(uniform.uLightDiffuse, this.light.diffuse);
			// gl.uniform1f(uniform.uLightOpacity, this.light.opacity);

			// // Pass point light count
			// gl.uniform1i(uniform.uNumPointLights, this.pointLights.length);

			// // Pass point light data
			// for (let i = 0; i < this.pointLights.length; i++) {
			// 	const light = this.pointLights[i];
			// 	const index = `[${i}]`;

			// 	gl.uniform3fv(uniform[`uPointLightPosition${index}`], light.position);
			// 	gl.uniform3fv(uniform[`uPointLightColor${index}`], light.color);
			// 	gl.uniform1f(uniform[`uPointLightRange${index}`], light.range);
			// 	gl.uniform1f(uniform[`uPointLightConstant${index}`], light.attenuation.constant);
			// 	gl.uniform1f(uniform[`uPointLightLinear${index}`], light.attenuation.linear);
			// 	gl.uniform1f(uniform[`uPointLightQuadratic${index}`], light.attenuation.quadratic);
			// 	gl.uniform1i(uniform[`uPointLightEnabled${index}`], light.enabled ? 1 : 0);
			// }
		}
	};


	/**
	 * Callback to execute once the map is loaded
	 */
	MapRenderer.onLoad = function onLoad()
	{
	};


	/**
	 * Initialize light data
	 */
	MapRenderer.initLightData = function () {
		this.light = {
			direction: new Float32Array([0, -1, 0]),  // Default direction
			ambient: new Float32Array([0.6, 0.6, 0.6]),
			diffuse: new Float32Array([1.0, 1.0, 1.0]),
			opacity: 1.0
		};
		this.pointLights = [];
	};


	/**
	 * Export
	 */
	return MapRenderer;
});
