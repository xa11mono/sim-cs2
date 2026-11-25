// (Р3.1.2, 25.11) Полнота снимка отметки по ЗНАЧЕНИЯМ: снимок страницы A на тике T открывается в новой странице B, обе играют дальше;
// каждый тик сравнивается отпечаток игры (как tools/measure/fingerprint.js: тик, состояние раунда, у ботов x, y, взгляд, HP, жив, оружие,
// деньги). Игру не меняет. Отличие от I-23 (diverge --snap-at): там первое отличие любого поля, включая тождество объектов (`#`); здесь —
// влияет ли неполнота снимка на игру.
// --carry=X,Y — перенести вместе со снимком и эти переменные (выражение, напр. nadeGuessStore.all(), — только упаковывается, переносит --after) (одной упаковкой — общие ссылки со снимком сохраняются): проверка, какая из
// переменных вне снимка нужна, чтобы игра шла так же. Восстановление — как mkOpenSnap, но без второй копии (structuredClone), чтобы
// перенесённые переменные остались связаны со снимком.
// Запуск: node tools/rebuild/snap_check.js sim.html --match=3 --at=3000 --ticks=6000 [--carry=…] [--inplace=1] [--diff=1] [--after=код после восстановления] [--b=сборка для B] [--open=1 — открыть штатно, mkRestore (переходники формата)] [--out=файл.json]
'use strict';
const fs = require('fs'), path = require('path'), pw = require('playwright'), DVS = require(path.join(__dirname, '..', 'measure', 'dv_state.js'));
const A = Object.fromEntries(process.argv.slice(3).map(a => { const t = a.replace(/^--/, ''), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
if (A.after && A.after[0] === '@') A.after = fs.readFileSync(A.after.slice(1), 'utf8');
const SIM = path.resolve(process.argv[2]), MATCH = +(A.match || 3), AT = +(A.at || 3000), TICKS = +(A.ticks || 6000);
const CARRY = (A.carry || '').split(',').filter(Boolean);
const NAMES = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'rebuild', 'gen', 'state.json'), 'utf8')).globals);
const { PAGE } = require('./state_digest.js');
const FP = `window.SC = { run: function(K){ var out = [], F64 = new Float64Array(1), U = new Uint32Array(F64.buffer), M0 = matchNum;
  for(var t = 0; t < K && matchNum === M0; t++){ stepTick(); var h = 2166136261 >>> 0;
    function mix(v){ F64[0] = +v || 0; h = Math.imul(h ^ U[0], 16777619) >>> 0; h = Math.imul(h ^ U[1], 16777619) >>> 0; }
    function mixS(s){ s = String(s == null ? '' : s); for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; }
    mix(tick); mixS(roundState); var per = [];
    bots.forEach(function(b){ mix(b.x); mix(b.y); mix(b.facing); mix(b.hp); mix(b.alive ? 1 : 0); mixS(b.weapon && b.weapon.key); mix(b.money);
      per.push([b.x, b.y, b.facing, b.hp, b.alive ? 1 : 0, b.weapon && b.weapon.key, b.money]); });
    out.push([tick, h, per]); }
  return out; } };`;
const SIM_B = A.b ? path.resolve(A.b) : SIM;   // --b=сборка.html — открыть снимок в другой сборке (совместимость формата, Р3.1.4)
async function page(br, file) { const p = await br.newPage(); await p.route(/^https?:/, r => r.abort());
  await p.goto(require('url').pathToFileURL(file || SIM).href); await p.waitForTimeout(1200); await DVS.stopFrames(p); await p.evaluate(c => __ev(c), FP + PAGE + '1'); return p; }
(async () => {
  const br = await pw.chromium.launch();
  const pa = await page(br);
  const text = await pa.evaluate(([m, T, C]) => __ev(`freshMatch(${m}); for(var i = 0; i < ${T}; i++) stepTick();
    var __x = {}; ${JSON.stringify(C)}.forEach(function(n){ __x[n] = eval(n); }); mkPack({s: mkSnapshot(), x: __x})`), [MATCH, AT, CARRY]);
  // --diff: хэши всех переменных и полей ботов в A в момент снимка — для сравнения с B сразу после восстановления
  const da = A.diff ? await pa.evaluate(n => __ev('SR.cp(' + JSON.stringify(n) + ')'), NAMES) : null;
  const ra = await pa.evaluate(K => __ev('SC.run(' + K + ')'), TICKS);
  // --inplace: B играет до T сама и восстанавливает снимок в СЕБЕ (переменные вне снимка — её собственные, живые): отличие от A —
  // только от разрыва ссылок снимка на объекты вне снимка; отличие обычного B (новая страница) от --inplace — от состояния вне снимка
  const pb = await page(br, SIM_B);
  if (A.inplace) await pb.evaluate(([m, T]) => __ev(`freshMatch(${m}); for(var i = 0; i < ${T}; i++) stepTick(); 1`), [MATCH, AT]);
  await pb.evaluate(t => { window.__SNAPTXT = t; }, text);
  await pb.evaluate(() => 0); await pb.evaluate(code => __ev(code), `var __c = mkUnpack(window.__SNAPTXT); ${A.open ? 'mkRestore(__c.s);' : 'mkSnapList().forEach(function(e){ if(e[0] in __c.s) e[2](__c.s[e[0]]); });'}
    Object.keys(__c.x).forEach(function(n){ if(/^[A-Za-z_$][\\w$]*$/.test(n)) eval(n + ' = __c.x[n]'); }); ${A.after ? A.after.replace(/`/g, '') + ';' : ''} mkRebaseShow(); clockPause(true); MK.cps = []; MK.cpMatch = matchNum; MK.lastCpTick = -1; 1`);
  const db = A.diff ? await pb.evaluate(n => __ev('SR.cp(' + JSON.stringify(n) + ')'), NAMES) : null;
  const rb = await pb.evaluate(K => __ev('SC.run(' + K + ')'), TICKS);
  await br.close();
  let first = null;
  for (let i = 0; i < Math.min(ra.length, rb.length); i++) if (ra[i][1] !== rb[i][1]) {
    const d = []; ra[i][2].forEach((p, bi) => p.forEach((v, j) => { if (v !== rb[i][2][bi][j]) d.push('бот ' + bi + ' ' + ['x', 'y', 'взгляд', 'hp', 'жив', 'оружие', 'деньги'][j] + ': ' + v + ' → ' + rb[i][2][bi][j]); }));
    first = { tick: ra[i][0], diff: d.slice(0, 8) }; break; }
  const res = { sim: path.basename(SIM), sim_b: path.basename(SIM_B), match: MATCH, snap_at: AT, ticks: TICKS, carry: CARRY, inplace: !!A.inplace, after: A.after || null, snap_bytes: text.length,
    same: !first && ra.length === rb.length, compared: Math.min(ra.length, rb.length), first_diff: first };
  if (da) {
    res.diff_globals = NAMES.filter(n => da.g[n] !== db.g[n]);
    res.diff_bot_fields = Object.keys(Object.assign({}, da.b, db.b)).filter(k => JSON.stringify(da.b[k]) !== JSON.stringify(db.b[k])); }
  console.log(JSON.stringify(res));
  if (A.out) fs.writeFileSync(A.out, JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
