import { Injectable } from '@angular/core';

/**
 * Simple front-end login gate.
 *
 * NOTE: This is a convenience gate only, not real security. The password is
 * checked in the browser, so a technical user could bypass it by reading the
 * code. For genuine protection you need a backend that verifies credentials
 * server-side. This is fine for keeping casual users out of the tool.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Configure the login credentials here.
  private readonly USERNAME = 'admin';
  private readonly PASSWORD = 'Admin123';

  private _loggedIn = false;

  get loggedIn(): boolean {
    return this._loggedIn;
  }

  /**
   * Attempt login. Username is optional/case-insensitive; the password must
   * match exactly. Returns true on success.
   */
  login(username: string, password: string): boolean {
    const userOk = !username || username.trim().toLowerCase() === this.USERNAME;
    const passOk = password === this.PASSWORD;
    this._loggedIn = userOk && passOk;
    return this._loggedIn;
  }

  logout(): void {
    this._loggedIn = false;
  }
}
