import { Injectable } from '@angular/core';
import { CanActivate, CanDeactivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SettingsService } from '../../../core/settings/settings.service';
import { Observable } from 'rxjs';
import { CarouselPage } from '../pages/carousel.page';

@Injectable({ providedIn: 'root' })
export class ShowOnceGuard implements CanActivate, CanDeactivate<CarouselPage> {
  constructor(private settings: SettingsService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    const shown = await this.settings.get<boolean>('welcomeShown');
    if (shown) {
      this.router.navigateByUrl('/home', { replaceUrl: true });
      return false;
    }
    return true;
  }

  async canDeactivate(
    component: CarouselPage,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState?: RouterStateSnapshot
  ): Promise<boolean> {
    await this.settings.set('welcomeShown', true);
    return true;
  }
}
