/* JP SELECT: productfeed voor Google Merchant Center (gratis vermeldingen in Google Shopping).
   Formaat: RSS 2.0 met de g:-namespace (https://support.google.com/merchants/answer/7052112).
   Alleen stukken die nu te koop zijn (status "available", met prijs en foto) komen in de feed. */
'use strict';
const SEO = require('./seo.js');

const x = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const money = v => Number(v).toFixed(2) + ' EUR';

/* Google-productcategorieën: 187 = Apparel & Accessories > Shoes; 1604 = Apparel & Accessories > Clothing */
function category(p) { return p.category === 'clothing' ? '1604' : '187'; }

function item(p, site, L) {
  const nl = L === 'nl';
  const url = site + SEO.pathOf({ v: 'product', p: p.id }, L, [p]);
  const imgs = (p.images || []).map(u => site + '/' + String(u).replace(/^\//, ''));
  const isNew = p.condition === 'new' || p.condition === 'new-tags';
  const shoe = p.category !== 'clothing';
  const kind = p.category === 'sneakers' ? 'sneakers' : shoe ? (nl ? 'schoenen' : 'shoes') : '';
  const title = [p.brand, p.model, kind, p.size ? (nl ? 'maat ' : 'size ') + p.size : '', isNew ? (nl ? '– nieuw' : '– new') : (nl ? '– tweedehands' : '– pre-owned')]
    .filter(Boolean).join(' ').slice(0, 150);
  const descr = [SEO.productDesc(p, L).replace(/\s*(Bekijk het bij JP SELECT\.|View it at JP SELECT\.)$/, ''),
    p.material && p.material[L] ? (nl ? 'Materiaal: ' : 'Material: ') + p.material[L] + '.' : '',
    nl ? 'Uniek stuk, verzonden vanuit Nederland. 14 dagen bedenktijd.' : 'One of a kind, shipped from the Netherlands. 14-day withdrawal period.']
    .filter(Boolean).join(' ').slice(0, 5000);
  const lines = [
    `<g:id>${x(p.sku || p.id)}</g:id>`,
    `<g:title>${x(title)}</g:title>`,
    `<g:description>${x(descr)}</g:description>`,
    `<g:link>${x(url)}</g:link>`,
    imgs[0] ? `<g:image_link>${x(imgs[0])}</g:image_link>` : '',
    ...imgs.slice(1, 11).map(u => `<g:additional_image_link>${x(u)}</g:additional_image_link>`),
    `<g:availability>in_stock</g:availability>`,
    `<g:price>${money(p.price)}</g:price>`,
    `<g:condition>${isNew ? 'new' : 'used'}</g:condition>`,
    `<g:brand>${x(p.brand)}</g:brand>`,
    `<g:identifier_exists>no</g:identifier_exists>`,
    `<g:google_product_category>${category(p)}</g:google_product_category>`,
    `<g:product_type>${x([nl ? (shoe ? 'Schoenen' : 'Kleding') : (shoe ? 'Shoes' : 'Clothing'), p.brand].join(' > '))}</g:product_type>`,
    p.gender === 'men' || p.gender === 'women' ? `<g:gender>${p.gender === 'men' ? 'male' : 'female'}</g:gender>` : '',
    `<g:age_group>adult</g:age_group>`,
    p.color && p.color[L] ? `<g:color>${x(String(p.color[L]).split(/,\s*/).slice(0, 3).join('/'))}</g:color>` : '',
    p.material && p.material[L] ? `<g:material>${x(p.material[L])}</g:material>` : '',
    p.size ? `<g:size>${x(String(p.size))}</g:size>` : '',
    p.size && shoe ? `<g:size_system>${x(p.sizeSystem || 'EU')}</g:size_system>` : ''
  ].filter(Boolean);
  return '<item>\n' + lines.map(l => '  ' + l).join('\n') + '\n</item>';
}

function eligible(p) { return p && p.status === 'available' && p.price > 0 && (p.images || []).length > 0 && !p.demo; }

function merchantFeed({ products, site, lang }) {
  site = String(site).replace(/\/$/, '');
  const L = lang === 'en' ? 'en' : 'nl';
  const items = (products || []).filter(eligible).map(p => item(p, site, L));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    '<title>JP SELECT</title>',
    `<link>${x(site + (L === 'nl' ? '/nl/' : '/'))}</link>`,
    `<description>${L === 'nl' ? 'Tweedehands en nieuwe luxe sneakers en designermode' : 'Pre-owned and new luxury sneakers and designer fashion'}</description>`,
    ...items,
    '</channel>',
    '</rss>',
    ''
  ].join('\n');
}

module.exports = { merchantFeed, eligible };
