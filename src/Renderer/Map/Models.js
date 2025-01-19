/**
 * Renderer/Map/Models.js
 *
 * Rendering Models
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(['Utils/WebGL', 'Engine/SessionStorage'], function (WebGL, Session)
{
	'use strict';


	/**
	 * @var {WebGLProgram}
	 */
	var _program = null;


	/**
	 * @var {WebGLBuffer}
	 */
	var _buffer = null;


	/**
	 * @var {Array} list of meshes
	 */
	var _objects = [];


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
	var TRANSITION_DURATION = 10000; // 10 seconds in milliseconds


	/**
	 * @var {string} vertex shader
	 */
	var _vertexShader = `
		precision highp float;

		attribute vec3 aPosition;
		attribute vec3 aVertexNormal;
		attribute vec2 aTextureCoord;
		attribute float aAlpha;

		varying vec2 vTextureCoord;
		varying vec3 vNormal;
		varying vec3 vFragPos;
		varying float vAlpha;
		varying float vLightWeighting;

		uniform mat4 uModelViewMat;
		uniform mat4 uProjectionMat;
		uniform mat3 uNormalMat;
		uniform vec3 uLightDirection;

		void main(void) {
			vec4 worldPos = uModelViewMat * vec4(aPosition, 1.0);
			gl_Position = uProjectionMat * worldPos;

			// Pass position and normal to fragment shader
			vFragPos = worldPos.xyz;
			vNormal = uNormalMat * aVertexNormal;

			vTextureCoord = aTextureCoord;
			vAlpha = aAlpha;

			// Calculate directional light weighting
			vec4 lDirection = uModelViewMat * vec4(uLightDirection, 0.0);
			vec3 dirVector = normalize(lDirection.xyz);
			vLightWeighting = max(dot(vNormal, dirVector), 0.1);
		}
	`;
		
	/**
	 * @var {string} fragment shader
	 */
	var _fragmentShader = `
		precision highp float;

		varying vec2 vTextureCoord;
		varying vec3 vNormal;
		varying vec3 vFragPos;
		varying float vAlpha;
		varying float vLightWeighting;

		uniform sampler2D uDiffuse;

		// Directional light uniforms
		uniform vec3 uLightDirection;
		uniform vec3 uLightAmbient;
		uniform vec3 uLightDiffuse;
		uniform float uLightOpacity;

		// Point light uniforms
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

		// Add transition factor uniform
		uniform float uTransitionFactor;

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

		void main(void) {
			vec4 texture = texture2D(uDiffuse, vTextureCoord.st);

			if (texture.a == 0.0) {
				discard;
			}

			// Calculate directional light with transition
			vec3 directionalLight = uLightDiffuse * (vLightWeighting * 0.8 * uTransitionFactor);
			vec3 ambient = uLightAmbient * (uLightOpacity * 0.7 * max(uTransitionFactor, 0.2));

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
			gl_FragColor = vec4(texture.rgb * lighting, texture.a * vAlpha);

			// Apply fog if enabled
			if (uFogUse) {
				float depth = gl_FragCoord.z / gl_FragCoord.w;
				float fogFactor = smoothstep(uFogNear, uFogFar, depth);
				gl_FragColor = mix(gl_FragColor, vec4(uFogColor, gl_FragColor.w), fogFactor);
			}
		}
	`;

	/**
	 * Initialize models
	 *
	 * @param {object} gl context
	 * @param {object} data ( models )
	 */
	function init( gl, data )
	{
		var i, count;
		var objects;

		objects         = data.infos;
		count           = objects.length;
		_objects.length = count;

		// Bind buffer
		if (!_buffer) {
			_buffer = gl.createBuffer();
		}

		if (!_program) {
			_program = WebGL.createShaderProgram( gl, _vertexShader, _fragmentShader );
		}

		gl.bindBuffer( gl.ARRAY_BUFFER, _buffer );
		gl.bufferData( gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW );

		function onTextureLoaded( texture, i ) {
			// Get the texture
			_objects[i].texture = texture;

			// Set better texture filtering
			gl.bindTexture(gl.TEXTURE_2D, texture);
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
			_objects[i].complete = true;
		}

		// Fetch all images, and draw them in a mega-texture
		for (i = 0; i < count; ++i) {
			if (!_objects[i]) {
				_objects[i] = {};
			}

			_objects[i].vertCount  = data.infos[i].vertCount;
			_objects[i].vertOffset = data.infos[i].vertOffset;
			_objects[i].complete   = false;

			WebGL.texture( gl, data.infos[i].texture, onTextureLoaded, i );
		}
	}


	/**
	 * Render models
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
		if (light.pointLights && light.pointLights.length > 0) {
			const light0 = light.pointLights[0];
			gl.uniform3fv(uniform.uPointLightPosition0, light0.position);
			gl.uniform3fv(uniform.uPointLightColor0, light0.color);
			gl.uniform1f(uniform.uPointLightRange0, light0.range);
			gl.uniform1f(uniform.uPointLightConstant0, light0.attenuation.constant);
			gl.uniform1f(uniform.uPointLightLinear0, light0.attenuation.linear);
			gl.uniform1f(uniform.uPointLightQuadratic0, light0.attenuation.quadratic);
			gl.uniform1i(uniform.uPointLightEnabled0, light0.enabled ? 1 : 0);
		} else {
			gl.uniform1i(uniform.uPointLightEnabled0, 0);
		}

		if (light.pointLights && light.pointLights.length > 1) {
			const light1 = light.pointLights[1];
			gl.uniform3fv(uniform.uPointLightPosition1, light1.position);
			gl.uniform3fv(uniform.uPointLightColor1, light1.color);
			gl.uniform1f(uniform.uPointLightRange1, light1.range);
			gl.uniform1f(uniform.uPointLightConstant1, light1.attenuation.constant);
			gl.uniform1f(uniform.uPointLightLinear1, light1.attenuation.linear);
			gl.uniform1f(uniform.uPointLightQuadratic1, light1.attenuation.quadratic);
			gl.uniform1i(uniform.uPointLightEnabled1, light1.enabled ? 1 : 0);
		} else {
			gl.uniform1i(uniform.uPointLightEnabled1, 0);
		}

		// Bind fog uniforms
		gl.uniform1i(uniform.uFogUse, fog.use && fog.exist);
		gl.uniform1f(uniform.uFogNear, fog.near);
		gl.uniform1f(uniform.uFogFar, fog.far);
		gl.uniform3fv( uniform.uFogColor, fog.color );

		// Pass transition factor to shader
		gl.uniform1f(uniform.uTransitionFactor, transitionFactor);

		// Enable all attributes
		gl.enableVertexAttribArray( attribute.aPosition );
		gl.enableVertexAttribArray( attribute.aVertexNormal );
		gl.enableVertexAttribArray( attribute.aTextureCoord );
		gl.enableVertexAttribArray( attribute.aAlpha );

		gl.bindBuffer( gl.ARRAY_BUFFER, _buffer );

		// Link attribute
		gl.vertexAttribPointer( attribute.aPosition,      3, gl.FLOAT, false, 9*4, 0   );
		gl.vertexAttribPointer( attribute.aVertexNormal,  3, gl.FLOAT, false, 9*4, 3*4 );
		gl.vertexAttribPointer( attribute.aTextureCoord,  2, gl.FLOAT, false, 9*4, 6*4 );
		gl.vertexAttribPointer( attribute.aAlpha,         1, gl.FLOAT, false, 9*4, 8*4 );

		// Textures
		gl.activeTexture( gl.TEXTURE0 );
		gl.uniform1i( uniform.uDiffuse, 0 );

		for (var i = 0, count = _objects.length; i < count; ++i) {
			if (_objects[i].complete) {
				gl.bindTexture( gl.TEXTURE_2D, _objects[i].texture );
				gl.drawArrays(  gl.TRIANGLES,  _objects[i].vertOffset, _objects[i].vertCount );
			}
		}

		// Is it needed ?
		gl.disableVertexAttribArray( attribute.aPosition );
		gl.disableVertexAttribArray( attribute.aVertexNormal );
		gl.disableVertexAttribArray( attribute.aTextureCoord );
		gl.disableVertexAttribArray( attribute.aAlpha );
	}


	/**
	 * Clean textures/buffer from memory
	 *
	 * @param {object} gl context
	 */
	function free( gl )
	{
		var i, count;

		if (_buffer) {
			gl.deleteBuffer(_buffer);
			_buffer = null;
		}

		if (_program) {
			gl.deleteProgram(_program);
			_program = null;
		}

		for (i = 0, count = _objects.length; i < count; ++i) {
			gl.deleteTexture( _objects[i].texture );
		}

		_objects.length = 0;
	}


	/**
	 * Export
	 */
	return {
		init:   init,
		render: render,
		free:   free
	};
});
