const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, M, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([M,N]) => { window.__ev('freshMatch('+M+')');
    window.__ev(`window.__L = {prev:{}, C:{}, eta:[], pp:0, plants:0, tw:0, pk:null};`);
    for(let i = 0; i < N; i++){ window.__ev('stepTick()'); if(i % 4) continue;
      window.__ev(`(function(){ var L = window.__L; if(!bomb || bomb.state !== "planted"){ L.prev = {}; return; }
        if(L.pk !== bomb.plantTick){ L.pk = bomb.plantTick; L.plants++; }
        bots.forEach(function(b){ if(b.team !== "T" || !b.alive) return; var tg = b.post ? String(b.post.tag) : ""; var p = L.prev[b.id];
          if(/^postplant/.test(tg)) L.pp++;
          if(p && /^postplant/.test(p) && !/^postplant/.test(tg)){ var k = tg.split(":")[0] || "(нет)"; L.C[k] = (L.C[k]||0)+1;
            if(/^(repos|pickup|contact|tradeR)/.test(tg)) L.eta.push(Math.round(typeof tCtEtaKnown === "function" ? tCtEtaKnown() : -1)); }
          L.prev[b.id] = tg; }); })()`); }
    return window.__ev(`JSON.stringify({плантов: __L.plants, тиков_на_посту_x4: __L.pp, ушли_с_поста_в: __L.C, eta_при_уходе: __L.eta.slice(0,20)})`); }, [+M, +N]);
  console.log(M, out); await br.close(); })();
