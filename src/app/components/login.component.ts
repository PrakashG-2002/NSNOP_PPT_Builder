import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="login-wrap">
    <div class="login-card">
      <div class="logo">NSNOP <span>PPT To Website Builder</span></div>
      <h1>Sign in</h1>
      <p class="sub">Enter your credentials to continue.</p>

      <label class="field">
        <span>Username</span>
        <input type="text" [(ngModel)]="username" placeholder="admin"
               (keyup.enter)="submit()" autocomplete="username" />
      </label>

      <label class="field">
        <span>Password</span>
        <input [type]="show ? 'text' : 'password'" [(ngModel)]="password"
               placeholder="••••••••" (keyup.enter)="submit()" autocomplete="current-password" />
        <button type="button" class="peek" (click)="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
      </label>

      <div class="error" *ngIf="error">{{ error }}</div>

      <button class="btn" (click)="submit()">Sign in</button>
    </div>
  </div>
  `,
  styles: [`
    .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(160deg,#27408B 0%,#15296b 100%);padding:20px}
    .login-card{background:#fff;border-radius:20px;padding:40px 36px;width:100%;max-width:400px;
      box-shadow:0 24px 60px rgba(0,0,0,.25)}
    .logo{font-weight:800;font-size:1.05rem;color:#27408B;margin-bottom:24px}
    .logo span{font-weight:500;opacity:.8;margin-left:4px;font-size:.92rem}
    h1{color:#15203f;font-size:1.6rem;font-weight:800;margin:0 0 6px}
    .sub{color:#5b6378;margin:0 0 24px;font-size:.95rem}
    .field{display:block;margin-bottom:16px;position:relative}
    .field span{display:block;font-size:.8rem;font-weight:700;color:#3f4a68;margin-bottom:6px}
    .field input{width:100%;box-sizing:border-box;border:1.5px solid #d4ddf2;border-radius:10px;
      padding:12px 14px;font-size:.98rem;outline:none;transition:border-color .15s}
    .field input:focus{border-color:#27408B}
    .peek{position:absolute;right:10px;top:30px;border:0;background:none;color:#689ACD;
      font-weight:700;font-size:.8rem;cursor:pointer}
    .error{color:#c11e5b;font-weight:700;font-size:.88rem;margin:-6px 0 14px}
    .btn{width:100%;background:#DF2A6D;color:#fff;font-weight:700;border:0;border-radius:999px;
      padding:13px;cursor:pointer;font-size:1rem;margin-top:6px}
    .btn:hover{background:#c11e5b}
  `]
})
export class LoginComponent {
  @Output() loggedIn = new EventEmitter<void>();

  username = '';
  password = '';
  show = false;
  error = '';

  constructor(private auth: AuthService) {}

  submit(): void {
    if (this.auth.login(this.username, this.password)) {
      this.error = '';
      this.loggedIn.emit();
    } else {
      this.error = 'Incorrect username or password.';
    }
  }
}
