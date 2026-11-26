// (Р5.4, 26.11) локальный режим: симуляция — ядро в этом процессе Node (tools/node/core_run.js), показ — страница в браузере того же компьютера,
// тот же код показа по кадрам. Протокол — как у Worker страницы (Р5.2): команда (match / adv / to / set, now — часы показа) → кадр
// (frameMake, текстом mkPack). Страница: http://127.0.0.1:<порт>/?local=1 (сборка src/build.py — та же, что для обычного режима).
// Запуск: node tools/node/local_server.js <core.js> <sim.html> [--port=8766]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const A = Object.fromEntries(process.argv.slice(4).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const CORE = path.resolve(process.argv[2]), PAGE = path.resolve(process.argv[3]), PORT = +(A.port || 8766);
const EV = require('./core_run.js').load(CORE);
EV('SIM_SHOW = true; 1');   // показ есть (страница): строки войса и т. п. — как у Worker страницы
const page = fs.readFileSync(PAGE);
function cmd(m) {   // то же, что обработчик Worker в ядре (tools/node/core_build.py)
  globalThis.__cmd = m;
  return EV(`(function(m){ if(m.now != null) nowTs = m.now;
    if(m.cmd === "match") freshMatch(m.n, m.keep);
    else if(m.cmd === "adv"){ clockAcc(accumulator + m.ms); while(accumulator >= TICK_MS){ stepTick(); clockAcc(accumulator - TICK_MS); } }
    else if(m.cmd === "to"){ while(tick < m.t) stepTick(); }
    else if(m.cmd === "set"){ Object.keys(m.v).forEach(function(k){ eval(k + " = m.v[k]"); }); }
    return JSON.stringify({tick: tick, F: mkPack(frameMake())}); })(globalThis.__cmd)`);
}
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/cmd') { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    try { const out = cmd(JSON.parse(b)); res.writeHead(200, { 'content-type': 'application/json' }); res.end(out); }
    catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); } }); return; }
  if (req.url === '/' || req.url.startsWith('/?') || req.url.startsWith('/index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page); return; }
  res.writeHead(404); res.end();
}).listen(PORT, '127.0.0.1', () => console.log('локальный режим: http://127.0.0.1:' + PORT + '/?local=1 (ядро ' + path.basename(CORE) + ')'));
