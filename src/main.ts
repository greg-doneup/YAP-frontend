import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// Node.js polyfills for crypto libraries
import { Buffer } from 'buffer';

// Global polyfills
(window as any).global = window;
(window as any).process = {
  env: { NODE_ENV: environment.production ? 'production' : 'development' },
  browser: true,
  version: '16.0.0',
  versions: { node: '16.0.0' },
  platform: 'browser',
  nextTick: (fn: Function) => setTimeout(fn, 0),
  cwd: () => '/',
  exit: () => {},
  argv: []
};
(window as any).Buffer = Buffer;

// Register Swiper custom elements
import { register } from 'swiper/element/bundle';
register();

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
