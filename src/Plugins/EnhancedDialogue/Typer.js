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
            audio.volume = 0.35;
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
      this.resolveCompletionListeners();
    }
  
    reset() {
      this.interrupt();
      this.textNode.nodeValue = '';
      this.currentIndex = 0;
    }
  
    resolveCompletionListeners() {
      while (this.completionListeners.length > 0) {
        const resolve = this.completionListeners.shift();
        resolve();
      }
    }

    /**
     * Finish typing and set the text
     */
    finish() {
      if (this.isTyping) {
        this.interrupt();
        this.textNode.nodeValue = this.text;
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
  }  
    
  return Typer;
});
