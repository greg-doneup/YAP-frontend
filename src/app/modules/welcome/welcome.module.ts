import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { IonicModule } from '@ionic/angular';

import { WelcomePageRoutingModule } from './welcome-routing.module';

import { WelcomePage } from './welcome.page';
import { CarouselPage } from './pages/carousel.page';
import { IntroPage } from './pages/intro.page';
import { WaitlistSignupPage } from './pages/waitlist-signup.page';
import { WaitlistRecoveryPage } from './pages/waitlist-recovery.page';
import { MicPermissionComponent } from './components/mic-permissio/mic-permission.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    IonicModule,
    WelcomePageRoutingModule
  ],
  declarations: [
    WelcomePage,
    CarouselPage,
    IntroPage,
    WaitlistSignupPage,
    WaitlistRecoveryPage,
    MicPermissionComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class WelcomePageModule {}
