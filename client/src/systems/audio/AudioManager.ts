import type { GameSettings } from '@idle-rpg/shared';

class AudioManager {
  private soundContext: AudioContext | null = null;
  private musicAudio: HTMLAudioElement | null = null;
  private soundEffects: Map<string, HTMLAudioElement> = new Map();
  private currentSettings: GameSettings | null = null;

  /**
   * Initialize the audio context
   */
  initialize(): void {
    try {
      // Create audio context (will be created on first user interaction)
      this.soundContext = null; // Will be created lazily
    } catch (error) {
      console.warn('Audio context initialization failed:', error);
    }
  }

  /**
   * Get or create audio context (requires user interaction)
   */
  private getAudioContext(): AudioContext | null {
    if (!this.soundContext) {
      try {
        this.soundContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Failed to create audio context:', error);
        return null;
      }
    }
    return this.soundContext;
  }

  /**
   * Update settings and apply them
   */
  updateSettings(settings: GameSettings): void {
    this.currentSettings = settings;

    // Update music volume
    if (this.musicAudio) {
      this.musicAudio.volume = (settings.musicVolume ?? 100) / 100;
      if (!settings.musicEnabled) {
        this.musicAudio.pause();
      }
    }

    // Update sound effects volume
    this.soundEffects.forEach((audio) => {
      audio.volume = (settings.soundVolume ?? 100) / 100;
    });
  }

  /**
   * Play background music
   */
  playMusic(url: string, loop: boolean = true): void {
    if (!this.currentSettings?.musicEnabled) {
      return;
    }

    // Stop current music if playing
    this.stopMusic();

    try {
      this.musicAudio = new Audio(url);
      this.musicAudio.volume = (this.currentSettings.musicVolume ?? 100) / 100;
      this.musicAudio.loop = loop;
      this.musicAudio.play().catch((error) => {
        console.warn('Failed to play music:', error);
      });
    } catch (error) {
      console.warn('Failed to create music audio:', error);
    }
  }

  /**
   * Stop background music
   */
  stopMusic(): void {
    if (this.musicAudio) {
      this.musicAudio.pause();
      this.musicAudio.currentTime = 0;
      this.musicAudio = null;
    }
  }

  /**
   * Play a sound effect
   */
  playSound(url: string, volume: number = 1.0): void {
    if (!this.currentSettings?.soundEnabled) {
      return;
    }

    try {
      const audio = new Audio(url);
      const baseVolume = (this.currentSettings.soundVolume ?? 100) / 100;
      audio.volume = baseVolume * volume;
      audio.play().catch((error) => {
        console.warn('Failed to play sound:', error);
      });

      // Clean up after playback
      audio.addEventListener('ended', () => {
        audio.remove();
      });
    } catch (error) {
      console.warn('Failed to create sound audio:', error);
    }
  }

  /**
   * Play a sound effect using Web Audio API for better control
   */
  playSoundWithContext(url: string, volume: number = 1.0): void {
    if (!this.currentSettings?.soundEnabled) {
      return;
    }

    const context = this.getAudioContext();
    if (!context) {
      // Fallback to HTML5 audio
      this.playSound(url, volume);
      return;
    }

    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        const source = context.createBufferSource();
        const gainNode = context.createGain();
        const baseVolume = (this.currentSettings?.soundVolume ?? 100) / 100;

        source.buffer = audioBuffer;
        gainNode.gain.value = baseVolume * volume;
        source.connect(gainNode);
        gainNode.connect(context.destination);
        source.start(0);
      })
      .catch((error) => {
        console.warn('Failed to play sound with Web Audio API:', error);
        // Fallback to HTML5 audio
        this.playSound(url, volume);
      });
  }

  /**
   * Preload a sound effect
   */
  preloadSound(id: string, url: string): void {
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.soundEffects.set(id, audio);
    } catch (error) {
      console.warn(`Failed to preload sound ${id}:`, error);
    }
  }

  /**
   * Play a preloaded sound effect
   */
  playPreloadedSound(id: string, volume: number = 1.0): void {
    if (!this.currentSettings?.soundEnabled) {
      return;
    }

    const audio = this.soundEffects.get(id);
    if (!audio) {
      console.warn(`Sound effect ${id} not found`);
      return;
    }

    try {
      const baseVolume = (this.currentSettings.soundVolume ?? 100) / 100;
      audio.volume = baseVolume * volume;
      audio.currentTime = 0; // Reset to start
      audio.play().catch((error) => {
        console.warn(`Failed to play preloaded sound ${id}:`, error);
      });
    } catch (error) {
      console.warn(`Error playing preloaded sound ${id}:`, error);
    }
  }

  /**
   * Cleanup all audio resources
   */
  cleanup(): void {
    this.stopMusic();
    this.soundEffects.clear();
    if (this.soundContext) {
      this.soundContext.close().catch(console.warn);
      this.soundContext = null;
    }
  }
}

// Export singleton instance
export const audioManager = new AudioManager();

