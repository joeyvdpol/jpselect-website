/* Gedeelde hulpfuncties voor de betaalserver. Geheime sleutels staan alleen in de
   Netlify-omgevingsvariabelen, nooit in de code of in de browser:
     MOLLIE_API_KEY             test_… (testen) of live_… (echt)
     SUPABASE_SERVICE_KEY       geheime sleutel van Supabase (sb_secret_… of service_role)
     GMAIL_APP_PASSWORD         app-wachtwoord van info@jpselect.nl (voor bevestigingsmails)
     SHOP_OPEN                  'true' zet de kassa aan; alles anders = kassa dicht            */
'use strict';
const SUPABASE_URL = 'https://tcusxrslzoldpmjbpzxu.supabase.co';
const SHOP = require('../../shop.js');
const data = require('../../data/products.json');

const env = k => (process.env[k] || '').trim();
const shopOpen = () => env('SHOP_OPEN') === 'true' && !!env('MOLLIE_API_KEY') && !!env('SUPABASE_SERVICE_KEY');

function siteUrl(event) {
  const h = (event && event.headers) || {};
  const host = h['x-forwarded-host'] || h.host;
  if (host && /(^|\.)jpselect\.nl$|\.netlify\.app$|^localhost(:\d+)?$/.test(host)) return (/^localhost/.test(host) ? 'http://' : 'https://') + host;
  return env('URL') || 'https://jpselect.nl';
}

const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

async function rpc(fn, args) {
  const key = env('SUPABASE_SERVICE_KEY');
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers, body: JSON.stringify(args || {}) });
  const t = await r.text();
  if (!r.ok) throw new Error('supabase ' + fn + ' ' + r.status + ' ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}

async function mollie(method, path, body) {
  const r = await fetch('https://api.mollie.com/v2' + path, {
    method, headers: { Authorization: 'Bearer ' + env('MOLLIE_API_KEY'), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('mollie ' + r.status + ' ' + (t.detail || t.title || '')); e.status = r.status; throw e; }
  return t;
}

const products = () => (data.products || []).filter(p => p && p.id && !p.demo);
const euro = c => '€ ' + (c / 100).toFixed(2).replace('.', ',');

module.exports = { SHOP, env, shopOpen, siteUrl, json, rpc, mollie, products, euro };
