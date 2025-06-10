import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { PronunciationPracticePageRoutingModule } from './pronunciation-practice-routing.module';
import { PronunciationPracticePage } from './pronunciation-practice.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PronunciationPracticePageRoutingModule,
    SharedModule
  ],
  declarations: [PronunciationPracticePage]
})
export class PronunciationPracticePageModule {}
