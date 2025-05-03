import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { VoiceService } from '../../../../core/voice/voice.service';   // assume exists

@Component({
  selector: 'app-mic-permission',
  templateUrl: './mic-permission.component.html',
  styleUrls: ['./mic-permission.component.scss'],
})
export class MicPermissionComponent {
  requesting = false;
  error?: string;

  constructor(
    private voice: VoiceService,
    private modalCtrl: ModalController
  ) {}

  async allow(): Promise<void> {
    this.requesting = true;
    const ok = await this.voice.requestPermission();
    this.requesting = false;
    if (ok) {
      this.modalCtrl.dismiss();
    } else {
      this.error = 'Microphone permission is required for pronunciation checks.';
    }
  }
}
