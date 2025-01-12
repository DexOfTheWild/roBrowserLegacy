define(['Utils/WebGL', 'Utils/gl-matrix'], function (WebGL, glMatrix) {
  'use strict';

  var _program;
  var _buffer;
  var _vertexShader = `
        #version 100
        #pragma vscode_glsllint_stage : vert
        precision highp float;

        attribute vec2 aPosition;
        attribute vec2 aTextureCoord;
        varying vec2 vTextureCoord;

        void main(void) {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vTextureCoord = aTextureCoord;
        }
    `;

  var _fragmentShader = `
        #version 100
        #pragma vscode_glsllint_stage : frag
        precision highp float;

        varying vec2 vTextureCoord;
        uniform sampler2D uMainTexture;
        uniform float uFocusPosition;
        uniform float uFocusRange;
        uniform float uBlurAmount;

        void main(void) {
            vec4 color = texture2D(uMainTexture, vTextureCoord);
            float dist = abs(vTextureCoord.y - uFocusPosition);
            float blur = smoothstep(0.0, uFocusRange, dist) * uBlurAmount;
            
            if(blur > 0.0) {
                float pixels = 32.0;
                vec2 size = vec2(blur * pixels) / vec2(1280.0, 960.0);
                
                vec4 sum = vec4(0.0);
                for(float x = -2.0; x <= 2.0; x++) {
                    for(float y = -2.0; y <= 2.0; y++) {
                        sum += texture2D(uMainTexture, 
                            vTextureCoord + vec2(x,y) * size);
                    }
                }
                color = sum / 25.0;
            }
            
            gl_FragColor = color;
        }
    `;

  var TiltShiftEffect = {};

  TiltShiftEffect.init = function init(gl) {
    if (_program) {
      this.free(gl);
    }

    _program = WebGL.createShaderProgram(gl, _vertexShader, _fragmentShader);
    if (!_program) {
      console.error('Failed to create shader program for TiltShiftEffect');
      return false;
    }

    // Store uniform locations
    _program.uniform = {
      uMainTexture: gl.getUniformLocation(_program, 'uMainTexture'),
      uFocusPosition: gl.getUniformLocation(_program, 'uFocusPosition'),
      uFocusRange: gl.getUniformLocation(_program, 'uFocusRange'),
      uBlurAmount: gl.getUniformLocation(_program, 'uBlurAmount')
    };

    // Store attribute locations
    _program.attribute = {
      aPosition: gl.getAttribLocation(_program, 'aPosition'),
      aTextureCoord: gl.getAttribLocation(_program, 'aTextureCoord')
    };

    // Create fullscreen quad
    _buffer = gl.createBuffer();
    var vertices = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,
      1.0, -1.0, 1.0, 0.0,
      -1.0, 1.0, 0.0, 1.0,
      1.0, 1.0, 1.0, 1.0
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    this.ready = true;
    return true;
  };

  TiltShiftEffect.free = function free(gl) {
    if (_program) {
      gl.deleteProgram(_program);
      _program = null;
    }
    if (_buffer) {
      gl.deleteBuffer(_buffer);
      _buffer = null;
    }
    this.ready = false;
  };

  TiltShiftEffect.render = function render(gl, mainTexture) {
    if (!this.ready || !_program) {
      return;
    }

    gl.useProgram(_program);

    gl.bindBuffer(gl.ARRAY_BUFFER, _buffer);
    gl.enableVertexAttribArray(_program.attribute.aPosition);
    gl.enableVertexAttribArray(_program.attribute.aTextureCoord);
    gl.vertexAttribPointer(_program.attribute.aPosition, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(_program.attribute.aTextureCoord, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mainTexture);
    gl.uniform1i(_program.uniform.uMainTexture, 0);

    gl.uniform1f(_program.uniform.uFocusPosition, 0.5);
    gl.uniform1f(_program.uniform.uFocusRange, 0.9);
    gl.uniform1f(_program.uniform.uBlurAmount, 0.06);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Clean up
    gl.disableVertexAttribArray(_program.attribute.aPosition);
    gl.disableVertexAttribArray(_program.attribute.aTextureCoord);
  };

  return TiltShiftEffect;
});
