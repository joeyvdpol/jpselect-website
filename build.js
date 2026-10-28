/* JP SELECT build (draait op Netlify bij elke wijziging in GitHub).
   Maakt in _site/ voor elke pagina een eigen HTML-bestand met titel, omschrijving, canonieke link,
   taalvarianten, social-preview en productgegevens voor Google, plus sitemap.xml, robots.txt en _headers.
   Geen externe pakketten nodig. */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const SEO = require('./seo.js');

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE = String(process.env.JPS_SITE || cfg.site).replace(/\/$/, '');
const INDEXABLE = cfg.indexable === true;
const page = fs.readFileSync(path.join(ROOT, 'src', 'page.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
const products = (data.products || []).filter(p => p && p.id && !p.demo);
const LASTMOD = data.updated || new Date().toISOString().slice(0, 10);

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonld = o => JSON.stringify(o).replace(/</g, '\\u003c');
const IM = (src, w) => '/.netlify/images?url=' + encodeURIComponent('/' + String(src).replace(/^\//, '')) + '&w=' + w + '&q=78';

/* bron-pagina zonder de kopregels die alleen voor het prototype bedoeld zijn */
const FONT_HREF = (page.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/) || [])[1];
const body = page
  .replace(/<title>[^<]*<\/title>\s*/, '')
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '')
  .replace(/<meta name="description"[^>]*>\s*/, '')
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]+">\s*/, '');

/* stijl en sitecode naar gedeelde bestanden (één keer downloaden, daarna uit de cache) */
const h10 = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
let CSS = '', JS = '';
let bodyLean = body.replace(/<style>([\s\S]*?)<\/style>\s*/, (m, c) => { CSS = c; return ''; });
bodyLean = bodyLean.replace(/<script>([\s\S]*?)<\/script>\s*$/, (m, c) => { JS = c; return '__APPJS__'; });
if (!CSS || !JS) throw new Error('build: stijl of sitecode niet gevonden in src/page.html');
const CSS_FILE = 'assets/app.' + h10(CSS) + '.css', JS_FILE = 'assets/app.' + h10(JS) + '.js';
bodyLean = bodyLean.replace('__APPJS__', `<script src="/${JS_FILE}"></script>`).replace('<script src="seo.js"></script>', '<script src="/seo.js"></script>');

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
function write(rel, content) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); }

/* ---------- alle routes ---------- */
const brandSet = new Set(SEO.BRANDS.concat(products.map(p => p.brand)).filter(Boolean));
const routes = [];
for (const k of Object.keys(SEO.ROUTES.en)) { const [v, p] = SEO.ROUTES.en[k]; routes.push({ v, p: p || '' }); }
for (const b of brandSet) routes.push({ v: 'col', p: 'brand', b: SEO.brandSlug(b) });
for (const p of products) routes.push({ v: 'product', p: p.id });

/* ---------- tekst voor bezoekers/crawlers zonder JavaScript ---------- */
function linkList(L) {
  const items = [['men-sneakers'], ['women-sneakers'], ['shoes'], ['clothing'], ['new']].map(([k]) => `<li><a href="${SEO.pathOf({ v: 'col', p: k }, L)}">${esc(SEO.COLN[L][k])}</a></li>`);
  items.push(`<li><a href="${SEO.pathOf({ v: 'brands' }, L)}">${L === 'nl' ? 'Merken' : 'Brands'}</a></li>`);
  items.push(`<li><a href="${SEO.pathOf({ v: 'sell' }, L)}">${L === 'nl' ? 'Verkoop aan ons' : 'Sell to us'}</a></li>`);
  items.push(`<li><a href="${SEO.pathOf({ v: 'info', p: 'contact' }, L)}">Contact</a></li>`);
  return `<nav><ul>${items.join('')}</ul></nav>`;
}
function statusTxt(p, L) {
  if (p.status === 'sold') return L === 'nl' ? 'verkocht' : 'sold';
  if (p.status === 'coming') return L === 'nl' ? 'binnenkort' : 'coming soon';
  return p.price != null ? SEO.eur(p.price) : '';
}
function productItem(p, L) {
  return `<li><a href="${SEO.pathOf({ v: 'product', p: p.id }, L, products)}">${esc(p.brand + ' ' + p.model)}${p.size ? (L === 'nl' ? ', maat ' : ', size ') + esc(p.size) : ''}</a> – ${esc(statusTxt(p, L))}</li>`;
}
function inCol(p, preset) {
  const shoe = p.category === 'sneakers' || p.category === 'footwear';
  switch (preset) {
    case 'all': return true;
    case 'new': return p.status === 'available' || p.status === 'coming';
    case 'shoes': return shoe;
    case 'clothing': return p.category === 'clothing';
    case 'men-sneakers': return p.category === 'sneakers' && p.gender === 'men';
    case 'women-sneakers': return p.category === 'sneakers' && p.gender === 'women';
    case 'men-shoes': return shoe && p.gender === 'men';
    case 'women-shoes': return shoe && p.gender === 'women';
    default: return false;
  }
}
function staticContent(r, L, m) {
  const nl = L === 'nl';
  let h = `<h1>${esc(m.title.split(' | ')[0])}</h1><p>${esc(m.description)}</p>`;
  if (r.v === 'product') {
    const p = products.find(x => x.id === r.p);
    const c = (SEO.COND[L] || {})[p.condition] || '';
    h += '<ul>' + [
      p.price != null ? `<li>${nl ? 'Prijs' : 'Price'}: ${SEO.eur(p.price)}${p.retail ? ` (${nl ? 'nieuwprijs' : 'retail'} ${SEO.eur(p.retail)})` : ''}</li>` : '',
      `<li>${nl ? 'Status' : 'Status'}: ${esc(p.status === 'available' ? (nl ? 'beschikbaar' : 'available') : statusTxt(p, L))}</li>`,
      p.size ? `<li>${nl ? 'Maat' : 'Size'}: ${esc(p.size)}${p.sizeSystem ? ' ' + esc(p.sizeSystem) : ''}</li>` : '',
      c ? `<li>${nl ? 'Staat' : 'Condition'}: ${esc(c)}</li>` : '',
      p.color && p.color[L] ? `<li>${nl ? 'Kleur' : 'Colour'}: ${esc(p.color[L])}</li>` : '',
      p.material && p.material[L] ? `<li>${nl ? 'Materiaal' : 'Material'}: ${esc(p.material[L])}</li>` : '',
      p.sku ? `<li>${nl ? 'Artikelnummer' : 'Item number'}: ${esc(p.sku)}</li>` : ''
    ].join('') + '</ul>';
    h += (p.images || []).map((u, i) => `<img src="/${esc(u)}" alt="${esc(p.brand + ' ' + p.model + (i ? ' – ' + (i + 1) : ''))}" width="1000" height="1250">`).join('');
  } else if (r.v === 'col') {
    const list = r.p === 'brand' ? products.filter(p => SEO.brandSlug(p.brand) === r.b) : products.filter(p => inCol(p, r.p));
    if (list.length) h += '<ul>' + list.map(p => productItem(p, L)).join('') + '</ul>';
  } else if (r.v === 'brands') {
    h += '<ul>' + [...brandSet].map(b => `<li><a href="${SEO.pathOf({ v: 'col', p: 'brand', b: SEO.brandSlug(b) }, L)}">${esc(b)}</a></li>`).join('') + '</ul>';
  } else if (r.v === 'home') {
    const feat = products.filter(p => p.status !== 'sold').slice(0, 12);
    if (feat.length) h += '<ul>' + feat.map(p => productItem(p, L)).join('') + '</ul>';
  }
  return `<noscript><div style="max-width:880px;margin:40px auto;padding:0 24px;font-family:Georgia,serif">${linkList(L)}${h}<p>JP SELECT · info@jpselect.nl · KVK 42155019</p></div></noscript>`;
}

/* ---------- head per pagina ---------- */
function head(r, L, m, forceNoindex) {
  const noindex = !INDEXABLE || m.noindex || forceNoindex;
  const p = r.v === 'product' ? products.find(x => x.id === r.p) : null;
  const ogImg = m.image || (SITE + '/img/cat-men.jpg');
  return [
    `<!doctype html><html lang="${L === 'nl' ? 'nl' : 'en'}"><head><meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`,
    `<base href="/">`,
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}">`,
    noindex ? `<meta name="robots" content="noindex,nofollow">` : '',
    `<link rel="canonical" href="${esc(m.canonical)}">`,
    m.noindex ? '' : `<link rel="alternate" hreflang="en" href="${esc(m.alternates.en)}"><link rel="alternate" hreflang="nl" href="${esc(m.alternates.nl)}"><link rel="alternate" hreflang="x-default" href="${esc(m.alternates.en)}">`,
    `<meta property="og:site_name" content="JP SELECT"><meta property="og:type" content="${m.type === 'product' ? 'product' : 'website'}">`,
    `<meta property="og:title" content="${esc(m.title)}"><meta property="og:description" content="${esc(m.description)}">`,
    `<meta property="og:url" content="${esc(m.canonical)}"><meta property="og:image" content="${esc(ogImg)}"><meta property="og:locale" content="${L === 'nl' ? 'nl_NL' : 'en_GB'}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    FONT_HREF ? `<link rel="stylesheet" href="${FONT_HREF}">` : '',
    `<link rel="stylesheet" href="/${CSS_FILE}">`,
    `<link rel="preconnect" href="https://cdnjs.cloudflare.com"><link rel="preconnect" href="https://unpkg.com">`,
    p && p.images && p.images[0] ? `<link rel="preload" as="image" href="${esc(IM(p.images[0], 1200))}">` : '',
    ...m.jsonld.map(o => `<script type="application/ld+json">${jsonld(o)}</script>`),
    `<style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>`,
    `</head><body>`
  ].filter(Boolean).join('\n');
}

/* ---------- bouwen ---------- */
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });
for (const d of ['data', 'img', 'media', 'scene']) copyDir(path.join(ROOT, d), path.join(OUT, d));
fs.copyFileSync(path.join(ROOT, 'seo.js'), path.join(OUT, 'seo.js'));
write(CSS_FILE, CSS);
write(JS_FILE, JS);

const sitemap = [];
let count = 0;
for (const r of routes) {
  for (const L of ['en', 'nl']) {
    const m = SEO.meta(r, L, products, SITE);
    const rel = SEO.pathOf(r, L, products).replace(/^\//, '') + 'index.html';
    write(rel, head(r, L, m) + '\n' + bodyLean + '\n' + staticContent(r, L, m) + '\n</body></html>\n');
    count++;
    if (!m.noindex && L === 'en') sitemap.push(m);
  }
}
/* 404 */
{ const m = SEO.meta({ v: 'home' }, 'en', products, SITE); write('404.html', head({ v: 'home' }, 'en', m, true) + '\n' + bodyLean + '\n</body></html>\n'); }

/* sitemap met taalvarianten */
const sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
for (const m of sitemap) {
  for (const L of ['en', 'nl']) {
    sm.push(`<url><loc>${esc(m.alternates[L])}</loc><lastmod>${LASTMOD}</lastmod>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${esc(m.alternates.en)}"/><xhtml:link rel="alternate" hreflang="nl" href="${esc(m.alternates.nl)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(m.alternates.en)}"/></url>`);
  }
}
sm.push('</urlset>');
write('sitemap.xml', sm.join('\n') + '\n');

write('robots.txt', INDEXABLE ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
write('_headers', ['/*', INDEXABLE ? '' : '  X-Robots-Tag: noindex, nofollow', '  Referrer-Policy: strict-origin-when-cross-origin', '  X-Content-Type-Options: nosniff',
  '/data/*', '  Cache-Control: public, max-age=60, must-revalidate', '/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '/seo.js', '  Cache-Control: public, max-age=300, must-revalidate'].filter(Boolean).join('\n') + '\n');

/* controle: ontbrekende afbeeldingen */
const missing = [];
for (const p of products) for (const u of p.images || []) if (!fs.existsSync(path.join(ROOT, u))) missing.push(p.id + ': ' + u);
console.log(`JP SELECT build: ${count} pagina's, ${sitemap.length * 2} adressen in sitemap, site ${SITE}, ${INDEXABLE ? 'vindbaar' : 'NIET vindbaar (nog niet live)'}`);
if (missing.length) console.log('Let op, ontbrekende afbeeldingen:\n  ' + missing.join('\n  '));
