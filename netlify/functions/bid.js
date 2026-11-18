/* /.netlify/functions/bid  – bieden op een stuk
   POST {product_id, amount, name, email, lang}   nieuw bod; de koper krijgt een bevestigingslink
   GET  ?t=<token>                                bevestigen (link uit de mail) en terug naar het product
   GET  ?checkout=<token>                         gegevens van een geaccepteerd bod voor de kassa
   POST {notify:<bid-id>}                         mail "bod geaccepteerd" (aangeroepen vanuit het Business Center;
                                                  verstuurt alleen iets als de database zegt dat het bod geaccepteerd is) */
'use strict';
const crypto = require('crypto');
const S = require('../lib/shop-server.js');
const B = require('../lib/bidmail.js');
const SEO = require('../../seo.js');

const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const tok = v => /^[0-9a-f]{64}$/.test(String(v || '')) ? String(v) : '';
const find = id => S.products().find(p => p.id === id);
const productUrl = (site, id, lang) => site + SEO.pathOf({ v: 'product', p: id }, lang === 'en' ? 'en' : 'nl', S.products());

exports.handler = async event => {
  if (!S.shopOpen()) return S.json(503, { error: 'closed' });
  const site = S.siteUrl(event);
  const q = event.queryStringParameters || {};

  if (event.httpMethod === 'GET' && q.t) {
    const t = tok(q.t);
    let r = null;
    try { if (t) r = await S.rpc('bid_confirm', { p_token: t }); } catch (e) { console.error(e); }
    if (!r) return { statusCode: 302, headers: { Location: site + '/?bod=error', 'Cache-Control': 'no-store' } };
    if (r.ok && r.notify_owner) {
      try { await B.ownerBidMail({ ...r.bid, product_id: r.product_id }, find(r.product_id), r.count); }
      catch (e) { console.error('owner mail', e); }
    }
    const state = r.ok ? 'ok' : (r.error || 'error');
    const to = r.product_id ? productUrl(site, r.product_id, r.lang) : site + '/';
    return { statusCode: 302, headers: { Location: to + '?bod=' + state, 'Cache-Control': 'no-store' } };
  }

  if (event.httpMethod === 'GET' && q.checkout) {
    const t = tok(q.checkout);
    if (!t) return S.json(400, { error: 'token' });
    try {
      const r = await S.rpc('bid_checkout', { p_token: t });
      return S.json(200, r || { state: 'unknown' });
    } catch (e) { console.error(e); return S.json(502, { error: 'db' }); }
  }

  if (event.httpMethod !== 'POST') return S.json(405, { error: 'method' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return S.json(400, { error: 'bad_json' }); }

  if (b.notify) {
    const id = String(b.notify);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return S.json(400, { error: 'id' });
    let bid;
    try { bid = await S.rpc('bid_claim_accept_mail', { p_id: id }); } catch (e) { console.error(e); return S.json(502, { error: 'db' }); }
    if (!bid) return S.json(200, { ok: false, sent: false });
    const lang = bid.lang === 'en' ? 'en' : 'nl';
    const link = site + (lang === 'nl' ? '/nl/afrekenen/' : '/checkout/') + '?bid=' + bid.token;
    try { await B.acceptMail(bid, find(bid.product_id), link); }
    catch (e) { console.error('accept mail', e); try { await S.rpc('bid_unclaim_accept_mail', { p_id: id }); } catch (e2) { console.error(e2); } return S.json(502, { error: 'mail' }); }
    return S.json(200, { ok: true, sent: true });
  }

  const lang = b.lang === 'en' ? 'en' : 'nl';
  const name = clean(b.name, 120), email = clean(b.email, 200).toLowerCase();
  const bad = [];
  if (!name) bad.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.push('email');
  const amount = Math.round(Number(b.amount) * 100);
  if (!(amount > 0)) bad.push('amount');
  if (bad.length) return S.json(400, { error: 'fields', fields: bad });

  const p = find(String(b.product_id || ''));
  if (!p || p.status !== 'available' || !(p.price > 0)) return S.json(409, { error: 'unavailable' });

  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim();
  const ipHash = ip ? crypto.createHash('sha256').update(ip + '|' + S.env('SUPABASE_SERVICE_KEY').slice(-12)).digest('hex').slice(0, 32) : null;

  let r;
  try { r = await S.rpc('bid_place', { p: { product_id: p.id, list_cents: Math.round(p.price * 100), amount_cents: amount, name, email, lang, ip_hash: ipHash } }); }
  catch (e) { console.error(e); return S.json(502, { error: 'db' }); }
  if (!r || !r.ok) return S.json(409, { error: (r && r.error) || 'error', min_cents: r && r.min_cents, high_cents: r && r.high_cents });

  try { await B.verifyMail({ name, email, lang, amount_cents: amount }, p, site + '/.netlify/functions/bid?t=' + r.token); }
  catch (e) { console.error('verify mail', e); return S.json(502, { error: 'mail' }); }
  return S.json(200, { ok: true });
};
