import { Injectable } from '@angular/core';
import * as gsap from "gsap";

import * as $ from 'jquery';

@Injectable({
  providedIn: 'root'
})
export class GsapService {

  public hideRightMenu(e: any, xam: any, aua: any, etw: any, secea: any, scxam: any) {
    let tl = gsap.gsap.timeline();

    tl.set(e, { x: xam, autoAlpha: aua })
      .set(etw, { autoAlpha: secea, x: scxam });
  }

  public openRightMenu(e: any, dur: any, aua: any, etw: any, oxam: any, osaua: any, tdur: any, xam: any, saua: any, dly: any, ea: any) {
    let tl = gsap.gsap.timeline();

    tl.to(e, { duration: dur, autoAlpha: aua })
      .fromTo(etw, { x: oxam, autoAlpha: osaua }, { duration: tdur, x: xam, autoAlpha: saua, delay: dly, ease: ea });
  }

  public closeRightMenu(e: any, dur: any, xam: any, aua: any, ea: any, etw: any, tdur: any, secea: any) {
    let tl = gsap.gsap.timeline();

    tl.to(e, { duration: dur, x: xam, autoAlpha: aua, ease: ea })
      .to(etw, { duration: tdur, autoAlpha: secea });
  }

  public hideLeftMenu(e: any, xam: any, aua: any, etw: any, secea: any, scxam: any) {
    let tl = gsap.gsap.timeline();

    tl.set(e, { x: xam, autoAlpha: aua })
      .set(etw, { autoAlpha: secea, x: scxam });
  }

  public openLeftMenu(e: any, dur: any, aua: any, etw: any, oxam: any, osaua: any, tdur: any, xam: any, saua: any, dly: any, ea: any) {
    let tl = gsap.gsap.timeline();

    tl.to(e, { duration: dur, autoAlpha: aua })
      .fromTo(etw, { x: oxam, autoAlpha: osaua }, { duration: tdur, x: xam, autoAlpha: saua, delay: dly, ease: ea });
  }
}
