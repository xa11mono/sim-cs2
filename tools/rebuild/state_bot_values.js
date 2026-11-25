// (Р3.1, 25.11) образцы значений полей ботов в матче (тики 3000…70000) — доказательство для разметки полей бота (state_classes.py):
// метка раунда в значении, номер тика в поле-сроке. Игру не меняет. Запуск: node tools/rebuild/state_bot_values.js sim.html выход.json
const path=require('path'), pw=require('playwright'), DVS=require(require('path').join(__dirname, '..', 'measure', 'dv_state.js')), fs=require('fs');
(async()=>{ const br=await pw.chromium.launch(); const p=await br.newPage(); await p.route(/^https?:/,r=>r.abort());
 await p.goto('file://'+path.resolve(process.argv[2])); await p.waitForTimeout(1200); await DVS.stopFrames(p);
 const out={}; await p.evaluate(()=>__ev('freshMatch(3); 1'));
 for(const T of [3000, 9000, 20000, 40000, 70000]){
   const r=await p.evaluate(T=>__ev(`while(tick<${T}) stepTick(); var o={}; bots.forEach(function(b){ Object.keys(b).forEach(function(k){ var v=b[k]; if(v===null||v===undefined) return; var s;
     try{ s = typeof v==='object' ? (Array.isArray(v) ? 'arr'+v.length+':'+JSON.stringify(v.slice(0,2), function(kk,vv){ return vv && vv.hp!==undefined && vv.team ? 'BOT' : vv; }).slice(0,90) : 'obj{'+Object.keys(v).slice(0,10).join(',')+'}') : typeof v+':'+String(v).slice(0,30); }catch(e){ s='?'; }
     (o[k]=o[k]||[]); if(o[k].length<3 && o[k].indexOf(s)<0) o[k].push(s); }); }); JSON.stringify(o)`),T);
   const o=JSON.parse(r); for(const k in o){ (out[k]=out[k]||[]); o[k].forEach(s=>{ if(out[k].length<4 && out[k].indexOf(s)<0) out[k].push(s); }); } }
 fs.writeFileSync(process.argv[3], JSON.stringify(out)); await br.close(); })();
