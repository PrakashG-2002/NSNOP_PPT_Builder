// Structured representation of a parsed presentation.

export interface TableData {
  rows: string[][];     // rows of cells; first row treated as header
}

export interface RawSlide {
  index: number;
  title: string;        // best-guess slide title (first/short prominent line)
  texts: string[];      // text paragraphs found on the slide, in order
  bullets: string[];    // paragraphs that look like list items
  tables: TableData[];  // every table on the slide
  images: string[];     // data: URIs of images on this slide
}

export interface ParsedDeck {
  slides: RawSlide[];
  media: string[];      // all images across the deck (data URIs)
}

// A faithfully-rendered block for the "full content" section of the page.
export interface SlideBlock {
  index: number;
  title: string;
  paragraphs: string[];
  bullets: string[];
  chips: string[];       // short data fragments (numbers, labels) shown as chips
  tables: TableData[];
  images: string[];
}

// The landing-page model the Angular components render from.
export interface LandingData {
  title: string;
  subtitle: string;
  intro: string;
  heroImage: string | null;
  logo: string | null;        // logo for the header, taken from the deck
  navLinks: NavLink[];        // only sections that actually exist in the deck
  stats: Stat[];
  objectives: Card[];
  achievements: Card[];
  projects: ProjectCard[];
  support: string[];
  closingQuote: string;
  slides: SlideBlock[];       // full, faithful per-slide content (nothing dropped)
  textColors?: Record<string, string>;  // optional per-element text colour overrides (edit mode)
}

export interface NavLink { label: string; href: string; }
export interface Stat { value: string; label: string; weight?: number; }
export interface Card { title: string; body: string; icon: string; }
export interface ProjectCard {
  code: string;
  title: string;
  total: string;
  completed: string;
  ongoing: string;
  pending: string;
}
