// (v462) Снимок игры на закупке раунда — для мгновенного перехода (кнопки «Инструменты»): матч считается тиками до закупки раунда,
// снимок (как у отметок: mkPack(mkSnapshot())) — в <папка>/snap_m<матч>r<раунд>.json; для проверки «бит в бит» — отпечаток
// после ещё <тиков> тиков (тот же, что fingerprint.js: координаты, взгляд, HP, оружие, деньги).
//   node tools/snap_round.js sim.html <матч> <раунд> <папка> [тиков=3000]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, m, r, out, nS] = process.argv; const N = +(nS||3000);
  fs.mkdirSync(out, {recursive: true});
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, q=>q.abort());
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.waitForTimeout(1000);
  const res = await pg.evaluate(([m, r, N]) => window.__ev('(' + function(m, r, N){
    paused = true; freshMatch(m);
    var M0 = matchNum, g = 0;
    while(matchNum === M0 && !(roundNum === r && roundState === "freeze") && g++ < 3e6) stepTick();
    var snap = mkPack(mkSnapshot()), info = {match: m, matchNum: matchNum, round: roundNum, state: roundState, tick: tick, fp: mkFp(), score: score.CT + ":" + score.T,
      pause: (typeof TO_NOW !== "undefined" && TO_NOW && TO_NOW.round === roundNum) ? TO_NOW.side : null};
    var h = 2166136261 >>> 0, F = new Float64Array(1), U = new Uint32Array(F.buffer);
    var mix = function(v){ F[0] = +v || 0; h = Math.imul(h ^ U[0], 16777619) >>> 0; h = Math.imul(h ^ U[1], 16777619) >>> 0; };
    for(var t = 0; t < N; t++){ stepTick(); bots.forEach(function(b){ mix(b.x); mix(b.y); mix(b.facing); mix(b.hp); mix(b.money); }); }
    info.after = {ticks: N, tick: tick, round: roundNum, hash: h};
    return JSON.stringify({info: info, snap: snap});
  } + ')(' + m + ',' + r + ',' + N + ')'), [+m, +r, N]);
  const R = JSON.parse(res);
  fs.writeFileSync(path.join(out, 'snap_m' + m + 'r' + r + '.json'), R.snap);
  fs.writeFileSync(path.join(out, 'info.txt'), JSON.stringify(R.info) + '\n'); console.log(JSON.stringify(R.info), 'снимок', R.snap.length, 'байт');
  await br.close();
})();
