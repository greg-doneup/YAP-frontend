import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
})
export class WelcomePage implements OnInit {

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    // Double check authentication status on page load
    // This provides an additional layer of protection for redirecting authenticated users
    if (this.authService.isLoggedIn && this.authService.authToken) {
      console.log('Welcome page detected authenticated user, redirecting to dashboard');
      this.router.navigate(['/dashboard']);
    } else {
      console.log('Welcome page - user is not authenticated');
    }
  }

}
