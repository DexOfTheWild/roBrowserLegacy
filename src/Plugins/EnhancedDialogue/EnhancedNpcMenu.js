define(function(require) {
  'use strict';

  // Dependencies
  var jQuery      = require('Utils/jquery');
  var KEYS        = require('Controls/KeyEventHandler');
  var Renderer    = require('Renderer/Renderer');
  var NpcMenu     = require('UI/Components/NpcMenu/NpcMenu');

  /**
   * Enhance NpcMenu
   */
  function enhanceNpcMenu() {
      // Override init
      NpcMenu.init = function init() {
          this.ui.find('.ok').click(validate.bind(this));
          this.ui.find('.cancel').click(cancel.bind(this));

          this.ui.css({
              top: Math.max(376, Renderer.height/2 + 76),
              left: Math.max(Renderer.width/3, 20)
          });

          // Remove draggable functionality
          // this.draggable();

          var self = this;
          this.ui.find('.content')
              .on('click', 'button', function() {
                  selectIndex.call(self, jQuery(this));
                  validate.bind(self).call();
              });
      };

      // Override setMenu with enhanced version
      NpcMenu.setMenu = function setMenu(menu, gid) {
          var content = this.ui.find('.content');
          var list = menu.split(':');
          this._ownerID = gid;
          this._index = 0;

          content.empty();

          // Enhanced menu creation
          list.forEach((item, index) => {
              if (item.length) {
                  jQuery('<button/>')
                      .text(item)
                      .data('index', index)
                      .appendTo(content);
              }
          });

          // Auto-select first option
          content.find('button:first').addClass('selected');
      };

      // Helper functions
      function validate() {
          this.onSelectMenu(this._ownerID, this._index + 1);
      }

      function cancel() {
          this.onSelectMenu(this._ownerID, 255);
      }

      function selectIndex($this) {
          this.ui.find('.content button').removeClass('selected');
          $this.addClass('selected');
          this._index = parseInt($this.data('index'), 10);
      }

      // Add new methods or properties if needed
      NpcMenu.resetSelection = function resetSelection() {
          this._index = 0;
          this.ui.find('.content button').removeClass('selected');
          this.ui.find('.content button:first').addClass('selected');
      };

      // Enhanced keyboard navigation
      NpcMenu.onKeyDown = function onKeyDown(event) {
          var count, top;
          var content;

          switch (event.which) {
              case KEYS.ENTER:
                  validate.call(this);
                  break;

              case KEYS.ESCAPE:
                  cancel.call(this);
                  break;

              case KEYS.UP:
                  count = this.ui.find('.content button').length;
                  this._index = Math.max(this._index - 1, 0);
                  
                  this.ui.find('.content button').removeClass('selected');
                  this.ui.find('.content button:eq('+ this._index +')').addClass('selected');

                  content = this.ui.find('.content')[0];
                  top = this._index * 20;

                  if (top < content.scrollTop) {
                      content.scrollTop = top;
                  }
                  break;

              case KEYS.DOWN:
                  count = this.ui.find('.content button').length;
                  this._index = Math.min(this._index + 1, count - 1);

                  this.ui.find('.content button').removeClass('selected');
                  this.ui.find('.content button:eq('+ this._index +')').addClass('selected');

                  content = this.ui.find('.content')[0];
                  top = this._index * 20;

                  if (top >= content.scrollTop + 80) {
                      content.scrollTop = top - 60;
                  }
                  break;

              default:
                  return true;
          }

          event.stopImmediatePropagation();
          return false;
      };
  }

  // Initialize enhancements
  enhanceNpcMenu();

  // Export enhanced NpcMenu
  return NpcMenu;
});
