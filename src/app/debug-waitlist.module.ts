import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { DebugWaitlistComponent } from './debug-waitlist.component';

const routes: Routes = [
  {
    path: '',
    component: DebugWaitlistComponent
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes)
  ],
  declarations: [DebugWaitlistComponent]
})
export class DebugWaitlistModule { }
