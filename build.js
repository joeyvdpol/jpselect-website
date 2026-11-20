/* JP SELECT build (draait op Netlify bij elke wijziging in GitHub).
   Maakt in _site/ voor elke pagina een eigen HTML-bestand met titel, omschrijving, canonieke link,
   taalvarianten, social-preview en productgegevens voor Google, plus sitemap.xml, robots.txt en _headers.
   Geen externe pakketten nodig. */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const SEO = require('./seo.js');
const CONTENT = require('./content.js');
const FEED = require('./feed.js');

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
const C = CONTENT.create({ pageHtml: page, products, site: SITE });
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
bodyLean = bodyLean.replace('__APPJS__', `<script src="/${JS_FILE}"></script>`).replace('<script src="seo.js"></script>', '<script src="/seo.js"></script>').replace('<script src="shop.js"></script>', '<script src="/shop.js"></script>');

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

/* tekst in de ruwe HTML: zichtbaar zonder JavaScript; met JavaScript verborgen tot de site zelf tekent
   (de site vervangt de inhoud van #root). Tekent de site niet binnen 6 seconden, dan blijft de tekst zichtbaar. */
const PRE_CSS = '.js #root>.prerender{display:none}.prerender{max-width:880px;margin:0 auto;padding:32px 24px 64px;font:300 16px/1.65 Jost,Helvetica,Arial,sans-serif;color:#242424;background:#F6F3EE}.prerender h1,.prerender h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:400;line-height:1.15}.prerender h1{font-size:34px}.prerender h2{font-size:24px;margin-top:36px}.prerender p,.prerender ul,.prerender ol{margin:0 0 16px}.prerender a{color:inherit}.prerender img{width:220px;height:auto;margin:0 8px 8px 0}.prerender blockquote{margin:16px 0;padding-left:14px;border-left:2px solid #C9B79C}';
const PRE_JS = "document.documentElement.classList.add('js');setTimeout(function(){var r=document.getElementById('root');var f=r&&r.firstElementChild;if(f&&f.className==='prerender')document.documentElement.classList.remove('js')},6000)";
function withRoot(r, L) {
  if (!bodyLean.includes('<div id="root"></div>')) throw new Error('build: <div id="root"></div> niet gevonden');
  return bodyLean.replace('<div id="root"></div>', () => '<div id="root"><div class="prerender">' + C.html(r, L) + '</div></div>');
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
    `<link rel="icon" href="/favicon.ico" sizes="48x48">`,
    `<link rel="icon" href="/img/brand/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/img/brand/favicon-192.png" type="image/png" sizes="192x192">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
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
    `<style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}${PRE_CSS}</style>`,
    `<script>${PRE_JS}</script>`,
    `<link rel="alternate" type="text/markdown" href="${esc(m.canonical.replace(/\/?$/, '/') + 'index.md')}">`,
    `</head><body>`
  ].filter(Boolean).join('\n');
}

/* ---------- bouwen ---------- */
rmrf(OUT);
fs.mkdirSync(OUT, { recursive: true });
for (const d of ['data', 'img', 'media', 'scene']) copyDir(path.join(ROOT, d), path.join(OUT, d));
fs.copyFileSync(path.join(ROOT, 'favicon.ico'), path.join(OUT, 'favicon.ico'));
fs.copyFileSync(path.join(ROOT, 'img/brand/apple-touch-icon.png'), path.join(OUT, 'apple-touch-icon.png'));
write('site.webmanifest', JSON.stringify({ name: 'JP SELECT', short_name: 'JP SELECT', start_url: '/', display: 'browser', background_color: '#F6F3EE', theme_color: '#242424',
  icons: [{ src: '/img/brand/favicon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/img/brand/favicon-512.png', sizes: '512x512', type: 'image/png' }] }) + '\n');
fs.copyFileSync(path.join(ROOT, 'seo.js'), path.join(OUT, 'seo.js'));
fs.copyFileSync(path.join(ROOT, 'shop.js'), path.join(OUT, 'shop.js'));
write(CSS_FILE, CSS);
write(JS_FILE, JS);

const sitemap = [];
let count = 0;
for (const r of routes) {
  for (const L of ['en', 'nl']) {
    const m = SEO.meta(r, L, products, SITE);
    const rel = SEO.pathOf(r, L, products).replace(/^\//, '') + 'index.html';
    write(rel, head(r, L, m) + '\n' + withRoot(r, L) + '\n</body></html>\n');
    write(rel.replace(/index\.html$/, 'index.md'), C.markdown(r, L));
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

write('llms.txt', C.llms());
write('404.md', C.notFoundMarkdown('en'));
write('google-merchant-feed.xml', FEED.merchantFeed({ products, site: SITE, lang: 'nl' }));

write('robots.txt', INDEXABLE ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
write('_headers', ['/*', INDEXABLE ? '' : '  X-Robots-Tag: noindex, nofollow', '  Referrer-Policy: strict-origin-when-cross-origin', '  X-Content-Type-Options: nosniff',
  '/data/*', '  Cache-Control: public, max-age=60, must-revalidate', '/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '/seo.js', '  Cache-Control: public, max-age=300, must-revalidate', '/shop.js', '  Cache-Control: public, max-age=300, must-revalidate',
  '/*.md', '  Content-Type: text/markdown; charset=utf-8', '  Vary: Accept', '/llms.txt', '  Content-Type: text/plain; charset=utf-8',
  '/google-merchant-feed.xml', '  Content-Type: application/xml; charset=utf-8', '  Cache-Control: public, max-age=600'].filter(Boolean).join('\n') + '\n');

/* controle: ontbrekende afbeeldingen */
const missing = [];
for (const p of products) for (const u of p.images || []) if (!fs.existsSync(path.join(ROOT, u))) missing.push(p.id + ': ' + u);
console.log(`JP SELECT build: ${count} pagina's, ${sitemap.length * 2} adressen in sitemap, site ${SITE}, ${INDEXABLE ? 'vindbaar' : 'NIET vindbaar (nog niet live)'}`);
if (missing.length) console.log('Let op, ontbrekende afbeeldingen:\n  ' + missing.join('\n  '));
