import { Injectable } from '@angular/core';
import { LandingData } from '../models/landing.model';

/**
 * Serialises LandingData into a single self-contained .html landing page.
 *
 * Everything is derived from the uploaded presentation:
 *   - header logo  -> first image found in the deck (if any)
 *   - nav links    -> only the sections that actually have content
 *   - all text     -> pulled from the slides, with neutral fallbacks
 *
 * No fixed branding is applied, so each uploaded deck produces its own page.
 */
@Injectable({ providedIn: 'root' })
export class HtmlExportService {

  download(data: LandingData, filename = 'landing-page.html'): void {
    const html = this.build(data);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private esc(s: string): string {
    return (s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  build(d: LandingData): string {
    const esc = (s: string) => this.esc(s);

    // ----- HEADER (logo + dynamic nav + generic buttons) -----
    const logoHtml = d.logo
      ? `<img class="logo-img" src="${d.logo}" alt="${esc(d.title)} logo">`
      : `<span class="logo-text" data-cid="brand">${esc(d.title)}</span>`;

    const navLinks = d.navLinks
      .map((l, i) => `<a href="${l.href}" data-cid="nav${i}">${esc(l.label)}</a>`)
      .join('\n      ');

    // ----- HERO -----
    const titleHtml = this.splitTitle(d.title);
    const heroPhoto = d.heroImage
      ? `<div class="photo"><img src="${d.heroImage}" alt="${esc(d.title)}"></div>`
      : `<div class="photo placeholder" style="height:440px;display:flex;align-items:center;justify-content:center;color:#8893b5;border:2px dashed var(--line);border-radius:24px 24px 24px 90px;background:#fff">No image in deck</div>`;

    const f1 = d.stats[0];
    const f2 = d.stats[1];
    const floats = `
      ${f1 ? `<div class="hero-float f1"><div><span class="big" data-cid="hf0v">${esc(f1.value)}</span><small data-cid="hf0l">${esc(f1.label)}</small></div></div>` : ''}
      ${f2 ? `<div class="hero-float f2"><div><span class="big" data-cid="hf1v">${esc(f2.value)}</span><small data-cid="hf1l">${esc(f2.label)}</small></div></div>` : ''}`;

    // ----- STAT STRIP -----
    const strip = (d.stats.length ? d.stats : [{ value: '—', label: 'Overview' }])
      .slice(0, 4)
      .map((s, i) => `<div class="stripe-item"><div class="num" data-cid="st${i}v">${esc(s.value)}</div><div class="lbl" data-cid="st${i}l">${esc(s.label)}</div></div>`)
      .join('');

    // ----- OBJECTIVES -----
    // Colour theming: elements carry data-cid/data-bg/data-btn, and a generated
    // <style> block (see colorStyleBlock) applies the saved colours. This keeps
    // the downloaded page identical to the edited preview.
    const cid = (id: string) => ` data-cid="${id}"`;

    const objIcons = ['&#127979;','&#128187;','&#127916;','&#9917;','&#127859;','&#129505;','&#127891;','&#128296;','&#129309;'];
    const objectives = d.objectives
      .map((c, i) => `<div class="obj"><div class="ico">${objIcons[i % objIcons.length]}</div><h3${cid('obj-t-'+i)}>${esc(c.title)}</h3>${c.body ? `<p${cid('obj-b-'+i)}>${esc(c.body)}</p>` : ''}</div>`).join('');

    // ----- ACHIEVEMENTS -----
    const achIcons = ['&#127942;','&#127891;','&#11088;','&#128200;','&#128202;','&#128167;'];
    const achievements = d.achievements
      .map((c, i) => `<div class="ach"><div class="badge">${achIcons[i % achIcons.length]}</div><div><h3${cid('ach-t-'+i)}>${esc(c.title)}</h3>${c.body ? `<p${cid('ach-b-'+i)}>${esc(c.body)}</p>` : ''}</div></div>`).join('');

    // ----- PROJECTS -----
    const projects = d.projects
      .map((p, i) => `<div class="proj"><div class="head"><span class="n">${esc(p.code)}</span><span class="ttl">${esc(p.title)}</span></div><div class="body"><div class="total" data-cid="pr-tot-${i}">${esc(p.total)}</div><div class="stat"><span class="k">Completed</span><span class="v">${esc(p.completed)}</span></div><div class="stat"><span class="k">Ongoing</span><span class="v">${esc(p.ongoing)}</span></div><div class="stat"><span class="k">Yet to start</span><span class="v">${esc(p.pending)}</span></div></div></div>`).join('');

    // ----- SUPPORT -----
    const support = d.support
      .map((s, i) => `<div class="sup"><span class="dot">${i + 1}</span><p data-cid="sup-${i}">${esc(s)}</p></div>`).join('');

    // ----- SECTIONS (only render what we have) -----
    const aboutSection = d.intro ? `
<section class="section" id="about" data-bg="about">
  <div class="wrap about-grid">
    <div>
      <span class="eyebrow">About</span>
      <h2 class="section-title" data-cid="about-title">${esc(d.title)}</h2>
      <p data-cid="about-lead" style="margin-top:20px;font-size:1.07rem;color:#2b3654;font-weight:600">${esc(d.intro)}</p>
    </div>
    <div class="about-card">
      <h3 style="color:var(--navy);font-size:1.15rem;margin-bottom:14px">Overview</h3>
      <p data-cid="about-ov" style="color:#39435f;font-weight:500;font-size:.96rem">${esc(d.intro)}</p>
    </div>
  </div>
</section>` : '';

    const objSection = objectives ? `
<section class="section alt" id="objectives" data-bg="obj-sec">
  <div class="wrap"><span class="eyebrow">What we do</span><h2 class="section-title" data-cid="obj-h">Objectives</h2>
  <div class="obj-grid">${objectives}</div></div>
</section>` : '';

    const achSection = achievements ? `
<section class="section" id="achievements" data-bg="ach-sec">
  <div class="wrap"><span class="eyebrow">Highlights</span><h2 class="section-title" data-cid="ach-h">Key Highlights</h2>
  <div class="ach-grid">${achievements}</div></div>
</section>` : '';

    const projSection = projects ? `
<section class="section" id="impact" data-bg="proj-sec">
  <div class="wrap"><span class="eyebrow">On the ground</span><h2 class="section-title" data-cid="proj-h">Impact &amp; Status</h2>
  <div class="proj-grid">${projects}</div></div>
</section>` : '';

    const supSection = support ? `
<section class="section alt" id="support" data-bg="sup-sec">
  <div class="wrap"><span class="eyebrow">Working together</span><h2 class="section-title" data-cid="sup-h">Support</h2>
  <div class="sup-grid">${support}</div></div>
</section>` : '';

    const quote = esc(d.closingQuote || '');
    const ctaSection = quote ? `
<section class="cta" id="cta" data-bg="cta">
  <div class="wrap inner">
    <h2 data-cid="cta-title">${esc(d.title)}</h2>
    <p class="quote" data-cid="cta-quote">${quote}</p>
    <div class="hero-cta" style="justify-content:center">
      <a href="#about" class="btn btn-primary" data-btn="cta-primary">Learn More</a>
      <a href="#" class="btn" data-btn="cta-ghost" style="border:2px solid #fff;color:#fff">Contact</a>
    </div>
  </div>
</section>` : '';

    // ----- DETAILS: faithful render of every slide (text, bullets, tables, images) -----
    const renderTable = (t: { rows: string[][] }) => {
      if (!t.rows.length) return '';
      let rows = t.rows;
      let caption = '';
      // A lone first row (merged title cell) becomes the table caption.
      if (rows.length > 1 && rows[0].length === 1 && rows[1].length > 1) {
        caption = rows[0][0];
        rows = rows.slice(1);
      }
      const [head, ...body] = rows;
      const cap = caption ? `<caption>${esc(caption)}</caption>` : '';
      const thead = `<thead><tr>${head.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${body.map(r =>
        `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<div class="tbl-wrap"><table class="data-tbl">${cap}${thead}${tbody}</table></div>`;
    };

    const detailBlocks = d.slides.map((s, si) => {
      const paras = s.paragraphs.filter(p => p !== s.title)
        .map((p, pi) => `<p data-cid="det-p-${si}-${pi}">${esc(p)}</p>`).join('');
      const bullets = s.bullets.length
        ? `<ul>${s.bullets.map((b, bi) => `<li data-cid="det-bl-${si}-${bi}">${esc(b.replace(/^\s*[\d]+[\.\)]\s*/, '').replace(/^[•\-\u2022\u25CF\u2013]\s?/, ''))}</li>`).join('')}</ul>`
        : '';
      const chips = s.chips && s.chips.length
        ? `<div class="chips">${s.chips.map(c => `<span class="chip-pill">${esc(c)}</span>`).join('')}</div>`
        : '';
      const tables = s.tables.map(renderTable).join('');
      const imgs = s.images.length
        ? `<div class="detail-imgs">${s.images.map(im => `<img src="${im}" alt="">`).join('')}</div>`
        : '';
      const heading = s.title ? `<h3 class="detail-title" data-cid="det-t-${si}">${esc(s.title)}</h3>` : '';
      return `<article class="detail-card">${heading}${paras}${bullets}${chips}${tables}${imgs}</article>`;
    }).join('');

    const detailsSection = detailBlocks ? `
<section class="section" id="details" data-bg="det-sec">
  <div class="wrap"><span class="eyebrow">Full content</span><h2 class="section-title" data-cid="det-h">Details</h2>
  <div class="detail-list">${detailBlocks}</div></div>
</section>` : '';

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.title)}</title>
<style>:root{
  --navy:#27408B; --navy2:#1d3170; --ink:#15203f; --magenta:#DF2A6D; --magenta-d:#c11e5b;
  --sky:#70C8ED; --peri:#689ACD; --green:#78C79D; --purple:#65318B; --gold:#F8DA47;
  --paper:#eef2fb; --line:#d4ddf2;
  --muted:#3f4a68; --white:#fff;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Segoe UI',-apple-system,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--white);line-height:1.6;-webkit-font-smoothing:antialiased;font-weight:500}
img{max-width:100%;display:block}
a{text-decoration:none;color:inherit}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.eyebrow{display:inline-block;font-size:.8rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--magenta);margin-bottom:14px}
h2.section-title{font-size:clamp(1.8rem,3.4vw,2.6rem);font-weight:800;color:var(--navy);line-height:1.15;letter-spacing:-.02em}
.section{padding:84px 0}
.section.alt{background:var(--paper)}

/* NAV */
header.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;height:72px}
.brand{display:flex;align-items:center;gap:12px}
.brand img.tn{height:42px;width:auto}
.brand img.ns{height:40px;width:auto}
.brand .logo-img{height:44px;width:auto;max-width:200px;object-fit:contain}
.brand .logo-text{font-weight:800;font-size:1.15rem;color:var(--navy)}
.brand .sep{width:1px;height:34px;background:var(--line)}
.navlinks{display:flex;gap:30px;align-items:center}
.navlinks a{font-weight:600;font-size:.94rem;color:#33405e;transition:color .2s}
.navlinks a:hover{color:var(--magenta)}
.btn{display:inline-block;font-weight:700;border-radius:999px;padding:13px 28px;transition:transform .15s,box-shadow .2s;font-size:.95rem}
.btn-primary{background:var(--magenta);color:#fff;box-shadow:0 8px 22px rgba(214,22,107,.28)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(214,22,107,.36)}
.btn-ghost{border:2px solid var(--navy);color:var(--navy)}
.btn-ghost:hover{background:var(--navy);color:#fff}
.nav-cta{display:flex;gap:14px;align-items:center}
.burger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:0}
.burger span{width:26px;height:3px;background:var(--navy);border-radius:2px}

/* HERO */
.hero{position:relative;overflow:hidden;background:linear-gradient(160deg,#f6f8fd 0%,#eef2fb 100%)}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:54px;align-items:center;padding:80px 0 96px}
.hero h1{font-size:clamp(2.4rem,5vw,4rem);font-weight:800;line-height:1.05;color:var(--navy);letter-spacing:-.025em}
.hero h1 .accent{color:var(--magenta)}
.hero p.lead{font-size:1.2rem;color:#2b3654;font-weight:600;margin:26px 0 34px;max-width:560px}
.hero-cta{display:flex;gap:16px;flex-wrap:wrap}
.hero-badges{display:flex;gap:22px;margin-top:38px;flex-wrap:wrap}
.hero-badge{font-size:.84rem;font-weight:600;color:#41506f;display:flex;align-items:center;gap:8px}
.hero-badge::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--magenta)}
.hero-visual{position:relative}
.hero-visual .photo{border-radius:24px 24px 24px 90px;overflow:hidden;box-shadow:0 30px 60px rgba(30,58,138,.22);position:relative;z-index:2;background:#fff}
.hero-visual .photo img{width:100%;height:440px;object-fit:cover}
.hero-visual .blob{position:absolute;width:220px;height:220px;background:var(--magenta);border-radius:30% 70% 70% 30%/30% 30% 70% 70%;bottom:-30px;left:-30px;z-index:1;opacity:.9}
.hero-visual .dots{position:absolute;top:-26px;right:-20px;width:140px;height:140px;z-index:0;
  background-image:radial-gradient(var(--navy) 2px,transparent 2px);background-size:14px 14px;opacity:.35}
.hero-float{position:absolute;z-index:3;background:#fff;border-radius:16px;padding:14px 18px;box-shadow:0 14px 34px rgba(20,32,58,.16);display:flex;align-items:center;gap:12px}
.hero-float .big{font-size:1.5rem;font-weight:800;color:var(--navy);line-height:1}
.hero-float small{display:block;font-size:.72rem;color:#4a5470;font-weight:600}
.hero-float.f1{top:24px;left:-26px}
.hero-float.f2{bottom:46px;right:-22px}

/* STAT STRIP */
.stripe{background:var(--navy);color:#fff}
.stripe-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:46px 0}
.stripe-item{text-align:center;padding:8px 10px;position:relative}
.stripe-item:not(:last-child)::after{content:"";position:absolute;right:0;top:18%;height:64%;width:1px;background:rgba(255,255,255,.18)}
.stripe-item .num{font-size:clamp(1.7rem,3vw,2.5rem);font-weight:800;letter-spacing:-.02em}
.stripe-item .num .u{color:var(--sky)}
.stripe-item .lbl{font-size:.88rem;color:#dbe4f7;margin-top:4px;font-weight:600}

/* ABOUT */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.about-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px;box-shadow:0 10px 30px rgba(20,32,58,.05)}
.cert-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:24px}
.chip{background:var(--navy);color:#fff;font-weight:800;font-size:.84rem;padding:9px 17px;border-radius:999px}
.chip:nth-child(2){background:var(--magenta)}
.chip:nth-child(3){background:var(--green)}
.chip:nth-child(4){background:var(--purple)}

/* OBJECTIVES */
.obj-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px}
.obj{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px 22px;transition:transform .2s,box-shadow .2s}
.obj:hover{transform:translateY(-4px);box-shadow:0 16px 36px rgba(30,58,138,.12);border-color:#cdd8f0}
.obj .ico{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:14px;background:#eef2fb}
.obj:nth-child(1) .ico{background:var(--green)}
.obj:nth-child(2) .ico{background:var(--peri)}
.obj:nth-child(3) .ico{background:var(--magenta)}
.obj:nth-child(4) .ico{background:var(--sky)}
.obj:nth-child(5) .ico{background:var(--gold)}
.obj:nth-child(6) .ico{background:var(--purple)}
.obj:nth-child(7) .ico{background:var(--navy)}
.obj:nth-child(8) .ico{background:var(--green)}
.obj:nth-child(9) .ico{background:var(--magenta)}
.obj h3{font-size:1.06rem;color:var(--navy);font-weight:800;margin-bottom:6px}
.obj p{font-size:.94rem;color:#3f4a68;font-weight:500}

/* ACHIEVEMENTS */
.ach-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px;margin-top:48px}
.ach{display:flex;gap:18px;background:#fff;border-radius:16px;padding:24px;border:1px solid var(--line)}
.ach .badge{flex:0 0 auto;width:54px;height:54px;border-radius:14px;background:var(--magenta);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800}
.ach:nth-child(1) .badge{background:var(--gold)}
.ach:nth-child(2) .badge{background:var(--purple)}
.ach:nth-child(3) .badge{background:var(--navy)}
.ach:nth-child(4) .badge{background:var(--green)}
.ach:nth-child(5) .badge{background:var(--magenta)}
.ach:nth-child(6) .badge{background:var(--peri)}
.ach h3{font-size:1.04rem;color:var(--navy);margin-bottom:5px;font-weight:800}
.ach p{font-size:.94rem;color:#3f4a68;font-weight:500}

/* JOURNEY / CHART */
.journey-grid{display:grid;grid-template-columns:1fr 1.05fr;gap:54px;align-items:center}
.cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
.fcard{background:#fff;border-radius:14px;padding:18px 14px;text-align:center;border:1px solid var(--line)}
.fcard .t{font-size:.78rem;color:#4a5470;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.fcard .v{font-size:1.35rem;font-weight:800;color:var(--navy);margin-top:6px}
.total-pill{display:inline-flex;flex-direction:column;align-items:center;background:#fff;border:2px solid var(--magenta);border-radius:14px;padding:14px 30px;margin-bottom:22px}
.total-pill .v{font-size:1.9rem;font-weight:800;color:var(--magenta);line-height:1}
.total-pill .t{font-size:.8rem;color:#4a5470;font-weight:600;margin-top:3px}
.chart-card{background:linear-gradient(160deg,var(--navy),var(--navy2));border-radius:22px;padding:34px 30px;color:#fff}
.chart-card h3{font-size:1.15rem;font-weight:700;margin-bottom:6px}
.chart-card .sub{font-size:.85rem;opacity:.92;margin-bottom:24px}
.bars{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;height:240px;padding-top:18px}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:8px}
.bar{width:62%;max-width:46px;background:var(--sky);border-radius:6px 6px 0 0;position:relative;transition:height 1s ease}
#bars .bar-col:nth-child(1) .bar{background:var(--green)}
#bars .bar-col:nth-child(2) .bar{background:var(--peri)}
#bars .bar-col:nth-child(3) .bar{background:var(--sky)}
#bars .bar-col:nth-child(4) .bar{background:var(--gold)}
#bars .bar-col:nth-child(5) .bar{background:var(--magenta)}
.bar .val{position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:.8rem;font-weight:800;color:#fff;white-space:nowrap}
.bar-col .yr{font-size:.76rem;font-weight:700;opacity:.98;text-align:center}
.donors{margin-top:22px;font-weight:800;font-size:1.05rem;text-align:center}

/* IMPACT PROJECTS */
.proj-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:48px}
.proj{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.proj .head{background:var(--navy);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px}
.proj:nth-child(1) .head{background:var(--navy)}
.proj:nth-child(2) .head{background:var(--magenta)}
.proj:nth-child(3) .head{background:var(--purple)}
.proj:nth-child(4) .head{background:var(--peri)}
.proj:nth-child(5) .head{background:var(--green)}
.proj:nth-child(6) .head{background:var(--navy2)}
.proj .head .n{font-size:1.5rem;font-weight:800;opacity:.55}
.proj .head .ttl{font-size:.93rem;font-weight:800;text-transform:uppercase;letter-spacing:.03em;line-height:1.2}
.proj .body{padding:18px 20px}
.proj .total{font-size:1.9rem;font-weight:800;color:var(--magenta);margin-bottom:12px}
.proj .stat{display:flex;justify-content:space-between;font-size:.9rem;padding:5px 0;border-top:1px solid #eef0f7}
.proj .stat .k{color:#39435f;font-weight:500;font-weight:600}
.proj .stat .v{font-weight:800;color:var(--navy)}
.proj-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:26px}
.psum{border-radius:14px;padding:22px;text-align:center;color:#fff}
.psum:nth-child(1){background:var(--navy)}
.psum:nth-child(2){background:var(--magenta)}
.psum:nth-child(3){background:var(--green)}
.psum:nth-child(4){background:var(--purple)}
.psum .v{font-size:1.9rem;font-weight:800;color:#fff}
.psum .v.mag{color:#fff}
.psum .k{font-size:.84rem;color:rgba(255,255,255,.9);font-weight:600;margin-top:4px}

/* SUPPORT */
.sup-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:48px}
.sup{display:flex;gap:16px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 22px}
.sup .dot{flex:0 0 auto;width:32px;height:32px;border-radius:9px;background:var(--navy);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:.95rem}
.sup:nth-child(1) .dot{background:var(--green)}
.sup:nth-child(2) .dot{background:var(--peri)}
.sup:nth-child(3) .dot{background:var(--magenta)}
.sup:nth-child(4) .dot{background:var(--sky)}
.sup:nth-child(5) .dot{background:var(--gold);color:var(--ink)}
.sup:nth-child(6) .dot{background:var(--purple)}
.sup:nth-child(7) .dot{background:var(--navy)}
.sup:nth-child(8) .dot{background:var(--magenta)}
.sup p{font-size:.95rem;color:#36405e;font-weight:500}

/* CTA */
.cta{background:linear-gradient(135deg,var(--navy) 0%,#15296b 100%);color:#fff;text-align:center;position:relative;overflow:hidden}
.cta::before{content:"";position:absolute;width:300px;height:300px;border-radius:50%;background:var(--magenta);opacity:.25;top:-120px;right:-80px}
.cta::after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;background:var(--sky);opacity:.18;bottom:-130px;left:-60px}
.cta .inner{position:relative;z-index:2;padding:90px 0}
.cta h2{font-size:clamp(2rem,4vw,3rem);font-weight:800;line-height:1.1}
.cta .quote{font-size:1.15rem;font-style:italic;opacity:.92;margin:18px auto 32px;max-width:640px}
.cta .vals{display:flex;gap:16px;justify-content:center;margin-top:34px;flex-wrap:wrap}
.cta .vals span{font-size:.85rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85;padding:8px 0}
.cta .vals i{color:var(--sky);font-style:normal;margin:0 6px}

/* FOOTER */
footer{background:#0f1c44;color:#aeb9d6;padding:46px 0 28px}
.foot-grid{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap}
.foot-brand{display:flex;align-items:center;gap:14px}
.foot-brand img{height:46px}
.foot-brand .txt{font-weight:700;color:#fff;font-size:1.05rem}
.foot-brand .txt small{display:block;font-weight:400;color:#8e9bc0;font-size:.78rem}
.copy{font-size:.82rem;color:#7e8bb0;border-top:1px solid #20305f;margin-top:28px;padding-top:18px;text-align:center}

/* DETAILS (faithful slide content) */
.detail-list{display:flex;flex-direction:column;gap:22px;margin-top:40px}
.detail-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px 28px;box-shadow:0 6px 18px rgba(20,32,63,.05)}
.detail-title{color:var(--navy);font-size:1.25rem;font-weight:800;margin-bottom:14px;border-left:4px solid var(--magenta);padding-left:12px}
.detail-card p{color:#39435f;font-weight:500;margin-bottom:10px}
.detail-card ul{margin:8px 0 14px 4px;padding-left:20px}
.detail-card li{color:#39435f;font-weight:500;margin-bottom:6px}
.tbl-wrap{overflow-x:auto;margin:16px 0;border-radius:12px;border:1px solid var(--line)}
.data-tbl{border-collapse:collapse;width:100%;font-size:.92rem}
.data-tbl caption{caption-side:top;text-align:left;font-weight:800;color:var(--navy);padding:10px 14px;font-size:1rem}
.data-tbl th{background:var(--navy);color:#fff;font-weight:700;text-align:left;padding:12px 14px;white-space:nowrap}
.data-tbl td{padding:10px 14px;border-top:1px solid var(--line);color:#2b3654}
.data-tbl tbody tr:nth-child(even){background:var(--paper)}
.data-tbl tbody tr:hover{background:#e3ecfb}
.detail-imgs{display:flex;flex-wrap:wrap;gap:14px;margin-top:16px;align-items:center}
.detail-imgs img{max-height:150px;max-width:200px;width:auto;height:auto;object-fit:contain;border-radius:10px;border:1px solid var(--line);background:#fff;padding:6px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.chip-pill{background:var(--paper);border:1px solid var(--line);color:var(--navy);font-weight:700;font-size:.84rem;padding:6px 13px;border-radius:999px;white-space:nowrap}

@media(max-width:920px){
  .hero-grid,.about-grid,.journey-grid{grid-template-columns:1fr;gap:40px}
  .stripe-grid{grid-template-columns:repeat(2,1fr);gap:30px}
  .stripe-item:nth-child(2)::after{display:none}
  .obj-grid,.proj-grid{grid-template-columns:repeat(2,1fr)}
  .ach-grid,.sup-grid{grid-template-columns:1fr}
  .proj-summary{grid-template-columns:repeat(2,1fr)}
  .navlinks{display:none}
  .nav-cta .btn-ghost{display:none}
  .hero-visual .photo img{height:340px}
}
@media(max-width:560px){
  .section{padding:60px 0}
  .obj-grid,.proj-grid{grid-template-columns:1fr}
  .cards3{grid-template-columns:1fr}
  .stripe-grid{grid-template-columns:1fr}
  .stripe-item::after{display:none!important}
  .hero-float{display:none}
}${this.colorStyleBlock(d)}</style></head>
<body>

<header class="nav">
  <div class="wrap nav-inner">
    <div class="brand">${logoHtml}</div>
    <nav class="navlinks">
      ${navLinks}
    </nav>
    <div class="nav-cta">
      <a href="#about" class="btn btn-ghost" data-btn="nav-ghost">Learn More</a>
      <a href="#cta" class="btn btn-primary" data-btn="nav-primary">Contact</a>
    </div>
  </div>
</header>

<section class="hero" data-bg="hero">
  <div class="wrap hero-grid">
    <div>
      ${d.subtitle ? `<span class="eyebrow" data-cid="hero-eyebrow">${esc(d.subtitle)}</span>` : ''}
      <h1 data-cid="hero-title">${titleHtml}</h1>
      <p class="lead" data-cid="hero-lead">${esc(d.intro)}</p>
      <div class="hero-cta">
        <a href="#about" class="btn btn-primary" data-btn="hero-primary">Learn More</a>
        <a href="#cta" class="btn btn-ghost" data-btn="hero-ghost">Contact</a>
      </div>
    </div>
    <div class="hero-visual">
      <div class="dots"></div>
      <div class="blob"></div>
      ${heroPhoto}
      ${floats}
    </div>
  </div>
</section>

<section class="stripe" data-bg="stripe"><div class="wrap stripe-grid">${strip}</div></section>

${aboutSection}
${objSection}
${achSection}
${projSection}
${supSection}
${detailsSection}
${ctaSection}

<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        ${d.logo ? `<img src="${d.logo}" alt="${esc(d.title)}">` : ''}
        <div class="txt">${esc(d.title)}</div>
      </div>
      <nav style="display:flex;gap:24px;flex-wrap:wrap">
        ${navLinks}
      </nav>
    </div>
    <div class="copy">&copy; ${new Date().getFullYear()} ${esc(d.title)}. Generated from your presentation.</div>
  </div>
</footer>

<script>
const obs=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){document.querySelectorAll('#bars .bar').forEach((b,i)=>{const h=b.dataset.h;b.style.height='0%';setTimeout(()=>{b.style.height=h+'%';},80+i*90);});obs.disconnect();}});},{threshold:.3});
const bs=document.getElementById('bars'); if(bs){obs.observe(bs);}
</script>
</body></html>`;
  }

  /**
   * Build a <style> fragment from the saved colour map. Each key is one of:
   *   text:<cid> -> colours [data-cid="cid"]
   *   bg:<sid>   -> background for [data-bg="sid"]
   *   btn:<bid>  -> button background/border/text for [data-btn="bid"]
   * Using attribute selectors keeps the markup clean and applies on download.
   */
  private colorStyleBlock(d: LandingData): string {
    const map = d.textColors;
    if (!map) return '';
    const rules: string[] = [];
    for (const key of Object.keys(map)) {
      const color = map[key];
      if (!color) continue;
      if (key.startsWith('text:')) {
        rules.push(`[data-cid="${key.slice(5)}"]{color:${color} !important}`);
      } else if (key.startsWith('bg:')) {
        rules.push(`[data-bg="${key.slice(3)}"]{background:${color} !important}`);
      } else if (key.startsWith('btn:')) {
        const id = key.slice(4);
        // colour both background and border so ghost/solid buttons both update
        rules.push(`[data-btn="${id}"]{background:${color} !important;border-color:${color} !important}`);
      }
    }
    return rules.length ? '\n' + rules.join('\n') : '';
  }

  /** "Some Long Title" -> two lines, accent on the last word. */
  private splitTitle(title: string): string {
    const t = this.esc(title || 'Presentation');
    const words = t.split(' ');
    if (words.length <= 2) return t;
    const mid = Math.ceil(words.length / 2);
    const first = words.slice(0, mid).join(' ');
    const rest = words.slice(mid);
    const accent = rest.pop() || '';
    const restStr = rest.join(' ');
    return `${first}<br>${restStr ? restStr + ' ' : ''}<span class="accent">${accent}</span>`;
  }
}
