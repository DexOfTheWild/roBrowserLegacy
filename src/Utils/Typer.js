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
      this.sentenceDelimiters = ['.', ',', '!', '?', ';', ':'];
  
      // Prepare multiple audio instances if provided
      if (this.audioSrc) {
        this.audioPlayers = Array.from({ length: this.audioInstances }, () => new Audio(this.audioSrc));
        this.currentAudioIndex = 0;
      }
    }
  
    typeChar() {
      if (this.currentIndex < this.text.length) {
        const char = this.text[this.currentIndex];
        this.targetNode.textContent += char;
        this.currentIndex++;
  
        // Play audio if provided
        if (this.audioSrc) {
          const audio = this.audioPlayers[this.currentAudioIndex];
          audio.currentTime = 0; // Reset the audio to the beginning
          audio.play();
          this.currentAudioIndex = (this.currentAudioIndex + 1) % this.audioInstances;
        }
  
        let delay = this.typeSpeed;
        if (this.sentenceDelimiters.includes(char)) {
          delay *= 3; // Increase delay for sentence delimiters
        }
  
        this.currentTimeout = setTimeout(() => this.typeChar(), delay);
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
      this.targetNode.textContent = '';
      this.currentIndex = 0;
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
  }  
    
  return Typer;
});
