const { chromium } = require('playwright');
const file = process.argv[2], ticks = +process.argv[3]||20000, setup = process.argv[4]||'';
(async()=>{
  const br = await chromium.launch(); const pg = await br.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e).slice(0,300)));
  await pg.route(/^https?:/, r=>r.abort());
  await pg.goto('file://'+require('path').resolve(file)); await pg.waitForTimeout(1500);
  const res = await pg.evaluate(({ticks,setup})=>__ev("("+(function(ticks,setup){
    paused = true; eval(setup);
    var M = {contacts:0, prepared:0, holdC:0, holdP:0, flips:0, lookTicks:0, dup:0, dupN:0, rounds:0, ctWins:0, errs:[]};
    var T0=Date.now(); if(!BZ.ids.length) beliefBuild(); var DEAD={}; BZ.ids.forEach(function(id,i){ if(BZ.nbr[i].length<=1 && id!=='zone58') DEAD[i]=1; }); var prevVis = {}, prevZ = {}, prevT={};
    var rs0 = typeof roundNum!=='undefined'?roundNum:0;
    for(var t=0;t<ticks;t++){
      try{ stepTick(); }catch(e){ M.errs.push(String(e)); if(M.errs.length>5) break; }
      if(roundState!==M._rs){ if(roundState==='ending'){ M.rounds2=(M.rounds2||0)+1; var sc=JSON.parse(JSON.stringify(score)); if(M._sc){ if(sc.CT>M._sc.CT) M.ctW=(M.ctW||0)+1; } M._sc=sc; } if(roundState==='freeze') M._sc=JSON.parse(JSON.stringify(score)); M._rs=roundState; }
      if(roundState!=='live') { prevVis={}; continue; }
      bots.forEach(function(b){
        if(!b.alive) return;
        var vis = {}; bots.forEach(function(e){ if(!e.alive||e.team===b.team) return; if(Math.hypot(e.x-b.x,e.y-b.y)>1400) return; if(!hasVision(b.x,b.y,e.x,e.y)) return; vis[e.id]=1;
          if(!(prevVis[b.id]||{})[e.id] && (tick - (prevT[b.id+e.id]||-1e9)) > 3*64){
            M.contacts++; var a=Math.atan2(e.y-b.y,e.x-b.x), off=Math.abs(((a-b.facing+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
            var prep = off<0.35; if(prep) M.prepared++;
            if(b.curSpeed < 40*SPD_K){ M.holdC++; if(prep) M.holdP++; }
          }
          prevT[b.id+e.id]=tick; });
        prevVis[b.id]=vis;
        if(t%16===0 && b.lookTarget && !b._sawEnemy){
          M.lookTicks++; var lz=bzOf(b.lookTarget.x,b.lookTarget.y); if(DEAD[lz] && !bots.some(function(e){return e.alive&&e.team!==b.team&&bzOf(e.x,e.y)===lz;})) M.dead=(M.dead||0)+1;
          var la=Math.atan2(b.lookTarget.y-b.y,b.lookTarget.x-b.x);
          if(prevZ[b.id]!=null){ var d=Math.abs(((la-prevZ[b.id]+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); if(d>1.5) M.flips++; }
          prevZ[b.id]=la;
          bots.forEach(function(o){ if(o===b||!o.alive||o.team!==b.team||!o.lookTarget||o._sawEnemy) return; if(Math.hypot(o.x-b.x,o.y-b.y)>350) return;
            M.dupN++; var oa=Math.atan2(o.lookTarget.y-o.y,o.lookTarget.x-o.x); if(Math.abs(((oa-la+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)<0.3) M.dup++; });
        } else if(b._sawEnemy) prevZ[b.id]=null;
      });
    }
    M.rounds = roundNum - rs0; M.ms=Date.now()-T0; M.score = (typeof score!=='undefined')? JSON.stringify(score):'';
    return M;
  }).toString()+")("+ticks+","+JSON.stringify(setup)+")"),{ticks,setup});
  res.pageErrors = errs;
  res.prepRate = (res.prepared/res.contacts).toFixed(3); res.holdPrep=(res.holdP/res.holdC).toFixed(3);
  res.flipPerMin = (res.flips/(res.lookTicks/4)*60).toFixed(2); res.dupRate=(res.dup/res.dupN).toFixed(3); res.deadPct=((res.dead||0)/res.lookTicks*100).toFixed(2);
  console.log(JSON.stringify(res));
  await br.close();
})();
