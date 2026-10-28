// (док 5) один проход матча с записью: убийства (видно ли по 3D / по стенам радара), ослепления и куда смотрит после, расстановка CT
// по сторонам на 20-й с каждого раунда. Игру не меняет (обёртки только читают).
//   node tools/measure/match_scan.js sim.html <матч> <out.json>
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, mt, outp] = process.argv;
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r=>r.abort());
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const res = await pg.evaluate(mt => window.__ev('(' + function(mt){
    paused = true; freshMatch(mt);
    var R = {kills: [], blind: [], setups: []}, watch = [];
    var fk = feedKill;
    feedKill = function(att, vic, wkey){ try{ if(att && vic && att !== vic && /^(AK|M4|M4S|AWP|SSG|GALIL|FAMAS|AUG|SG|MAC10|MP9|MP7|UMP|P90|GLOCK|USP|P2000|P250|FIVE7|TEC9|CZ|DEAGLE|DUALS|R8)/.test(String(wkey))){
        var cl = rayClipWalls(att.x, att.y, vic.x, vic.y), full = Math.hypot(vic.x-att.x, vic.y-att.y), cd = Math.hypot(cl.x-att.x, cl.y-att.y);
        R.kills.push({tick: tick, round: roundNum, att: att.id, vic: vic.id, w: wkey, d: Math.round(full), wall2d: cd < full - 12, los3d: hasLOS(att.x, att.y, vic.x, vic.y, att.z, vic.z),
          from: calloutName(att.x, att.y), to: calloutName(vic.x, vic.y)}); } }catch(e){}
      return fk.apply(this, arguments); };
    R.throws = [];
    var tn = throwNade;
    throwNade = function(b, type, x, y){ var r = tn.apply(this, arguments);
      try{ if(r){ var foe = b.team === "CT" ? "T" : "CT";
        R.throws.push({tick: tick, round: roundNum, id: b.id, team: b.team, type: type, why: String(arguments[5]||""), foes: aliveCount(foe), bomb: bomb.state,
          defusing: bots.some(function(o){ return o.alive && o.defusing; }), to: calloutName(x, y), zone: npZoneAt(x, y)}); } }catch(e){}
      return r; };
    var ob = onBlind;
    onBlind = function(b, threat){ var r = ob.apply(this, arguments);
      try{ watch.push({b: b, th: {x: threat.x, y: threat.y}, t0: tick, end: b.blindUntil, back: !!(b._blind && b._blind.back), samp: []}); }catch(e){}
      return r; };
    var lastSetupRound = -1, n = 0;
    while(roundState !== "matchover" && n < 400000){ stepTick(); n++;
      if(roundState === "live" && roundNum !== lastSetupRound && (tick - roundStartTick) === 20*TICK_HZ){ lastSetupRound = roundNum;
        var S = teamTac.CT && teamTac.CT.setup, c = {A: 0, mid: 0, B: 0}, who = [];
        bots.forEach(function(b){ if(b.team !== "CT" || !b.alive) return; var z = npZoneAt(b.x, b.y); c[z] = (c[z]||0) + 1; who.push(b.id + ":" + b.tRole + "@" + calloutName(b.x, b.y).replace(/^на /, "") + "[" + (b.post ? b.post.tag : "") + "]"); });
        R.setups.push({round: roundNum, setup: S ? (S.name || S.id) : null, rt: teamEco.CT && teamEco.CT.type, alive: aliveCount("CT"), A: c.A, mid: c.mid, B: c.B, who: who}); }
      for(var i = watch.length - 1; i >= 0; i--){ var W = watch[i], b = W.b;
        if(!b.alive || tick > W.end + 8*TICK_HZ){ if(W.samp.length) R.blind.push({id: b.id, round: roundNum, tick: W.t0, blindSec: +((W.end - W.t0)/TICK_HZ).toFixed(1), back: W.back,
            after: W.samp}); watch.splice(i, 1); continue; }
        if(tick >= W.end && (tick - W.end) % 16 === 0){ var a = Math.atan2(W.th.y - b.y, W.th.x - b.x), f = b.facing !== undefined ? b.facing : b.heading;
          var off = Math.abs(((f - a + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
          W.samp.push([+((tick - W.end)/TICK_HZ).toFixed(2), Math.round(off*180/Math.PI), Math.round(b.curSpeed||0), b.lookReason || "", b.post ? b.post.tag : ""]); } }
    }
    return R;
  } + ')')(mt), +mt);
  fs.writeFileSync(outp, JSON.stringify(res));
  console.log('бросков', res.throws.length, 'убийств', res.kills.length, 'ослеплений', res.blind.length, 'раундов', res.setups.length);
  await br.close();
})();
