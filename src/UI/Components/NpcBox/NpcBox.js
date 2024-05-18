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
		this.ui.find('.content').text('');

		_needCleanUp = false;
		_ownerID     = 0;

		// Cutin system
		var cutin = document.getElementById('cutin');
		if (cutin) {
			document.body.removeChild( cutin );
		}
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


		let container = '<span/>';
		
		if (_textCount === 0 && text.startsWith('[') && text.endsWith(']')) {
			if (content.find('#NpcName').length === 0) {
				text = text.substring(1, text.length - 1);
				_npcName = text;
				container = '<h1 id="NpcName" />';
			} else {
				return;
			}
		}
		
		if (_needCleanUp) {
			_needCleanUp = false;
			_textCount = 0;
		}
		
		content.append( jQuery(container).text(text) );
		_textCount++;
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
		_textCount = 0;
		if (this.ui.find('.content').text() !== '') {
			_existingText.push(this.ui.find('.content').text());
		}
		this.ui.find('.next').hide();
		this.onNextPressed( _ownerID );
	};


	/**
	 * Press "close" button
	 */
	NpcBox.close = function Close()
	{
		_needCleanUp = true;
		_textCount = 0;
		this.ui.find('.close').hide();
		this.onClosePressed( _ownerID );
	};
	
	NpcBox.resetMessage = function ResetMessage() {
		_textCount = 0;
		_existingText = [];
		this.ui.find('.content').children('span').remove();
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
