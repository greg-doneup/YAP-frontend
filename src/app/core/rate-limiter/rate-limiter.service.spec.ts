import { TestBed } from '@angular/core/testing';

import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RateLimiterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
