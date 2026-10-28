/* JP SELECT: adressen, titels, omschrijvingen en productgegevens voor Google.
   Wordt gebruikt door de site zelf (browser) én door build.js (Netlify) die per pagina een eigen HTML-bestand maakt. */
(function (root) {
  'use strict';
  var BRANDS = ['Hogan', 'Santoni', 'Moorer', 'Gran Sasso', 'Falconeri', 'Fusalp', 'Boggi Milano'];

  /* token in het adres -> [weergave, preset] ; Engels op /, Nederlands op /nl/ */
  var ROUTES = {
    en: { '': ['home'], 'mens-sneakers': ['col', 'men-sneakers'], 'mens-shoes': ['col', 'men-shoes'], 'womens-shoes': ['col', 'women-shoes'], 'womens-sneakers': ['col', 'women-sneakers'], 'new-arrivals': ['col', 'new'], 'shoes': ['col', 'shoes'], 'clothing': ['col', 'clothing'], 'collection': ['col', 'all'], 'brands': ['brands'], 'our-story': ['story'], 'sell-to-us': ['sell'], 'reviews': ['reviews'], 'checkout': ['checkout'], 'shipping-returns': ['info', 'ship'], 'terms': ['info', 'terms'], 'privacy': ['info', 'privacy'], 'contact': ['info', 'contact'] },
    nl: { '': ['home'], 'heren-sneakers': ['col', 'men-sneakers'], 'herenschoenen': ['col', 'men-shoes'], 'damesschoenen': ['col', 'women-shoes'], 'dames-sneakers': ['col', 'women-sneakers'], 'nieuw': ['col', 'new'], 'schoenen': ['col', 'shoes'], 'kleding': ['col', 'clothing'], 'collectie': ['col', 'all'], 'merken': ['brands'], 'verhaal': ['story'], 'verkopen': ['sell'], 'reviews': ['reviews'], 'afrekenen': ['checkout'], 'verzenden': ['info', 'ship'], 'voorwaarden': ['info', 'terms'], 'privacy': ['info', 'privacy'], 'contact': ['info', 'contact'] }
  };
  var BRANDSEG = { en: 'brands', nl: 'merken' };

  function slug(s) {
    return String(s || '').replace(/³/g, '3').replace(/²/g, '2').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function brandSlug(b) { return String(b || '').toLowerCase().replace(/\s+/g, '-'); }
  function productSlug(p) { return slug(p.brand + ' ' + p.model) + '-' + p.id; }
  function prefix(L) { return L === 'nl' ? '/nl/' : '/'; }

  /* route -> pad (altijd met afsluitende /) */
  function pathOf(r, L, products) {
    var pre = prefix(L);
    if (!r || r.v === 'home') return pre;
    if (r.v === 'product') {
      var p = (products || []).find(function (x) { return x.id === r.p; });
      return pre + 'product/' + (p ? productSlug(p) : r.p) + '/';
    }
    if (r.v === 'col' && r.p === 'brand') return pre + BRANDSEG[L] + '/' + r.b + '/';
    var map = ROUTES[L];
    for (var k in map) { if (map[k][0] === r.v && (map[k][1] || '') === (r.p || '')) return k ? pre + k + '/' : pre; }
    return pre;
  }

  /* pad -> {L, r}; r.v==='product' met r.slug als de producten nog niet geladen zijn */
  function parsePath(pathname, products) {
    var s = decodeURIComponent(String(pathname || '/')).replace(/\/index\.html$/, '').replace(/\/+$/, '');
    var L = 'en';
    if (s === '/nl' || s.indexOf('/nl/') === 0) { L = 'nl'; s = s.slice(3); }
    var rest = s.replace(/^\/+/, '').toLowerCase();
    var map = ROUTES[L];
    if (Object.prototype.hasOwnProperty.call(map, rest)) return { L: L, r: { v: map[rest][0], p: map[rest][1] || '' } };
    var bs = BRANDSEG[L] + '/';
    if (rest.indexOf(bs) === 0) return { L: L, r: { v: 'col', p: 'brand', b: rest.slice(bs.length) } };
    if (rest.indexOf('product/') === 0) {
      var sl = rest.slice(8);
      var p = (products || []).find(function (x) { return sl === productSlug(x) || sl.slice(-x.id.length - 1) === '-' + x.id || sl === x.id; });
      return { L: L, r: p ? { v: 'product', p: p.id } : { v: 'product', p: '', slug: sl } };
    }
    return { L: L, r: { v: 'home', p: '' }, notFound: rest !== '' };
  }

  /* oude #-adressen (#heren-sneakers, #merk-hogan, #jp-2610-024) */
  function parseLegacyHash(hash, products) {
    var h = String(hash || '').replace(/^#/, '').toLowerCase();
    if (!h) return null;
    var map = ROUTES.nl;
    if (Object.prototype.hasOwnProperty.call(map, h)) return { v: map[h][0], p: map[h][1] || '' };
    if (h.indexOf('merk-') === 0) return { v: 'col', p: 'brand', b: h.slice(5) };
    if ((products || []).find(function (x) { return x.id === h; })) return { v: 'product', p: h };
    return null;
  }

  var COND = {
    en: { 'new-tags': 'New with tags', 'new': 'New', 'very-good': 'Very good', 'good': 'Good' },
    nl: { 'new-tags': 'Nieuw met label', 'new': 'Nieuw', 'very-good': 'Zeer goed', 'good': 'Goed' }
  };
  var COLN = {
    en: { all: 'Collection', 'new': 'New arrivals', shoes: 'Shoes', clothing: 'Clothing', 'men-sneakers': 'Men’s sneakers', 'women-sneakers': 'Women’s sneakers', 'men-shoes': 'Men’s shoes', 'women-shoes': 'Women’s shoes' },
    nl: { all: 'Collectie', 'new': 'Nieuw binnen', shoes: 'Schoenen', clothing: 'Kleding', 'men-sneakers': 'Heren sneakers', 'women-sneakers': 'Dames sneakers', 'men-shoes': 'Herenschoenen', 'women-shoes': 'Damesschoenen' }
  };

  /* korte zichtbare introtekst per categorie/merk (feitelijk, geen beloftes die niet kloppen) */
  var INTRO = {
    en: {
      all: 'Every piece at JP SELECT: pre-owned and new designer sneakers and clothing, mostly from Italian houses such as Hogan and Santoni. Each item is one of a kind.',
      'new': 'The latest additions to the collection: selected pre-owned and new designer sneakers and clothing. Every piece is one of a kind, so once it is gone, it is gone.',
      shoes: 'Pre-owned and new designer shoes and sneakers for men and women, with Hogan models such as the Interactive³, H601, Hyperactive and Cool. Each pair is described with an honest condition rating.',
      'men-sneakers': 'Pre-owned and new designer sneakers for men, including the Hogan Interactive³, H601 and Hyperlight. Each pair comes with an honest condition rating and a clear size.',
      'women-sneakers': 'Pre-owned and new designer sneakers for women, including the Hogan Hyperactive, Cool and Rebel. Each pair comes with an honest condition rating and a clear size.',
      'men-shoes': 'Pre-owned and new designer shoes for men from Italian houses such as Hogan and Santoni, each with an honest condition rating.',
      'women-shoes': 'Pre-owned and new designer shoes for women from Italian houses such as Hogan, each with an honest condition rating.',
      clothing: 'Selected designer clothing for men: cashmere, knitwear and gilets from Italian houses such as Gran Sasso, Moorer and Boggi Milano.',
      brand: 'Pre-owned and new {b} at JP SELECT. See what is available now and what is arriving soon.',
      Hogan: 'Pre-owned and new Hogan sneakers for men and women: the Interactive³, H601, Hyperactive, Cool and more. Italian craftsmanship for a fraction of the retail price.'
    },
    nl: {
      all: 'Alle stukken van JP SELECT: tweedehands en nieuwe designer sneakers en kleding, vooral van Italiaanse huizen als Hogan en Santoni. Elk stuk is uniek.',
      'new': 'De nieuwste stukken in de collectie: geselecteerde tweedehands en nieuwe designer sneakers en kleding. Elk stuk is uniek, dus op is op.',
      shoes: 'Tweedehands en nieuwe designer schoenen en sneakers voor heren en dames, met Hogan-modellen als de Interactive³, H601, Hyperactive en Cool. Elk paar met een eerlijke omschrijving van de staat.',
      'men-sneakers': 'Tweedehands en nieuwe designer sneakers voor heren, zoals de Hogan Interactive³, H601 en Hyperlight. Elk paar met een eerlijke omschrijving van de staat en een duidelijke maat.',
      'women-sneakers': 'Tweedehands en nieuwe designer sneakers voor dames, zoals de Hogan Hyperactive, Cool en Rebel. Elk paar met een eerlijke omschrijving van de staat en een duidelijke maat.',
      'men-shoes': 'Tweedehands en nieuwe designer herenschoenen van Italiaanse huizen als Hogan en Santoni, elk met een eerlijke omschrijving van de staat.',
      'women-shoes': 'Tweedehands en nieuwe designer damesschoenen van Italiaanse huizen als Hogan, elk met een eerlijke omschrijving van de staat.',
      clothing: 'Geselecteerde designerkleding voor heren: cashmere, gebreid en bodywarmers van Italiaanse huizen als Gran Sasso, Moorer en Boggi Milano.',
      brand: 'Tweedehands en nieuwe {b} bij JP SELECT. Bekijk wat er nu beschikbaar is en wat binnenkort binnenkomt.',
      Hogan: 'Tweedehands en nieuwe Hogan sneakers voor heren en dames: de Interactive³, H601, Hyperactive, Cool en meer. Italiaans vakmanschap voor een fractie van de nieuwprijs.'
    }
  };
  function brandName(bslug, products) {
    var all = BRANDS.concat((products || []).map(function (p) { return p.brand; }));
    for (var i = 0; i < all.length; i++) if (brandSlug(all[i]) === bslug) return all[i];
    return '';
  }
  function intro(preset, bname, L) {
    var I = INTRO[L] || INTRO.en;
    if (preset === 'brand') return bname ? (I[bname] || I.brand.replace('{b}', bname)) : '';
    return I[preset] || '';
  }

  function isNew(p) { return p.condition === 'new' || p.condition === 'new-tags'; }
  function kind(p, L) {
    if (p.category === 'clothing') return '';
    if (p.category === 'sneakers') return L === 'nl' ? 'sneakers' : 'Sneakers';
    return L === 'nl' ? 'schoenen' : 'Shoes';
  }
  function sizeTxt(p, L) {
    if (!p.size) return '';
    var w = L === 'nl' ? 'maat ' : 'Size ';
    return w + p.size + (p.sizeSystem && p.sizeSystem !== 'EU' ? ' ' + p.sizeSystem : '');
  }
  function eur(v) { return v == null ? '' : '€ ' + (Math.round(v) === v ? String(v) : Number(v).toFixed(2).replace('.', ',')); }
  function clip(s, n) { s = String(s).replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; }

  var STATIC_TITLES = {
    en: { home: 'JP SELECT | Pre-Owned Luxury Sneakers & Designer Fashion', brands: 'Designer Brands: Hogan, Santoni, Moorer & More | JP SELECT', story: 'Our Story | JP SELECT', sell: 'Sell or Trade In Your Designer Sneakers | JP SELECT', reviews: 'Reviews | JP SELECT', checkout: 'Checkout | JP SELECT', ship: 'Shipping & Returns | JP SELECT', terms: 'Terms & Conditions | JP SELECT', privacy: 'Privacy Policy | JP SELECT', contact: 'Contact | JP SELECT' },
    nl: { home: 'JP SELECT | Tweedehands luxe sneakers & designermode', brands: 'Designermerken: Hogan, Santoni, Moorer & meer | JP SELECT', story: 'Ons verhaal | JP SELECT', sell: 'Verkoop of ruil je designer sneakers in | JP SELECT', reviews: 'Reviews | JP SELECT', checkout: 'Afrekenen | JP SELECT', ship: 'Verzenden & retourneren | JP SELECT', terms: 'Algemene voorwaarden | JP SELECT', privacy: 'Privacybeleid | JP SELECT', contact: 'Contact | JP SELECT' }
  };
  var STATIC_DESC = {
    en: { home: 'Pre-owned and new designer sneakers and fashion from Hogan, Santoni, Moorer, Gran Sasso and more. Selected pieces with honest condition ratings. Trade in. Step up.', brands: 'Shop pre-owned and new designer pieces by brand: Hogan, Santoni, Moorer, Gran Sasso, Falconeri, Fusalp and Boggi Milano.', story: 'The story behind JP SELECT: selected pre-owned and new Italian designer sneakers and fashion.', sell: 'Sell your designer sneakers or clothing to JP SELECT, or trade them in for credit with 20% extra towards a new piece. Send photos and receive an offer by email.', reviews: 'What customers say about JP SELECT.', checkout: 'Checkout', ship: 'Shipping and returns at JP SELECT.', terms: 'Terms and conditions of JP SELECT.', privacy: 'Privacy policy of JP SELECT.', contact: 'Questions about a piece, your size or selling to JP SELECT? Get in touch.' },
    nl: { home: 'Tweedehands en nieuwe designer sneakers en mode van Hogan, Santoni, Moorer, Gran Sasso en meer. Geselecteerde stukken met een eerlijke omschrijving van de staat.', brands: 'Shop tweedehands en nieuwe designerstukken per merk: Hogan, Santoni, Moorer, Gran Sasso, Falconeri, Fusalp en Boggi Milano.', story: 'Het verhaal achter JP SELECT: geselecteerde tweedehands en nieuwe Italiaanse designer sneakers en mode.', sell: 'Verkoop je designer sneakers of kleding aan JP SELECT, of ruil ze in voor tegoed met 20% extra voor een nieuw stuk. Stuur foto’s en ontvang een bod per mail.', reviews: 'Wat klanten zeggen over JP SELECT.', checkout: 'Afrekenen', ship: 'Verzenden en retourneren bij JP SELECT.', terms: 'Algemene voorwaarden van JP SELECT.', privacy: 'Privacybeleid van JP SELECT.', contact: 'Vragen over een stuk, je maat of verkopen aan JP SELECT? Neem contact op.' }
  };
  var COLTITLE = {
    en: { all: 'Pre-Owned Designer Sneakers & Fashion | Collection | JP SELECT', 'new': 'New Arrivals: Pre-Owned Designer Sneakers | JP SELECT', shoes: 'Pre-Owned Designer Shoes & Sneakers | JP SELECT', clothing: 'Pre-Owned Designer Clothing for Men | JP SELECT', 'men-sneakers': 'Men’s Designer Sneakers | Pre-Owned Luxury | JP SELECT', 'women-sneakers': 'Women’s Designer Sneakers | Pre-Owned Luxury | JP SELECT', 'men-shoes': 'Men’s Designer Shoes | Pre-Owned Luxury | JP SELECT', 'women-shoes': 'Women’s Designer Shoes | Pre-Owned Luxury | JP SELECT' },
    nl: { all: 'Tweedehands designer sneakers & mode | Collectie | JP SELECT', 'new': 'Nieuw binnen: tweedehands designer sneakers | JP SELECT', shoes: 'Tweedehands designer schoenen & sneakers | JP SELECT', clothing: 'Tweedehands designerkleding heren | JP SELECT', 'men-sneakers': 'Designer sneakers heren | Tweedehands luxe | JP SELECT', 'women-sneakers': 'Designer sneakers dames | Tweedehands luxe | JP SELECT', 'men-shoes': 'Designer herenschoenen | Tweedehands luxe | JP SELECT', 'women-shoes': 'Designer damesschoenen | Tweedehands luxe | JP SELECT' }
  };

  function productTitle(p, L) {
    var k = kind(p, L), sz = sizeTxt(p, L);
    var cond = isNew(p) ? (L === 'nl' ? 'Nieuw' : 'New') : (L === 'nl' ? 'Tweedehands luxe' : 'Pre-Owned Luxury');
    var head = p.brand + ' ' + p.model + (k ? ' ' + k : '') + (sz ? ' ' + (L === 'nl' ? 'maat ' + p.size : 'Size ' + p.size) : '');
    return head + ' | ' + cond + ' | JP SELECT';
  }
  function productDesc(p, L) {
    var nl = L === 'nl';
    var c = (COND[L] || COND.en)[p.condition] || '';
    var col = p.color && p.color[L] ? p.color[L].toLowerCase() : '';
    var g = p.gender === 'men' ? (nl ? 'heren' : 'men’s') : p.gender === 'women' ? (nl ? 'dames' : 'women’s') : '';
    var base = nl
      ? (isNew(p) ? 'Nieuwe ' : 'Tweedehands ') + p.brand + ' ' + p.model + (g ? ' ' + g : '') + (col ? ' in ' + col : '') + (p.size ? ', maat ' + p.size : '') + '. ' + (c ? 'Staat: ' + c.toLowerCase() + '. ' : '')
      : (isNew(p) ? 'New ' : 'Pre-owned ') + g + (g ? ' ' : '') + p.brand + ' ' + p.model + (col ? ' in ' + col : '') + (p.size ? ', size ' + p.size : '') + '. ' + (c ? 'Condition: ' + c.toLowerCase() + '. ' : '');
    var tail;
    if (p.status === 'sold') tail = nl ? 'Dit stuk is verkocht; bekijk vergelijkbare stukken bij JP SELECT.' : 'This piece has been sold; see similar pieces at JP SELECT.';
    else if (p.status === 'coming') tail = (nl ? 'Binnenkort beschikbaar' : 'Available soon') + (p.price != null ? (nl ? ' voor ' : ' for ') + eur(p.price) : '') + (p.retail ? (nl ? ' (nieuwprijs ' : ' (retail ') + eur(p.retail) + ')' : '') + '.';
    else tail = (p.price != null ? (nl ? 'Nu ' : 'Now ') + eur(p.price) + (p.retail ? (nl ? ' (nieuwprijs ' : ' (retail ') + eur(p.retail) + ')' : '') + '. ' : '') + (nl ? 'Bekijk het bij JP SELECT.' : 'View it at JP SELECT.');
    return clip(base + tail, 160);
  }

  function abs(site, u) { if (!u) return ''; if (/^https?:/.test(u)) return u; return site + '/' + String(u).replace(/^\//, ''); }

  /* alles wat in <head> hoort voor een route */
  function meta(r, L, products, site) {
    site = String(site || '').replace(/\/$/, '');
    products = products || [];
    var title, desc, img = '', type = 'website', jsonld = [], noindex = false, crumbs = null;
    var home = { name: 'JP SELECT', url: site + prefix(L) };
    if (r.v === 'product') {
      var p = products.find(function (x) { return x.id === r.p; });
      if (!p) { title = STATIC_TITLES[L].home; desc = STATIC_DESC[L].home; noindex = true; }
      else {
        title = productTitle(p, L); desc = productDesc(p, L); type = 'product';
        img = abs(site, (p.images || [])[0]);
        var url = site + pathOf(r, L, products);
        var cond = isNew(p) ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition';
        var prod = { '@context': 'https://schema.org', '@type': 'Product', name: p.brand + ' ' + p.model, sku: p.sku || p.id, brand: { '@type': 'Brand', name: p.brand },
          image: (p.images || []).map(function (u) { return abs(site, u); }), description: productDesc(p, L), url: url, itemCondition: cond };
        if (p.color && p.color[L]) prod.color = p.color[L];
        if (p.material && p.material[L]) prod.material = p.material[L];
        if (p.size) prod.size = p.size + (p.sizeSystem ? ' ' + p.sizeSystem : '');
        if (p.price != null) prod.offers = { '@type': 'Offer', url: url, priceCurrency: 'EUR', price: String(p.price), itemCondition: cond,
          availability: p.status === 'available' ? 'https://schema.org/InStock' : p.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: 'JP SELECT' } };
        jsonld.push(prod);
        var colKey = p.category === 'clothing' ? 'clothing' : (p.gender === 'women' ? 'women-sneakers' : p.gender === 'men' ? 'men-sneakers' : 'shoes');
        if (p.category === 'footwear') colKey = p.gender === 'women' ? 'women-shoes' : p.gender === 'men' ? 'men-shoes' : 'shoes';
        crumbs = [[COLN[L][colKey], site + pathOf({ v: 'col', p: colKey }, L)], [p.brand + ' ' + p.model, url]];
      }
    } else if (r.v === 'col') {
      if (r.p === 'brand') {
        var bn = brandName(r.b, products) || r.b;
        title = L === 'nl' ? bn + ' tweedehands & nieuw | JP SELECT' : bn + ' | Pre-Owned & New | JP SELECT';
        desc = clip(intro('brand', bn, L), 160);
        crumbs = [[L === 'nl' ? 'Merken' : 'Brands', site + pathOf({ v: 'brands' }, L)], [bn, site + pathOf(r, L)]];
      } else {
        title = (COLTITLE[L] || COLTITLE.en)[r.p] || COLTITLE[L].all;
        desc = clip(intro(r.p, '', L) || STATIC_DESC[L].home, 160);
        crumbs = [[COLN[L][r.p] || COLN[L].all, site + pathOf(r, L)]];
      }
    } else {
      var key = r.v === 'info' ? r.p : r.v;
      title = STATIC_TITLES[L][key] || STATIC_TITLES[L].home;
      desc = STATIC_DESC[L][key] || STATIC_DESC[L].home;
      if (r.v === 'checkout') noindex = true;
      if (r.v === 'home') {
        jsonld.push({ '@context': 'https://schema.org', '@type': 'Organization', name: 'JP SELECT', url: site + '/', email: 'info@jpselect.nl',
          address: { '@type': 'PostalAddress', addressLocality: 'Nijkerk', addressCountry: 'NL' }, slogan: 'Trade in. Step up.' });
        jsonld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'JP SELECT', url: site + '/', inLanguage: L === 'nl' ? 'nl-NL' : 'en' });
      }
    }
    if (crumbs) jsonld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [[home.name, home.url]].concat(crumbs).map(function (c, i) { return { '@type': 'ListItem', position: i + 1, name: c[0], item: c[1] }; }) });
    var canon = site + pathOf(r, L, products);
    return { title: title, description: desc, canonical: canon, alternates: { en: site + pathOf(r, 'en', products), nl: site + pathOf(r, 'nl', products) },
      image: img, type: type, jsonld: jsonld, noindex: noindex, lang: L };
  }

  var api = { BRANDS: BRANDS, ROUTES: ROUTES, BRANDSEG: BRANDSEG, slug: slug, brandSlug: brandSlug, productSlug: productSlug, pathOf: pathOf, parsePath: parsePath,
    parseLegacyHash: parseLegacyHash, intro: intro, brandName: brandName, meta: meta, productTitle: productTitle, productDesc: productDesc, COND: COND, COLN: COLN, eur: eur };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JPSEO = api;
})(typeof window !== 'undefined' ? window : this);
