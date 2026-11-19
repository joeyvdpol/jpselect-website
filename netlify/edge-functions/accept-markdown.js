/* Markdown-versie van elke pagina voor AI-agents (content negotiation, zie acceptmarkdown.com).
   - Vraagt iemand met "Accept: text/markdown" (en verkiest hij dat boven HTML), dan krijgt hij index.md
     uit dezelfde map, met Content-Type: text/markdown.
   - Bestaat de pagina niet: status 404 met een korte Markdown-uitleg.
   - Alle andere bezoekers krijgen gewoon de HTML-pagina; we zetten er "Vary: Accept" bij,
     zodat tussenliggende caches HTML en Markdown niet door elkaar halen. */

// q-waarde van een mediatype in een Accept-header (een exacte match gaat voor "type/*" en "*/*")
export function quality(accept, type) {
  const [main] = type.split('/');
  let best = -1, spec = -1;
  for (const part of String(accept || '').split(',')) {
    const [range, ...params] = part.trim().toLowerCase().split(';').map(s => s.trim());
    if (!range) continue;
    let q = 1;
    for (const p of params) { const m = p.match(/^q=([0-9.]+)$/); if (m) q = Math.max(0, Math.min(1, parseFloat(m[1]) || 0)); }
    const s = range === type ? 3 : range === main + '/*' ? 2 : range === '*/*' ? 1 : 0;
    if (s > spec || (s === spec && q > best)) { if (s > 0) { spec = s; best = q; } }
  }
  return spec > 0 ? best : 0;
}

/* Markdown alleen als die expliciet gevraagd wordt en minstens even zwaar weegt als HTML */
export function prefersMarkdown(accept) {
  const a = String(accept || '').toLowerCase();
  if (!/text\/markdown/.test(a)) return false;
  const md = quality(a, 'text/markdown');
  return md > 0 && md >= quality(a, 'text/html');
}

/* pad -> bijbehorend Markdown-bestand (alleen voor pagina's, niet voor bestanden met een extensie) */
export function markdownPath(pathname) {
  let p = String(pathname || '/');
  if (/\.[a-z0-9]{1,8}$/i.test(p) && !/\/index\.html$/i.test(p)) return null;
  p = p.replace(/\/index\.html$/i, '/');
  if (!p.endsWith('/')) p += '/';
  return p + 'index.md';
}

function withVary(res) {
  const h = new Headers(res.headers);
  const v = h.get('vary');
  if (!v) h.set('vary', 'Accept');
  else if (!/(^|,)\s*accept\s*(,|$)/i.test(v)) h.set('vary', v + ', Accept');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

const MD = { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept', 'x-content-type-options': 'nosniff' };

export default async function handler(request, context) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();
  const url = new URL(request.url);
  if (!prefersMarkdown(request.headers.get('accept'))) return withVary(await context.next());

  const mdPath = markdownPath(url.pathname);
  if (mdPath) {
    const r = await fetch(new URL(mdPath, url.origin), { headers: { accept: 'text/markdown' } });
    if (r.ok) {
      const text = await r.text();
      return new Response(request.method === 'HEAD' ? null : text, { status: 200, headers: { ...MD, 'cache-control': 'public, max-age=300' } });
    }
  }
  /* niet gevonden (of een bestand zonder Markdown-versie): 404 in Markdown */
  const nf = await fetch(new URL('/404.md', url.origin));
  const body = nf.ok ? await nf.text() : '# Page not found (404)\n\nThis page does not exist on jpselect.nl. See https://jpselect.nl/sitemap.xml or https://jpselect.nl/llms.txt.\n';
  return new Response(request.method === 'HEAD' ? null : body, { status: 404, headers: { ...MD, 'cache-control': 'no-store' } });
}

export const config = {
  path: '/*',
  excludedPath: ['/img/*', '/media/*', '/assets/*', '/data/*', '/scene/*', '/.netlify/*', '/*.md', '/*.js', '/*.css', '/*.xml', '/*.txt', '/*.json', '/*.jpg', '/*.png', '/*.webp', '/*.svg', '/*.mp4', '/*.webm', '/*.ico']
};
