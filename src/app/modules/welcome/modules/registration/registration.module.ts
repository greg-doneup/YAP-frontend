import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { IonicModule } from '@ionic/angular';
import { MaterialModule } from '../../../../shared/material/material.module';

import { RegistrationRoutingModule } from './registration-routing.module';
import { StandardRegistrationPage } from './pages/standard-registration.page';
import { WaitlistRegistrationPage } from './pages/waitlist-registration.page';
import { WalletRecoveryPage } from './pages/wallet-recovery.page';
import { RegistrationService } from './services/registration.service';
import { RegistrationAuthService } from './services/registration-auth.service';
import { CryptoBrowserService } from '../../../../shared/services/crypto-browser.service';
import { SecureWalletRegistrationService } from '../../../../services/secure-wallet-registration.service';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    IonicModule,
    MaterialModule,
    RegistrationRoutingModule
  ],
  declarations: [
    StandardRegistrationPage,
    WaitlistRegistrationPage,
    WalletRecoveryPage,
  ],
  providers: [
    RegistrationService,
    RegistrationAuthService,  
    CryptoBrowserService,
    SecureWalletRegistrationService
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class RegistrationModule { }
