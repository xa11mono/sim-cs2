// Снимки момента матча без отметки (по скрину владельца: «матч N · тик T» в шапке страницы).
//   node tools/match_snaps.js sim.html <матч> <тик1,тик2,...> <папка> [--pre=20]
// freshMatch(матч) и шаги stepTick() до каждого тика; в папку — snap_<тик>.json (момент) и pre_<тик>.json (за --pre секунд до),
// тот же формат, что у отметок (mkPack) — дальше tools/mark_story.js / mark_frames.js / mark_open.js.
// Печатает сверку со скрином: раунд, счёт, время раунда, у каждого бота HP, деньги, оружие.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
  const [sim, match, ticksArg, out] = args;
  if(!sim || !match || !ticksArg || !out){ console.error('node tools/match_snaps.js sim.html матч тик1,тик2 папка [--pre=20]'); process.exit(2); }
  fs.mkdirSync(out, {recursive: true});
  const pre = +(opt.pre || 20);
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.evaluate(n => window.__ev('(function(n){ freshMatch(n); paused = true; return 1; })')(n), +match);
  const ticks = ticksArg.split(',').map(Number).sort((a, b) => a - b);
  const want = [];
  ticks.forEach(T => { want.push(['pre', T]); want.push(['snap', T]); });
  for(const [kind, T] of want){
    const res = await pg.evaluate(([kind, T, pre]) => window.__ev('(' + function(kind, T, pre){
      var goal = kind === 'pre' ? Math.max(0, T - Math.round(pre*TICK_HZ)) : T;
      if(tick > goal) return {skip: true, tick: tick};
      while(tick < goal) stepTick();
      var rt = (typeof roundTimeLeft === 'function') ? roundTimeLeft() : null;
      var info = {tick: tick, round: roundNum, score: JSON.stringify(typeof score !== 'undefined' ? score : null), state: roundState,
        t: Math.round((simTime - roundStartTime)*10)/10,
        bots: bots.map(function(b){ return b.id + ':' + b.name + ' ' + b.team + ' hp' + b.hp + (b.alive ? '' : '✝') + ' $' + b.money + ' ' + (b.weapon && b.weapon.name || b.weapon || ''); })};
      return {text: mkPack(mkSnapshot()), info: info};
    } + ')')(kind, T, pre), [kind, T, pre]);
    if(res.skip){ console.log(kind, T, 'пропущен (уже тик ' + res.tick + ')'); continue; }
    fs.writeFileSync(path.join(out, kind + '_' + T + '.json'), res.text);
    if(kind === 'snap') console.log(JSON.stringify(res.info));
  }
  await br.close();
})();
