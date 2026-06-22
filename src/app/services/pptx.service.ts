import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import JSZip from 'jszip';
import { ParsedDeck, RawSlide, TableData } from '../models/landing.model';
import { firstValueFrom } from 'rxjs';

/**
 * Parses a .pptx file into structured content: per-slide title, text
 * paragraphs, bullet lists, TABLES and images — so nothing visible in the deck
 * is dropped when building the landing page.
 *
 * Default mode (USE_BACKEND = false): parses entirely in the browser with JSZip.
 * Backend mode (USE_BACKEND = true): uploads to the Laravel API for the same shape.
 */
@Injectable({ providedIn: 'root' })
export class PptxService {
  USE_BACKEND = false;
  BACKEND_URL = 'http://localhost:8000/api/parse-pptx';

  constructor(private http: HttpClient) {}

  async parse(file: File): Promise<ParsedDeck> {
    if (this.USE_BACKEND) return this.parseViaBackend(file);
    return this.parseInBrowser(file);
  }

  // ---- Browser parsing -----------------------------------------------------

  private async parseInBrowser(file: File): Promise<ParsedDeck> {
    const zip = await JSZip.loadAsync(file);

    // 1. Load every image as a data URI, keyed by filename.
    const mediaByName: Record<string, string> = {};
    const allMedia: string[] = [];
    const mediaFiles = Object.keys(zip.files).filter(p =>
      p.startsWith('ppt/media/') && /\.(png|jpe?g|gif|webp)$/i.test(p)
    );
    for (const path of mediaFiles) {
      const ext = path.split('.').pop()!.toLowerCase();
      const mime = ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
        : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const base64 = await zip.files[path].async('base64');
      const uri = `data:${mime};base64,${base64}`;
      mediaByName[path.split('/').pop()!] = uri;
      allMedia.push(uri);
    }

    // 2. Sort slide XML files (slide1.xml, slide2.xml, ...).
    const slidePaths = Object.keys(zip.files)
      .filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => this.slideNum(a) - this.slideNum(b));

    const slides: RawSlide[] = [];
    for (let i = 0; i < slidePaths.length; i++) {
      const xml = await zip.files[slidePaths[i]].async('text');
      const tables = this.extractTables(xml);
      // Remove table XML before pulling free text so cell text isn't duplicated.
      const xmlNoTables = xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, '');
      const paras = this.extractParagraphs(xmlNoTables);
      const title = this.guessTitle(paras);
      const bullets = paras.filter(p => p !== title && this.looksLikeBullet(p));
      const texts = paras.filter(p => p !== title);
      const images = await this.extractSlideImages(zip, slidePaths[i], mediaByName);
      slides.push({ index: i + 1, title, texts, bullets, tables, images });
    }

    return { slides, media: allMedia };
  }

  private slideNum(path: string): number {
    const m = path.match(/slide(\d+)\.xml/);
    return m ? parseInt(m[1], 10) : 0;
  }

  /** Pull text paragraphs, joining runs within each <a:p>. */
  private extractParagraphs(xml: string): string[] {
    const out: string[] = [];
    const paras = xml.split(/<a:p>/);
    for (const para of paras) {
      const runs: string[] = [];
      const re = /<a:t>([\s\S]*?)<\/a:t>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(para)) !== null) runs.push(this.decodeXml(m[1]));
      const joined = runs.join('').replace(/\s+/g, ' ').trim();
      if (joined && joined !== '‹#›') out.push(joined);
    }
    return out;
  }

  /** Extract every table on the slide as rows of cell strings. */
  private extractTables(xml: string): TableData[] {
    const tables: TableData[] = [];
    const tblRe = /<a:tbl>([\s\S]*?)<\/a:tbl>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tblRe.exec(xml)) !== null) {
      const tableXml = tm[1];
      const rows: string[][] = [];
      const rowRe = /<a:tr[ >][\s\S]*?<\/a:tr>/g;
      let rm: RegExpExecArray | null;
      while ((rm = rowRe.exec(tableXml)) !== null) {
        const rowXml = rm[0];
        const cells: string[] = [];
        const cellRe = /<a:tc[ >][\s\S]*?<\/a:tc>/g;
        let cm: RegExpExecArray | null;
        while ((cm = cellRe.exec(rowXml)) !== null) {
          const cellXml = cm[0];
          const runs: string[] = [];
          const tRe = /<a:t>([\s\S]*?)<\/a:t>/g;
          let xm: RegExpExecArray | null;
          while ((xm = tRe.exec(cellXml)) !== null) runs.push(this.decodeXml(xm[1]));
          cells.push(runs.join('').replace(/\s+/g, ' ').trim());
        }
        if (cells.length) rows.push(cells);
      }
      if (rows.length) tables.push({ rows });
    }
    return tables;
  }

  private guessTitle(paras: string[]): string {
    // A slide title is usually the first short, prominent line.
    const short = paras.filter(p => p.length <= 70);
    return short[0] || paras[0] || '';
  }

  private looksLikeBullet(p: string): boolean {
    return /^[\d]+[\.\)]\s/.test(p) || /^[a-z][\.\)]\s/i.test(p) ||
           /^[•\-\u2022\u25CF\u2013]\s?/.test(p) || p.length < 120;
  }

  private async extractSlideImages(
    zip: JSZip, slidePath: string, mediaByName: Record<string, string>
  ): Promise<string[]> {
    const name = slidePath.split('/').pop()!;
    const relsFile = zip.files[`ppt/slides/_rels/${name}.rels`];
    if (!relsFile) return [];
    const relsXml = await relsFile.async('text');
    const out: string[] = [];
    const re = /Target="[^"]*media\/([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(relsXml)) !== null) {
      const uri = mediaByName[m[1]];
      if (uri && !out.includes(uri)) out.push(uri);
    }
    return out;
  }

  private decodeXml(s: string): string {
    return s
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
  }

  // ---- Backend parsing -----------------------------------------------------

  private async parseViaBackend(file: File): Promise<ParsedDeck> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.post<ParsedDeck>(this.BACKEND_URL, form));
  }
}
