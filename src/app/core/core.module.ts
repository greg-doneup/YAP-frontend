//vital modules import
import { NgModule, CUSTOM_ELEMENTS_SCHEMA, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';

// layout services

// tools
import { GsapService } from './gsap/gsap.service';

@NgModule({
  imports: [
    CommonModule
  ],
  providers: [
    // SDK services
    
    
    // Layout services
    
    
    // Tools
    GsapService,
  ],
  exports: [
    CommonModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CoreModule {
	static forRoot(): ModuleWithProviders<CoreModule> {
		return {
			ngModule: CoreModule,
			providers: [
				// SDK services
				
				
				// Layout services
				
				
				// Tools
				GsapService
			]
		}
	}
}
