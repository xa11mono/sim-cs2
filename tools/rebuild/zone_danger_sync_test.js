// (Р3.4) таблица «откуда простреливается» после правки карты: visInvalidate → «устарела», первый шаг игры пересчитывает и чистит HOLD_CANDS. Запуск: node … sim.html
const path=require('path'), pw=require('playwright'), DVS=require(require('path').join(__dirname, '..', 'measure', 'dv_state.js'));
(async()=>{ const br=await pw.chromium.launch(); const p=await br.newPage(); await p.route(/^https?:/,r=>r.abort());
 await p.goto('file://'+path.resolve(process.argv[2])); await p.waitForTimeout(1200); await DVS.stopFrames(p);
 console.log(await p.evaluate(()=>__ev(`freshMatch(3); for(var i=0;i<500;i++) stepTick();
   var h=function(){ return JSON.stringify(ZONE_DANGER).length + ':' + JSON.stringify(ZONE_DANGER_W||null).length; };
   var before=h(); var gen0=VIS_GEN; visInvalidate(); var dirty=VIS_DANGER_DIRTY; HOLD_CANDS.x=1; stepTick();
   JSON.stringify({dirty_after_invalidate: dirty, dirty_after_step: VIS_DANGER_DIRTY, hold_cleared: !('x' in HOLD_CANDS), table_same_as_before: h()===before, gen_up: VIS_GEN===gen0+1})`))); await br.close(); })();
