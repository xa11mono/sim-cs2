// (Р3.4, 25.11) Состояние страницы сразу после загрузки у двух сборок: хэши всех переменных реестра (rebuild/gen/state.json) и полей ботов
// (SR.cp, tools/rebuild/state_digest.js). Доказательство, что перенос кода загрузки (порядок boot) не меняет начальное состояние игры.
// Игру не меняет. Запуск: node tools/rebuild/load_state_cmp.js A.html B.html [--out=файл.json]
'use strict';
const fs = require('fs'), path = require('path'), pw = require('playwright');
const { PAGE } = require('./state_digest.js');
const [FA, FB] = process.argv.slice(2, 4).map(f => path.resolve(f));
const A = Object.fromEntries(process.argv.slice(4).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const NAMES = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'rebuild', 'gen', 'state.json'), 'utf8')).globals);
async function state(br, file) {
  const p = await br.newPage(); await p.route(/^https?:/, r => r.abort());
  // кадры и таймеры страницы — до скриптов игры не запускаются: сравнивается ровно состояние после выполнения кода загрузки,
  // без кадров, которые успели бы пройти за ожидание (часы страницы, показ, шаги игры в кадре)
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; window.setTimeout = () => 0; window.setInterval = () => 0; });
  await p.goto(require('url').pathToFileURL(file).href); await p.waitForTimeout(500);
  await p.evaluate(c => __ev(c), PAGE + '1');
  const r = await p.evaluate(n => __ev('SR.cp(' + JSON.stringify(n) + ')'), NAMES); await p.close(); return r;
}
(async () => {
  const br = await pw.chromium.launch();
  const a = await state(br, FA), b = await state(br, FB); await br.close();
  const dg = NAMES.filter(n => a.g[n] !== b.g[n]), keys = [...new Set(Object.keys(a.b).concat(Object.keys(b.b)))];
  const db = keys.filter(k => JSON.stringify(a.b[k]) !== JSON.stringify(b.b[k]));
  const res = { a: path.basename(path.dirname(FA)) + '/' + path.basename(FA), b: path.basename(path.dirname(FB)) + '/' + path.basename(FB),
    vars: NAMES.length, bot_fields: keys.length, tick: [a.tick, b.tick], diff_vars: dg, diff_bot_fields: db, same: !dg.length && !db.length };
  if (A.out) fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
  console.log(`переменных ${NAMES.length}, полей ботов ${keys.length}: ` + (res.same ? 'состояние после загрузки одинаковое' : 'РАЗЛИЧИЯ: ' + dg.concat(db.map(k => 'бот.' + k)).join(', ')));
  process.exit(res.same ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
