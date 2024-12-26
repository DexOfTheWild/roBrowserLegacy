define(function (require) {
    'use strict';

    var jQuery = require('Utils/jquery');
    var NpcBox = require('UI/Components/NpcBox/NpcBox');
    var Renderer = require('Renderer/Renderer');
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
        let _messageChunks = new Set();

        // Override init
        NpcBox.init = function init() {
            this.typer = new Typer(this.ui.find('#CurrentNpcText')[0], {
                typeSpeed: 40,
                audioSrc: '/static/sfx/typing.mp3'
            });

            this.ui.on('click', () => {
                if (this.typer.isTyping) {
                    this.typer.finish();
                } else {
                    if (this.ui.find('.next').is(':visible')) {
                        this.next();
                    }
                }
            });
            this.ui.css({
                top: Math.max(100, Renderer.height / 2 - 200),
                left: Math.max(Renderer.width / 3, 20)
            });

            // Bind mouse
            this.ui.find('.next').click(NpcBox.next.bind(this));
            this.ui.find('.close').click(NpcBox.close.bind(this));

            // Content do not drag window (official)
            // Will also fix the problem about the scrollbar
            this.ui.find('.content').mousedown(function (event) {
                event.stopImmediatePropagation();
            });
        };

        // Override setText
        NpcBox.setText = function setText(text, gid) {
            var container = this.ui.find('#CurrentNpcText');
            // Remove HTML tags and special characters
            text = text.replace(/<[^>]*>|&[^;]+;/g, '')
                .replaceAll(/\u0E42\u20AC[\u0098\u0099]/g, "'")
                .replaceAll('โ€"', "—")
                .replaceAll('โ€ฆ', '...');

            if (text.startsWith('[') && text.endsWith(']')) {
                text = text.substring(1, text.length - 1);
                _npcName = text;
                container = this.ui.find('#NpcName');
                return jQuery(container).text(text);
            }

            if (_needCleanUp) {
                this.resetMessage();
                _needCleanUp = false;
            }

            _ownerID = gid;
            _messageChunks.add(text);

            // Use start() for the first chunk, queue() for subsequent chunks
            if (_messageChunks.size === 1) {
                this.typer.start(text);
            } else {
                this.typer.queue(text);
            }
        };

        NpcBox.onRemove = function onRemove() {
            this.ui.find('.next').hide();
            this.ui.find('.close').hide();
            this.ui.find('.content').hide();

            this.resetMessage();

            this.ui.find('.portrait').children().remove();

            _needCleanUp = false;
            _ownerID = 0;
        };

        // Add new method
        NpcBox.resetMessage = function resetMessage() {
            this.typer.reset();
            _messageChunks.clear();
            return this;
        };

        NpcBox.next = function next() {
            _needCleanUp = true;

            this.resetMessage();

            this.ui.find('.next').hide();
            this.onNextPressed(_ownerID);
        };

        NpcBox.close = function close() {
            _needCleanUp = true;
            this.ui.find('.close').hide();

            this.resetMessage();

            this.onClosePressed(_ownerID);
        };
    }

    // Apply enhancements immediately
    enhanceNpcBox();

    return NpcBox;
});
