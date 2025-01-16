
define(function (require) {
  'use strict';

  /**
   * Plugin initialization
   */
  return function Init(pars) {
    // Enhance all components
    require('./Interceptor.js')();

    return true;
  };
});

