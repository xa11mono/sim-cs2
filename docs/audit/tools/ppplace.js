const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, M, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([M,N]) => { window.__ev('freshMatch('+M+')');
    window.__ev(`window.__P = {prev:{}, C:{}, plants:0, n:0, see:0, stop:0, tags:{}, pk:null};`);
    for(let i = 0; i < N; i++){ window.__ev('stepTick()'); if(i % 4) continue;
      window.__ev(`(function(){ var L = window.__P; if(!bomb || bomb.state !== "planted"){ L.prev = {}; return; }
        if(L.pk !== bomb.plantTick){ L.pk = bomb.plantTick; L.plants++; }
        var el = tick - bomb.plantTick;
        bots.forEach(function(b){ if(b.team !== "T" || !b.alive) return; var tg = b.post ? String(b.post.tag) : "";
          if(el >= 384 && el < 388){ L.n++; var t0 = tg.split(":").slice(0,2).join(":"); L.tags[t0] = (L.tags[t0]||0)+1;
            if(hasLOS(b.x, b.y, bomb.x, bomb.y, b.z)) L.see++;
            if(typeof defStopP === "function") L.stop += defStopP({x:b.x, y:b.y, z:b.z}, bomb, "T"); }
          var p = L.prev[b.id]; if(p && /^postplant/.test(p) && !/^postplant/.test(tg)){ var k = tg.split(":")[0] || "(нет)"; L.C[k] = (L.C[k]||0)+1; }
          L.prev[b.id] = tg; }); })()`); }
    return window.__ev(`JSON.stringify({плантов: __P.plants, T_через6с: __P.n, видят_бомбу: __P.see, шанс_сорвать_ср: __P.n ? +(__P.stop/__P.n).toFixed(2) : null, задачи: __P.tags, ушли_с_поста_в: __P.C})`); }, [+M, +N]);
  console.log(M, out); await br.close(); })();
