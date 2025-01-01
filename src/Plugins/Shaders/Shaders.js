define(function (require) {
  'use strict';

  var Ground = require('Renderer/Map/Ground');

  function enhanceGround() {
    // Add new uniforms
    Ground.addCustomUniform('uWaterTime', 'float');
    Ground.addCustomUniform('uWaterStrength', 'float');

    // Modify vertex shader to include water effect
    const newVertexShader = `
            uniform float uWaterTime;
            uniform float uWaterStrength;
            
            void main(void) {
                vec3 position = aPosition;
                
                // Add wave effect to y coordinate
                position.y += sin(position.x * 0.1 + uWaterTime) * uWaterStrength;
                
                gl_Position = uProjectionMat * uModelViewMat * vec4(position, 1.0);
            }
        `;

    Ground.setVertexShader(newVertexShader);

    // Store original render
    var originalRender = Ground.render;

    // Override render to update water uniforms
    Ground.render = function (gl, modelView, projection, normalMat, fog, light) {
      var uniform = this.getProgram().uniform;

      // Update water effect uniforms
      gl.uniform1f(uniform.uWaterTime, performance.now() * 0.001);
      gl.uniform1f(uniform.uWaterStrength, 0.5);

      // Call original render
      originalRender.call(this, gl, modelView, projection, normalMat, fog, light);
    };
  }

  // Apply enhancements
  // enhanceGround();

  return Ground;
});
