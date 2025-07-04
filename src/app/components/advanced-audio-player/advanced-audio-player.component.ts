import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { Subscription } from 'rxjs';
import WaveSurfer from 'wavesurfer.js';
import { AudioService, AudioTrack, AudioState } from '../../services/audio.service';

@Component({
  selector: 'app-advanced-audio-player',
  templateUrl: './advanced-audio-player.component.html',
  styleUrls: ['./advanced-audio-player.component.scss']
})
export class AdvancedAudioPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('waveformContainer', { static: true }) waveformContainer!: ElementRef;
  @Input() track?: AudioTrack;
  @Input() showWaveform = true;
  @Input() showControls = true;
  @Input() showVolumeControl = true;
  @Input() showSpeedControl = true;
  @Input() autoPlay = false;
  @Input() compact = false;
  
  @Output() trackEnded = new EventEmitter<AudioTrack>();
  @Output() playbackError = new EventEmitter<{ track: AudioTrack; error: string }>();

  // State
  audioState: AudioState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    playbackRate: 1.0,
    isLoading: false
  };

  // WaveSurfer instance
  wavesurfer?: WaveSurfer;
  private subscriptions: Subscription[] = [];

  // UI state
  isDragging = false;
  showVolumeSlider = false;
  showSpeedSlider = false;

  // Predefined playback speeds
  playbackSpeeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  constructor(private audioService: AudioService) {}

  ngOnInit() {
    this.subscribeToAudioState();
    
    if (this.showWaveform) {
      this.initializeWaveform();
    }

    if (this.track && this.autoPlay) {
      this.playTrack();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.destroyWaveform();
  }

  private subscribeToAudioState() {
    // Subscribe to audio state changes
    this.subscriptions.push(
      this.audioService.audioState$.subscribe(state => {
        this.audioState = state;
        this.updateWaveformProgress();
      })
    );

    // Subscribe to track ended events
    this.subscriptions.push(
      this.audioService.trackEnded$.subscribe(track => {
        if (track.id === this.track?.id) {
          this.trackEnded.emit(track);
        }
      })
    );

    // Subscribe to playback errors
    this.subscriptions.push(
      this.audioService.playbackError$.subscribe(({ track, error }) => {
        if (track.id === this.track?.id) {
          this.playbackError.emit({ track, error });
        }
      })
    );
  }

  private initializeWaveform() {
    if (!this.waveformContainer || !this.track) return;

    try {
      this.wavesurfer = WaveSurfer.create({
        container: this.waveformContainer.nativeElement,
        waveColor: '#4372c4',
        progressColor: '#ffdb45',
        cursorColor: '#ffffff',
        height: this.compact ? 40 : 80,
        normalize: true,
        hideScrollbar: true,
        barWidth: 2,
        barGap: 1,
        backend: 'MediaElement' // Better mobile support
      });

      // Load audio into waveform
      if (this.track.url) {
        this.wavesurfer.load(this.track.url);
      }

      // Waveform event handlers
      this.wavesurfer.on('ready', () => {
        console.log('Waveform ready for track:', this.track?.id);
      });

      this.wavesurfer.on('loading', (percent: number) => {
        console.log('Waveform loading:', percent + '%');
      });

      this.wavesurfer.on('error', (error: Error) => {
        console.error('Waveform error:', error);
      });

      // Click on waveform to seek
      this.wavesurfer.on('click', (progress: number) => {
        if (this.track && this.audioState.duration > 0) {
          const seekTime = progress * this.audioState.duration;
          this.audioService.seek(seekTime);
        }
      });

    } catch (error) {
      console.error('Failed to initialize waveform:', error);
    }
  }

  private updateWaveformProgress() {
    if (this.wavesurfer && this.audioState.duration > 0) {
      const progress = this.audioState.currentTime / this.audioState.duration;
      this.wavesurfer.seekTo(progress);
    }
  }

  private destroyWaveform() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = undefined;
    }
  }

  // Playback controls
  async playTrack() {
    if (!this.track) return;

    await this.audioService.playTrack(this.track, {
      volume: this.audioState.volume,
      playbackRate: this.audioState.playbackRate
    });
  }

  togglePlayPause() {
    if (this.audioState.isPlaying) {
      this.audioService.pause();
    } else if (this.audioState.currentTrack?.id === this.track?.id) {
      this.audioService.resume();
    } else {
      this.playTrack();
    }
  }

  stop() {
    this.audioService.stop();
  }

  seek(event: any) {
    if (!this.audioState.duration) return;

    const rect = event.target.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const seekTime = percent * this.audioState.duration;
    
    this.audioService.seek(seekTime);
  }

  // Volume control
  onVolumeChange(event: any) {
    const volume = parseFloat(event.target.value) / 100;
    this.audioService.setVolume(volume);
  }

  toggleMute() {
    const newVolume = this.audioState.volume > 0 ? 0 : 1;
    this.audioService.setVolume(newVolume);
  }

  // Speed control
  onSpeedChange(speed: number) {
    this.audioService.setPlaybackRate(speed);
    this.showSpeedSlider = false;
  }

  // Progress bar interaction
  onProgressMouseDown() {
    this.isDragging = true;
  }

  onProgressMouseUp() {
    this.isDragging = false;
  }

  // Utility methods
  formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  getProgressPercent(): number {
    if (!this.audioState.duration) return 0;
    return (this.audioState.currentTime / this.audioState.duration) * 100;
  }

  getVolumeIcon(): string {
    if (this.audioState.volume === 0) return 'volume-mute';
    if (this.audioState.volume < 0.5) return 'volume-low';
    return 'volume-high';
  }

  getPlayButtonIcon(): string {
    if (this.audioState.isLoading) return 'hourglass';
    if (this.audioState.isPlaying && this.audioState.currentTrack?.id === this.track?.id) {
      return 'pause';
    }
    return 'play';
  }

  // Loading state methods
  get isCurrentTrack(): boolean {
    return this.audioState.currentTrack?.id === this.track?.id;
  }

  get canPlay(): boolean {
    return !!this.track && !this.audioState.isLoading;
  }
}
