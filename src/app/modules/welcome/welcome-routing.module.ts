import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WelcomePage } from './welcome.page';
import { IntroPage } from './pages/intro.page';
import { CarouselPage } from './pages/carousel.page';
import { ShowOnceGuard } from './guards/show-once.guard';

const routes: Routes = [
  {
    path: '',
    component: IntroPage,
    // Temporarily disable guard for testing
    // canActivate: [ShowOnceGuard],
  },
  {
    path: 'legacy',
    component: CarouselPage,
  },
  {
    path: 'registration',
    loadChildren: () => import('./modules/registration/registration.module').then(m => m.RegistrationModule)
  },
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WelcomePageRoutingModule {}
