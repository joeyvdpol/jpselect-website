/* Webshop-instellingen: gedeeld door de website (browser) en de betaalserver (Netlify Functions).
   Bedragen in euro's. Pas hier verzendkosten en landen aan; beide kanten rekenen dan hetzelfde. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.JPSHOP = m;
})(typeof self !== 'undefined' ? self : this, function () {
  const freeFrom = 130;              // gratis verzending vanaf dit subtotaal
  const rates = { NL: 6.95, BE: 9.95, DE: 9.95, EU: 14.95 }; // VOORSTEL – nog door Joey te bevestigen
  const countries = ['NL', 'BE', 'DE', 'FR', 'LU', 'AT', 'IT', 'ES', 'PT', 'IE', 'DK', 'SE', 'FI', 'PL', 'CZ', 'SK', 'SI', 'HR', 'HU', 'RO', 'BG', 'GR', 'CY', 'MT', 'EE', 'LV', 'LT'];
  const names = {
    nl: { NL: 'Nederland', BE: 'België', DE: 'Duitsland', FR: 'Frankrijk', LU: 'Luxemburg', AT: 'Oostenrijk', IT: 'Italië', ES: 'Spanje', PT: 'Portugal', IE: 'Ierland', DK: 'Denemarken', SE: 'Zweden', FI: 'Finland', PL: 'Polen', CZ: 'Tsjechië', SK: 'Slowakije', SI: 'Slovenië', HR: 'Kroatië', HU: 'Hongarije', RO: 'Roemenië', BG: 'Bulgarije', GR: 'Griekenland', CY: 'Cyprus', MT: 'Malta', EE: 'Estland', LV: 'Letland', LT: 'Litouwen' },
    en: { NL: 'Netherlands', BE: 'Belgium', DE: 'Germany', FR: 'France', LU: 'Luxembourg', AT: 'Austria', IT: 'Italy', ES: 'Spain', PT: 'Portugal', IE: 'Ireland', DK: 'Denmark', SE: 'Sweden', FI: 'Finland', PL: 'Poland', CZ: 'Czechia', SK: 'Slovakia', SI: 'Slovenia', HR: 'Croatia', HU: 'Hungary', RO: 'Romania', BG: 'Bulgaria', GR: 'Greece', CY: 'Cyprus', MT: 'Malta', EE: 'Estonia', LV: 'Latvia', LT: 'Lithuania' }
  };
  const rate = c => (c in rates ? rates[c] : rates.EU);
  /* verzendkosten in centen */
  function shippingCents(country, subtotalCents) {
    if (subtotalCents >= freeFrom * 100) return 0;
    return Math.round(rate(country) * 100);
  }
  const methods = ['ideal', 'bancontact', 'creditcard', 'applepay']; // alleen directe betaalmethoden
  return { freeFrom, rates, countries, names, rate, shippingCents, methods, reserveMinutes: 45 };
});
