// (v318) Несколько раундов на карте и снимок всей карты на 35-й секунде каждого раунда — проверка нового набора карты глазами.
// node tools/map_shot.js <sim.html> <префикс снимков> [раундов=3]   (sim.html — python3 src/build.py --map <карта> <sim.html>)
// Печатает итоги раундов (кто выиграл, как, тактика T, расстановка CT, кто жив) и ошибки страницы. Это не замер.
const { chromium } = require('playwright');
(async()=>{ const br=await chromium.launch(); const pg=await br.newPage({viewport:{width:1600,height:1000}}); const errs=[];
pg.on('pageerror', e=>errs.push('ERR '+e.message+' '+(e.stack||'').split('\n').slice(1,3).join(' | ')));
await pg.route(/^https?:/, r=>r.abort());
await pg.goto('file://'+require('path').resolve(process.argv[2])); await pg.waitForTimeout(2000);
const pre=process.argv[3], N=+process.argv[4]||3;
await pg.evaluate(()=>__ev("freshMatch(3); window.__R=[]; var _oe=endRound; endRound=function(w,r){ __R.push({round:roundNum, w:w, r:r, site:bomb&&bomb.site, state:bomb&&bomb.state, sec:Math.round((tick-roundStartTick)/64), tac:teamTac.T&&teamTac.T.tac&&teamTac.T.tac.id, ct:teamTac.CT&&teamTac.CT.setup&&teamTac.CT.setup.id, alive:bots.filter(function(b){return b.alive}).map(function(b){return b.team}).join('')}); return _oe.apply(this, arguments); }; 1"));
let shots=0;
for(let r=0;r<N;r++){
  // до середины раунда (35 с) — снимок, потом до конца раунда
  const st = await pg.evaluate(()=>__ev("var n0=__R.length, rn=roundNum; for(var i=0;i<200000 && (roundState!=='live' || (tick-roundStartTick)<35*64); i++){ stepTick(); if(__R.length>n0) break; } JSON.stringify({rs:roundState, sec:Math.round((tick-roundStartTick)/64), rn:roundNum})"));
  await pg.evaluate(()=>__ev("paused=true; OBS.on=false; var r=document.getElementById('cv').getBoundingClientRect(); view.scale=Math.min(r.width/2048, r.height/2048)*1.25; view.panX=r.width/2-1110*view.scale; view.panY=r.height/2-1010*view.scale; try{ draw(); }catch(e){} 1"));
  await pg.waitForTimeout(300);
  const cv = await pg.$('#cv'); await cv.screenshot({path: pre+'_r'+(r+1)+'.png'}); shots++;
  await pg.evaluate(()=>__ev("var n0=__R.length; for(var i=0;i<400000 && __R.length===n0; i++) stepTick(); 1"));
}
console.log(JSON.stringify(await pg.evaluate(()=>__ev("JSON.stringify(__R)"))));
console.log(errs.slice(0,10).join('\n'));
await br.close(); })();
