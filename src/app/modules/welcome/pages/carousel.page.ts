import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MicPermissionComponent } from '../components/mic-permissio/mic-permission.component';

@Component({
  selector: 'app-carousel',
  templateUrl: './carousel.page.html',
  styleUrls: ['./carousel.page.scss'],
})
export class CarouselPage {
  constructor(private modalCtrl: ModalController) {}

  /** Called from final slide “Get Started” button */
  async next(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: MicPermissionComponent,
      backdropDismiss: false,
      cssClass: 'mic-permission-modal',
    });
    await modal.present();
  }
}
