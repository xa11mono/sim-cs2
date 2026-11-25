// (Р3.1, 25.11) Реестр состояния — проверка опытом: какие общие переменные и поля бота на самом деле меняются за матч. Игру не меняет
// (страница — обычная сборка; кадр страницы остановлен, игру ведут только шаги инструмента).
// Зачем: статический разбор (gen_maps → rebuild/gen/state.json) не видит изменений через другие имена и параметры; правило «не пишется
// по имени → неизменяемое» (state_classes.py) подтверждается или опровергается здесь. Второе — полнота снимка: что меняется в игре, но в
// снимок отметки (__SNAP) не попадает.
// Контрольные точки: после freshMatch(N) (до первого шага), после 1 шага, в начале раундов 2 и 3, в конце (--ticks). Хэш значения —
// дерево как в dv_state.js, но бот внутри чужого значения — ссылка {bot: id} (поле бота хэшируется само по себе, без обхода всей команды).
// Запуск: node tools/rebuild/state_runtime.js sim.html --match=3 --ticks=12000 [--rounds=2,3,14] --out=файл.json
'use strict';
const fs = require('fs'), path = require('path');
const pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => a.replace(/^--/, '').split('=')));
const SIM = path.resolve(process.argv[2]), MATCH = +(A.match || 3), TICKS = +(A.ticks || 12000), OUT = A.out || 'state_runtime.json';
const ST = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'rebuild', 'gen', 'state.json'), 'utf8'));
const G = Object.keys(ST.globals);

const { PAGE } = require('./state_digest.js');

(async () => {
  const br = await pw.chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto(require('url').pathToFileURL(SIM).href); await pg.waitForTimeout(1200); await DVS.stopFrames(pg);
  await pg.evaluate(c => __ev(c), PAGE + '1');
  const snap = await pg.evaluate(() => __ev('mkSnapList().map(function(e){ return e[0]; })'));
  const cps = [];
  const take = async name => { const t0 = Date.now(); const c = await pg.evaluate(n => __ev('SR.cp(' + JSON.stringify(n) + ')'), G); c.name = name; c.ms = Date.now() - t0; cps.push(c); console.error(name, 'тик', c.tick, 'раунд', c.round, c.ms + ' мс'); };
  await pg.evaluate(m => __ev('freshMatch(' + m + '); 1'), MATCH);
  await take('после freshMatch');
  await pg.evaluate(() => __ev('stepTick(); 1')); await take('1 шаг');
  for (const want of (A.rounds || '2,3').split(',').map(Number)) {
    await pg.evaluate(([w, T]) => __ev('var M0 = matchNum; while(roundNum < ' + w + ' && tick < ' + T + ' && matchNum === M0) stepTick(); 1'), [want, TICKS]);
    await take('раунд ' + want);
  }
  await pg.evaluate(T => __ev('var M0 = matchNum; while(tick < ' + T + ' && matchNum === M0) stepTick(); 1'), TICKS); await take('конец');
  await br.close();
  // что менялось: переменная → между какими точками
  const ch = {}, bch = {};
  for (const n of G) { const seq = cps.map(c => c.g[n]); const at = []; for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) at.push(cps[i].name); ch[n] = at; }
  const bk = new Set(); cps.forEach(c => Object.keys(c.b).forEach(k => bk.add(k)));
  for (const k of bk) { const at = []; for (let i = 1; i < cps.length; i++) if (JSON.stringify(cps[i].b[k]) !== JSON.stringify(cps[i - 1].b[k])) at.push(cps[i].name); bch[k] = at; }
  const sn = new Set(snap);
  const res = { sim: path.basename(SIM), match: MATCH, ticks: TICKS, points: cps.map(c => ({ name: c.name, tick: c.tick, round: c.round, ms: c.ms })),
    // type: тип значения; функция — содержимое её замыкания хэш не видит («не меняется» для неё не доказано)
    globals: Object.fromEntries(G.map(n => [n, { changed: ch[n], snap: sn.has(n), absent: cps[0].g[n] === 'нет', type: cps[cps.length - 1].ty[n] }])),
    bot: Object.fromEntries([...bk].sort().map(k => [k, { changed: bch[k] }])),
    changed_not_in_snapshot: G.filter(n => ch[n].length && !sn.has(n)) };
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  console.error('меняются:', G.filter(n => ch[n].length).length, 'из', G.length, '; меняются, но не в снимке:', res.changed_not_in_snapshot.length);
})().catch(e => { console.error(e); process.exit(1); });
