/* Kleine SMTP-verzender (TLS, poort 465, AUTH PLAIN) zonder externe pakketten. */
'use strict';
const tls = require('tls');
const crypto = require('crypto');

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=';
const addr = a => typeof a === 'string' ? '<' + a + '>' : (a.name ? '"' + encWord(a.name).replace(/"/g, '') + '" ' : '') + '<' + a.address + '>';
const bare = a => typeof a === 'string' ? a : a.address;
const wrap76 = s => s.replace(/.{1,76}/g, '$&\r\n');

function build(m) {
  const bnd = 'jps' + crypto.randomBytes(12).toString('hex');
  const h = [
    'From: ' + addr(m.from), 'To: ' + addr(m.to), m.replyTo ? 'Reply-To: ' + addr(m.replyTo) : null,
    'Subject: ' + encWord(m.subject), 'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + crypto.randomBytes(16).toString('hex') + '@jpselect.nl>', 'MIME-Version: 1.0'
  ].filter(Boolean);
  if (!m.html) return h.concat(['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.text))]).join('\r\n');
  return h.concat(['Content-Type: multipart/alternative; boundary="' + bnd + '"', '',
    '--' + bnd, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.text)),
    '--' + bnd, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.html)),
    '--' + bnd + '--', '']).join('\r\n');
}

function send(opt, m) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host: opt.host, port: opt.port || 465, servername: opt.host, rejectUnauthorized: true });
    let buf = '', step = 0, done = false;
    const fail = e => { if (done) return; done = true; try { sock.destroy(); } catch (x) {} reject(e instanceof Error ? e : new Error(String(e))); };
    const steps = [
      [220, () => 'EHLO jpselect.nl'],
      [250, () => 'AUTH PLAIN ' + b64('\0' + opt.user + '\0' + opt.pass)],
      [235, () => 'MAIL FROM:<' + bare(m.from) + '>'],
      [250, () => 'RCPT TO:<' + bare(m.to) + '>'],
      [250, () => 'DATA'],
      [354, () => build(m).replace(/^\./gm, '..') + '\r\n.'],
      [250, () => 'QUIT']
    ];
    sock.setTimeout(20000, () => fail(new Error('smtp timeout')));
    sock.on('error', fail);
    sock.on('data', d => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (/^\d{3}-/.test(line)) continue; // meerregelig antwoord
        const code = parseInt(line.slice(0, 3), 10);
        if (step >= steps.length) { done = true; sock.end(); return resolve(); }
        if (code !== steps[step][0]) return fail(new Error('smtp ' + line));
        sock.write(steps[step][1]() + '\r\n'); step++;
      }
    });
  });
}

module.exports = { send, build };
