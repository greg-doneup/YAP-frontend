import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PronunciationPracticePage } from './pronunciation-practice.page';

const routes: Routes = [
  {
    path: '',
    component: PronunciationPracticePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PronunciationPracticePageRoutingModule {}
