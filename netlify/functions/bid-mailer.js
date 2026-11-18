/* Geplande functie (elke 5 minuten): verstuurt de mail "bod geaccepteerd" voor biedingen die
   in het Business Center zijn geaccepteerd. Elke mail wordt in de database geclaimd, dus nooit dubbel. */
'use strict';
const S = require('../lib/shop-server.js');
const B = require('../lib/bidmail.js');

exports.handler = async () => {
  if (!S.shopOpen()) return { statusCode: 200, body: 'closed' };
  let ids = [];
  try { ids = (await S.rpc('bid_pending_accept_mails', {})) || []; } catch (e) { console.error(e); return { statusCode: 500, body: 'db' }; }
  const site = S.env('URL') || 'https://jpselect.nl';
  let sent = 0;
  for (const row of ids) {
    const id = typeof row === 'string' ? row : row && (row.bid_pending_accept_mails || row.id);
    if (!id) continue;
    let bid;
    try { bid = await S.rpc('bid_claim_accept_mail', { p_id: id }); } catch (e) { console.error(e); continue; }
    if (!bid) continue;
    const lang = bid.lang === 'en' ? 'en' : 'nl';
    const link = site + (lang === 'nl' ? '/nl/afrekenen/' : '/checkout/') + '?bid=' + bid.token;
    try { await B.acceptMail(bid, S.products().find(p => p.id === bid.product_id), link); sent++; }
    catch (e) { console.error('accept mail', e); try { await S.rpc('bid_unclaim_accept_mail', { p_id: id }); } catch (e2) { console.error(e2); } }
  }
  return { statusCode: 200, body: 'sent ' + sent };
};
