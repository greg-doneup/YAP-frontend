import { Component, EventEmitter, Output } from '@angular/core';
import { SettingsService } from '../../../../core/settings/settings.service';

@Component({
  selector: 'app-first-lesson-tooltip',
  template: `
    <ion-popover isOpen="true">
      <ng-template>
        <div class="ion-padding">
          <h3>Tip</h3>
          <p>Tap here to start your first speaking lesson!</p>
          <ion-button size="small" (click)="close()">Got it</ion-button>
        </div>
      </ng-template>
    </ion-popover>
  `,
})
export class FirstLessonTooltipComponent {
  @Output() closed = new EventEmitter<void>();
  constructor(private settings: SettingsService) {}

  async close() {
    await this.settings.set('firstLessonTipShown', true);
    this.closed.emit();
  }
}
