// На неизменяемой Node-сборке. Режим proof — отпечатки, решения, RNG и снимки.
// Режим profile — тот же матч с REC, по одному процессу на вариант.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { load } = require('../../tools/node/core_run.js');
const root = path.resolve(__dirname, '../..');
const [core, mode, matchText, ticksText, watchMode, tools = root, output] = process.argv.slice(2);
const match = Number(matchText), limit = Number(ticksText);
if (!core || !['proof', 'profile'].includes(mode) || !Number.isInteger(match) || !Number.isInteger(limit) || limit < 1 ||
    !['off', 'on', 'quiet'].includes(watchMode)) throw new Error('accept_g.cjs <core> proof|profile <match> <ticks> off|on|quiet [tools-root] [record.json.gz]');
const source = file => fs.readFileSync(path.join(tools,file), 'utf8');
const injectWatch = watchMode === 'on' ? source('tools/measure/audit/watch.js') : '';
const ev = load(core);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
if (mode === 'proof') {
  const fp = source('tools/measure/fingerprint.js');
  const setup = fp.slice(fp.indexOf('freshMatch('), fp.indexOf('var T1 =')).replaceAll('__M__',String(match));
  const result = JSON.parse(ev(`(function(){
    ${setup}
    ${watchMode === 'quiet' ? 'probTick.on = false;' : ''}
    ${injectWatch}
    ${watchMode === 'on' ? source('tools/measure/invariants.js') : ''}
    var rng = 2166136261, nrng = 0, host = 0, decision = 2166136261, states = [];
    var oldRand = hashRand, oldHost = Math.random;
    function mul(h,x){ return Math.imul(h ^ x,16777619) >>> 0; }
    hashRand = function(seed) {
      var value = oldRand(seed); nrng++;
      F64[0] = seed; rng = mul(mul(rng,U32[0]),U32[1]);
      return value;
    };
    Math.random = function(){ host++; return oldHost(); };
    function observe(){
      bots.forEach(function(b){
        var p=b.post, t=b._task, q=b.nadeTask;
        var s=[b.id,b.state,b.lookReason,b._stopWhy,t&&t.tag,t&&t.lv,p&&p.tag,p&&p.x,p&&p.y,p&&p.z,
          b._fc&&b._fc.ph,q&&q.type,q&&q.x,q&&q.y,b._sawEnemy,b.pathIdx,b.nextShotTick,b.weapon&&b.weapon.key].join('|');
        for(var i=0;i<s.length;i++) decision = mul(decision,s.charCodeAt(i));
      });
    }
    function snapshot(){
      var state=mkSnapshot();
      delete state.PROB;
      delete state.NADE_SOLVE_MS;
      var fields=Object.keys(state).sort().map(function(k){ return [k,mkPack(state[k])]; });
      return [tick,fields];
    }
    try {
      for(var i=0;i<${limit} && roundState!=='matchover';i++){
        stepTick();
        if(typeof WATCH!=='undefined') WATCH.tick();
        if(typeof INV!=='undefined') INV.tick(0);
        mix(tick); mixS(roundState);
        bots.forEach(function(b){ mix(b.x);mix(b.y);mix(b.facing);mix(b.hp);mix(b.alive?1:0);mixS(b.weapon&&b.weapon.key);mix(b.money); });
        observe();
        if(tick===1 || tick===3200) states.push(snapshot());
      }
      FP.ticks=tick; FP.hash=h;
      states.push(snapshot());
      return JSON.stringify({fp:FP,rng:[nrng,rng,host],decision,states,finished:roundState==='matchover',
        errors:simEvIn.errs||[],inv:typeof INV!=='undefined' ? Object.fromEntries(Object.entries(INV.R).map(([k,r])=>[k,r.n])) : null});
    } finally { hashRand=oldRand; Math.random=oldHost; }
  })()`));
  result.states = result.states.map(([tick, fields]) => [tick, Object.fromEntries(fields.map(([name, value]) => [name,sha(value ?? '')]))]);
  result.fingerprint=sha(JSON.stringify(result.fp));
  delete result.fp;
  console.log(JSON.stringify(result));
} else {
  const tpl = source('tools/measure/rec2.js').replaceAll('__M__', String(match)).replaceAll('__T__', String(limit))
    .replace('/*@@WATCH@@*/', watchMode === 'quiet' ? 'probTick.on = false;' : injectWatch);
  const started = performance.now(), cpu = process.cpuUsage();
  const raw = ev(tpl), duration = performance.now() - started, used = process.cpuUsage(cpu);
  const compressed = zlib.gzipSync(raw);
  const record = JSON.parse(raw);
  if (output) fs.writeFileSync(output, compressed);
  console.log(JSON.stringify({ticks:record.ticks,finished:record.finished,cpuMs:(used.user+used.system)/1000,
    wallMs:duration,peakRssKiB:process.resourceUsage().maxRSS,bytes:Buffer.byteLength(raw),gzipBytes:compressed.length,
    diagnosticBytes:Buffer.byteLength(JSON.stringify([record.prob,record.watch])),
    rounds:record.rounds.length,diagnostics:record.watch&&record.watch.n}));
}
