// (Р3.3, 25.11) «почему бот так сделал»: цепочка решений бота в момент отметки — по следу решений (DLOG, 645: вне состояния игры)
// и текущему состоянию каналов у хозяев (место — задача и уровень арбитра; гранаты — заказ; бой — режим; взгляд — причина; ход —
// шагом / бегом / стоп с причиной). Игру не меняет: открывает снимок отметки, проигрывает до тика, только читает.
// Запуск: node tools/sim.js why <отметка> <бот> [тик] [--sim=сборка.html] [--map=карта] [--json=файл]
//   отметка — id из rebuild/scenarios.json (снимок pre, тик и карта — оттуда) или путь к снимку (.json / .json.gz, тогда нужен --map);
//   тик — по умолчанию тик отметки; меньше тика снимка — нельзя (след пишется от снимка: снимок до отметки — за 15 с, как окно следа)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..', '..');
const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const A = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const t = a.slice(2), i = t.indexOf('='); return i < 0 ? [t, '1'] : [t.slice(0, i), t.slice(i + 1)]; }));
if (pos.length < 2) { console.error('node tools/sim.js why <отметка> <бот> [тик] [--sim=…] [--map=…] [--json=…]'); process.exit(2); }
const [MARK, BOT] = pos; let T = pos[2] != null ? +pos[2] : null, MAPN = A.map || null, SNAP;
const SC = JSON.parse(fs.readFileSync(path.join(ROOT, 'rebuild', 'scenarios.json'), 'utf8')).find(s => s.id === MARK);
if (SC) { SNAP = path.resolve(ROOT, SC.pre || SC.snap); MAPN = MAPN || SC.map; if (T == null) T = SC.tick; }
else { SNAP = path.resolve(MARK); if (!fs.existsSync(SNAP)) { console.error('нет отметки «' + MARK + '» в rebuild/scenarios.json и нет файла'); process.exit(2); } }
if (!MAPN) { console.error('карта не известна: --map=ancient|mirage'); process.exit(2); }
let SIM = A.sim ? path.resolve(A.sim) : null;
if (!SIM) { SIM = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'why_')), MAPN + '.html'); cp.execFileSync('python3', [path.join(ROOT, 'src', 'build.py'), '--map', MAPN, SIM], { stdio: 'ignore' }); }

// в странице: состояние каналов у хозяев и след решений по всем ключам, по времени
const COLLECT = `(function(id){
  var b = bots.find(function(x){ return x.id === id; }); if(!b) return {err: 'нет бота ' + id + ' (есть: ' + bots.map(function(x){ return x.id; }).join(', ') + ')'};
  function pt(p){ return p ? calloutName(p.x, p.y) : null; }
  var T0 = b._task, nt = b.nadeTask, ch = {
    'место': b.post ? {задача: b.post.tag, где: pt(b.post), дошёл: !!b.atPost, уровень: T0 ? T0.lv : null, с_тика: T0 ? T0.t0 : null,
      отклонение: b._detour ? (b._detour.tb || true) : null} : {задача: null},
    'гранаты': nt ? {заказ: nt.type, куда: pt(nt), зачем: nt.why || null, с_тика: nt.start, до_тика: nt.until} : {заказ: null},
    'бой': {режим: b.state, перестрелка: !!b._fc, видит_врага: !!b._sawEnemy},
    'взгляд': {причина: b.lookReason || null},
    'ход': {шагом: b.walking ? (b._walkWhy || '?') : null, отмена_шага: b._runWhy || null, стоп: b._stopWhy || null},
    'знание': {звук: b.heardSound ? b.heardSound.kind + ' ' + Math.round((tick - b.heardSound.tick)/TICK_HZ*10)/10 + ' с назад' : null,   // (Р3.2 знание ш.3) knowHear / knowSound
      место_врага: b.lastIntel ? pt(b.lastIntel) + ' ' + Math.round((tick - b.lastIntel.tick)/TICK_HZ*10)/10 + ' с назад' : null}
  };
  var B = DLOG.by[b.id] || {}, L = [];
  Object.keys(B).forEach(function(k){ if(Array.isArray(B[k])) B[k].forEach(function(e){ if(e[0] <= tick) L.push([e[0], e[1], e[2]]); }); });
  L.sort(function(a, c){ return a[0] - c[0]; });
  return {tick: tick, round: roundNum, bot: b.id, team: b.team, alive: b.alive, hp: b.hp, где: pt({x: b.x, y: b.y}), channels: ch, trace: L, trace_on: DLOG.on};
})`;

(async () => {
  const { chromium } = require('playwright');
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto(require('url').pathToFileURL(SIM).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, { timeout: 60000 });
  const raw = fs.readFileSync(SNAP);
  await pg.evaluate(t => window.__ev('mkOpenSnap')(t), (SNAP.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8'));
  const t0 = await pg.evaluate(() => window.__ev('paused = true; tick'));
  if (T == null) T = t0;
  if (T < t0) { console.error('тик ' + T + ' раньше снимка (' + t0 + '): след пишется от снимка'); await br.close(); process.exit(2); }
  await pg.evaluate(t => window.__ev('var __n = 0; while(tick < ' + (t | 0) + ' && __n++ < 400000) stepTick(); tick'), T);
  const r = await pg.evaluate(([c, id]) => window.__ev(c)(id), [COLLECT, BOT]);
  await br.close();
  if (r.err) { console.error(r.err); process.exit(1); }
  r.mark = MARK; r.snap_tick = t0; r.sim = path.basename(SIM);
  if (A.json) fs.writeFileSync(A.json, JSON.stringify(r, null, 1));
  const sec = t => ((t - r.tick) / 64).toFixed(1).replace(/^(?!-)/, '+');
  console.log(`${r.bot} (${r.team}), тик ${r.tick}, раунд ${r.round}: ${r.alive ? 'жив, HP ' + r.hp : 'мёртв'}, ${r.где || ''}`);
  console.log('— каналы сейчас (хозяин решения → что выбрано, почему):');
  for (const [k, v] of Object.entries(r.channels)) console.log('  ' + k + ': ' + (Object.entries(v).filter(([, x]) => x !== null && x !== false).map(([a, x]) => a + ' ' + (x === true ? 'да' : x)).join(', ') || '—'));
  console.log(`— след решений за ${((r.tick - (r.trace[0] ? r.trace[0][0] : r.tick)) / 64).toFixed(1)} с (снимок — тик ${t0}${r.trace_on ? '' : '; след выключен'}):`);
  for (const [t, kind, text] of r.trace) console.log(`  ${sec(t)} с  [${kind}] ${text}`);
  if (!r.trace.length) console.log('  (пусто)');
})().catch(e => { console.error(e); process.exit(1); });
