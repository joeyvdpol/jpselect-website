/* Mails rond biedingen: bevestig je bod (koper), nieuw bod (eigenaar), bod geaccepteerd (koper). */
'use strict';
const M = require('./mail.js');
const S = require('./shop-server.js');
const esc = M.esc;

const T = {
  nl: {
    vSubj: p => 'Bevestig je bod op ' + p,
    vBody: (p, a) => `Je hebt een bod van ${a} gedaan op ${p}. Klik op de knop hieronder om je bod te bevestigen. Pas daarna telt het mee en zien we het.`,
    vBtn: 'Bod bevestigen',
    vNote: 'Een bevestigd bod blijft 7 dagen geldig. Ben je overboden of verloopt het, dan hoef je niets te doen. Een bod is pas een koop als wij het accepteren en jij betaalt. Heb je dit niet zelf gedaan? Dan kun je deze mail negeren.',
    aSubj: p => 'Je bod op ' + p + ' is geaccepteerd',
    aBody: (p, a) => `Goed nieuws: we hebben je bod van ${a} op ${p} geaccepteerd. Je kunt het paar nu voor dat bedrag afrekenen.`,
    aBtn: 'Nu afrekenen',
    aNote: until => `Deze link is geldig tot ${until}. Let op: het paar is niet voor je gereserveerd. Koopt iemand anders het eerder, dan is het weg. Verzendkosten zie je bij het afrekenen. Na ontvangst heb je 14 dagen bedenktijd.`,
    hi: n => 'Hoi ' + n + ',', q: 'Vragen? Beantwoord deze mail of mail naar info@jpselect.nl.'
  },
  en: {
    vSubj: p => 'Confirm your offer on ' + p,
    vBody: (p, a) => `You made an offer of ${a} on ${p}. Click the button below to confirm it. Only then does it count and do we see it.`,
    vBtn: 'Confirm offer',
    vNote: 'A confirmed offer stays valid for 7 days. If you are outbid or it expires, you do not need to do anything. An offer only becomes a purchase once we accept it and you pay. Did not make this offer? You can ignore this email.',
    aSubj: p => 'Your offer on ' + p + ' has been accepted',
    aBody: (p, a) => `Good news: we accepted your offer of ${a} on ${p}. You can now check out at that price.`,
    aBtn: 'Check out now',
    aNote: until => `This link is valid until ${until}. Please note: the pair is not reserved for you. If someone else buys it first, it is gone. You see the shipping cost at checkout. You have 14 days to change your mind after delivery.`,
    hi: n => 'Hi ' + n + ',', q: 'Questions? Reply to this email or write to info@jpselect.nl.'
  }
};

const foot = `${M.CO.name} · ${M.CO.city} · KVK ${M.CO.kvk} · btw ${M.CO.btw}`;
function page(lines, btn, href, note, q) {
  const text = [...lines, '', btn + ': ' + href, '', note, '', q, '', foot].join('\n');
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#1d1a16;max-width:560px;margin:0 auto;line-height:1.55">
<p style="letter-spacing:.3em;font-size:13px;margin:0 0 24px">JP SELECT</p>
${lines.map(l => `<p>${esc(l)}</p>`).join('')}
<p style="margin:28px 0"><a href="${esc(href)}" style="background:#1d1a16;color:#f6f3ee;text-decoration:none;padding:14px 26px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;display:inline-block">${esc(btn)}</a></p>
<p style="font-size:13px;color:#5b544b">${esc(note)}</p><p style="font-size:13px">${esc(q)}</p>
<p style="font-size:11px;color:#8a8073;margin-top:28px">${esc(foot)}</p></div>`;
  return { text, html };
}
const pname = p => p ? `${p.brand} ${p.model} (${(p.sizeSystem ? p.sizeSystem + ' ' : '') + p.size})` : 'dit stuk';
const when = (iso, lang) => new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

async function verifyMail(b, p, link) {
  const t = T[b.lang === 'en' ? 'en' : 'nl'];
  const c = page([t.hi(b.name), t.vBody(pname(p), S.euro(b.amount_cents))], t.vBtn, link, t.vNote, t.q);
  await M.transport().sendMail({ from: { name: 'JP SELECT', address: M.FROM }, to: b.email, replyTo: M.FROM, subject: t.vSubj(pname(p)), ...c });
}

async function ownerBidMail(b, p, count) {
  const text = [`Nieuw bevestigd bod op ${p ? p.sku + ' ' : ''}${pname(p)}`, '',
    `Bod: ${S.euro(b.amount_cents)} (vraagprijs ${S.euro(b.list_cents)})`, `Van: ${b.name} <${b.email}>`,
    `Aantal actieve biedingen: ${count}`, `Geldig tot: ${when(b.expires_at, 'nl')}`, '',
    'Accepteren of weigeren doe je in het Business Center onder Webshop > Biedingen.'].join('\n');
  await M.transport().sendMail({ from: { name: 'JP SELECT webshop', address: M.FROM }, to: M.FROM, replyTo: b.email,
    subject: `Nieuw bod ${S.euro(b.amount_cents)} op ${p ? p.sku : b.product_id}`, text });
}

async function acceptMail(b, p, link) {
  const t = T[b.lang === 'en' ? 'en' : 'nl'];
  const c = page([t.hi(b.name), t.aBody(pname(p), S.euro(b.amount_cents))], t.aBtn, link, t.aNote(when(b.accept_until, b.lang)), t.q);
  await M.transport().sendMail({ from: { name: 'JP SELECT', address: M.FROM }, to: b.email, replyTo: M.FROM, subject: t.aSubj(pname(p)), ...c });
}

module.exports = { verifyMail, ownerBidMail, acceptMail };
