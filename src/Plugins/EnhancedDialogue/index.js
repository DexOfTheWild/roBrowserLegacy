define(function (require) {
  'use strict';

  /**
   * Plugin initialization
   */
  return function Init(pars) {
    // Enhance all components
    require('./EnhancedNpcBox.js');
    require('./EnhancedNpcEngine.js');
    require('./EnhancedNpcMenu.js');
    require('./EnhancedInputBox.js');

    return true;
  };
});
