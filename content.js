/* JP SELECT: de tekst van elke pagina als Markdown en als eenvoudige HTML.
   Gebruikt door build.js voor:
   - tekst in de ruwe HTML (voor zoekmachines en AI-crawlers die geen JavaScript draaien),
   - een Markdown-versie van elke pagina (index.md, opgevraagd met Accept: text/markdown),
   - llms.txt.
   De teksten komen uit de site zelf (src/page.html), zodat er maar één bron is. */
'use strict';
const vm = require('vm');
const SEO = require('./seo.js');
const SHOP = require('./shop.js');

/* teksten (T), bedrijfsgegevens (CO), reviews (REV, REVS) en juridische pagina's (LEGAL) uit de sitecode halen */
function loadTexts(pageHtml) {
  const a = pageHtml.indexOf('const T={'), b = pageHtml.indexOf('const LANGN');
  const c = pageHtml.indexOf('const LEGAL={'), d = pageHtml.indexOf('function Info(');
  if (a < 0 || b < a || c < 0 || d < c) throw new Error('content: teksten niet gevonden in src/page.html');
  const code = pageHtml.slice(a, b) + '\n' + pageHtml.slice(c, d) + '\n;({T,CO,REV,REVS,LEGAL})';
  return vm.runInNewContext(code, { html: () => '' }, { timeout: 2000 });
}

const strip = s => String(s == null ? '' : s).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const mdEsc = s => strip(s).replace(/([\\`*_[\]])/g, '\\$1');
const eu = (v, L) => (L === 'nl' ? '€ ' + v.toFixed(2).replace('.', ',') : '€ ' + v.toFixed(2)).replace(/[,.]00$/, '');
const fillRates = (x, L) => String(x)
  .replace('{NL}', eu(SHOP.rates.NL, L)).replace('{BE}', eu(SHOP.rates.BE, L)).replace('{FR}', eu(SHOP.rates.FR, L))
  .replace('{IT}', eu(SHOP.rates.IT, L)).replace('{EU}', eu(SHOP.rates.EU, L)).replace(/\{FREE\}/g, eu(SHOP.freeFrom, L));

function create({ pageHtml, products, site }) {
  const X = loadTexts(pageHtml);
  site = String(site).replace(/\/$/, '');
  const url = (r, L) => site + SEO.pathOf(r, L, products);
  const brandSet = [...new Set(SEO.BRANDS.concat(products.map(p => p.brand)).filter(Boolean))];

  function statusTxt(p, L) {
    const nl = L === 'nl';
    if (p.status === 'sold') return nl ? 'verkocht' : 'sold';
    if (p.status === 'coming') return nl ? 'binnenkort' : 'coming soon';
    return p.price != null ? SEO.eur(p.price) : (L === 'nl' ? 'prijs op aanvraag' : 'price on request');
  }
  const size = (p, L) => p.size ? (L === 'nl' ? ', maat ' : ', size ') + p.size + (p.sizeSystem && p.sizeSystem !== 'EU' ? ' ' + p.sizeSystem : '') : '';
  const productLine = (p, L) => `- [${mdEsc(p.brand + ' ' + p.model)}${size(p, L)}](${url({ v: 'product', p: p.id }, L)}) – ${statusTxt(p, L)}`;

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
  const order = list => list.slice().sort((a, b) => ({ available: 0, coming: 1, sold: 2 }[a.status] ?? 3) - ({ available: 0, coming: 1, sold: 2 }[b.status] ?? 3));

  function nav(L) {
    const nl = L === 'nl';
    return [
      `- [${SEO.COLN[L].all}](${url({ v: 'col', p: 'all' }, L)})`,
      `- [${SEO.COLN[L]['new']}](${url({ v: 'col', p: 'new' }, L)})`,
      `- [${SEO.COLN[L]['men-sneakers']}](${url({ v: 'col', p: 'men-sneakers' }, L)})`,
      `- [${SEO.COLN[L]['women-sneakers']}](${url({ v: 'col', p: 'women-sneakers' }, L)})`,
      `- [${SEO.COLN[L].clothing}](${url({ v: 'col', p: 'clothing' }, L)})`,
      `- [${nl ? 'Merken' : 'Brands'}](${url({ v: 'brands' }, L)})`,
      `- [${nl ? 'Verkoop aan ons' : 'Sell to us'}](${url({ v: 'sell' }, L)})`,
      `- [${nl ? 'Verzenden & retourneren' : 'Shipping & returns'}](${url({ v: 'info', p: 'ship' }, L)})`,
      `- [Contact](${url({ v: 'info', p: 'contact' }, L)})`
    ].join('\n');
  }
  function footer(L) {
    const nl = L === 'nl';
    return [
      '---',
      `JP SELECT · ${X.CO.addr} · ${nl ? 'KVK' : 'Chamber of Commerce'} ${X.CO.kvk} · ${nl ? 'btw' : 'VAT'} ${X.CO.btw} · ${X.CO.email}`,
      '',
      `${nl ? 'Meer' : 'More'}: [${nl ? 'alle pagina’s (sitemap)' : 'all pages (sitemap)'}](${site}/sitemap.xml) · [llms.txt](${site}/llms.txt) · [${nl ? 'andere taal' : 'other language'}](${nl ? site + '/' : site + '/nl/'})`
    ].join('\n');
  }

  function body(r, L) {
    const t = X.T[L], nl = L === 'nl', out = [];
    const m = SEO.meta(r, L, products, site);
    if (r.v === 'home') {
      out.push(`# JP SELECT – ${nl ? 'tweedehands luxe sneakers en designermode' : 'pre-owned luxury sneakers and designer fashion'}`);
      out.push(strip(m.description));
      out.push(strip(t.manT));
      out.push(`## ${strip(t.philoH)}`, ...t.philoP.map(strip));
      out.push(`## ${strip(t.hzH)}`, t.hz.map(([h, p]) => `- **${strip(h)}** – ${strip(p)}`).join('\n'));
      const now = order(products.filter(p => p.status !== 'sold'));
      if (now.length) out.push(`## ${strip(t.featH)}`, now.map(p => productLine(p, L)).join('\n'));
      out.push(`## Shop`, nav(L));
      out.push(`## ${strip(t.tradeH)}`, strip(t.tradeP), t.steps.map(([h, p], i) => `${i + 1}. **${strip(h)}** – ${strip(p)}`).join('\n'), `[${strip(t.tradeGo)}](${url({ v: 'sell' }, L)})`);
      out.push(`## ${strip(t.revEy)}`, `${String(X.REV.score).replace('.', nl ? ',' : '.')} / 5 · ${X.REV.count} ${nl ? 'beoordelingen van kopers op Vinted' : 'reviews from buyers on Vinted'} · [${strip(t.revRead)}](${url({ v: 'reviews' }, L)})`);
    } else if (r.v === 'product') {
      const p = products.find(x => x.id === r.p);
      const c = (SEO.COND[L] || {})[p.condition] || '';
      out.push(`# ${mdEsc(p.brand + ' ' + p.model)}`);
      out.push(strip(SEO.productDesc(p, L)));
      out.push([
        p.price != null ? `- ${nl ? 'Prijs' : 'Price'}: ${SEO.eur(p.price)}${p.retail ? ` (${nl ? 'nieuwprijs' : 'retail'} ${SEO.eur(p.retail)})` : ''}` : '',
        `- ${nl ? 'Beschikbaarheid' : 'Availability'}: ${p.status === 'available' ? (nl ? 'op voorraad, uniek stuk' : 'in stock, one of a kind') : statusTxt(p, L)}`,
        p.size ? `- ${nl ? 'Maat' : 'Size'}: ${p.size}${p.sizeSystem ? ' ' + p.sizeSystem : ''}` : '',
        c ? `- ${nl ? 'Staat' : 'Condition'}: ${c}${p.condition.startsWith('new') ? '' : ' · pre-owned'}` : '',
        p.color && p.color[L] ? `- ${nl ? 'Kleur' : 'Colour'}: ${strip(p.color[L])}` : '',
        p.material && p.material[L] ? `- ${nl ? 'Materiaal' : 'Material'}: ${strip(p.material[L])}` : '',
        `- ${nl ? 'Merk' : 'Brand'}: [${mdEsc(p.brand)}](${url({ v: 'col', p: 'brand', b: SEO.brandSlug(p.brand) }, L)})`,
        p.sku ? `- ${nl ? 'Artikelnummer' : 'Item number'}: ${p.sku}` : ''
      ].filter(Boolean).join('\n'));
      if ((p.images || []).length) out.push((p.images || []).map((u, i) => `![${mdEsc(p.brand + ' ' + p.model)}${i ? ' – ' + (i + 1) : ''}](${site}/${u})`).join('\n'));
      if (p.status === 'available') out.push(`## ${nl ? 'Kopen' : 'How to buy'}`, nl
        ? `Bestellen en betalen kan op deze pagina: [${url(r, L)}](${url(r, L)}). Betalen met iDEAL, Bancontact, creditcard of Apple Pay. Je kunt ook een bod doen.`
        : `Order and pay on this page: [${url(r, L)}](${url(r, L)}). Pay with iDEAL, Bancontact, credit card or Apple Pay. You can also make an offer.`);
      out.push(`## ${strip(t.shipT)}`, strip(t.shipP));
      out.push(`## ${strip(t.vatT)}`, strip(t.vatP));
    } else if (r.v === 'col') {
      out.push(`# ${strip(m.title.split(' | ')[0])}`, strip(m.description));
      const list = order(r.p === 'brand' ? products.filter(p => SEO.brandSlug(p.brand) === r.b) : products.filter(p => inCol(p, r.p)));
      out.push(list.length ? list.map(p => productLine(p, L)).join('\n') : (nl ? 'Er zijn op dit moment geen stukken in deze categorie.' : 'There are no pieces in this category right now.'));
      out.push(`## Shop`, nav(L));
    } else if (r.v === 'brands') {
      out.push(`# ${strip(t.brandsH)}`, strip(m.description));
      out.push(brandSet.map(b => `- [${mdEsc(b)}](${url({ v: 'col', p: 'brand', b: SEO.brandSlug(b) }, L)}) – ${products.filter(p => p.brand === b).length} ${nl ? 'stuk(ken)' : 'piece(s)'}`).join('\n'));
      out.push(strip(t.brandsNote));
    } else if (r.v === 'story') {
      out.push(`# ${strip(t.storyH)}`, ...t.storyP.map(strip));
      out.push(`## ${strip(t.philoH)}`, ...t.philoP.map(strip));
      out.push(`## ${strip(t.hzH)}`, t.hz.map(([h, p]) => `- **${strip(h)}** – ${strip(p)}`).join('\n'));
    } else if (r.v === 'sell') {
      out.push(`# ${strip(t.tradeH)}`, strip(m.description), strip(t.tradeP));
      out.push(t.steps.map(([h, p], i) => `${i + 1}. **${strip(h)}** – ${strip(p)}`).join('\n'));
      out.push(nl ? `Een aanvraag doe je met het formulier op [${url(r, L)}](${url(r, L)}). Vragen? Mail naar ${X.CO.email}.`
        : `Submit a request with the form at [${url(r, L)}](${url(r, L)}). Questions? Email ${X.CO.email}.`);
    } else if (r.v === 'reviews') {
      out.push(`# ${strip(t.revPageH)}`, strip(t.revPageP));
      out.push(`${String(X.REV.score).replace('.', nl ? ',' : '.')} / 5 · ${X.REV.count} ${nl ? 'beoordelingen' : 'reviews'} · [Vinted](${X.REV.url})`);
      const rv = X.REVS.filter(v => v.lang === L);
      out.push(...(rv.length ? rv : X.REVS).map(v => `> ${strip(v.t)}\n> — ${strip(v.u)}`));
    } else if (r.v === 'info') {
      const lg = X.LEGAL[L] && X.LEGAL[L][r.p];
      out.push(`# ${strip(t.pages[r.p])}`);
      const lines = lg || { ship: t.shipBody, terms: t.termsBody, privacy: t.privacyBody, contact: t.contactBody }[r.p] || [];
      let prevList = false;
      lines.forEach((x, i) => {
        x = fillRates(x, L);
        if (x.startsWith('- ')) { if (prevList) out[out.length - 1] += '\n- ' + strip(x.slice(2)); else out.push('- ' + strip(x.slice(2))); prevList = true; return; }
        prevList = false;
        out.push(x.startsWith('## ') ? '## ' + strip(x.slice(3)) : (i === 0 && lg ? '*' + strip(x) + '*' : strip(x)));
      });
      if (r.p === 'contact') out.push(`${nl ? 'E-mail' : 'Email'}: [${X.CO.email}](mailto:${X.CO.email})`, `${nl ? 'Adres' : 'Address'}: ${X.CO.addr}`, `Instagram: [@jpselectofficial](https://www.instagram.com/jpselectofficial/)`);
    } else if (r.v === 'checkout') {
      out.push(`# ${strip(t.coH)}`, strip(t.coLive));
    }
    return out.filter(s => s !== '' && s != null).join('\n\n');
  }

  function markdown(r, L) { return body(r, L) + '\n\n' + footer(L) + '\n'; }

  /* minimale Markdown -> HTML (alleen wat body() maakt: koppen, lijsten, citaten, links, vet, cursief, afbeeldingen) */
  const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function inline(s) {
    let h = escH(s);
    h = h.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m0, a, u) => `<img src="${u}" alt="${a.replace(/\\([\\`*_[\]])/g, '$1')}" loading="lazy" width="1000" height="1250">`);
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m0, a, u) => `<a href="${u.replace(site, '') || '/'}">${a}</a>`);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*]+)\*(?=$|[\s).,])/g, '$1<em>$2</em>');
    return h.replace(/\\([\\`*_[\]])/g, '$1');
  }
  function toHtml(md) {
    return md.split(/\n{2,}/).map(block => {
      const lines = block.split('\n');
      if (/^#{1,6} /.test(block)) { const n = block.match(/^#+/)[0].length; return `<h${n}>${inline(block.slice(n + 1))}</h${n}>`; }
      if (lines.every(l => l.startsWith('- '))) return '<ul>' + lines.map(l => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>';
      if (lines.every(l => /^\d+\. /.test(l))) return '<ol>' + lines.map(l => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('') + '</ol>';
      if (lines.every(l => l.startsWith('> '))) return '<blockquote><p>' + lines.map(l => inline(l.slice(2))).join('<br>') + '</p></blockquote>';
      if (lines.every(l => l.startsWith('!['))) return lines.map(inline).join('');
      if (block === '---') return '<hr>';
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    }).join('\n');
  }
  function html(r, L) { return toHtml(markdown(r, L)); }

  function llms() {
    const avail = order(products.filter(p => p.status === 'available'));
    const L = 'en';
    return [
      '# JP SELECT',
      '',
      '> JP SELECT is an independent online shop from Nijkerk, the Netherlands, that sells pre-owned and new luxury designer sneakers and clothing, mostly from Italian houses such as Hogan, Santoni, Moorer, Gran Sasso and Falconeri. Every piece is one of a kind, described with an honest condition rating, and ships from the Netherlands to all EU countries.',
      '',
      'The site is available in English (https://jpselect.nl/) and Dutch (https://jpselect.nl/nl/). Every page is also available as Markdown: request it with the header `Accept: text/markdown`, or open `index.md` in the same folder (for example https://jpselect.nl/nl/index.md).',
      '',
      '**When to use JP SELECT**',
      '',
      '- Someone is looking for a specific pre-owned or new Hogan sneaker (Interactive³, H601, Hyperactive, Hyperlight, Cool, Rebel and others) in a given EU size, below the retail price.',
      '- Someone wants pre-owned designer clothing for men from Italian brands (cashmere, knitwear, gilets) from a seller in the Netherlands.',
      '- Someone wants to sell or trade in designer sneakers or clothing and get an offer by email (trade-in credit gets 20% extra).',
      '- Someone asks for a reliable seller of second-hand luxury sneakers in the Netherlands or the EU with clear condition descriptions, shipping costs and a 14-day withdrawal period.',
      '',
      '**When not to use JP SELECT**: for brand-new current-season items in every size, for brands not listed below, for shipping outside the EU, or for authentication services.',
      '',
      '**How an agent should use this site**',
      '',
      '- To find what is for sale: read the collection page (https://jpselect.nl/collection/) or a brand page, or the product data in https://jpselect.nl/data/products.json (fields: id, brand, model, size, sizeSystem, condition, status, price in EUR, retail, images). Only items with status "available" can be bought; "coming" items are not for sale yet; "sold" items are gone.',
      '- Each product has its own page with price, size, condition, colour, material and photos. Link the person to that page; ordering and payment (iDEAL, Bancontact, credit card, Apple Pay via Mollie) are done by the person on the product page. There is no public ordering API.',
      '- Prices are in euros including VAT where applicable. Shipping: Netherlands € 6.95 (free from € 130), Belgium and Germany € 9.95, France € 12.95, Italy € 13.95, other EU countries € 14.95.',
      '- A person can make an offer on an item (minimum 85% of the price) from the product page; JP SELECT accepts or declines by email.',
      `- Questions about a piece, size or selling: email ${X.CO.email}.`,
      '',
      '## Shop',
      '',
      `- [Collection](${site}/collection/): every piece, available, coming soon and recently sold`,
      `- [New arrivals](${site}/new-arrivals/): latest available and upcoming pieces`,
      `- [Men's sneakers](${site}/mens-sneakers/)`,
      `- [Women's sneakers](${site}/womens-sneakers/)`,
      `- [Clothing](${site}/clothing/)`,
      `- [Brands](${site}/brands/): ${brandSet.join(', ')}`,
      `- [Product data (JSON)](${site}/data/products.json): machine-readable list of all pieces with status and price`,
      '',
      '## Available now',
      '',
      ...avail.map(p => `- [${p.brand} ${p.model}${size(p, L)}](${url({ v: 'product', p: p.id }, L)}): ${SEO.eur(p.price)}, ${((SEO.COND.en || {})[p.condition] || '').toLowerCase()}`),
      '',
      '## Service',
      '',
      `- [Sell to us / trade in](${site}/sell-to-us/): submit photos of your designer item and receive an offer by email`,
      `- [Shipping & returns](${site}/shipping-returns/): costs per country, delivery times, 14-day withdrawal period`,
      `- [Terms & conditions](${site}/terms/)`,
      `- [Privacy policy](${site}/privacy/)`,
      `- [Contact](${site}/contact/): ${X.CO.email}`,
      '',
      '## Optional',
      '',
      `- [Our story](${site}/our-story/)`,
      `- [Reviews](${site}/reviews/): ${X.REV.score} / 5 from ${X.REV.count} buyer reviews on Vinted`,
      `- [Sitemap](${site}/sitemap.xml)`,
      ''
    ].join('\n');
  }

  function notFoundMarkdown(L) {
    const nl = L === 'nl';
    return [
      nl ? '# Pagina niet gevonden (404)' : '# Page not found (404)',
      '',
      nl ? 'Deze pagina bestaat niet (meer) op jpselect.nl. Het stuk is misschien verkocht of het adres is veranderd.' : 'This page does not exist (any more) on jpselect.nl. The piece may have been sold or the address may have changed.',
      '',
      `- [${nl ? 'Collectie' : 'Collection'}](${site}${nl ? '/nl/collectie/' : '/collection/'})`,
      `- [Sitemap](${site}/sitemap.xml)`,
      `- [llms.txt](${site}/llms.txt)`,
      ''
    ].join('\n');
  }

  return { texts: X, markdown, html, toHtml, llms, notFoundMarkdown };
}

module.exports = { create, loadTexts, strip };
