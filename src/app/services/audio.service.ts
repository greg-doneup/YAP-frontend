import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Howl, Howler } from 'howler';
import { Storage } from '@ionic/storage-angular';

export interface AudioTrack {
  id: string;
  url: string;
  title: string;
  duration?: number;
  cached?: boolean;
  base64Data?: string;
  type: 'ai-response' | 'user-recording' | 'tts-generated';
}

export interface AudioState {
  isPlaying: boolean;
  currentTrack?: AudioTrack;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isLoading: boolean;
  error?: string;
}

export interface AudioQueueItem {
  track: AudioTrack;
  priority: 'high' | 'normal' | 'low';
  autoPlay: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private currentSound?: Howl;
  private audioQueue: AudioQueueItem[] = [];
  private isProcessingQueue = false;

  // State management
  private audioStateSubject = new BehaviorSubject<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    playbackRate: 1.0,
    isLoading: false
  });

  public audioState$ = this.audioStateSubject.asObservable();

  // Events
  private trackEndedSubject = new Subject<AudioTrack>();
  private playbackErrorSubject = new Subject<{ track: AudioTrack; error: string }>();
  private queueUpdatedSubject = new Subject<AudioQueueItem[]>();

  public trackEnded$ = this.trackEndedSubject.asObservable();
  public playbackError$ = this.playbackErrorSubject.asObservable();
  public queueUpdated$ = this.queueUpdatedSubject.asObservable();

  constructor(private storage: Storage) {
    this.initializeStorage();
    this.setupGlobalSettings();
  }

  private async initializeStorage() {
    await this.storage.create();
  }

  private setupGlobalSettings() {
    // Set global volume
    Howler.volume(1.0);
    
    // Mobile optimizations
    Howler.autoUnlock = true;
    Howler.autoSuspend = false;
  }

  /**
   * Play audio track with advanced features
   */
  async playTrack(track: AudioTrack, options: {
    volume?: number;
    playbackRate?: number;
    startTime?: number;
    autoQueue?: boolean;
  } = {}): Promise<void> {
    try {
      this.updateState({ isLoading: true, error: undefined });

      // Stop current playback
      if (this.currentSound) {
        this.currentSound.stop();
        this.currentSound.unload();
      }

      // Get audio source (cached or URL)
      const audioSrc = await this.getAudioSource(track);

      // Create Howl instance with advanced options
      this.currentSound = new Howl({
        src: [audioSrc],
        format: ['wav', 'mp3', 'opus'],
        html5: true, // Use HTML5 audio for better mobile support
        preload: true,
        volume: options.volume ?? this.audioStateSubject.value.volume,
        rate: options.playbackRate ?? this.audioStateSubject.value.playbackRate,
        
        // Event handlers
        onload: () => {
          const duration = this.currentSound?.duration() || 0;
          this.updateState({
            isLoading: false,
            currentTrack: track,
            duration,
            currentTime: 0
          });

          // Start playback from specified time
          if (options.startTime) {
            this.currentSound?.seek(options.startTime);
          }
        },

        onplay: () => {
          this.updateState({ isPlaying: true });
          this.startProgressTracking();
        },

        onpause: () => {
          this.updateState({ isPlaying: false });
        },

        onstop: () => {
          this.updateState({ 
            isPlaying: false, 
            currentTime: 0 
          });
        },

        onend: () => {
          this.updateState({ 
            isPlaying: false, 
            currentTime: 0 
          });
          this.trackEndedSubject.next(track);
          
          // Process next in queue if auto-queue is enabled
          if (options.autoQueue) {
            this.processNextInQueue();
          }
        },

        onloaderror: (id: any, error: any) => {
          const errorMsg = `Failed to load audio: ${error}`;
          this.updateState({ 
            isLoading: false, 
            error: errorMsg 
          });
          this.playbackErrorSubject.next({ track, error: errorMsg });
        },

        onplayerror: (id: any, error: any) => {
          const errorMsg = `Playback error: ${error}`;
          this.updateState({ error: errorMsg });
          this.playbackErrorSubject.next({ track, error: errorMsg });
          
          // Try to recover by reloading
          this.retryPlayback(track, options);
        }
      });

      // Start playback
      this.currentSound.play();

    } catch (error) {
      const errorMsg = `Audio service error: ${error}`;
      this.updateState({ 
        isLoading: false, 
        error: errorMsg 
      });
      this.playbackErrorSubject.next({ track, error: errorMsg });
    }
  }

  /**
   * Play TTS-generated audio from base64 data
   */
  async playTTSAudio(base64Data: string, metadata: {
    title: string;
    language: string;
    cefrLevel: string;
  }): Promise<void> {
    const track: AudioTrack = {
      id: `tts-${Date.now()}`,
      url: `data:audio/wav;base64,${base64Data}`,
      title: metadata.title,
      type: 'tts-generated',
      base64Data
    };

    // Cache TTS audio for reuse
    await this.cacheAudioTrack(track);

    await this.playTrack(track, { autoQueue: true });
  }

  /**
   * Add track to playback queue
   */
  addToQueue(track: AudioTrack, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    const queueItem: AudioQueueItem = {
      track,
      priority,
      autoPlay: true
    };

    // Insert based on priority
    if (priority === 'high') {
      this.audioQueue.unshift(queueItem);
    } else {
      this.audioQueue.push(queueItem);
    }

    this.queueUpdatedSubject.next([...this.audioQueue]);

    // Start processing if queue was empty
    if (!this.isProcessingQueue && this.audioQueue.length === 1) {
      this.processNextInQueue();
    }
  }

  /**
   * Process next item in queue
   */
  private async processNextInQueue(): Promise<void> {
    if (this.audioQueue.length === 0 || this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    const nextItem = this.audioQueue.shift();

    if (nextItem) {
      await this.playTrack(nextItem.track, { autoQueue: true });
      this.queueUpdatedSubject.next([...this.audioQueue]);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Playback controls
   */
  pause(): void {
    if (this.currentSound && this.audioStateSubject.value.isPlaying) {
      this.currentSound.pause();
    }
  }

  resume(): void {
    if (this.currentSound && !this.audioStateSubject.value.isPlaying) {
      this.currentSound.play();
    }
  }

  stop(): void {
    if (this.currentSound) {
      this.currentSound.stop();
    }
  }

  seek(position: number): void {
    if (this.currentSound) {
      this.currentSound.seek(position);
      this.updateState({ currentTime: position });
    }
  }

  setVolume(volume: number): void {
    volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
    
    if (this.currentSound) {
      this.currentSound.volume(volume);
    }
    
    Howler.volume(volume);
    this.updateState({ volume });
  }

  setPlaybackRate(rate: number): void {
    rate = Math.max(0.5, Math.min(2.0, rate)); // Clamp between 0.5x and 2x
    
    if (this.currentSound) {
      this.currentSound.rate(rate);
    }
    
    this.updateState({ playbackRate: rate });
  }

  /**
   * Audio caching management
   */
  private async cacheAudioTrack(track: AudioTrack): Promise<void> {
    try {
      const cacheKey = `audio_cache_${track.id}`;
      await this.storage.set(cacheKey, {
        track,
        cachedAt: new Date().toISOString()
      });
      
      track.cached = true;
    } catch (error) {
      console.warn('Failed to cache audio track:', error);
    }
  }

  private async getCachedTrack(trackId: string): Promise<AudioTrack | null> {
    try {
      const cacheKey = `audio_cache_${trackId}`;
      const cachedData = await this.storage.get(cacheKey);
      
      if (cachedData && cachedData.track) {
        return cachedData.track;
      }
    } catch (error) {
      console.warn('Failed to retrieve cached track:', error);
    }
    
    return null;
  }

  private async getAudioSource(track: AudioTrack): Promise<string> {
    // Check if we have base64 data (TTS generated)
    if (track.base64Data) {
      return `data:audio/wav;base64,${track.base64Data}`;
    }

    // Check cache first
    const cachedTrack = await this.getCachedTrack(track.id);
    if (cachedTrack && cachedTrack.base64Data) {
      return `data:audio/wav;base64,${cachedTrack.base64Data}`;
    }

    // Return original URL
    return track.url;
  }

  /**
   * Clear audio cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await this.storage.keys();
      const audioCacheKeys = keys.filter(key => key.startsWith('audio_cache_'));
      
      for (const key of audioCacheKeys) {
        await this.storage.remove(key);
      }
      
      console.log(`Cleared ${audioCacheKeys.length} cached audio files`);
    } catch (error) {
      console.error('Failed to clear audio cache:', error);
    }
  }

  /**
   * Progress tracking
   */
  private startProgressTracking(): void {
    const updateProgress = () => {
      if (this.currentSound && this.audioStateSubject.value.isPlaying) {
        const currentTime = this.currentSound.seek() as number;
        this.updateState({ currentTime });
        
        // Continue tracking
        requestAnimationFrame(updateProgress);
      }
    };
    
    requestAnimationFrame(updateProgress);
  }

  /**
   * Error recovery
   */
  private async retryPlayback(track: AudioTrack, options: any, retryCount = 0): Promise<void> {
    if (retryCount >= 3) {
      console.error('Max retry attempts reached for track:', track.id);
      return;
    }

    console.log(`Retrying playback for track ${track.id}, attempt ${retryCount + 1}`);
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
    
    try {
      await this.playTrack(track, options);
    } catch (error) {
      await this.retryPlayback(track, options, retryCount + 1);
    }
  }

  /**
   * Queue management
   */
  clearQueue(): void {
    this.audioQueue = [];
    this.queueUpdatedSubject.next([]);
  }

  getQueue(): AudioQueueItem[] {
    return [...this.audioQueue];
  }

  removeFromQueue(trackId: string): void {
    this.audioQueue = this.audioQueue.filter(item => item.track.id !== trackId);
    this.queueUpdatedSubject.next([...this.audioQueue]);
  }

  /**
   * State management
   */
  private updateState(updates: Partial<AudioState>): void {
    const currentState = this.audioStateSubject.value;
    this.audioStateSubject.next({ ...currentState, ...updates });
  }

  getCurrentState(): AudioState {
    return this.audioStateSubject.value;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound.unload();
    }
    
    this.clearQueue();
    Howler.unload();
  }
}
