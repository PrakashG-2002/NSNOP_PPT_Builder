import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LandingData, TableData } from '../models/landing.model';

/**
 * Editable landing-page preview.
 *
 * Renders the landing page natively (not in an iframe) so every piece can be
 * edited inline:
 *   - text  -> contenteditable (title, intro, stats, cards, support, details)
 *   - logo & images -> click to replace (file upload) or remove
 *   - tables -> editable cells, add/remove rows
 *   - cards -> delete button
 *
 * All edits write straight back into the bound LandingData object, so the
 * Download (which serialises that same object) always reflects the edits.
 *
 * NOTE: true flowcharts/SmartArt are flattened images in the deck, so they are
 * editable as images (replace/remove), not as editable diagrams.
 */
@Component({
  selector: 'app-landing-preview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './landing-preview.component.html',
  styleUrls: ['./landing-preview.component.scss']
})
export class LandingPreviewComponent {
  @Input() data!: LandingData | null;
  @Input() editMode = false;
  @Output() dataChange = new EventEmitter<void>();

  // ---- palette helpers (mirror the export service) ----
  OBJ = ['var(--green)','var(--peri)','var(--magenta)','var(--sky)','var(--gold)','var(--purple)','var(--navy)','var(--green)','var(--magenta)'];
  ACH = ['var(--gold)','var(--purple)','var(--navy)','var(--green)','var(--magenta)','var(--peri)'];
  PROJ = ['var(--navy)','var(--magenta)','var(--purple)','var(--peri)','var(--green)','var(--navy2)'];
  SUP = ['var(--green)','var(--peri)','var(--magenta)','var(--sky)','var(--gold)','var(--purple)','var(--navy)','var(--magenta)'];
  objIcons = ['\u{1F3EB}','\u{1F4BB}','\u{1F3AC}','\u{26BD}','\u{1F37D}','\u{1F49A}','\u{1F393}','\u{1F528}','\u{1F91D}'];
  achIcons = ['\u{1F3C6}','\u{1F393}','\u2B50','\u{1F4C8}','\u{1F4CA}','\u{1F4A7}'];

  c(arr: string[], i: number) { return arr[i % arr.length]; }

  // ---- generic text edit: write innerText back to the model field ----
  edit(obj: any, key: string, ev: Event) {
    const el = ev.target as HTMLElement;
    obj[key] = (el.innerText || '').trim();
    this.dataChange.emit();
  }

  editArr(arr: string[], i: number, ev: Event) {
    const el = ev.target as HTMLElement;
    arr[i] = (el.innerText || '').trim();
    this.dataChange.emit();
  }

  // ---- COLOUR THEMING (floating toolbar) ----
  // colours are stored in data.textColors keyed by an id like:
  //   text:<cid>   -> text colour for that element
  //   bg:<sid>     -> background colour for a section
  //   btn:<bid>    -> button colour
  // The export reads the same map, so downloads keep every colour.

  picker = { open: false, x: 0, y: 0, cid: '', kind: 'text' as 'text' | 'bg' | 'btn', label: '', hex: '' };

  /** Quick swatches offered in the toolbar (brand palette + neutrals). */
  swatches = ['#27408B','#DF2A6D','#65318B','#689ACD','#70C8ED','#78C79D','#F8DA47','#15203f','#5b6378','#ffffff'];

  colorVal(key: string): string {
    return (this.data?.textColors && this.data.textColors[key]) || '';
  }

  textColor(cid: string): string | null { return this.colorVal('text:' + cid) || null; }
  bgColor(sid: string): string | null { return this.colorVal('bg:' + sid) || null; }
  btnColor(bid: string): string | null { return this.colorVal('btn:' + bid) || null; }

  private setKey(key: string, color: string) {
    if (!this.data) return;
    if (!this.data.textColors) this.data.textColors = {};
    if (color) this.data.textColors[key] = color;
    else delete this.data.textColors[key];
    this.dataChange.emit();
  }

  /** True when the toolbar should be a centered bottom sheet (mobile). */
  get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 700;
  }

  /** Click handler (delegated): if a themeable element was clicked, open toolbar. */
  onPreviewClick(ev: MouseEvent) {
    if (!this.editMode) return;
    const el = (ev.target as HTMLElement).closest('[data-cid],[data-bg],[data-btn]') as HTMLElement | null;
    if (!el) return;
    let kind: 'text' | 'bg' | 'btn' = 'text';
    let cid = '';
    let label = 'Text colour';
    if (el.hasAttribute('data-btn')) { kind = 'btn'; cid = el.getAttribute('data-btn')!; label = 'Button colour'; }
    else if (el.hasAttribute('data-bg')) { kind = 'bg'; cid = el.getAttribute('data-bg')!; label = 'Background colour'; }
    else { kind = 'text'; cid = el.getAttribute('data-cid')!; label = 'Text colour'; }

    const key = (kind === 'btn' ? 'btn:' : kind === 'bg' ? 'bg:' : 'text:') + cid;
    const current = this.colorVal(key);

    if (this.isMobile) {
      // On mobile the toolbar is a fixed bottom sheet; position is handled in CSS.
      this.picker = { open: true, x: 0, y: 0, cid, kind, label, hex: current };
      return;
    }
    const r = el.getBoundingClientRect();
    const host = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    // Keep the toolbar inside the viewport horizontally and vertically.
    const TOOLBAR_W = 300;
    let x = r.left - host.left;
    x = Math.max(8, Math.min(x, host.width - TOOLBAR_W));
    let y = r.top - host.top - 56;
    if (y < 4) y = r.bottom - host.top + 8;  // flip below if no room above
    this.picker = { open: true, x, y, cid, kind, label, hex: current };
  }

  private pickerKey(): string {
    return (this.picker.kind === 'btn' ? 'btn:' : this.picker.kind === 'bg' ? 'bg:' : 'text:') + this.picker.cid;
  }

  applySwatch(color: string) { this.picker.hex = color; this.setKey(this.pickerKey(), color); }

  onPickerInput(ev: Event) {
    const v = (ev.target as HTMLInputElement).value;
    this.picker.hex = v;
    this.setKey(this.pickerKey(), v);
  }

  /** Apply a typed/pasted hex value (accepts with or without leading #). */
  onHexInput(ev: Event) {
    let v = (ev.target as HTMLInputElement).value.trim();
    if (v && !v.startsWith('#')) v = '#' + v;
    this.picker.hex = v;
    // Only apply once it's a valid #rgb or #rrggbb.
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
      this.setKey(this.pickerKey(), v);
    }
  }

  clearColor() { this.picker.hex = ''; this.setKey(this.pickerKey(), ''); }

  closePicker() { this.picker.open = false; }

  // ---- drag to reorder cards within an array ----
  dragIndex = -1;
  dragArr: any[] | null = null;

  onDragStart(arr: any[], i: number) {
    this.dragArr = arr;
    this.dragIndex = i;
  }

  onDragOver(ev: DragEvent) {
    if (this.editMode && this.dragArr) ev.preventDefault();  // allow drop
  }

  onDrop(arr: any[], i: number, ev: DragEvent) {
    ev.preventDefault();
    if (this.dragArr !== arr || this.dragIndex < 0 || this.dragIndex === i) {
      this.dragIndex = -1; this.dragArr = null; return;
    }
    const [moved] = arr.splice(this.dragIndex, 1);
    arr.splice(i, 0, moved);
    this.dragIndex = -1; this.dragArr = null;
    this.dataChange.emit();
  }

  // ---- table cell edit ----
  editCell(table: TableData, r: number, cIdx: number, ev: Event) {
    const el = ev.target as HTMLElement;
    table.rows[r][cIdx] = (el.innerText || '').trim();
    this.dataChange.emit();
  }

  addRow(table: TableData) {
    if (!table.rows.length) return;
    const cols = table.rows[0].length;
    table.rows.push(new Array(cols).fill(''));
    this.dataChange.emit();
  }

  removeRow(table: TableData, r: number) {
    table.rows.splice(r, 1);
    this.dataChange.emit();
  }

  // ---- card / item removal ----
  removeFrom(arr: any[], i: number) {
    arr.splice(i, 1);
    this.dataChange.emit();
  }

  // ---- image / logo replace & remove ----
  private readFile(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async replaceLogo(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file || !this.data) return;
    this.data.logo = await this.readFile(file);
    this.dataChange.emit();
  }

  removeLogo() { if (this.data) { this.data.logo = null; this.dataChange.emit(); } }

  async replaceHero(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file || !this.data) return;
    this.data.heroImage = await this.readFile(file);
    this.dataChange.emit();
  }

  removeHero() { if (this.data) { this.data.heroImage = null; this.dataChange.emit(); } }

  async replaceDetailImg(images: string[], i: number, ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    images[i] = await this.readFile(file);
    this.dataChange.emit();
  }

  removeDetailImg(images: string[], i: number) {
    images.splice(i, 1);
    this.dataChange.emit();
  }
}
