// (Т-2, 25.11) Изоляция матчей — инвариант I-22 в уточнении владельца 25.11: следующий матч после сыгранного (штатный переход из stepTick
// после matchover) = тот же матч в НОВОЙ странице с той же долгосрочной памятью на входе (OPP) — бит в бит. Игру не меняет.
// Плечо A: новая страница, freshMatch(M) с OPP на входе, игра до конца матча и штатного перехода (matchNum меняется сам) → память на
// выходе (OPP после saveOppProfile). Плечо B: новая страница (свой контекст браузера — своё хранилище), OPP = копия выхода A,
// freshMatch(N, true) (true — профиль не сбрасывать). Сравнение: (1) состояние в момент старта N — каждая общая переменная, каждое поле
// ботов, состояние вне переменных (mkSnapExt, если есть); (2) отпечаток игры по тикам дальше (--ticks).
// Запуск: node tools/rebuild/i22_check.js sim.html [--match=11] [--ticks=8000] [--opp=empty|@файл.json] [--out=отчёт.json]
'use strict';
const fs = require('fs'), path = require('path'), pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
const SIM = path.resolve(process.argv[2]), M = +(A.match || 11), TICKS = +(A.ticks || 8000);
const OPP0 = !A.opp || A.opp === 'empty' ? null : JSON.parse(fs.readFileSync(A.opp.replace(/^@/, ''), 'utf8'));
const NAMES = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'rebuild', 'gen', 'state.json'), 'utf8')).globals);
const { PAGE } = require('./state_digest.js');
const RUN = `window.I22 = { run: function(K){ var out = [], F64 = new Float64Array(1), U = new Uint32Array(F64.buffer), M0 = matchNum;
  for(var t = 0; t < K && matchNum === M0; t++){ stepTick(); var h = 2166136261 >>> 0;
    function mix(v){ F64[0] = +v || 0; h = Math.imul(h ^ U[0], 16777619) >>> 0; h = Math.imul(h ^ U[1], 16777619) >>> 0; }
    function mixS(s){ s = String(s == null ? '' : s); for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; }
    mix(tick); mixS(roundState); bots.forEach(function(b){ mix(b.x); mix(b.y); mix(b.facing); mix(b.hp); mix(b.alive ? 1 : 0); mixS(b.weapon && b.weapon.key); mix(b.money); });
    out.push([tick, h]); }
  return out; },
  ext: function(){ return typeof mkSnapExt === 'function' ? mkPack(mkSnapExt()) : null; } };`;
async function page(br) { const ctx = await br.newContext(); const p = await ctx.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(require('url').pathToFileURL(SIM).href); await p.waitForTimeout(1200); await DVS.stopFrames(p); await p.evaluate(c => __ev(c), RUN + PAGE + '1'); return p; }
(async () => {
  const br = await pw.chromium.launch();
  const pa = await page(br);
  // A: OPP на входе, матч M до конца и штатного перехода
  const a0 = await pa.evaluate(([m, o]) => __ev(`OPP = ${JSON.stringify(o)}; freshMatch(${m}, true); var M0 = matchNum, n = 0; while(matchNum === M0 && n < 600000){ stepTick(); n++; }
    JSON.stringify({n: matchNum, ticks: n, opp: OPP, tick: tick})`), [M, OPP0]).then(JSON.parse);
  const da = await pa.evaluate(n => __ev('SR.cp(' + JSON.stringify(n) + ')'), NAMES);
  const xa = await pa.evaluate(() => __ev('I22.ext()'));
  const ra = await pa.evaluate(K => __ev('I22.run(' + K + ')'), TICKS);
  // B: новая страница (свой контекст), OPP = выход A, тот же номер матча
  const pb = await page(br);
  await pb.evaluate(([n, o]) => __ev(`OPP = ${JSON.stringify(o)}; freshMatch(${n}, true); 1`), [a0.n, a0.opp]);
  const db = await pb.evaluate(n => __ev('SR.cp(' + JSON.stringify(n) + ')'), NAMES);
  const xb = await pb.evaluate(() => __ev('I22.ext()'));
  const rb = await pb.evaluate(K => __ev('I22.run(' + K + ')'), TICKS);
  await br.close();
  const k = ra.findIndex((x, i) => !rb[i] || x[1] !== rb[i][1]);
  const res = { sim: path.basename(SIM), match_a: M, match_next: a0.n, ticks_match_a: a0.ticks, tick_at_transition: a0.tick, opp_in: OPP0 ? 'файл' : 'пусто',
    start_diff_globals: NAMES.filter(n => da.g[n] !== db.g[n]),
    start_diff_bot_fields: Object.keys(Object.assign({}, da.b, db.b)).filter(f => JSON.stringify(da.b[f]) !== JSON.stringify(db.b[f])),
    start_diff_ext: xa === xb ? null : 'отличается (подсказки броска / кэш путей — mkSnapExt)',
    same: k < 0 && ra.length === rb.length, compared: Math.min(ra.length, rb.length), first_diff_tick: k < 0 ? null : ra[k][0] };
  console.log(JSON.stringify(res));
  if (A.out) fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
