import { Component, Input, OnInit } from '@angular/core';

export interface DailyTrackerData {
  level: string;
  levelProgress: number; // percentage 0-100
  streak: number;
  lessonsToday: number;
  dailyGoal: number;
  pointsEarned: number;
}

@Component({
  selector: 'app-daily-tracker',
  templateUrl: './daily-tracker.component.html',
  styleUrls: ['./daily-tracker.component.scss']
})
export class DailyTrackerComponent implements OnInit {
  @Input() trackerData: DailyTrackerData = {
    level: 'A1 - Beginner',
    levelProgress: 0,
    streak: 0,
    lessonsToday: 0,
    dailyGoal: 5,
    pointsEarned: 0
  };

  constructor() { }

  ngOnInit() { }

  getStreakMessage(): string {
    if (this.trackerData.streak === 0) {
      return 'Start your streak today!';
    } else if (this.trackerData.streak === 1) {
      return '1 day streak - keep it going!';
    } else {
      return `${this.trackerData.streak} day streak - amazing!`;
    }
  }

  getGoalProgress(): number {
    return Math.min((this.trackerData.lessonsToday / this.trackerData.dailyGoal) * 100, 100);
  }

  getGoalMessage(): string {
    const remaining = Math.max(0, this.trackerData.dailyGoal - this.trackerData.lessonsToday);
    if (remaining === 0) {
      return '🎉 Daily goal completed!';
    } else if (remaining === 1) {
      return '1 more lesson to reach your goal!';
    } else {
      return `${remaining} more lessons to reach your goal`;
    }
  }
}
