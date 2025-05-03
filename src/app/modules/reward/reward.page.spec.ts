import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RewardPage } from './reward.page';

describe('RewardPage', () => {
  let component: RewardPage;
  let fixture: ComponentFixture<RewardPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RewardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
