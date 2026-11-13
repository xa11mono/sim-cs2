// В136 «режим тени»: раунд демки про в нашей игре. Игроки идут и смотрят ровно как в демке; наши боты в их телах видят / слышат по нашей
// видимости и событиям демки (выстрелы, попадания, смерти, смоки, плант) и только РЕШАЮТ: куда идти (задача, post), куда смотреть
// (lookTarget, lookReason), режим боя. Каждые 0,5 с — запись «про: где и куда пришёл за 3 с, куда смотрел / бот: задача, точка, взгляд».
// Игру не меняет (управляет сборкой снаружи). Запуск: node tools/shadow/shadow.js <сборка.html> <round_….json> <выход.json>
const {chromium} = require('playwright'); const fs = require('fs');
(async () => {
  const [html, rj, outp] = process.argv.slice(2); const R = JSON.parse(fs.readFileSync(rj, 'utf8'));
  const b = await chromium.launch(); const pg = await b.newPage(); pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto('file://' + html); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.evaluate(R => { window.__R = R; }, R);
  const body = (function(){ var R = window.__R;
    paused = true; freshMatch(1);
    while(roundState !== 'live') stepTick();
    // соответствие: бот ↔ игрок демки (сторона; у кого совпал ник — тот, остальные по порядку)
    var P = R.players, ids = Object.keys(P), map = {}, used = {};
    ['T', 'CT'].forEach(function(side){
      var dem = ids.filter(function(s){ return P[s].side === side; }), bs = bots.filter(function(x){ return x.team === side; });
      bs.forEach(function(x){ var n = String(nick(x.id)).toLowerCase(), m = dem.filter(function(s){ return !used[s] && P[s].name.toLowerCase() === n; })[0]; if(m){ map[m] = x; used[m] = 1; } });
      bs.forEach(function(x){ if(Object.keys(map).some(function(k){ return map[k] === x; })) return; var m = dem.filter(function(s){ return !used[s]; })[0]; if(m){ map[m] = x; used[m] = 1; } }); });
    var BOT = {}; Object.keys(map).forEach(function(s){ BOT[s] = map[s]; });
    var wkey = {}; Object.keys(WEAPONS).forEach(function(k){ wkey[WEAPONS[k].name] = k; });
    var isPistol = function(k){ return k && WEAPONS[k] && WEAPONS[k].slot === 'secondary'; };
    // оружие на раунд — основное из демки (последнее не-пистолет), пистолет
    Object.keys(BOT).forEach(function(s){ var x = BOT[s], pr = null, sc = null;
      P[s].track.forEach(function(r){ var k = wkey[r[7]]; if(!k) return; if(isPistol(k)) sc = k; else pr = k; });
      x.primary = pr; if(sc) x.secondary = sc; x.weapon = WEAPONS[pr || x.secondary]; x._ammoFor = null; x.armor = true; x.helmet = true; });
    var t0 = tick, ev = R.ev.slice(), ei = 0, rec = [], dead = {};
    var at = function(s, t){ var T = P[s].track, lo = 0, hi = T.length - 1; if(t <= T[0][0]) return T[0]; if(t >= T[hi][0]) return T[hi];
      while(hi - lo > 1){ var m = (lo + hi) >> 1; if(T[m][0] <= t) lo = m; else hi = m; } var a = T[lo], c = T[hi], k = (t - a[0]) / Math.max(1, c[0] - a[0]);
      return [t, a[1] + (c[1]-a[1])*k, a[2] + (c[2]-a[2])*k, a[3] + (c[3]-a[3])*k, a[4] + (((c[4]-a[4]+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*k, a[5], a[6], a[7]]; };
    // свои выстрелы ботов — выкл (стреляет только демка); урон — только смерти демки
    tryShoot = function(){}; var oDmg = applyDamage, allowDmg = false; applyDamage = function(){ return allowDmg ? oDmg.apply(this, arguments) : false; };
    var place = function(){ var t = tick - t0; Object.keys(BOT).forEach(function(s){ var x = BOT[s]; if(!x.alive) return; var q = at(s, t), q1 = at(s, t - 8);
      x.x = x.baseX = q[1]; x.y = x.baseY = q[2]; x.facing = q[4]; x.curSpeed = Math.hypot(q[1]-q1[1], q[2]-q1[2]) / (8/TICK_HZ); if(q[6] > 0) x.hp = q[6]; }); };
    place();
    var hearShot = function(sh){ bots.forEach(function(o){ if(!o.alive || o.team === sh.team) return; var dG = Math.hypot(o.x-sh.x, o.y-sh.y);
      var hearR = hasLOS(o.x, o.y, sh.x, sh.y, o.z, sh.z) ? GUN_HEAR_OPEN : GUN_HEAR_WALL; if(dG >= hearR) return;
      var hp = hearPos(o, sh.x, sh.y, tick*17 + o.id.charCodeAt(0)*7, hearR === GUN_HEAR_WALL);
      o.heardSound = hearReal(o, {x: hp ? hp.x : sh.x, y: hp ? hp.y : sh.y, tick: tick, team: sh.team, src: sh.id, kind: 'shots'}); }); };
    while(tick - t0 < R.len){
      var t = tick - t0;
      while(ei < ev.length && ev[ei][1] <= t){ var e = ev[ei++], A = BOT[e[2]];
        if(e[0] === 'shot' && A && A.alive){ A.lastShotTick = tick; hearShot(A); }
        else if(e[0] === 'hurt' && A && BOT[e[3]] && BOT[e[3]].alive){ var V = BOT[e[3]]; V.heardSound = hearReal(V, {x: A.x, y: A.y, tick: tick, team: A.team, src: A.id, kind: 'hit'}); V._shotAtT = tick; V._shotAtBy = A; }
        else if(e[0] === 'death' && BOT[e[3]] && BOT[e[3]].alive){ allowDmg = true; oDmg(A || BOT[e[3]], BOT[e[3]], 999, 'bullet', {}); allowDmg = false; dead[e[3]] = 1; }
        else if(e[0] === 'nade' && e[3] === 'smoke'){ smokes.push({x: e[4], y: e[5], born: tick, until: tick + NADE.smoke.life, team: A ? A.team : 'T'}); }
        else if(e[0] === 'plant'){ bomb.state = 'planted'; bomb.x = e[3]; bomb.y = e[4]; bomb.carrier = null; bomb.plantTick = tick; if(typeof NADE !== 'undefined'){} }
      }
      stepTick(); place();
      if((tick - t0) % 32 === 0) Object.keys(BOT).forEach(function(s){ var x = BOT[s]; if(!x.alive) return; var q = at(s, tick - t0), q3 = at(s, tick - t0 + 192);
        rec.push([tick - t0, s, x.id, Math.round(q[1]), Math.round(q[2]), Math.round(q3[1]), Math.round(q3[2]), +q[4].toFixed(2),
          x.post ? String(x.post.tag) : '', x.post ? Math.round(x.post.x) : null, x.post ? Math.round(x.post.y) : null,
          x.lookTarget ? Math.round(x.lookTarget.x) : null, x.lookTarget ? Math.round(x.lookTarget.y) : null, x.lookReason || '', x.state, x._fc ? x._fc.ph : '', x.nadeTask ? x.nadeTask.type : '']); });
    }
    return JSON.stringify({map: Object.keys(BOT).map(function(s){ return [s, P[s].name, BOT[s].id, nick(BOT[s].id)]; }), rec: rec});
  }).toString();
  const res = await pg.evaluate(c => window.__ev(c), '(' + body + ')()');
  fs.writeFileSync(outp, res); const J = JSON.parse(res); console.log('записей', J.rec.length, '|', J.map.map(m => m[1] + '→' + m[2]).join(', ')); await b.close();
})();
