define(function(require) {
  'use strict';
  
  var jQuery      = require('Utils/jquery');
  var NpcBox = require('UI/Components/NpcBox/NpcBox');
  var Typer  = require('./Typer.js');

  // Store original methods
  var originalInit = NpcBox.init;
  var originalOnRemove = NpcBox.onRemove;

  // Enhance NpcBox
  function enhanceNpcBox() {
      // Override init
      NpcBox.init = function init() {
          originalInit.call(this);
          this.typer = new Typer(this.ui.find('#CurrentNpcText')[0], { 
              typeSpeed: 40, 
              audioSrc: '/static/sfx/typing.mp3' 
          });
      };

      // Override setText
      NpcBox.setText = function setText(text, gid) {
          var container = this.ui.find('#CurrentNpcText');
          
          if (text.startsWith('[') && text.endsWith(']')) {
              text = text.substring(1, text.length - 1);
              container = this.ui.find('#NpcName');
              return jQuery(container).text(text);
          }

          if (this._needCleanUp) {
              jQuery(container).text('');
              this._needCleanUp = false;
          }

          this._ownerID = gid;
          this.typer.start(text);
      };

      // Override onRemove
      NpcBox.onRemove = function onRemove() {
          originalOnRemove.call(this);
          this.typer.reset();
          this.ui.find('.portrait').children().remove();
      };

      // Add new method
      NpcBox.resetMessage = function resetMessage() {
          this._existingText = [];
          this.ui.find('.content').children('span').text('');
          return this;
      };
  }

  // Apply enhancements immediately
  enhanceNpcBox();

  return NpcBox;
});
