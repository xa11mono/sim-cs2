// (Р5.4, 26.11) локальный режим: симуляция — ядро в этом процессе Node (tools/node/core_run.js), показ — страница в браузере того же компьютера,
// тот же код показа по кадрам. Протокол — как у Worker страницы (Р5.2): команда (match / adv / to / set, now — часы показа) → кадр
// (frameMake, текстом mkPack). Страница: http://127.0.0.1:<порт>/?local=1 (сборка src/build.py — та же, что для обычного режима).
// Запуск: node tools/node/local_server.js <core.js> <sim.html> [--port=8766]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const A = Object.fromEntries(process.argv.slice(4).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const CORE = path.resolve(process.argv[2]), PAGE = path.resolve(process.argv[3]), PORT = +(A.port || 8766);
// (Р5.2, режимы) хранилище браузера: настройки и правки, которые ядро читает при загрузке (localStorage — линии гранат, зоны, профиль соперника,
// хайлайты), — те же, что у страницы: страница присылает своё (init) до загрузки ядра; запись ядра (setItem) уходит странице с ответом (ls)
let EV = null, LS = {}, LSOUT = [];
globalThis.localStorage = { getItem: k => (Object.prototype.hasOwnProperty.call(LS, k) ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); LSOUT.push([k, String(v)]); },
  removeItem: k => { delete LS[k]; LSOUT.push([k, null]); } };
const page = fs.readFileSync(PAGE);
function cmd(m) {   // команда — coreCmd ядра (tools/node/core_build.py; то же, что у Worker страницы); снимки — текстом (mkPack)
  if (m.cmd === 'init' || !EV) { LS = Object.assign({}, m.ls || {}); EV = require('./core_run.js').load(CORE); EV('SIM_SHOW = true; 1'); }   // показ есть (страница): строки войса — как у Worker
  if (m.cmd === 'init') m = { cmd: 'set', v: {}, now: m.now };
  globalThis.__cmd = m; LSOUT = [];
  const out = EV(`(function(m){ if(typeof m.S === "string") m.S = mkUnpack(m.S); if(typeof m.dlog === "string") m.dlog = mkUnpack(m.dlog); var r = coreCmd(m);
    if(r.F) r.F = mkPack(r.F); if(r.S) r.S = mkPack(r.S); if(r.dlog) r.dlog = mkPack(r.dlog); return JSON.stringify(r); })(globalThis.__cmd)`);
  return LSOUT.length ? out.replace(/}$/, ',"ls":' + JSON.stringify(LSOUT) + '}') : out;
}
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/cmd') { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    try { const out = cmd(JSON.parse(b)); res.writeHead(200, { 'content-type': 'application/json' }); res.end(out); }
    catch (e) { res.writeHead(500); res.end(String(e && e.stack || e)); } }); return; }
  if (req.url === '/' || req.url.startsWith('/?') || req.url.startsWith('/index.html')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page); return; }
  res.writeHead(404); res.end();
}).listen(PORT, '127.0.0.1', () => console.log('локальный режим: http://127.0.0.1:' + PORT + '/?local=1 (ядро ' + path.basename(CORE) + ')'));
