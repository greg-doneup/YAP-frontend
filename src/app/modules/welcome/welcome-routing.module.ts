import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WelcomePage } from './welcome.page';
// Update the import path to match the actual location of the CarouselPage
import { CarouselPage } from './pages/carousel.page';
import { ShowOnceGuard } from './guards/show-once.guard';

const routes: Routes = [
  {
    path: '',
    component: CarouselPage,
    canActivate: [ShowOnceGuard],
  },
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WelcomePageRoutingModule {}
