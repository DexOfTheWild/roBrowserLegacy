/**
 * Renderer/Effects/Sky.js
 *
 * Rendering blue sky effects
 * TODO: Create a particle class to manage the process
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
	var WebGL          = require('Utils/WebGL');
	var WeatherTable   = require('DB/Effects/WeatherEffect');
	var Client         = require('Core/Client');
	var Session        = require('Engine/SessionStorage');
	var SpriteRenderer = require('Renderer/SpriteRenderer');
	var Renderer = require('Renderer/Renderer');
	var vec3           = require('Utils/gl-matrix').vec3;


	/**
	 * @var {number} number of clouds to render
	 */
	var MAX_CLOUDS = 150;


	/**
	 * @var {Array} clouds particles
	 */
	var _clouds = new Array(MAX_CLOUDS);


	/**
	 * @var {Array} textures list
	 */
	var _textures = [];


	/**
	 * @var {vec4} RGBA color
	 */
	var _color = null;


	/**
	 * @var {boolean} display clouds ?
	 */
	var _display     = true;


	/**
	 * @var {vec3} current sky color
	 */
	var _currentSkyColor = vec3.create();


	/**
	 * @var {vec3} target sky color
	 */
	var _targetSkyColor = vec3.create();


	/**
	 * @var {vec3} current cloud color
	 */
	var _currentCloudColor = vec3.create();


	/**
	 * @var {vec3} target cloud color
	 */
	var _targetCloudColor = vec3.create();


	/**
	 * @var {boolean} is transitioning
	 */
	var _isTransitioning = false;


	/**
	 * @var {number} transition start time
	 */
	var _transitionStartTime = 0;


	/**
	 * @var {number} transition duration
	 */
	var _transitionDuration = 2000000; // 2 seconds, match your CSS transition


	/**
	 * @var {string} current map name
	 */
	var _currentMapName = '';


	/**
	 * Prepare cloud data
	 *
	 * @param {object} gl context
	 * @param {string} mapname
	 */
	function init( gl, mapname )
	{
		var color;
		var i;

		// Store the mapname for later use
		_currentMapName = mapname;

		// Not found on weather, black sky, no cloud.
		if (!WeatherTable.sky[mapname]) {
			gl.clearColor( 0.0, 0.0, 0.0, 1.0);
			_display = false;
			return;
		}

		// Save color
		_color   = WeatherTable.sky[mapname].cloudColor;
		color    = WeatherTable.sky[mapname].skyColor;
		_display = true;

		gl.clearColor( color[0], color[1], color[2], color[3]);

		// Add images to GPU
		if (!_textures.length) {
			_textures.length = 8;

			for (i = 0; i < 7; i++) {
				loadCloudTexture(gl, i);
			}
		}

		// Store initial colors
		if (WeatherTable.sky[mapname]) {
			vec3.copy(_currentSkyColor, WeatherTable.sky[mapname].skyColor);
			vec3.copy(_currentCloudColor, WeatherTable.sky[mapname].cloudColor);
		}
	}


	/**
	 * Loading cloud texture index
	 *
	 * @param {object} gl context
	 * @param {number} cloud texture index
	 */
	function loadCloudTexture( gl, i )
	{
		Client.loadFile('data/texture/effect/cloud' + (i+1) + '.tga', function(buffer) {
			WebGL.texture( gl, buffer, function(texture) {
				_textures[i] = texture;
			});
		});
	}


	/**
	 * Set up cloud data
	 */
	function setUpCloudData()
	{
		var i;

		// Add sprites to scene
		for (i = 0; i < MAX_CLOUDS; i++) {
			if (!_clouds[i]) {
				_clouds[i] = {
					position:   vec3.create(),
					direction:  vec3.create(),
					born_tick:  0,
					death_tick: 0
				};
			}
			cloudInit(_clouds[i]);
			_clouds[i].sprite     = (Math.random()*(_textures.length-1)) | 0;
			_clouds[i].death_tick = _clouds[i].born_tick + Math.random()*8000;
			_clouds[i].born_tick  -= 2000;
		}

		// Sort by textures
		_clouds.sort(function(a,b){
			return a.sprite-b.sprite;
		});
	}


	/**
	 * Initialize cloud element
	 */
	function cloudInit( cloud )
	{
		var pos = Session.Entity.position;

		cloud.position[0]  = pos[0] + (Math.random()*35 | 0) * (Math.random() > 0.5 ? 1 : -1);
		cloud.position[1]  = pos[1] + (Math.random()*35 | 0) * (Math.random() > 0.5 ? 1 : -1);
		cloud.position[2]  = -10.0;

		cloud.direction[0] = Math.random()*0.02  - 0.01;
		cloud.direction[1] = Math.random()*0.02  - 0.01;
		cloud.direction[2] = Math.random()*0.002 - 0.001;

		cloud.born_tick    = cloud.death_tick ? cloud.death_tick + 2000 : Date.now();
		cloud.death_tick   = cloud.born_tick + 6000;
	}


	/**
	 * Add new function to handle color transitions
	 */
	function startDayNightTransition(isNight) {
		_isTransitioning = true;
		_transitionStartTime = Renderer.tick;

		var tempSkyColor = vec3.clone(_currentSkyColor);
		var tempCloudColor = vec3.clone(_currentCloudColor);

		if (isNight) {
			_targetSkyColor.set([0.05, 0.05, 0.1]);
			_targetCloudColor.set([0.1, 0.1, 0.15]);
		} else {
			// Use stored mapname instead of trying to get it from Session
			if (WeatherTable.sky[_currentMapName]) {
				vec3.copy(_targetSkyColor, WeatherTable.sky[_currentMapName].skyColor);
				vec3.copy(_targetCloudColor, WeatherTable.sky[_currentMapName].cloudColor);
			}
		}

		vec3.copy(_currentSkyColor, tempSkyColor);
		vec3.copy(_currentCloudColor, tempCloudColor);
	}


	/**
	 * Rendering clouds on maps
	 *
	 * @param {object} gl context
	 * @param {mat4} modelView
	 * @param {mat4} projection
	 * @param {object} fog structure
	 * @param {number} tick - game tick
	 */
	function render( gl, modelView, projection, fog, tick )
	{
		if (!_display) {
			return;
		}

		var i, cloud, opacity;

		// Handle color transition
		if (_isTransitioning) {
			var progress = Math.min((tick - _transitionStartTime) / _transitionDuration, 1.0);
			if (progress >= 1.0) {
				_isTransitioning = false;
				vec3.copy(_currentSkyColor, _targetSkyColor);
				vec3.copy(_currentCloudColor, _targetCloudColor);
			} else {
				// Interpolate colors
				vec3.lerp(_currentSkyColor, _currentSkyColor, _targetSkyColor, progress);
				vec3.lerp(_currentCloudColor, _currentCloudColor, _targetCloudColor, progress);
			}

			// Update clear color
			gl.clearColor(_currentSkyColor[0], _currentSkyColor[1], _currentSkyColor[2], 1.0);
		}

		// Update cloud color
		SpriteRenderer.bind3DContext(gl, modelView, projection, fog);
		SpriteRenderer.color[0] = _currentCloudColor[0];
		SpriteRenderer.color[1] = _currentCloudColor[1];
		SpriteRenderer.color[2] = _currentCloudColor[2];

		// Base parameters
		SpriteRenderer.shadow        = 1.0;
		SpriteRenderer.angle         = 0;
		SpriteRenderer.size[0]       = 500;
		SpriteRenderer.size[1]       = 500;
		SpriteRenderer.offset[0]     = 0;
		SpriteRenderer.offset[1]     = 0;
		SpriteRenderer.image.palette = null;
		SpriteRenderer.depth         = 0;
		gl.depthMask(false);

		for (i = 0; i < MAX_CLOUDS; i++) {
			cloud = _clouds[i];

			// Appear
			if (cloud.born_tick + 1000 > tick) {
				opacity = (tick - cloud.born_tick) / 1000;
			}

			// Remove
			else if (cloud.death_tick + 2000 < tick) {
				cloudInit(cloud);
				opacity = 0.0;
			}

			// Disapear
			else if (cloud.death_tick < tick) {
				opacity = 1.0 - (tick - cloud.death_tick) / 2000;
			}

			// Default
			else {
				opacity = 1.0;
			}

			SpriteRenderer.zIndex        = 0;
			SpriteRenderer.color[3]      = opacity;
			SpriteRenderer.image.texture = _textures[cloud.sprite];

			// Calculate position
			vec3.add( cloud.position, cloud.position, cloud.direction );
			SpriteRenderer.position.set(cloud.position);
			SpriteRenderer.render();
		}

		// Clean up
		SpriteRenderer.unbind(gl);
		gl.depthMask(true);
	}


	/**
	 * Export
	 */
	return {
		init:           init,
		setUpCloudData: setUpCloudData,
		render: render,
		startDayNightTransition: startDayNightTransition
	};
});
