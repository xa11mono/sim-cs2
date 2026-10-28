// (док 5, п.10) все броски гранат матча с обстановкой: живых врагов, бомба, дефуз, задача бросающего.
//   node tools/measure/throw_scan.js sim.html <матч> <out.json>
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, mt, outp] = process.argv;
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r=>r.abort());
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const res = await pg.evaluate(mt => window.__ev('(' + function(mt){
    paused = true; freshMatch(mt); var L = [];
    var f0 = throwNade;
    throwNade = function(b, type, x, y){ var r = f0.apply(this, arguments);
      if(r){ var foe = b.team === "CT" ? "T" : "CT";
        L.push({tick: tick, round: roundNum, t: Math.round((tick-roundStartTick)/TICK_HZ), id: b.id, team: b.team, type: type, why: String(arguments[5]||""),
          foes: aliveCount(foe), mates: aliveCount(b.team), bomb: bomb.state, defusing: bots.some(function(o){ return o.alive && o.defusing; }),
          to: calloutName(x, y), task: b.post ? String(b.post.tag) : ""}); }
      return r; };
    var n = 0; while(roundState !== "matchover" && n < 400000){ stepTick(); n++; }
    return L;
  } + ')')(mt), +mt);
  fs.writeFileSync(outp, JSON.stringify(res));
  console.log('бросков', res.length);
  await br.close();
})();
