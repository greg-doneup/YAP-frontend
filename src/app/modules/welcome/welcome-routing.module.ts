import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WelcomePage } from './welcome.page';
import { IntroPage } from './pages/intro.page';
import { CarouselPage } from './pages/carousel.page';
import { WaitlistSignupPage } from './pages/waitlist-signup.page';
import { WaitlistRecoveryPage } from './pages/waitlist-recovery.page';
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
    path: 'waitlist-signup',
    component: WaitlistSignupPage,
  },
  {
    path: 'waitlist-recovery',
    component: WaitlistRecoveryPage,
  },
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WelcomePageRoutingModule {}
