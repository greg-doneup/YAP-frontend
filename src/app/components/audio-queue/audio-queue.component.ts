import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AudioService, AudioQueueItem, AudioTrack } from '../../services/audio.service';

@Component({
  selector: 'app-audio-queue',
  templateUrl: './audio-queue.component.html',
  styleUrls: ['./audio-queue.component.scss']
})
export class AudioQueueComponent implements OnInit, OnDestroy {
  queueItems: AudioQueueItem[] = [];
  isVisible = false;
  
  private subscriptions: Subscription[] = [];

  constructor(private audioService: AudioService) {}

  ngOnInit() {
    this.subscriptions.push(
      this.audioService.queueUpdated$.subscribe(queue => {
        this.queueItems = queue;
        this.isVisible = queue.length > 0;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  removeFromQueue(track: AudioTrack) {
    this.audioService.removeFromQueue(track.id);
  }

  clearQueue() {
    this.audioService.clearQueue();
  }

  toggleQueue() {
    this.isVisible = !this.isVisible;
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'danger';
      case 'normal': return 'primary';
      case 'low': return 'medium';
      default: return 'medium';
    }
  }

  getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'high': return 'arrow-up';
      case 'normal': return 'remove';
      case 'low': return 'arrow-down';
      default: return 'remove';
    }
  }

  trackByFn(index: number, item: AudioQueueItem): string {
    return item.track.id;
  }
}
