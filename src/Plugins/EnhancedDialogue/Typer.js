define(function(){
	'use strict';
  class Typer {
    constructor(targetNode, { typeSpeed = 50, audioSrc = null, audioInstances = 5 } = {}) {
      this.targetNode = targetNode;
      this.typeSpeed = typeSpeed;
      this.audioSrc = audioSrc;
      this.audioInstances = audioInstances;
      this.currentIndex = 0;
      this.isTyping = false;
      this.currentTimeout = null;
      this.completionListeners = [];
      this.sentenceDelimiters = new Set(['.', ',', '!', '?', ';', ':']);
      this.textQueue = '';
  
      // Prepare multiple audio instances if provided
      if (this.audioSrc) {
        this.audioPlayers = Array.from({ length: this.audioInstances }, () => new Audio(this.audioSrc));
        this.currentAudioIndex = 0;
      }

      // Create text node once for better performance
      this.textNode = document.createTextNode('');
      this.targetNode.appendChild(this.textNode);
    }
  
    typeChar() {
      // If there is text to type, type it
      if (this.currentIndex < this.text.length) {
        const char = this.text[this.currentIndex];
        this.textNode.nodeValue += char;
        this.currentIndex++;
  
        // Play audio if provided
        if (this.audioSrc) {
          const audio = this.audioPlayers[this.currentAudioIndex];
          // Only reset and play audio for non-space characters
          if (char !== ' ') {
            audio.currentTime = 0;
            audio.volume = 0.15;
            audio.play().catch(() => { }); // Ignore failed playback
          }
          this.currentAudioIndex = (this.currentAudioIndex + 1) % this.audioInstances;
        }
  
        let delay = this.typeSpeed;
        // Use Set.has() instead of Array.includes()
        if (this.sentenceDelimiters.has(char)) {
          delay *= 3;
        }
        // Use requestAnimationFrame for better performance
        this.currentTimeout = setTimeout(() => {
          requestAnimationFrame(() => this.typeChar());
        }, delay);

        // If the textQueue has more text added, add it to the current text
      } else if (this.textQueue.length > 0) {
        this.text += this.textQueue;
        this.textQueue = '';
        this.typeChar();
      } else {
        this.isTyping = false;
        this.resolveCompletionListeners();
      }
    }
  
    start(text) {
      if (this.isTyping) {
        this.interrupt();
      }
  
      this.text = text;
      this.currentIndex = 0;
      this.isTyping = true;
  
      return new Promise((resolve) => {
        this.completionListeners.push(resolve);
        this.typeChar();
      });
    }
  
    interrupt() {
      if (this.currentTimeout) {
        clearTimeout(this.currentTimeout);
        this.currentTimeout = null;
      }
      this.isTyping = false;
      this.textQueue = '';
      this.resolveCompletionListeners();
    }
  
    reset() {
      this.interrupt();
      // Remove old text node
      if (this.textNode.parentNode) {
        this.textNode.parentNode.removeChild(this.textNode);
      }
      // Create fresh text node and append it
      this.textNode = document.createTextNode('');
      this.targetNode.appendChild(this.textNode);
      this.currentIndex = 0;
    }

    /**
     * Finish typing and set the final text
     */
    finish() {
      if (this.isTyping) {
        this.interrupt();
        this.textNode.nodeValue = this.text;
      }
    }

    resolveCompletionListeners() {
      while (this.completionListeners.length > 0) {
        const resolve = this.completionListeners.shift();
        resolve();
      }
    }

    onCompletion() {
      if (!this.isTyping) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        this.completionListeners.push(resolve);
      });
    }

    /**
     * Queue additional text to be typed after the current text
     * @param {string} text - The text to append
     * @returns {Promise} Resolves when all text (including queued) is typed
     */
    queue(text) {
      if (!this.isTyping) {
        return this.start(text);
      }
      this.textQueue += text;
      return this.onCompletion();
    }
  }  
    
  return Typer;
});
