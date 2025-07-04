import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StandardRegistrationPage } from './pages/standard-registration.page';
import { WaitlistRegistrationPage } from './pages/waitlist-registration.page';
import { WalletRecoveryPage } from './pages/wallet-recovery.page';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'standard',
    pathMatch: 'full'
  },
  {
    path: 'standard',
    component: StandardRegistrationPage
  },
  {
    path: 'waitlist',
    component: WaitlistRegistrationPage
  },
  {
    path: 'recovery',
    component: WalletRecoveryPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RegistrationRoutingModule {}
