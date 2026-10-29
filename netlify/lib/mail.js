/* Bevestigingsmails, verstuurd via het Google Workspace-account info@jpselect.nl (eigen SMTP-verzender + app-wachtwoord). */
'use strict';
const SMTP = require('./smtp.js');
const S = require('./shop-server.js');

const FROM = 'info@jpselect.nl';
const CO = { name: 'JP SELECT', owner: 'Joey van den Pol', city: 'Nijkerk', kvk: '42155019', btw: 'NL005540814B59' };

function transport() {
  const pass = S.env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  if (!pass) throw new Error('GMAIL_APP_PASSWORD ontbreekt');
  const opt = { host: S.env('SMTP_HOST') || 'smtp.gmail.com', port: +(S.env('SMTP_PORT') || 465), user: FROM, pass };
  return { sendMail: m => SMTP.send(opt, m) };
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const T = {
  nl: {
    subj: r => 'Je bestelling ' + r + ' bij JP SELECT',
    hi: n => 'Hoi ' + n + ',',
    thanks: 'Bedankt voor je bestelling. Je betaling is ontvangen. We pakken je stuk zorgvuldig in en mailen je de track & trace zodra het onderweg is.',
    conflict: 'Je betaling is ontvangen. Eén of meer stukken uit je bestelling zijn helaas net op een ander kanaal verkocht. We nemen binnen één werkdag contact met je op; je krijgt het bedrag voor die stukken volledig terug.',
    order: 'Bestelling', sub: 'Subtotaal', ship: 'Verzending', free: 'Gratis', total: 'Totaal (incl. btw, voor zover verschuldigd)', addr: 'Bezorgadres',
    wd: 'Bedenktijd (herroepingsrecht)',
    wdP: 'Je mag je bestelling binnen 14 dagen na ontvangst zonder opgave van reden annuleren. Meld dit binnen die 14 dagen per mail aan info@jpselect.nl (je kunt het formulier hieronder gebruiken, maar dat hoeft niet) en stuur het artikel binnen 14 dagen na je melding terug. De kosten voor het terugsturen zijn voor jouw rekening. We betalen het aankoopbedrag inclusief de oorspronkelijke verzendkosten binnen 14 dagen na je melding terug, maar mogen wachten tot we het artikel terug hebben ontvangen. Behandel het artikel zorgvuldig en pas het alleen zoals je dat in een winkel zou doen.',
    form: 'Modelformulier voor herroeping',
    formT: 'Aan: JP SELECT, Nijkerk, info@jpselect.nl\nIk deel u hierbij mede dat ik onze overeenkomst betreffende de verkoop van de volgende producten herroep: [artikel]\nBesteld op / ontvangen op: [datum]\nBestelnummer: {ref}\nNaam: [naam]\nAdres: [adres]\nHandtekening (alleen bij een papieren formulier):\nDatum:',
    terms: 'Onze algemene voorwaarden: ', q: 'Vragen? Beantwoord deze mail of mail naar info@jpselect.nl.'
  },
  en: {
    subj: r => 'Your JP SELECT order ' + r,
    hi: n => 'Hi ' + n + ',',
    thanks: 'Thank you for your order. Your payment has been received. We will pack your piece carefully and email you the tracking link once it is on its way.',
    conflict: 'Your payment has been received. Unfortunately one or more pieces in your order were just sold through another channel. We will contact you within one working day and refund the amount for those pieces in full.',
    order: 'Order', sub: 'Subtotal', ship: 'Shipping', free: 'Free', total: 'Total (incl. VAT where applicable)', addr: 'Delivery address',
    wd: 'Right of withdrawal',
    wdP: 'You may cancel your order within 14 days of receiving it without giving a reason. Let us know within those 14 days by email at info@jpselect.nl (you may use the form below, but you do not have to) and return the item within 14 days of telling us. Return shipping costs are at your expense. We refund the purchase price including the original shipping costs within 14 days of your notice, but may wait until we have received the item back. Please handle the item with care and only try it on as you would in a shop.',
    form: 'Model withdrawal form',
    formT: 'To: JP SELECT, Nijkerk, Netherlands, info@jpselect.nl\nI hereby give notice that I withdraw from my contract of sale of the following goods: [item]\nOrdered on / received on: [date]\nOrder number: {ref}\nName: [name]\nAddress: [address]\nSignature (only if this form is notified on paper):\nDate:',
    terms: 'Our terms and conditions: ', q: 'Questions? Reply to this email or write to info@jpselect.nl.'
  }
};

function customerMail(o, conflict) {
  const t = T[o.lang === 'en' ? 'en' : 'nl'];
  const site = 'https://jpselect.nl' + (o.lang === 'en' ? '/terms/' : '/nl/voorwaarden/');
  const names = S.SHOP.names[o.lang === 'en' ? 'en' : 'nl'];
  const lines = (o.items || []).map(i => `${i.brand} ${i.model} · ${i.size} · ${i.sku || ''}  ${S.euro(i.price_cents)}`);
  const shipTxt = o.shipping_cents ? S.euro(o.shipping_cents) : t.free;
  const form = t.formT.replace('{ref}', o.ref);
  const text = [t.hi(o.name), '', conflict ? t.conflict : t.thanks, '', t.order + ' ' + o.ref, ...lines,
    t.sub + ': ' + S.euro(o.subtotal_cents), t.ship + ': ' + shipTxt, t.total + ': ' + S.euro(o.total_cents), '',
    t.addr + ':', o.name, o.street, o.zip + ' ' + o.city, names[o.country] || o.country, '',
    t.wd, t.wdP, '', t.form, form, '', t.terms + site, t.q, '',
    `${CO.name} · ${CO.city} · KVK ${CO.kvk} · btw ${CO.btw}`].join('\n');
  const row = (a, b, bold) => `<tr><td style="padding:6px 0;${bold ? 'font-weight:600;' : ''}">${a}</td><td style="padding:6px 0;text-align:right;${bold ? 'font-weight:600;' : ''}">${b}</td></tr>`;
  const htmlBody = `<div style="font-family:Helvetica,Arial,sans-serif;color:#1d1a16;max-width:560px;margin:0 auto;line-height:1.55">
<p style="letter-spacing:.3em;font-size:13px;margin:0 0 24px">JP SELECT</p>
<p>${esc(t.hi(o.name))}</p><p>${esc(conflict ? t.conflict : t.thanks)}</p>
<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8a8073;margin-top:28px">${t.order} ${esc(o.ref)}</p>
<table style="width:100%;border-collapse:collapse;border-top:1px solid #e5ded3;font-size:14px">
${(o.items || []).map(i => row(`${esc(i.brand)} ${esc(i.model)}<br><span style="color:#8a8073">${esc(i.size)} · ${esc(i.sku || '')}</span>`, S.euro(i.price_cents))).join('')}
${row(t.sub, S.euro(o.subtotal_cents))}${row(t.ship, shipTxt)}${row(esc(t.total), S.euro(o.total_cents), true)}</table>
<p style="font-size:14px"><b>${t.addr}</b><br>${esc(o.name)}<br>${esc(o.street)}<br>${esc(o.zip)} ${esc(o.city)}<br>${esc(names[o.country] || o.country)}</p>
<p style="font-size:13px"><b>${t.wd}</b><br>${esc(t.wdP)}</p>
<p style="font-size:13px"><b>${t.form}</b><br>${esc(form).replace(/\n/g, '<br>')}</p>
<p style="font-size:13px">${t.terms}<a href="${site}" style="color:#1d1a16">${site}</a><br>${t.q}</p>
<p style="font-size:11px;color:#8a8073;margin-top:28px">${CO.name} · ${CO.city} · KVK ${CO.kvk} · btw ${CO.btw}</p></div>`;
  return { from: { name: 'JP SELECT', address: FROM }, to: o.email, replyTo: FROM, subject: t.subj(o.ref), text, html: htmlBody };
}

function ownerMail(o, conflict) {
  const lines = (o.items || []).map(i => `- ${i.sku || i.id}  ${i.brand} ${i.model} (${i.size})  ${S.euro(i.price_cents)}`);
  const text = [(conflict ? '⚠️ LET OP: dubbel verkocht – een stuk was al bezet. Neem contact op met de klant en betaal dat deel terug via Mollie.\n' : '') +
    'Nieuwe webshopbestelling ' + o.ref + ' is betaald (' + (o.method || 'onbekend') + (o.mollie_mode === 'test' ? ', TESTMODUS' : '') + ').', '',
    ...lines, 'Verzending: ' + S.euro(o.shipping_cents), 'Totaal: ' + S.euro(o.total_cents), '',
    o.name, o.street, o.zip + ' ' + o.city, o.country, o.email, o.phone || '', '',
    'Haal deze stukken nu van Vinted af, zodat ze niet dubbel verkocht worden.', 'Mollie: ' + (o.mollie_id || '')].join('\n');
  return { from: { name: 'JP SELECT webshop', address: FROM }, to: FROM, replyTo: o.email,
    subject: (conflict ? '⚠️ DUBBEL VERKOCHT – ' : '') + (o.mollie_mode === 'test' ? '[TEST] ' : '') + 'Bestelling ' + o.ref + ' betaald – ' + S.euro(o.total_cents), text };
}

async function orderMails(o, conflict) {
  const tr = transport();
  await tr.sendMail(ownerMail(o, conflict));
  await tr.sendMail(customerMail(o, conflict));
}

module.exports = { orderMails, customerMail, ownerMail };
