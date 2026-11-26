// Deterministic boundary probes. VM stubs are fixtures, not stepped matches.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const prob = read('engine/debug/problem-watch.js');
const watch = read('tools/measure/audit/watch.js');
const inv = read('tools/measure/invariants.js');
const cases = [];

function fixture(watchOn = false, invOn = false) {
  const actor = id => ({
    id, team: id[0] === 'T' ? 'T' : 'CT', alive: true, hp: 100, x: 0, y: 0, z: 0, baseX: 0, baseY: 0,
    state: 'patrol', curSpeed: 0, pathIdx: 0, path: [], nades: {}, _dlog: [],
  });
  const a = actor('CT0'), b = actor('T0');
  const c = vm.createContext({
    tick: 0, roundNum: 1, matchNum: 1, roundState: 'live', TICK_HZ: 64, SPEED: 150, DM: Math, bots: [a, b],
    bomb: {state: 'carried'}, bombTimeLeftTicks: () => 0, bombDamageAt: () => 0,
    teamEco: {CT: {roundType: 'full'}, T: {roundType: 'eco'}}, MAP: {pxUnits: 2.5}, TASK_STALE: 96,
    crossed: false, offFloor: false, smoke: false, line: true, fire: false, throwResult: true,
    NADE_FAIL: '', hasLOS: (...args) => c.line, aliveCount: side => c.bots.filter(x => x.alive && x.team === side).length,
    crossesWall: () => c.crossed, heightBlocked: () => false, offNavStep: () => c.offFloor,
    inFire: (_x, _y, z) => c.fire && z === 0, navOnFloor: () => !c.offFloor,
    smokeBlocks: (...args) => { c.smokeArgs = args.length; return c.smoke; },
    throwNade: () => c.throwResult, voiceLog: () => {}, logEvent: () => {}, feedKill: () => {}, detonate: () => {},
    tradeStart: () => {}, knowAvoidPeek: () => {}, throwNadeTry: () => false, resetRound: () => {},
    setPost: () => false, taskLevel: () => 1, pickSpots: () => [], nadeRunPlan: () => {},
    // (перенос в Р3, 25.11) след решений вне бота (Р3.3, 645: dlogOf) — в пробе след лежит в b._dlog, как в базе пробы
    dlogOf: (bt, key) => (bt && bt[key || '_dlog']) || [],
  });
  c.window = c;
  vm.runInContext(prob, c);
  if (watchOn) vm.runInContext(watch, c);
  if (invOn) vm.runInContext(inv, c);
  function advance(dt, update = () => {}) {
    for (let i = 0; i < dt; i++) {
      c.tick++;
      update(c.tick);
      c.probTick();
      if (watchOn) c.WATCH.tick();
      if (invOn) c.INV.tick(0);
    }
  }
  return {a, b, c, advance, watch: () => c.WATCH.report(), inv: () => c.INV.R};
}
function run(id, test) {
  const result = test();
  cases.push({id, ...result});
}
function motion(tag = 'anchor') {
  const f = fixture();
  Object.assign(f.a, {post: {tag, x: 100, y: 0}, curSpeed: 2, path: [[100, 0]]});
  return f;
}

run('P01_wall_block', () => {
  const f = motion();
  f.c.crossed = true; f.advance(6 * 64);
  assert.equal(f.c.PROB.n.stall, 1);
  assert.match(f.c.PROB.ev[0].text, /стена/);
  return {observed: 1, detail: 'blocked step and repeated positive curSpeed'};
});
run('P02_loop_same_endpoint', () => {
  const f = motion();
  f.advance(6 * 64, t => { f.a.baseX = f.a.x = (t % (5 * 64)) / 8; });
  assert.equal(f.c.PROB.n.stall, 1);
  assert.match(f.c.PROB.ev.find(e => e.kind === 'stall').text, /шаг проходит/);
  return {observed: 1, detail: 'moved on a route, then returned within endpoint radius; open step passes'};
});
run('P03_wall_zero_speed', () => {
  const f = motion();
  f.a.curSpeed = 0; f.c.crossed = true; f.advance(6 * 64);
  assert.equal(f.c.PROB.n.stall, 0);
  return {observed: 0, detail: 'unreached active post and blocked physical step, but zero stored speed'};
});
run('P04_intentional_hold', () => {
  const f = motion();
  f.a.atPost = true; f.a.holding = true; f.a.curSpeed = 0; f.advance(6 * 64);
  assert.equal(f.c.PROB.n.stall, 0);
  return {observed: 0};
});
run('P05_refusal_overlaps_stall', () => {
  const f = motion();
  f.advance(10 * 64, t => {
    if (t % 64 === 0) f.a._dlog.push([t, 'место', 'отказ «route:site»: занят «contact:hold»', { ask: 'route:site', busy: 'contact:hold' }]);
  });
  const labels = f.c.PROB.ev.filter(e => e.kind === 'stall').map(e => e.text);
  assert.equal(labels.length, 2);
  assert(labels.some(x => x.startsWith('залип')) && labels.some(x => x.startsWith('застрял')));
  return {observed: 2, detail: 'one continuous stationary actor produced two stall events on distinct branches'};
});
run('P06_valid_refusal_still_counted', () => {
  const f = fixture();
  f.a.atPost = true; f.a.holding = true;
  f.advance(10 * 64, t => {
    if (t % 64 === 0) f.a._dlog.push([t, 'место', 'отказ «route:site»: занят «contact:hold»', { ask: 'route:site', busy: 'contact:hold' }]);
  });
  assert.equal(f.c.PROB.n.stall, 1);
  return {observed: 1, detail: 'active hold and refusals counted even with hold deliberately marked as valid in fixture'};
});
run('P07_nav_and_vertical', () => {
  const f = fixture();
  f.advance(2); f.advance(1, () => { f.a.x += 8; }); f.advance(1, () => { f.a.z += 100; });
  f.advance(1, () => { f.a._climb = {}; f.a.x += 100; });
  assert.equal(f.c.PROB.n.nav, 1);
  return {observed: 1, detail: 'horizontal delta counted, vertical-only and ladder horizontal delta ignored'};
});
run('P08_tug_cause_missing', () => {
  const f = fixture();
  f.advance(64, t => {
    const tag = t < 32 ? 'hold:A' : t < 48 ? 'contact:checking' : 'hold:A';
    f.a.post = {tag};
  });
  assert.equal(f.c.PROB.n.tug, 1);
  return {observed: 1, detail: 'legal temporary contact then return also matches A-B-A'};
});
run('P09_tug_suffix_and_between_samples', () => {
  const f = fixture();
  f.advance(64, t => { f.a.post = {tag: t === 33 ? 'contact' : t < 48 ? 'hold:A' : 'hold:B'}; });
  assert.equal(f.c.PROB.n.tug, 0);
  return {observed: 0, detail: 'one-tick reassignment and a same-prefix change are invisible'};
});
run('W01_wait_tag_drift', () => {
  const f = fixture(true);
  f.a.atPost = true; f.a.post = {tag: 'stage:x'};
  f.advance(8 * 64, t => { if (t === 4 * 64) f.a.post = {tag: 'bombWait:y'}; });
  assert.equal(f.watch().n.wait, 1);
  assert.equal(f.watch().n.waitCould, 1);
  return {observed: 1, detail: 'two valid waits concatenate; own bot makes near>=enemy'};
});
run('W02_bomb_exit_in_time', () => {
  const f = fixture(true);
  f.c.bomb.state = 'planted';
  f.c.bombTimeLeftTicks = () => 2 * 64 - f.c.tick;
  f.c.bombDamageAt = x => x === 0 ? 100 : 0;
  f.advance(2 * 64, t => { if (t === 64) f.a.x = f.b.x = 100; });
  assert.equal(f.watch().dangerBy['взрыв'], 2);
  return {observed: 2, detail: 'both exit fatal region before detonation; one warning per actor'};
});
run('W03_flash_covered_or_no_flash_effect', () => {
  const f = fixture(true);
  f.a.facing = Math.PI;
  f.advance(1);
  f.c.detonate({type: 'flash', thrower: f.b, team: 'T', x: 10, y: 0, z: 100, ox: 20, oy: 0});
  f.advance(96);
  assert.equal(f.watch().dangerBy['флешка без реакции'], 1);
  return {observed: 1, detail: '2D LOS stub true, no engine flash effect, no turning to unknown origin'};
});
run('W04_fire_running_out', () => {
  const f = fixture(true);
  f.c.fire = true; f.a._burning = true; f.b.z = 100;
  f.advance(80, t => { f.a.x = t; });
  assert.equal(f.watch().dangerBy['стоит в огне'], 1);
  return {observed: 1, detail: 'moves at every sample; higher-floor actor is excluded'};
});
run('W05_smoke_teammate_and_2D', () => {
  const f = fixture(true);
  f.b.team = f.a.team; f.c.smoke = true; f.c.feedKill(f.a, f.b);
  assert.equal(f.watch().n.smokeKill, 1);
  assert.equal(f.watch().n.kills, 1);
  assert.equal(f.c.smokeArgs, 4);
  return {observed: 1, detail: 'team kill with four-argument smoke test'};
});
run('W06_nade_attribution_wrong_type', () => {
  const f = fixture(true);
  f.a.nadeTask = {type: 'smoke', from: {x: 0, y: 0}, until: 300};
  f.advance(1); f.c.throwNade(f.a, 'flash'); f.a.nadeTask = null; f.advance(1);
  assert.equal(f.watch().nade.thrown['CT|full|smoke'], 1);
  return {observed: 1, detail: 'a flash throw is credited to a disappearing smoke task'};
});
run('W07_nade_round_reset', () => {
  const f = fixture(true);
  f.a.nadeTask = {type: 'smoke', from: {x: 0, y: 0}, until: 300};
  f.advance(1); f.c.roundState = 'ending'; f.a.nadeTask = null; f.advance(1);
  assert.equal(f.watch().nade.intent['CT|full|smoke'], 1);
  assert.equal(Object.keys(f.watch().nade.thrown).length + Object.keys(f.watch().nade.lost).length, 0);
  return {observed: 0, detail: 'unclosed task disappears when state changes'};
});
run('W08_flip_valid_repeat', () => {
  const f = fixture(true);
  for (let call = 0; call < 4; call++) {
    f.advance(16); f.c.voiceLog('CT', 'repeat', 'CT0', 'B чисто');
  }
  assert.equal(f.watch().n.flip, 1);
  return {observed: 1, detail: 'three identical messages flag, fourth within window does not'};
});
run('O01_watch_mutates_bot_shape', () => {
  const f = fixture(true);
  f.advance(1);
  const d = Object.getOwnPropertyDescriptor(f.a, 'nadeTask');
  assert.equal(typeof d.get, 'function');
  assert.equal(f.a.__wt, 1);
  const snap = structuredClone(f.a);
  assert.equal(snap.__wt, 1);
  assert.equal(Object.getOwnPropertyDescriptor(snap, 'nadeTask').get, undefined);
  f.c.bots[0] = snap; f.advance(1);
  assert.equal(Object.getOwnPropertyDescriptor(snap, 'nadeTask').get, undefined);
  return {observed: 1, detail: 'own field + accessor; after clone hook is skipped because marker survives'};
});
run('I01_bad_index_tally', () => {
  const f = fixture(false, true);
  f.a.pathIdx = 1; f.advance(3); f.a.pathIdx = 0; f.advance(1);
  assert.equal(f.inv()['I-01'].n, 3);
  return {observed: 3, detail: 'three offending ticks for one persistent bad index'};
});
run('I04_orphan_from_start', () => {
  const f = fixture(false, true);
  f.a.post = {tag: 'lineup'}; f.advance(128);
  assert.equal(f.inv()['I-04'].n, 0);
  f.a.nadeTask = {}; f.advance(1); f.a.nadeTask = null; f.advance(17);
  assert.equal(f.inv()['I-04'].n, 1);
  return {observed: [0, 1], detail: 'orphan counted only when a valid lineup-task pair was observed first'};
});
run('I09_buffer_saturation', () => {
  const f = fixture(false, true);
  f.advance(2);
  f.advance(405, () => { f.a.x += 8; });
  assert.equal(f.c.PROB.n.nav, 405);
  assert.equal(f.inv()['I-09'].n, 400);
  return {observed: [405, 400], detail: 'PROB cumulative counter grows, reader cursor sticks at capped array length'};
});
run('I16_legitimate_sound', () => {
  const f = fixture(false, true);
  f.b.x = 12;
  f.advance(1, tick => { f.a.heardSound = {x: 12, y: 0, tick, kind: 'step', src: 'T0'}; });
  assert.equal(f.inv()['I-16'].n, 1);
  return {observed: 1, detail: 'same-tick legitimate source flagged if no ally sees enemy'};
});
run('I25_two_reasons_one_write', () => {
  const f = fixture(false, true);
  f.advance(1, tick => { f.a.heardSound = {tick, kind: 'call', src: 'T0', x: 0, y: 0}; });
  f.a._visible = [f.b];
  f.advance(1, tick => { f.a.heardSound = {tick, kind: 'step', src: 'T0', x: 0, y: 0}; });
  assert.equal(f.inv()['I-25'].n, 2);
  return {observed: 2, detail: 'same write triggers both call-overwrite and seen+sound'};
});
run('I07_requests_not_ticks', () => {
  const f = fixture(false, true);
  for (let i = 0; i < 5; i++) f.c.setPost(f.a, null, null, null, 'hold:A');
  assert.equal(f.inv()['I-07'].hist.hold, 5);
  assert.equal(f.inv()['I-07'].n, 0);
  return {observed: {consecutive: 5, ticks: 1, n: 0}};
});
run('F01_attempt_logged_as_throw', () => {
  const sink = {}, bomb = {state: 'carried'};
  const c = vm.createContext({roundNum: 1, tick: 0, roundState: 'live', bots: [], bomb,
    freshMatch(n) { c.matchNum = n; }, simEvOn(name, listener) { sink[name] = listener; },
    stepTick() {
      c.tick++;
      if (c.tick === 1) {
        const args = [{id: 'CT0'}, 'smoke'];
        sink.throwNade('in', args);
        sink.throwNade('out', args, false);
      } else c.matchNum++;
    },
  });
  const fp = JSON.parse(vm.runInContext(read('tools/measure/fingerprint.js').replaceAll('__M__', '3'), c));
  assert.equal(fp.nades.length, 1);
  return {observed: fp.nades.length, detail: 'failed throwNade still appears in FP.nades'};
});
process.stdout.write(JSON.stringify({base: '32fb35ea852b028667fd14f656da786a7ebf3f8f', type: 'VM fixtures calling unchanged detectors', cases}, null, 2) + '\n');
