/**
 * UI/Components/NpcBox/NpcBox.js
 *
 * NPC Box windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var jQuery      = require('Utils/jquery');
	var KEYS        = require('Controls/KeyEventHandler');
	var Renderer    = require('Renderer/Renderer');
	var UIManager   = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var htmlText    = require('text!./NpcBox.html');
	var cssText     = require('text!./NpcBox.css');
	var Typer				= require('Utils/Typer');


	/**
	 * Create NpcBox component
	 */
	var NpcBox = new UIComponent( 'NpcBox', htmlText, cssText, { htmlTarget: '#DialogueBox'} );



	/**
	 * @var {boolean} does the box need to be clean up?
	 */
	var _needCleanUp = false;


	/**
	 * @var {integer} NPC GID
	 */
	var _ownerID = 0;
	
	/**
	 * @var {string} How many messages are in the current batch
	 */
	var _textCount = 0;
	
	var _existingText = [];
	
	var _npcName = '';
	
	/**
	 * Initialize Component
	 */
	NpcBox.init = function init()
	{
		_textCount = 0;
		_existingText = [];
		
		this.ui.css({
			top: Math.max(100, Renderer.height/2 - 200),
			left: Math.max( Renderer.width/3, 20)
		});
		
		this.typer = new Typer(this.ui.find('#CurrentNpcText')[0], { typeSpeed: 40, audioSrc: '/static/sfx/typing.mp3' });

		// Bind mouse
		this.ui.find('.next').click( NpcBox.next.bind(this) );
		this.ui.find('.close').click( NpcBox.close.bind(this) );

		// Content do not drag window (official)
		// Will also fix the problem about the scrollbar
		this.ui.find('.content').mousedown(function(event){
			event.stopImmediatePropagation();
		});
		// this.draggable();
	};


	/**
	 * Once NPC Box is removed from HTML, clean up data
	 */
	NpcBox.onRemove = function onRemove()
	{
		this.ui.find('.next').hide();
		this.ui.find('.close').hide();
		this.ui.find('.content').hide();
		this.typer.reset();
		this.ui.find('.portrait').children().remove();

		_needCleanUp = false;
		_ownerID     = 0;
	};


	/**
	 * Add support for Enter key
	 */
	NpcBox.onKeyDown = function onKeyDown( event )
	{
		switch (event.which) {
			case KEYS.ENTER:
				if (this.ui.find('.next').is(':visible')) {
					event.preventDefault();
					this.next();
					break;
				}
				else if (this.ui.find('.close').is(':visible')) {
					event.preventDefault();
					this.close();
					break;
				}
				return true;

			case KEYS.ESCAPE:
				if (this.ui.find('.close').is(':visible')) {
					event.preventDefault();
					this.close();
					break;
				}
				return true;

			default:
				return true;
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Add text to box
	 *
	 * @param {string} text to display
	 * @param {number} gid - npc id
	 */
	NpcBox.setText = function SetText( text, gid )
	{
		var content = this.ui.find('.content');
		_ownerID    = gid;


		let container = this.ui.find('#CurrentNpcText');
		
		// If any message comes in with the format [text], it will be treated as the NPC's name
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

		this.typer.start(text);
	};


	/**
	 * Add next button
	 *
	 * @param {number} gid - npc id
	 */
	NpcBox.addNext = function addNext( gid )
	{
		_ownerID = gid;
		this.ui.find('.next').show();
	};


	/**
	 * Add close button
	 *
	 * @param {number} gid - npc id
	 */
	NpcBox.addClose = function addClose( gid )
	{
		_ownerID = gid;
		this.ui.find('.close').show();
	};


	/**
	 * Press "next" button
	 */
	NpcBox.next = function Next()
	{
		_needCleanUp = true;
		this.typer.reset();
		this.ui.find('.next').hide();
		this.onNextPressed( _ownerID );
	};


	/**
	 * Press "close" button
	 */
	NpcBox.close = function Close()
	{
		_needCleanUp = true;
		this.ui.find('.close').hide();
		this.typer.reset();
		this.onClosePressed( _ownerID );
	};
	
	NpcBox.resetMessage = function ResetMessage() {
		_existingText = [];
		this.ui.find('.content').children('span').text('');
		return this;
	}
	
	document.onkeydown = NpcBox.onKeyDown.bind(NpcBox);

	/**
	 * Callback
	 */
	NpcBox.onClosePressed = function OnClosePressed(){};
	NpcBox.onNextPressed  = function OnNextPressed(){};


	/**
	 * Create component based on view file and export it
	 */
	return UIManager.addComponent(NpcBox);
});
