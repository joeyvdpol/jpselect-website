/* Tests voor de build-uitvoer: tekst in ruwe HTML, Markdown-versies, llms.txt, Merchant-feed en content negotiation.
   Draaien: npm test   (bouwt de site eerst in een tijdelijke map; geen externe pakketten nodig) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
let OUT;

test.before(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jps-build-'));
  for (const f of ['build.js', 'seo.js', 'shop.js', 'content.js', 'feed.js', 'site.config.json']) fs.copyFileSync(path.join(REPO, f), path.join(tmp, f));
  for (const d of ['src', 'data']) fs.cpSync(path.join(REPO, d), path.join(tmp, d), { recursive: true });
  execFileSync(process.execPath, ['build.js'], { cwd: tmp, stdio: 'pipe', env: { ...process.env, JPS_SITE: 'https://jpselect.nl' } });
  OUT = path.join(tmp, '_site');
});

const read = rel => fs.readFileSync(path.join(OUT, rel), 'utf8');
const textOf = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const rootOf = html => { const m = html.match(/<div id="root">([\s\S]*?)<\/div><\/div>/); return m ? m[1] : ''; };

test('homepage heeft ruim 500 tekens tekst en één H1 in de ruwe HTML', () => {
  for (const f of ['index.html', 'nl/index.html']) {
    const html = read(f);
    const root = rootOf(html);
    assert.ok(textOf(root).length >= 500, f + ': te weinig tekst (' + textOf(root).length + ')');
    assert.equal((root.match(/<h1>/g) || []).length, 1, f + ': precies één H1');
    assert.ok(!/<h3>/.test(root) || /<h2>/.test(root), f + ': koppen op volgorde');
  }
});

test('binnenpagina’s hebben hun hoofdtekst in de ruwe HTML', () => {
  const pages = ['nl/privacy/index.html', 'brands/index.html', 'nl/voorwaarden/index.html', 'shipping-returns/index.html'];
  const prod = fs.readdirSync(path.join(OUT, 'nl/product'))[0];
  pages.push('nl/product/' + prod + '/index.html');
  for (const f of pages) {
    const t = textOf(rootOf(read(f)));
    assert.ok(t.length >= 300, f + ': te weinig tekst (' + t.length + ')');
  }
});

test('de site verbergt de tekst alleen terwijl JavaScript de pagina tekent', () => {
  const html = read('index.html');
  assert.match(html, /\.js #root>\.prerender\{display:none\}/);
  assert.match(html, /classList\.add\('js'\)/);
  assert.match(html, /<link rel="alternate" type="text\/markdown" href="https:\/\/jpselect\.nl\/index\.md">/);
  assert.doesNotMatch(html, /<noscript><div/);
});

test('elke HTML-pagina heeft een Markdown-versie met een H1', () => {
  let n = 0;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html') {
        const md = p.replace(/index\.html$/, 'index.md');
        assert.ok(fs.existsSync(md), 'ontbreekt: ' + md);
        const t = fs.readFileSync(md, 'utf8');
        assert.match(t, /^# \S/, md + ' begint niet met een H1');
        assert.doesNotMatch(t, /<[a-z][^>]*>/i, md + ' bevat HTML');
        assert.doesNotMatch(t, /undefined|\[object Object\]/, md);
        n++;
      }
    }
  })(OUT);
  assert.ok(n >= 100);
});

test('llms.txt volgt het llmstxt.org-formaat en heeft een when-to-use-deel', () => {
  const t = read('llms.txt');
  const lines = t.split('\n');
  assert.equal(lines[0], '# JP SELECT');
  assert.match(t, /\n> \S.+\n/, 'samenvatting als blockquote');
  assert.match(t, /\*\*When to use JP SELECT\*\*/);
  assert.match(t, /\n## Shop\n/);
  assert.match(t, /\n## Optional\n/);
  for (const l of lines.filter(l => /^- \[/.test(l))) assert.match(l, /^- \[[^\]]+\]\(https:\/\/jpselect\.nl\/[^)\s]*\)(: .+)?$/, 'linkregel: ' + l);
  assert.ok(t.indexOf('## ') > t.indexOf('**When to use'), 'when-to-use staat voor de eerste H2');
});

test('404 in Markdown', () => {
  const t = read('404.md');
  assert.match(t, /^# Page not found \(404\)/);
  assert.match(t, /sitemap\.xml/);
  assert.match(t, /llms\.txt/);
});

test('Merchant-feed: geldige RSS met alleen beschikbare stukken en verplichte velden', () => {
  const x = read('google-merchant-feed.xml');
  const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data/products.json'), 'utf8'));
  const avail = data.products.filter(p => p.status === 'available' && p.price > 0 && (p.images || []).length && !p.demo);
  assert.match(x, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rss version="2\.0" xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0">/);
  const items = x.split('<item>').slice(1);
  assert.equal(items.length, avail.length);
  for (const it of items) {
    for (const tag of ['id', 'title', 'description', 'link', 'image_link', 'availability', 'price', 'condition', 'brand', 'google_product_category'])
      assert.match(it, new RegExp('<g:' + tag + '>[^<]+</g:' + tag + '>'), 'ontbreekt g:' + tag);
    assert.match(it, /<g:price>\d+\.\d{2} EUR<\/g:price>/);
    assert.match(it, /<g:availability>in_stock<\/g:availability>/);
    assert.match(it, /<g:link>https:\/\/jpselect\.nl\/nl\/product\/[a-z0-9-]+\/<\/g:link>/);
  }
  assert.doesNotMatch(x, /&(?!amp;|lt;|gt;|quot;|apos;)/, 'onge-escapete &');
});

test('_headers geeft Markdown het juiste Content-Type', () => {
  const h = read('_headers');
  assert.match(h, /\/\*\.md\n {2}Content-Type: text\/markdown; charset=utf-8\n {2}Vary: Accept/);
});

test('homepage JSON-LD noemt de hoofdproducten', () => {
  const html = read('index.html');
  assert.match(html, /"keywords":"luxury sneakers, pre-owned Hogan sneakers, designer fashion"/);
  assert.match(textOf(rootOf(html)), /luxury sneakers/);
});

test('Organization JSON-LD is compleet: description, contactPoint en adres', () => {
  const html = read('index.html');
  const org = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1])).find(o => o['@type'] === 'Organization');
  assert.ok(org, 'Organization ontbreekt');
  assert.ok(org.description && org.description.length > 50);
  assert.equal(org.contactPoint['@type'], 'ContactPoint');
  assert.ok(org.contactPoint.contactType && org.contactPoint.email);
  assert.equal(org.address['@type'], 'PostalAddress');
  assert.ok(org.address.streetAddress && org.address.postalCode && org.address.addressLocality);
});

/* ---------- edge function: content negotiation ---------- */
test('content negotiation (edge function)', async () => {
  /* het bestand is een ES-module (Deno/Netlify Edge); hier als data-URL laden */
  const src = fs.readFileSync(path.join(REPO, 'netlify/edge-functions/accept-markdown.js'), 'utf8');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  assert.equal(mod.prefersMarkdown('text/markdown'), true);
  assert.equal(mod.prefersMarkdown('text/markdown, text/html;q=0.8'), true);
  assert.equal(mod.prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'), false);
  assert.equal(mod.prefersMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(mod.prefersMarkdown(''), false);
  assert.equal(mod.markdownPath('/'), '/index.md');
  assert.equal(mod.markdownPath('/nl/privacy'), '/nl/privacy/index.md');
  assert.equal(mod.markdownPath('/nl/index.html'), '/nl/index.md');
  assert.equal(mod.markdownPath('/img/a.jpg'), null);

  const files = { '/index.md': '# JP SELECT\n\nhallo\n', '/404.md': '# Page not found (404)\n\nzie /sitemap.xml\n' };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async u => { const p = new URL(u).pathname; return files[p] ? new Response(files[p], { status: 200 }) : new Response('nf', { status: 404 }); };
  try {
    const ctx = { next: async () => new Response('<!doctype html><title>x</title>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', vary: 'Accept-Encoding' } }) };
    let r = await mod.default(new Request('https://jpselect.nl/', { headers: { accept: 'text/markdown' } }), ctx);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^text\/markdown/);
    assert.equal(r.headers.get('vary'), 'Accept');
    assert.match(await r.text(), /^# JP SELECT/);

    r = await mod.default(new Request('https://jpselect.nl/', { headers: { accept: 'text/html' } }), ctx);
    assert.match(r.headers.get('content-type'), /^text\/html/);
    assert.equal(r.headers.get('vary'), 'Accept-Encoding, Accept');

    r = await mod.default(new Request('https://jpselect.nl/bestaat-niet', { headers: { accept: 'text/markdown' } }), ctx);
    assert.equal(r.status, 404);
    assert.match(r.headers.get('content-type'), /^text\/markdown/);
    const body = await r.text();
    assert.ok(body.length >= 20);
    assert.match(body, /sitemap/);
  } finally { globalThis.fetch = realFetch; }
});
