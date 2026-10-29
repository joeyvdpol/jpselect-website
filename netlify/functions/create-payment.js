/* POST /.netlify/functions/create-payment
   Controleert de tas op de server (prijzen en beschikbaarheid komen uit data/products.json,
   nooit uit de browser), reserveert de stukken en maakt een Mollie-betaling aan. */
'use strict';
const S = require('../lib/shop-server.js');

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

exports.handler = async event => {
  if (event.httpMethod === 'GET') return S.json(200, { open: S.shopOpen(), freeFrom: S.SHOP.freeFrom });
  if (event.httpMethod !== 'POST') return S.json(405, { error: 'method' });
  if (!S.shopOpen()) return S.json(503, { error: 'closed' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return S.json(400, { error: 'bad_json' }); }

  const lang = b.lang === 'en' ? 'en' : 'nl';
  const c = b.customer || {};
  const cu = { name: clean(c.name, 120), email: clean(c.email, 200), phone: clean(c.phone, 40), street: clean(c.street, 160), zip: clean(c.zip, 16), city: clean(c.city, 80), country: clean(c.country, 2).toUpperCase() };
  const bad = [];
  ['name', 'street', 'zip', 'city'].forEach(k => { if (!cu[k]) bad.push(k); });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cu.email)) bad.push('email');
  if (!S.SHOP.countries.includes(cu.country)) bad.push('country');
  if (b.terms !== true) bad.push('terms');
  if (bad.length) return S.json(400, { error: 'fields', fields: bad });

  const ids = [...new Set((Array.isArray(b.items) ? b.items : []).map(x => String(x)))].slice(0, 10);
  if (!ids.length) return S.json(400, { error: 'empty' });
  const all = S.products();
  const items = [], gone = [];
  for (const id of ids) {
    const p = all.find(x => x.id === id);
    if (!p || p.status !== 'available' || !(p.price > 0)) { gone.push(id); continue; }
    items.push({ id: p.id, sku: p.sku, brand: p.brand, model: p.model, size: (p.sizeSystem ? p.sizeSystem + ' ' : '') + p.size, price_cents: Math.round(p.price * 100) });
  }
  if (gone.length) return S.json(409, { error: 'unavailable', unavailable: gone });

  const subtotal = items.reduce((a, x) => a + x.price_cents, 0);
  const shipping = S.SHOP.shippingCents(cu.country, subtotal);
  const total = subtotal + shipping;

  let res;
  try {
    res = await S.rpc('shop_reserve', { p: { product_ids: ids, lang, ...cu, items, subtotal_cents: subtotal, shipping_cents: shipping, total_cents: total } });
  } catch (e) { console.error(e); return S.json(502, { error: 'db' }); }
  if (!res || !res.ok) return S.json(409, { error: 'unavailable', unavailable: (res && res.unavailable) || ids });

  const site = S.siteUrl(event);
  const back = site + (lang === 'nl' ? '/nl/afrekenen/' : '/checkout/') + '?order=' + res.id;
  try {
    const pay = await S.mollie('POST', '/payments', {
      amount: { currency: 'EUR', value: (total / 100).toFixed(2) },
      description: 'JP SELECT ' + res.ref,
      redirectUrl: back,
      cancelUrl: back,
      webhookUrl: site + '/.netlify/functions/mollie-webhook',
      locale: lang === 'nl' ? 'nl_NL' : 'en_GB',
      method: S.SHOP.methods,
      metadata: { order_id: res.id, ref: res.ref }
    });
    await S.rpc('shop_attach_payment', { p_order: res.id, p_mollie: pay.id, p_mode: pay.mode || null });
    const url = pay._links && pay._links.checkout && pay._links.checkout.href;
    if (!url) throw new Error('mollie: geen checkout-link');
    return S.json(200, { ok: true, ref: res.ref, order: res.id, checkout: url });
  } catch (e) {
    console.error(e);
    try { await S.rpc('shop_release', { p_order: res.id }); } catch (e2) { console.error(e2); }
    return S.json(502, { error: 'payment' });
  }
};
