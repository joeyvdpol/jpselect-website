/* POST /.netlify/functions/mollie-webhook  (Mollie roept dit aan met alleen het betaling-id)
   We vertrouwen niets uit het verzoek zelf: de status wordt altijd opnieuw bij Mollie opgehaald. */
'use strict';
const S = require('../lib/shop-server.js');
const M = require('../lib/mail.js');

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return S.json(405, { error: 'method' });
  if (!S.env('MOLLIE_API_KEY') || !S.env('SUPABASE_SERVICE_KEY')) return S.json(503, { error: 'closed' });
  const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : (event.body || '');
  const id = new URLSearchParams(body).get('id') || '';
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) return S.json(200, { ok: true }); // onbekend: stil negeren

  let pay;
  try { pay = await S.mollie('GET', '/payments/' + id); }
  catch (e) { if (e.status === 404) return S.json(200, { ok: true }); console.error(e); return S.json(500, { error: 'mollie' }); }
  const orderId = pay.metadata && pay.metadata.order_id;
  if (!orderId) return S.json(200, { ok: true });

  let res;
  try { res = await S.rpc('shop_payment_update', { p_order: orderId, p_mollie: pay.id, p_status: pay.status, p_method: pay.method || null, p_mode: pay.mode || null }); }
  catch (e) { console.error(e); return S.json(500, { error: 'db' }); } // Mollie probeert het later opnieuw

  if (res && res.send_mail) {
    try { await M.orderMails(res.order, res.conflict); }
    catch (e) { console.error('mail', e); try { await S.rpc('shop_mail_failed', { p_order: orderId }); } catch (e2) { console.error(e2); } return S.json(500, { error: 'mail' }); }
  }
  return S.json(200, { ok: true });
};
