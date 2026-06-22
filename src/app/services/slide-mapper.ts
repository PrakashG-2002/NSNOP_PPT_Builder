import { Injectable } from '@angular/core';
import { ParsedDeck, LandingData, Stat, Card, ProjectCard } from '../models/landing.model';

/**
 * Turns a raw parsed deck into the structured LandingData the page renders from.
 *
 * This is rule-based and intentionally simple so you can tune it for your own
 * template family. The rules below are tuned for NSNOP-style decks:
 *   - Slide 1            -> hero (title + intro + first image)
 *   - "Objectives" slides -> objective cards (numbered list items)
 *   - "Achievements"      -> achievement cards
 *   - Slides with Rs./numbers -> stats
 *   - "project status"    -> project cards
 *   - "support required"  -> support list
 *   - last slide          -> closing quote
 *
 * Anything it can't confidently classify still shows up as objective cards so no
 * content is silently dropped.
 */
@Injectable({ providedIn: 'root' })
export class SlideMapper {

  private ICONS = ['\u{1F3EB}','\u{1F4BB}','\u{1F3AC}','\u{26BD}','\u{1F37D}',
                   '\u{1F49A}','\u{1F393}','\u{1F528}','\u{1F91D}','\u{1F4CA}',
                   '\u{1F30D}','\u{1F465}','\u{1F4A1}','\u{1F4B0}','\u{2B50}'];

  map(deck: ParsedDeck): LandingData {
    const data: LandingData = {
      title: '', subtitle: '', intro: '', heroImage: null,
      logo: null, navLinks: [],
      stats: [], objectives: [], achievements: [], projects: [],
      support: [], closingQuote: '', slides: []
    };

    deck.slides.forEach((slide, i) => {
      const all = slide.texts.join(' ');
      const lower = all.toLowerCase();
      const heading = this.findHeading(slide.texts);

      // ---- Hero (first slide) ----
      if (i === 0) {
        // The parser already separated a short title from the body text.
        // Title = that title; intro = the longest remaining paragraph (the
        // descriptive sentence). These must be different so the hero doesn't
        // show the same text as both the <h1> and the lead paragraph.
        let title = (slide.title || '').trim();
        let intro = this.longest(slide.texts.filter(t => t !== title)) || '';

        // If the title looks like a long sentence (no real short title found),
        // derive a concise title from its opening words and keep the full
        // sentence as the intro.
        if (title && title.length > 70) {
          if (!intro) intro = title;
          title = this.tidyTitle(title.split(' ').slice(0, 6).join(' '));
        }

        // Title still missing? Try a merged title cell from a slide-1 table.
        if (!title && slide.tables.length) {
          const firstCell = slide.tables[0].rows?.[0]?.[0];
          if (firstCell) title = this.tidyTitle(firstCell.split(' ').slice(0, 8).join(' '));
        }

        data.title = title || 'Presentation';
        data.intro = intro || (title !== data.title ? '' : '');
        // Guard against title === intro duplication.
        if (data.intro && data.intro === data.title) data.intro = '';

        // Big photo for the hero visual = largest image on slide 1 / deck.
        data.heroImage = this.pickPhoto(slide.images) || this.pickPhoto(deck.media) || null;
        // Logo = a small/medium image on the title slide, distinct from the
        // big hero photo (skips trivial decorative blobs).
        data.logo = this.pickLogo(slide.images, data.heroImage);
        data.subtitle = '';
        return;
      }

      // ---- Closing slide ----
      if (i === deck.slides.length - 1 &&
          (lower.includes('thank') || all.includes('"') || lower.includes('together'))) {
        data.closingQuote = this.longest(slide.texts) || all;
        return;
      }

      // ---- Objectives ----
      if (lower.includes('objective')) {
        this.numberedItems(slide.texts).forEach(item =>
          data.objectives.push(this.toCard(item, data.objectives.length)));
        return;
      }

      // ---- Achievements ----
      if (lower.includes('achievement') || lower.includes('key achievements')) {
        this.sentences(slide.texts).forEach(s =>
          data.achievements.push(this.toCard(s, data.achievements.length)));
        return;
      }

      // ---- Support required ----
      if (lower.includes('support required') || lower.includes('government support')) {
        this.sentences(slide.texts).forEach(s => {
          if (s.length > 25) data.support.push(s);
        });
        return;
      }

      // ---- Project status ----
      if (lower.includes('project status') || lower.includes('impact and project')) {
        data.projects.push(...this.projectCards(slide.texts));
        this.harvestStats(slide.texts, data.stats);
        return;
      }

      // ---- Journey / stats (lots of Rs. values) ----
      if ((all.match(/Rs\.?/g) || []).length >= 3 || lower.includes('journey')) {
        this.harvestStats(slide.texts, data.stats);
        return;
      }

      // ---- Fallback: treat remaining content as objective cards ----
      this.numberedItems(slide.texts).forEach(item =>
        data.objectives.push(this.toCard(item, data.objectives.length)));
    });

    // Remove cards that have no real content (empty title and empty body),
    // and drop duplicates, so we never render an empty card.
    const hasContent = (c: Card) => (c.title && c.title.trim().length > 1) || (c.body && c.body.trim().length > 1);
    const dedupeCards = (cards: Card[]) => {
      const seen = new Set<string>();
      return cards.filter(c => {
        if (!hasContent(c)) return false;
        const key = (c.title + '|' + c.body).toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    // Trim to sensible counts for layout.
    data.objectives = dedupeCards(data.objectives).slice(0, 9);
    data.achievements = dedupeCards(data.achievements).slice(0, 6);
    data.stats = this.dedupeStats(data.stats)
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, 4);
    data.support = data.support.filter(s => s && s.trim().length > 1).slice(0, 8);

    if (!data.stats.length) {
      data.stats = [{ value: String(deck.slides.length), label: 'Slides' }];
    }

    // ---- Curated content for a clean landing page.
    // The page should read like a polished landing page, NOT a data dump:
    //   - real prose  -> paragraphs / bullets
    //   - stray number/label fragments (chart leftovers) -> DROPPED
    //     (the real totals already appear in the hero stats + stat strip)
    //   - only real photos kept; decorative clip-art / illustrations dropped
    // The first slide becomes the hero, so we render slides 2..n here.
    const usedAsBranding = new Set([data.logo, data.heroImage].filter(Boolean) as string[]);
    data.slides = deck.slides.slice(1).map(s => {
      const nonTitle = s.texts.filter(t => t !== s.title);
      // Keep only meaningful prose/bullets; drop bare number/label fragments.
      const kept = nonTitle.filter(t => !this.isFragment(t));
      const bullets = s.bullets.filter(b => !this.isFragment(b));
      const prose = kept.filter(p => !bullets.includes(p));

      return {
        index: s.index,
        title: s.title,
        paragraphs: prose,
        bullets,
        chips: [],   // chips intentionally removed for a clean look
        tables: s.tables,
        // Keep only real photographs; drop decorative clip-art and branding dupes.
        images: this.realPhotos(s.images, usedAsBranding)
      };
    }).filter(b =>
      b.title || b.paragraphs.length || b.bullets.length || b.tables.length || b.images.length
    );

    // Build nav links only for sections that actually have content.
    data.navLinks = [];
    if (data.intro) data.navLinks.push({ label: 'About', href: '#about' });
    if (data.objectives.length) data.navLinks.push({ label: 'Objectives', href: '#objectives' });
    if (data.achievements.length) data.navLinks.push({ label: 'Highlights', href: '#achievements' });
    if (data.projects.length) data.navLinks.push({ label: 'Impact', href: '#impact' });
    if (data.support.length) data.navLinks.push({ label: 'Support', href: '#support' });
    if (data.slides.length) data.navLinks.push({ label: 'Details', href: '#details' });

    return data;
  }

  // ---- helpers -------------------------------------------------------------

  private findHeading(texts: string[]): string {
    // Headings are often the last short line on a slide; fall back to first.
    const shortLines = texts.filter(t => t.length < 40);
    return shortLines[shortLines.length - 1] || texts[0] || '';
  }

  private longest(texts: string[]): string {
    return texts.reduce((a, b) => (b.length > a.length ? b : a), '');
  }

  private numberedItems(texts: string[]): string[] {
    const items: string[] = [];
    for (const t of texts) {
      const cleaned = t.replace(/^\s*\d+[\.\)]\s*/, '').trim();
      if (cleaned.length > 20 && !/^objectives?$/i.test(cleaned)) items.push(cleaned);
    }
    return items;
  }

  private sentences(texts: string[]): string[] {
    return texts.filter(t => t.length > 25);
  }

  private toCard(text: string, idx: number): Card {
    const icon = this.ICONS[idx % this.ICONS.length];
    const clean = text.trim();

    // Try to split into a heading + the rest at the first natural boundary
    // (colon, dash, en-dash, or end of first sentence). Require the heading
    // part to be a meaningful length so we don't make "Link" the title of
    // "Link: NSNOP Portal Tracker".
    const m = clean.match(/^(.{8,60}?)\s*[:\u2013\u2014-]\s+(.+)$/);
    if (m && m[2].trim().length > 3) {
      return { title: this.tidyTitle(m[1]), body: m[2].trim(), icon };
    }

    // Split on the first sentence end if the line is long enough to have a body.
    const dot = clean.search(/[.!?]\s+/);
    if (dot > 8 && dot < clean.length - 10) {
      return {
        title: this.tidyTitle(clean.slice(0, dot + 1)),
        body: clean.slice(dot + 1).trim(),
        icon
      };
    }

    // Short line: use it as the title only — no duplicated body.
    if (clean.length <= 70) {
      return { title: this.tidyTitle(clean), body: '', icon };
    }

    // Long single sentence: first ~6 words as a heading, and the body is the
    // REMAINDER after those words (never a copy of the whole line).
    const words = clean.split(' ');
    const title = this.tidyTitle(words.slice(0, 6).join(' '));
    const body = words.slice(6).join(' ').trim();
    return { title, body, icon };
  }

  /** Trim trailing punctuation and tidy a heading string. */
  private tidyTitle(s: string): string {
    return s.trim().replace(/[\s,.;:\u2013\u2014-]+$/, '').trim();
  }

  /** Pull "Rs. 1,029.70 Cr" / big numbers + their nearby label into stats.
   *  Larger values are preferred so headline totals win over small yearly figures. */
  private harvestStats(texts: string[], out: Stat[]): void {
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      const moneyMatch = t.match(/Rs\.?\s*[\d,]+(?:\.\d+)?\s*(?:Cr(?:ores)?)?/i);
      const bigNum = t.match(/^\s*[\d,]{3,}\s*$/);
      if (moneyMatch) {
        const label = texts[i + 1] && texts[i + 1].length < 40 ? texts[i + 1] : 'Contribution';
        out.push({ value: moneyMatch[0].replace(/\s+/g, ' ').trim(), label, weight: this.numericValue(moneyMatch[0]) });
      } else if (bigNum) {
        const label = texts[i + 1] && texts[i + 1].length < 40 ? texts[i + 1] : 'Total';
        out.push({ value: t.trim(), label, weight: this.numericValue(t) });
      }
    }
  }

  /** Strip formatting and return the numeric magnitude of a stat string. */
  private numericValue(s: string): number {
    const n = parseFloat(s.replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  private dedupeStats(stats: Stat[]): Stat[] {
    const seen = new Set<string>();
    return stats.filter(s => {
      const k = s.value;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  /** Build project cards from a status slide with "Completed/Ongoing/Yet to start". */
  private projectCards(texts: string[]): ProjectCard[] {
    const cards: ProjectCard[] = [];
    const titleIdx: number[] = [];
    texts.forEach((t, i) => {
      if (/^(NEW |CLASSROOM|TOILET|HI-TECH|SMART)/i.test(t)) titleIdx.push(i);
    });
    titleIdx.forEach((ti, k) => {
      const nums = texts.slice(ti).join(' ').match(/[\d,]{2,}/g) || [];
      cards.push({
        code: String(k + 1).padStart(2, '0'),
        title: texts[ti],
        total: nums[0] || '-',
        completed: nums[1] || '-',
        ongoing: nums[2] || '-',
        pending: nums[3] || '-'
      });
    });
    return cards.slice(0, 6);
  }

  /** Prefer a real photo (large dimensions implied) over tiny icons/SVGs. */
  private pickPhoto(images: string[]): string | null {
    if (!images.length) return null;
    // Heuristic: the longest base64 string is usually the biggest/real photo.
    return images.reduce((a, b) => (b.length > a.length ? b : a));
  }

  /**
   * Pick a header logo from the title slide's images.
   *
   * Logos are small/medium graphics (not the big hero photo, not a trivial
   * decorative blob). We exclude the hero photo, drop very tiny images
   * (decorative shapes), then take the smallest of what remains — which is
   * typically the brand mark.
   */
  private pickLogo(slideImages: string[], heroImage: string | null): string | null {
    const MIN_LEN = 5000;  // ~ skips tiny solid-colour decorative shapes
    let candidates = slideImages.filter(m => m !== heroImage && m.length >= MIN_LEN);
    if (!candidates.length) {
      // Fall back to any non-hero image if nothing clears the size floor.
      candidates = slideImages.filter(m => m !== heroImage);
    }
    if (!candidates.length) return null;
    // Smallest remaining candidate is most likely the logo/emblem.
    return candidates.reduce((a, b) => (b.length < a.length ? b : a));
  }

  /**
   * Classify a line as a short "data fragment" (bare number, currency amount,
   * FY label, or a single short word) versus real prose. Fragments are dropped
   * so the page stays clean and reads like a proper landing page.
   */
  private isFragment(t: string): boolean {
    const s = (t || '').trim();
    if (!s) return false;
    if (/^[\d.,]+$/.test(s)) return true;                                   // pure number
    if (/^(rs\.?|₹|inr)\s*[\d.,]+\s*(cr(ores)?|crore|lakh|l)?\.?$/i.test(s)) return true; // currency
    if (/^fy\s*[\d\u2013\u2014-]+$/i.test(s)) return true;                   // FY label
    if (!/\s/.test(s) && s.length < 16) return true;                        // single short token
    if (s.length <= 24 && !/[.!?]/.test(s) && /\d/.test(s)) return true;     // short label with a number
    return false;
  }

  /**
   * Keep only real photographs, dropping decorative clip-art, icons, charts
   * and illustrations so the page stays clean.
   *
   * Heuristic: real photos are almost always JPEGs (continuous-tone, large),
   * while clip-art / icons / illustrations / chart graphics are PNGs (flat
   * colour, often with transparency). We therefore keep JPEGs above a sensible
   * size and drop PNGs. Branding images (logo/hero) are excluded too.
   */
  private realPhotos(images: string[], exclude: Set<string>): string[] {
    const MIN_PHOTO_LEN = 40000;   // ~30KB+ decoded; filters small graphics
    const out: string[] = [];
    const seen = new Set<string>();
    for (const img of images) {
      if (exclude.has(img) || seen.has(img)) continue;
      const isJpeg = img.startsWith('data:image/jpeg') || img.startsWith('data:image/jpg');
      if (isJpeg && img.length >= MIN_PHOTO_LEN) {
        seen.add(img);
        out.push(img);
      }
    }
    return out;
  }
}
