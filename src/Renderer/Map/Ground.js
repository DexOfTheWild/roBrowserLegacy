/**
 * Renderer/Map/Ground.js
 *
 * Rendering ground
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(['Utils/WebGL', 'Utils/Texture', 'Preferences/Map', 'Engine/SessionStorage'],
	function (WebGL, Texture, Preferences, Session)
{
	'use strict';


	/**
	 * @var {WebGLProgram}
	 */
	var _program       = null;


	/**
	 * @var {WebGBLuffer}
	 */
	var _buffer = null;


	/**
	 * @var {WebGLTexture}
	 */
	var _lightmap = null;


	/**
	 * @var {WebGLTexture}
	 */
	var _tileColor = null;


	/**
	 * @var {WebGLTexture}
	 */
	var _textureAtlas = null;


	/**
	 * @var {WebGLTexture}
	 */
	var _shadowMap = null;


	/**
	 * @var {number} total vertices count
	 */
	var _vertCount = 0;


	/**
	 * @var {number} Ground width
	 */
	var _width = 0;


	/**
	 * @var {number} Ground height
	 */
	var _height = 0;


		/**
		 * @var {number} Transition start time
		 */
		var _transitionStartTime = 0;


		/**
		 * @var {boolean} Is transitioning
		 */
		var _isTransitioning = false;


		/**
		 * @var {boolean} Transition from night
		 */
		var _transitionFromNight = false;


		/**
		 * @var {number} Transition duration
		 */
		var TRANSITION_DURATION = 10000; // 1 minute in milliseconds


	/**
	 * @var {string} Vertex Shader
	 */
		var _vertexShader = `
		#version 100
		precision highp float;

		attribute vec3 aPosition;
		attribute vec3 aVertexNormal;
		attribute vec2 aTextureCoord;
		attribute vec2 aLightmapCoord;
		attribute vec2 aTileColorCoord;
		attribute float aCustomAttribute;

		varying vec2 vTextureCoord;
		varying vec2 vLightmapCoord;
		varying vec2 vTileColorCoord;
		varying vec3 vNormal;
		varying vec3 vFragPos;
		varying float vLightWeighting;
		varying float vCustomValue;

		uniform mat4 uModelViewMat;
		uniform mat4 uProjectionMat;
		uniform mat3 uNormalMat;
		uniform vec3 uLightDirection;
		uniform float uTime;

		void main(void) {
			vec4 worldPos = uModelViewMat * vec4(aPosition, 1.0);
			gl_Position = uProjectionMat * worldPos;

			// Pass fragment position and normal to fragment shader
			vFragPos = worldPos.xyz;
			vNormal = uNormalMat * aVertexNormal;

			// Pass texture coordinates
			vTextureCoord = aTextureCoord;
			vLightmapCoord = aLightmapCoord;
			vTileColorCoord = aTileColorCoord;

			// Calculate directional light weighting
			vec4 lDirection = uModelViewMat * vec4(uLightDirection, 0.0);
			vec3 dirVector = normalize(lDirection.xyz);
			vLightWeighting = max(dot(vNormal, dirVector), 0.1);

			// Calculate custom wave effect
			float wave = sin(uTime * 0.001 + aPosition.x * 0.1);
			wave = wave * (1.0 - max(wave, 0.0) * 0.5);
			vCustomValue = wave * 0.5 + 0.5;
		}
	`;

	/**
	 * @var {string} Fragment Shader
	 */
		var _fragmentShader = `
		#version 100
		precision highp float;

		// Maximum number of point lights
		#define MAX_POINT_LIGHTS 10

		varying vec2 vTextureCoord;
		varying vec2 vLightmapCoord;
		varying vec2 vTileColorCoord;
		varying vec3 vNormal;
		varying vec3 vFragPos;
		varying float vLightWeighting;
		varying float vCustomValue;

		uniform sampler2D uDiffuse;
		uniform sampler2D uLightmap;
		uniform sampler2D uTileColor;
		uniform bool uLightMapUse;

		// Directional light uniforms
		uniform vec3 uLightDirection;
		uniform vec3 uLightAmbient;
		uniform vec3 uLightDiffuse;
		uniform float uLightOpacity;

		// Point light uniforms (using individual uniforms instead of arrays)
		uniform int uNumPointLights;

		uniform vec3 uPointLightPosition0;
		uniform vec3 uPointLightPosition1;
		uniform vec3 uPointLightColor0;
		uniform vec3 uPointLightColor1;
		uniform float uPointLightRange0;
		uniform float uPointLightRange1;
		uniform float uPointLightConstant0;
		uniform float uPointLightConstant1;
		uniform float uPointLightLinear0;
		uniform float uPointLightLinear1;
		uniform float uPointLightQuadratic0;
		uniform float uPointLightQuadratic1;
		uniform bool uPointLightEnabled0;
		uniform bool uPointLightEnabled1;

		// Fog uniforms
		uniform bool uFogUse;
		uniform float uFogNear;
		uniform float uFogFar;
		uniform vec3 uFogColor;

		// Transition factor
		uniform float uTransitionFactor;  // 0.0 to 1.0

		// Custom effect uniform
		uniform float uEffectStrength;

		// Calculate point light contribution
		vec3 calculatePointLight(vec3 position, vec3 color, float range,
							   float constant, float linear, float quadratic,
							   bool enabled, vec3 normal, vec3 fragPos) {
			if (!enabled) {
				return vec3(0.0);
			}

			vec3 lightDir = position - fragPos;
			float distance = length(lightDir);

			if (distance > range) {
				return vec3(0.0);
			}

			lightDir = normalize(lightDir);
			float diff = max(dot(normal, lightDir), 0.0) * 0.5;

			float attenuation = 1.0 / (
				constant +
				linear * distance * 2.0 +
				quadratic * distance * distance * 1.5
			);

			return color * diff * attenuation * 0.7;
		}

		// Add color enhancement functions
		vec3 saturate(vec3 color, float adjustment) {
			// Convert to HSL-like space
			float maxVal = max(max(color.r, color.g), color.b);
			float minVal = min(min(color.r, color.g), color.b);
			vec3 adjusted = (color - mix(vec3(minVal), vec3(maxVal), 0.5)) * adjustment + color;
			return clamp(adjusted, 0.0, 1.0);
		}

		vec3 enhanceColor(vec3 color) {
			// Increase saturation
			vec3 saturated = saturate(color, 0.5);

			// Slightly boost brightness while preserving contrast
			return saturated * 1.0;
		}

		void main(void) {
			vec4 texture = texture2D(uDiffuse, vTextureCoord.st);
			float lightWeight = 1.0;

			if (texture.a == 0.0) {
				discard;
			}

			// Apply tile color if available
			if (vTileColorCoord.st != vec2(0.0, 0.0)) {
				texture *= texture2D(uTileColor, vTileColorCoord.st);
				lightWeight = vLightWeighting;
			}

			// Calculate directional light with transition
			float dayFactor = uTransitionFactor;
			vec3 directionalLight = uLightDiffuse * (lightWeight * 0.7 * dayFactor);
			vec3 ambient = uLightAmbient * (uLightOpacity * 0.6 * max(dayFactor, 0.2));

			// Calculate point lights contribution
			vec3 pointLightContribution = vec3(0.0);
			vec3 normal = normalize(vNormal);

			// Add first point light
			pointLightContribution += calculatePointLight(
				uPointLightPosition0, uPointLightColor0, uPointLightRange0,
				uPointLightConstant0, uPointLightLinear0, uPointLightQuadratic0,
				uPointLightEnabled0, normal, vFragPos
			);

			// Add second point light
			pointLightContribution += calculatePointLight(
				uPointLightPosition1, uPointLightColor1, uPointLightRange1,
				uPointLightConstant1, uPointLightLinear1, uPointLightQuadratic1,
				uPointLightEnabled1, normal, vFragPos
			);

			// Combine all lighting
			vec3 lighting = ambient + directionalLight + pointLightContribution;

			// Apply lighting to texture
			vec3 enhancedColor = enhanceColor(texture.rgb);
			gl_FragColor = vec4(enhancedColor * lighting, texture.a);

			// Apply custom wave effect
			gl_FragColor.rgb += vec3(vCustomValue * uEffectStrength);

			// Apply lightmap if enabled
			if (uLightMapUse) {
				vec4 lightmap = texture2D(uLightmap, vLightmapCoord.st);
				// Modulate lighting with lightmap alpha for shadows
				lighting *= lightmap.a;
				// Optionally, combine lightmap color
				// lighting += lightmap.rgb * 0.2; // Adjust factor as needed
				gl_FragColor.rgb *= lighting;
			}

			// Apply fog if enabled
			if (uFogUse) {
				float depth = gl_FragCoord.z / gl_FragCoord.w;
				float fogFactor = smoothstep(uFogNear, uFogFar, depth);
				gl_FragColor = mix(gl_FragColor, vec4(uFogColor, gl_FragColor.w), fogFactor);
			}
		}
	`;

	/**
	 * Render ground
	 *
	 * @param {object} gl context
	 * @param {mat4} modelView
	 * @param {mat4} projection
	 * @param {mat3} normalMat
	 * @param {object} fog structure
	 * @param {object} light structure
	 */
	function render( gl, modelView, projection, normalMat, fog, light )
	{
		var uniform = _program.uniform;
		var attribute = _program.attribute;
		var currentTime = performance.now();

		// Check if we need to start a transition
		if (Session.mapState.isNight !== _transitionFromNight && !_isTransitioning) {
			_transitionStartTime = currentTime;
			_isTransitioning = true;
			_transitionFromNight = Session.mapState.isNight;
		}

		// Calculate transition factor
		var transitionFactor;
		if (_isTransitioning) {
			var elapsed = currentTime - _transitionStartTime;
			var progress = Math.min(elapsed / TRANSITION_DURATION, 1.0);

			if (progress >= 1.0) {
				_isTransitioning = false;
				transitionFactor = _transitionFromNight ? 0.3 : 1.0; // Final values
			} else {
				// Smooth transition using sine
				var smoothProgress = (Math.sin(progress * Math.PI - Math.PI / 2) + 1) / 2;
				transitionFactor = _transitionFromNight ?
					1.0 - (smoothProgress * 0.7) : // Transition to 0.3 for night
					0.3 + (smoothProgress * 0.7);  // Transition to 1.0 for day
			}
		} else {
			transitionFactor = Session.mapState.isNight ? 0.3 : 1.0;
		}

		gl.useProgram( _program );

		// Bind matrices
		gl.uniformMatrix4fv(uniform.uModelViewMat, false, modelView);
		gl.uniformMatrix4fv( uniform.uProjectionMat, false, projection );
		gl.uniformMatrix3fv(uniform.uNormalMat, false, normalMat);

		// Bind directional light
		gl.uniform3fv( uniform.uLightDirection, light.direction );
		gl.uniform3fv(uniform.uLightAmbient, light.ambient);
		gl.uniform3fv(uniform.uLightDiffuse, light.diffuse);
		gl.uniform1f(uniform.uLightOpacity, light.opacity);

		// Bind point lights
		gl.uniform1i(uniform.uNumPointLights, Math.min(light.pointLights.length, 2));

		// Bind first point light if available
		if (light.pointLights.length > 0) {
			const light0 = light.pointLights[0];
			gl.uniform3fv(uniform.uPointLightPosition0, light0.position);
			gl.uniform3fv(uniform.uPointLightColor0, light0.color);
			gl.uniform1f(uniform.uPointLightRange0, light0.range);
			gl.uniform1f(uniform.uPointLightConstant0, light0.attenuation.constant);
			gl.uniform1f(uniform.uPointLightLinear0, light0.attenuation.linear);
			gl.uniform1f(uniform.uPointLightQuadratic0, light0.attenuation.quadratic);
			gl.uniform1i(uniform.uPointLightEnabled0, light0.enabled ? 1 : 0);
		}

		// Bind second point light if available
		if (light.pointLights.length > 1) {
			const light1 = light.pointLights[1];
			gl.uniform3fv(uniform.uPointLightPosition1, light1.position);
			gl.uniform3fv(uniform.uPointLightColor1, light1.color);
			gl.uniform1f(uniform.uPointLightRange1, light1.range);
			gl.uniform1f(uniform.uPointLightConstant1, light1.attenuation.constant);
			gl.uniform1f(uniform.uPointLightLinear1, light1.attenuation.linear);
			gl.uniform1f(uniform.uPointLightQuadratic1, light1.attenuation.quadratic);
			gl.uniform1i(uniform.uPointLightEnabled1, light1.enabled ? 1 : 0);
		}

		// Bind lightmap
		if (Preferences.lightmap) {
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, _lightmap);
			gl.uniform1i(uniform.uLightmap, 1);
		}

		// Ensure uLightMapUse is set based on preferences
		gl.uniform1i(uniform.uLightMapUse, Preferences.lightmap ? 1 : 0);

		// Fog settings
		gl.uniform1i(  uniform.uFogUse,   fog.use && fog.exist );
		gl.uniform1f(  uniform.uFogNear,  fog.near );
		gl.uniform1f(  uniform.uFogFar,   fog.far  );
		gl.uniform3fv( uniform.uFogColor, fog.color );

		// Pass transition factor to shader
		gl.uniform1f(uniform.uTransitionFactor, transitionFactor);

		// Cloud wave effect uniforms
		gl.uniform1f(uniform.uTime, currentTime);
		gl.uniform1f(uniform.uEffectStrength, 0.1); // Adjust as needed

		// Enable all attributes
		gl.enableVertexAttribArray( attribute.aPosition );
		gl.enableVertexAttribArray( attribute.aVertexNormal );
		gl.enableVertexAttribArray( attribute.aTextureCoord );
		gl.enableVertexAttribArray( attribute.aLightmapCoord );
		gl.enableVertexAttribArray( attribute.aTileColorCoord );
		gl.enableVertexAttribArray(attribute.aCustomAttribute);

		gl.bindBuffer( gl.ARRAY_BUFFER, _buffer );

		// Link attribute
		gl.vertexAttribPointer( attribute.aPosition,       3, gl.FLOAT, false, 12*4,  0   );
		gl.vertexAttribPointer( attribute.aVertexNormal,   3, gl.FLOAT, false, 12*4,  3*4 );
		gl.vertexAttribPointer( attribute.aTextureCoord,   2, gl.FLOAT, false, 12*4,  6*4 );
		gl.vertexAttribPointer( attribute.aLightmapCoord,  2, gl.FLOAT, false, 12*4,  8*4 );
		gl.vertexAttribPointer( attribute.aTileColorCoord, 2, gl.FLOAT, false, 12*4, 10*4 );
		gl.vertexAttribPointer(attribute.aCustomAttribute, 1, gl.FLOAT, false, 12 * 4, 12 * 4);

		// Texture Atlas
		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, _textureAtlas );
		gl.uniform1i( uniform.uDiffuse, 0 );

		// Tile Color
		gl.activeTexture( gl.TEXTURE2 );
		gl.bindTexture( gl.TEXTURE_2D, _tileColor );
		gl.uniform1i( uniform.uTileColor, 2 );

		// Send mesh
		gl.drawArrays(  gl.TRIANGLES, 0, _vertCount );

		// Is it needed ?
		gl.disableVertexAttribArray( attribute.aPosition );
		gl.disableVertexAttribArray( attribute.aVertexNormal );
		gl.disableVertexAttribArray( attribute.aTextureCoord );
		gl.disableVertexAttribArray( attribute.aLightmapCoord );
		gl.disableVertexAttribArray( attribute.aTileColorCoord );
		gl.disableVertexAttribArray(attribute.aCustomAttribute);
	}


	/**
	 * Prepare lightmap and send it to GPU
	 * Create a lightmap image with size power of two
	 *
	 * @param {object} gl context
	 * @param {object} lightmap
	 * @param {number} size
	 */
	function initLightmap( gl, lightmap, size )
	{
		var width = WebGL.toPowerOfTwo(Math.round(Math.sqrt(size)) * 8);
		var height = WebGL.toPowerOfTwo(Math.ceil(Math.sqrt(size)) * 8);

		if (!_lightmap) {
			_lightmap = gl.createTexture();
		}

		gl.bindTexture(gl.TEXTURE_2D, _lightmap);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, lightmap);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.generateMipmap(gl.TEXTURE_2D);
	}


	/**
	 * Prepare Tile Color and send it to GPU
	 *
	 * @param {object} gl
	 * @param {Array} tilescolor
	 * @param {number} width
	 * @param {number} height
	 */
	function initTileColor( gl, tilescolor, width, height )
	{

		var _width, _height, i, count;
		var smooth, canvas, ctx, imageData, data;

		// Build image
		canvas        = document.createElement('canvas');
		canvas.width  = width;
		canvas.height = height;
		ctx           = canvas.getContext('2d');
		imageData     = ctx.createImageData(width, height);
		data          = imageData.data;
		count         = data.length;

		// Set Image pixel
		for (i = 0; i < count; ++i) {
			data[i] = tilescolor[i];
		}
		ctx.putImageData( imageData, 0, 0 );

		// Build Image with power of two texture * 2 (to smooth)
		_width        = WebGL.toPowerOfTwo( width );
		_height       = WebGL.toPowerOfTwo( height );
		smooth        = document.createElement('canvas');
		smooth.width  = _width;
		smooth.height = _height;
		ctx           = smooth.getContext('2d');

		ctx.fillStyle = 'black';
		ctx.fillRect( 0, 0, _width, _height);
		ctx.drawImage( canvas, 0, 0, _width, _height );

		// Send texture to GPU
		if (!_tileColor) {
			_tileColor = gl.createTexture();
		}

		gl.bindTexture( gl.TEXTURE_2D, _tileColor );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, smooth );
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.generateMipmap( gl.TEXTURE_2D );
	}


	/**
	 * Prepare textures and send it to GPU
	 * Create a texture atlas where we put all textures to avoid drawcall and optimize perfs
	 *
	 * @param {Object} gl context
	 * @param {Array} textures 's filename
	 */
	function initTextures( gl, textures )
	{
		var i, count, width, height, _width, loaded;
		var canvas, ctx;

		// Find texture size
		count  = textures.length;
		_width = Math.round( Math.sqrt(count) );
		width  = WebGL.toPowerOfTwo( _width * 258 );
		height = WebGL.toPowerOfTwo( Math.ceil(  Math.sqrt(count) ) * 258 );

		// Create canvas where we put all textures
		canvas        = document.createElement('canvas');
		canvas.width  = width;
		canvas.height = height;
		ctx           = canvas.getContext('2d');
		loaded        = 0;


		function onTextureCompleteBuildAtlas( success, i )
		{
			if (success) {
				var x = (i % _width) * 258;
				var y = Math.floor(i / _width) * 258;
				ctx.drawImage( this, x + 0, y + 0, 258, 258 ); // generate border
				ctx.drawImage( this, x + 1, y + 1, 256, 256 );
			}

			if ((++loaded) === count) {
				onTextureAtlasComplete(gl, canvas);
			}
		}

		// Fetch all images, and draw them in a mega-texture
		for (i = 0; i < count; ++i) {
			Texture.load(textures[i], onTextureCompleteBuildAtlas, i);
		}
	}


	/**
	 * Send the texture atlas to GPU
	 *
	 * @param {object} gl
	 * @param {object} atlas - canvas texture
	 */
	function onTextureAtlasComplete( gl, atlas )
	{
		if (!_textureAtlas) {
			_textureAtlas = gl.createTexture();
		}

		gl.bindTexture(gl.TEXTURE_2D, _textureAtlas);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);

		// Use better texture filtering
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// Enable anisotropic filtering if available
		const ext = gl.getExtension('EXT_texture_filter_anisotropic');
		if (ext) {
			const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
			gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
		}

		gl.generateMipmap(gl.TEXTURE_2D);
	}


	/**
	 * Prepare ground data
	 *
	 * @param {object} gl context
	 * @param {object} data - ground
	 */
	function init( gl, data )
	{
		_vertCount = data.meshVertCount;
		_width     = data.width;
		_height    = data.height;
		_shadowMap = data.shadowMap;

		// Bind buffer, sending mesh to GPU
		if (!_buffer) {
			_buffer = gl.createBuffer();
		}

		// Link program	if not loaded
		if (!_program) {
			_program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);
			_program.uniform.uEffectStrength = gl.getUniformLocation(_program, 'uEffectStrength');
			_program.uniform.uTime = gl.getUniformLocation(_program, 'uTime');
			_program.attribute.aCustomAttribute = gl.getAttribLocation(_program, 'aCustomAttribute');
		}

		gl.bindBuffer( gl.ARRAY_BUFFER, _buffer );
		gl.bufferData( gl.ARRAY_BUFFER, data.mesh, gl.STATIC_DRAW );

		// Send lightmap to GPU
		initLightmap( gl, data.lightmap, data.lightmapSize );

		// Send Tile color to GPU
		initTileColor( gl, data.tileColor, data.width, data.height );

		// Send textures to GPU
		initTextures( gl, data.textures );
	}



	/**
	 * Clean texture/buffer from memory
	 *
	 * @param {object} gl context
	 */
	function free( gl )
	{
		if (_lightmap) {
			gl.deleteTexture( _lightmap );
			_lightmap = null;
		}

		if (_tileColor) {
			gl.deleteTexture( _tileColor );
			_tileColor = null;
		}

		if (_textureAtlas) {
			gl.deleteTexture( _textureAtlas );
			_textureAtlas = null;
		}

		if (_buffer) {
			gl.deleteBuffer( _buffer );
			_buffer = null;
		}

		_shadowMap = null;
		_vertCount = 0;
	}


	/**
	 * Return shadow factor
	 *
	 * @param {number} x
	 * @param {number} y
	 * @return {number} shadow factor
	 */
	function getShadowFactor( x, y )
	{
		// Map not loadead yet
		if (!_shadowMap) {
			return 1.0;
		}

		var _x, _y, factor = 0;

		// Player is at cell center
		x += 0.5;
		y += 0.5;

		// Get index
		_x = Math.floor( x / 2 ) * 8;
		_y = Math.floor( y / 2 ) * 8;

		// Add floor percent
		_x += Math.min( ( x & 1 ? 4 : 0) + Math.floor( (x % 1) * 4 ), 6);
		_y += Math.min( ( y & 1 ? 4 : 0) + Math.floor( (y % 1) * 4 ), 6);

		// Smooth shadowmap
		for (y = -3; y < 3; ++y) {
			for (x = -3; x < 3; ++x) {
				factor += _shadowMap[ (_x+x) + (_y+y) * _width * 8];
			}
		}

		// Get back value
		return factor / (6*6) / 255;
	}


	/**
	 * Export
	 */
	return {
		init:            init,
		free:            free,
		render:          render,
		getShadowFactor: getShadowFactor
	};
});
