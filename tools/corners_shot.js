// Снимок радара с показом углов в заданный момент (для отчёта «до / после»).
// node tools/corners_shot.js <sim.html> <out.png> <матч> <раунд> <секунда раунда> [id,id,...]
// Без id — показ у всех CT. Старые сборки без слоя «углы» снимаются с подписями «почему».
const { chromium } = require('playwright');
(async () => {
  const [sim, out, m, r, sec, ids] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage({viewport: {width: 1400, height: 1100}});
  await pg.route(/^https?:/, rt => rt.abort());
  await pg.goto('file://' + require('path').resolve(sim)); await pg.waitForTimeout(1000);
  const info = await pg.evaluate(([m, r, sec, ids]) => __ev(`
    paused = true; freshMatch(${m});
    for(var t=0;t<400000;t++){ stepTick(); if(roundNum > ${r}) break; if(roundNum === ${r} && roundState === "live" && simTime - roundStartTime >= ${sec}) break; }
    var who = ${ids ? JSON.stringify(ids.split(',')) : 'null'} || bots.filter(function(b){ return b.team === "CT" && b.alive; }).map(function(b){ return b.id; });
    if(typeof chkCorners !== "undefined"){ chkCorners.checked = true; CORNER_SHOW = who; }
    if(typeof chkWhy !== "undefined") chkWhy.checked = true;
    draw();
    JSON.stringify({round: roundNum, sec: +(simTime - roundStartTime).toFixed(1), who: who,
      look: who.map(function(id){ var b = botById(id); return b ? [id, b.lookReason || "", (b._lkTop || []).map(function(c){ return c[0] + " " + (+c[1]).toFixed(2); }).join(" › ")] : [id]; })});
  `), [m, r, sec, ids]);
  await pg.screenshot({path: out});
  console.log(info); await br.close();
})();
