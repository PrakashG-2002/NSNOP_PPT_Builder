import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PptxService } from './services/pptx.service';
import { SlideMapper } from './services/slide-mapper';
import { HtmlExportService } from './services/html-export.service';
import { AuthService } from './services/auth.service';
import { LandingData } from './models/landing.model';
import { LandingPreviewComponent } from './components/landing-preview.component';
import { LoginComponent } from './components/login.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LandingPreviewComponent, LoginComponent],
  template: `
  <app-login *ngIf="!auth.loggedIn" (loggedIn)="onLoggedIn()"></app-login>

  <ng-container *ngIf="auth.loggedIn">
  <header class="topbar">
    <div class="brand">NSNOP <span>PPT To Website Builder</span></div>
    <div class="top-right">
      <span class="mode">{{ pptx.USE_BACKEND ? 'Backend parsing' : 'In-browser parsing' }}</span>
      <button class="logout" (click)="logout()">Log out</button>
    </div>
  </header>

  <main class="container">
    <section class="uploader" *ngIf="!data">
      <div class="drop"
           (dragover)="$event.preventDefault()"
           (drop)="onDrop($event)">
        <div class="icon">⬆</div>
        <h2>Upload your .pptx</h2>
        <p>Drop a PowerPoint file here, or choose one. It’s turned into a landing page you can preview and download.</p>
        <label class="btn">
          Choose .pptx
          <input type="file" accept=".pptx" (change)="onPick($event)" hidden />
        </label>
        <div class="status" *ngIf="loading">Parsing “{{ fileName }}”…</div>
        <div class="error" *ngIf="error">{{ error }}</div>
      </div>
    </section>

    <section class="result" *ngIf="data">
      <div class="bar">
        <div class="file">✅ {{ fileName }}
          <span class="hint" *ngIf="editMode">— click any text, image, or table cell to edit</span>
        </div>
        <div class="actions">
          <button class="btn ghost" (click)="reset()">Upload another</button>
          <button class="btn toggle" [class.on]="editMode" (click)="editMode = !editMode">
            {{ editMode ? '✓ Done editing' : '✎ Edit' }}
          </button>
          <button class="btn" (click)="download()">⬇ Download File</button>
        </div>
      </div>
      <div class="preview-frame" [class.editing-frame]="editMode">
        <app-landing-preview [data]="data" [editMode]="editMode"></app-landing-preview>
      </div>
    </section>
  </main>
  </ng-container>
  `,
  styles: [`
    :host{display:block;min-height:100vh;background:#f1f4fb}
    .topbar{display:flex;justify-content:space-between;align-items:center;
      background:#27408B;color:#fff;padding:16px 28px}
    .brand{font-weight:800;font-size:1.15rem}.brand span{font-weight:500;opacity:.85;margin-left:6px}
    .top-right{display:flex;align-items:center;gap:14px}
    .mode{font-size:.78rem;background:rgba(255,255,255,.15);padding:5px 12px;border-radius:999px}
    .logout{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.35);
      border-radius:999px;padding:6px 16px;font-size:.82rem;font-weight:700;cursor:pointer}
    .logout:hover{background:rgba(255,255,255,.22)}
    .container{max-width:1240px;margin:0 auto;padding:30px 20px}
    .drop{background:#fff;border:2px dashed #c5d0ec;border-radius:20px;padding:64px 30px;text-align:center;max-width:680px;margin:40px auto}
    .drop .icon{font-size:2.4rem;color:#689ACD}
    .drop h2{color:#27408B;margin:14px 0 8px;font-weight:800}
    .drop p{color:#52608a;max-width:440px;margin:0 auto 22px}
    .btn{display:inline-block;background:#DF2A6D;color:#fff;font-weight:700;border:0;
      border-radius:999px;padding:13px 28px;cursor:pointer;font-size:.95rem}
    .btn.ghost{background:#fff;color:#27408B;border:2px solid #27408B}
    .btn.toggle{background:#fff;color:#65318B;border:2px solid #65318B}
    .btn.toggle.on{background:#65318B;color:#fff}
    .hint{font-weight:500;color:#7a6aa0;font-size:.82rem;margin-left:6px}
    .status{margin-top:18px;color:#27408B;font-weight:700}
    .error{margin-top:18px;color:#c11e5b;font-weight:700}
    .bar{display:flex;justify-content:space-between;align-items:center;
      background:#fff;border-radius:14px;padding:14px 20px;margin-bottom:18px;box-shadow:0 6px 18px rgba(20,32,63,.06)}
    .file{font-weight:700;color:#27408B}.actions{display:flex;gap:12px}
    .preview-frame{border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(20,32,63,.12);background:#fff}
    .preview-frame.editing-frame{box-shadow:0 0 0 3px rgba(101,49,139,.35),0 10px 40px rgba(20,32,63,.12)}
    @media(max-width:700px){
      .topbar{padding:12px 16px;flex-wrap:wrap;gap:8px}
      .brand{font-size:1rem}
      .container{padding:16px 10px}
      .bar{flex-direction:column;align-items:stretch;gap:12px;padding:12px 14px}
      .actions{flex-wrap:wrap}
      .actions .btn{flex:1;text-align:center;padding:11px 14px;font-size:.85rem}
      .drop{padding:40px 18px;margin:18px auto}
    }
  `]
})
export class AppComponent {
  data: LandingData | null = null;
  loading = false;
  editMode = false;
  error = '';
  fileName = '';

  constructor(
    public pptx: PptxService,
    private mapper: SlideMapper,
    private exporter: HtmlExportService,
    public auth: AuthService
  ) {}

  onLoggedIn(): void {
    // login state is held in AuthService; nothing else needed here.
  }

  logout(): void {
    this.auth.logout();
    this.reset();
  }

  onPick(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.handle(file);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) this.handle(file);
  }

  private async handle(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      this.error = 'Please choose a .pptx file.';
      return;
    }
    this.error = '';
    this.fileName = file.name;
    this.loading = true;
    try {
      const deck = await this.pptx.parse(file);
      this.data = this.mapper.map(deck);
    } catch (err) {
      console.error(err);
      this.error = 'Could not parse that file. Is it a valid .pptx?';
    } finally {
      this.loading = false;
    }
  }

  download(): void {
    if (!this.data) return;
    const base = this.fileName.replace(/\.pptx$/i, '') || 'landing-page';
    this.exporter.download(this.data, `${base}.html`);
  }

  reset(): void {
    this.data = null;
    this.fileName = '';
    this.error = '';
  }
}
