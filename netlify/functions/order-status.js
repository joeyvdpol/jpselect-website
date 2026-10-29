/* GET /.netlify/functions/order-status?order=<id>
   Voor de bedankpagina. Haalt bij een nog open bestelling de status direct bij Mollie op,
   zodat de klant niet op de webhook hoeft te wachten. Geeft geen persoonsgegevens terug. */
'use strict';
const S = require('../lib/shop-server.js');
const M = require('../lib/mail.js');

exports.handler = async event => {
  const id = (event.queryStringParameters || {}).order || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return S.json(400, { error: 'id' });
  if (!S.env('SUPABASE_SERVICE_KEY')) return S.json(503, { error: 'closed' });
  try {
    let st = await S.rpc('shop_order_status', { p_id: id });
    if (!st) return S.json(404, { error: 'not_found' });
    if (st.status === 'open' && S.env('MOLLIE_API_KEY')) {
      const o = await S.rpc('shop_order_mollie', { p_id: id });
      if (o) {
        const pay = await S.mollie('GET', '/payments/' + o);
        const res = await S.rpc('shop_payment_update', { p_order: id, p_mollie: pay.id, p_status: pay.status, p_method: pay.method || null, p_mode: pay.mode || null });
        if (res && res.send_mail) {
          try { await M.orderMails(res.order, res.conflict); }
          catch (e) { console.error('mail', e); await S.rpc('shop_mail_failed', { p_order: id }); }
        }
        st = await S.rpc('shop_order_status', { p_id: id });
      }
    }
    return S.json(200, { ref: st.ref, status: st.status, email: st.email, total_cents: st.total_cents });
  } catch (e) { console.error(e); return S.json(502, { error: 'server' }); }
};
