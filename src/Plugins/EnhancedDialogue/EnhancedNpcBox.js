define(function (require) {
    'use strict';

    var jQuery = require('Utils/jquery');
    var NpcBox = require('UI/Components/NpcBox/NpcBox');
    var Typer = require('./Typer.js');

    // Store original methods
    var originalInit = NpcBox.init;

    // Enhance NpcBox
    function enhanceNpcBox() {
        let _npcName = '';
        let _textCount = 0;
        let _existingText = [];
        let _needCleanUp = false;
        let _ownerID = 0;

        // Override init
        NpcBox.init = function init() {
            originalInit.call(this);
            _textCount = 0;
            this.typer = new Typer(this.ui.find('#CurrentNpcText')[0], {
                typeSpeed: 40,
                audioSrc: '/static/sfx/typing.mp3'
            });

            this.ui.find('.border').on('click', () => {
                if (this.typer.isTyping) {
                    this.typer.finish();
                } else {
                    if (this.ui.find('.next').is(':visible')) {
                        this.next();
                    }
                }
            });
        };

        // Override setText
        NpcBox.setText = function setText(text, gid) {
            var container = this.ui.find('#CurrentNpcText');

            if (text.startsWith('[') && text.endsWith(']')) {
                text = text.substring(1, text.length - 1);
                _npcName = text;
                container = this.ui.find('#NpcName');
                return jQuery(container).text(text);
            }

            if (_needCleanUp) {
                jQuery(container).text('');
                _needCleanUp = false;
            }

            _ownerID = gid;
            this.typer.start(text);
        };

        NpcBox.onRemove = function onRemove() {
            this.ui.find('.next').hide();
            this.ui.find('.close').hide();
            this.ui.find('.content').hide();
            this.typer.reset();
            this.ui.find('.portrait').children().remove();

            _needCleanUp = false;
            _ownerID = 0;
        };

        // Add new method
        NpcBox.resetMessage = function resetMessage() {
            _existingText = [];
            this.ui.find('.content').children('span').text('');
            return this;
        };

        NpcBox.next = function next() {
            _needCleanUp = true;
            this.typer.reset();
            this.ui.find('.next').hide();
            this.onNextPressed(_ownerID);
        };

        NpcBox.close = function close() {
            _needCleanUp = true;
            this.ui.find('.close').hide();
            this.typer.reset();
            this.onClosePressed(_ownerID);
        };
    }

    // Apply enhancements immediately
    enhanceNpcBox();

    return NpcBox;
});
