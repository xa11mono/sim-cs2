// (Р3.2, канал «место», У-9) места вызова pickSpots: из какого мозга достижимы по графу вызовов (SPOT_TEAM задан только вокруг tBrain / ctBrain, 350:388)
// — статический разбор для перевода стороны в явный аргумент. Игру не меняет. Запуск: NODE_PATH=… node tools/rebuild/spot_team_sites.js
const acorn=require('acorn'), walk=require('acorn-walk'), path=require('path');
const GS=require(require('path').join(__dirname, 'game_src.js')); const {all, spans}=GS.concat();
const fileAt=pos=>(spans.find(sp=>pos>=sp[0]&&pos<sp[1])||spans[spans.length-1])[2];
let main=null; for(const m of all.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)){ const off=m.index+m[0].indexOf('>')+1; if(!main||m[1].length>main.src.length) main={off,src:m[1]}; }
const ast=acorn.parse(main.src.replace(/@@[A-Z_]+@@/g,m=>'0'.padEnd(m.length,' ')),{ecmaVersion:'latest',allowReturnOutsideFunction:true});
let body=ast.body; const iife=body.find(st=>st.type==='ExpressionStatement'&&st.expression.type==='CallExpression'&&/Function/.test(st.expression.callee.type)); if(iife) body=body.concat(iife.expression.callee.body.body);
const tops={}; body.forEach(st=>{ if(st.type==='FunctionDeclaration') tops[st.id.name]=st; });
const calls={}; const sites=[];
for(const [n,f] of Object.entries(tops)){ const c=new Set(); walk.simple(f,{CallExpression(e){ if(e.callee.type==='Identifier'){ c.add(e.callee.name); if(e.callee.name==='pickSpots'){ const pos=e.start+main.off; const a=e.arguments[3]; sites.push({fn:n, at:fileAt(pos)+':'+(all.slice(spans.find(sp=>pos>=sp[0]&&pos<sp[1])[0],pos).split('\n').length), team: a && a.type==='ObjectExpression' && a.properties.some(p=>p.key&&p.key.name==='team')}); } } }}); calls[n]=c; }
const callers={}; for(const [n,c] of Object.entries(calls)) for(const m of c){ (callers[m]=callers[m]||new Set()).add(n); }
// корни: tBrain, ctBrain (SPOT_TEAM задан); всё, что вызывает не из них, — «другое»
function roots(fn){ const seen=new Set(), out=new Set(), st=[fn]; while(st.length){ const f=st.pop(); if(seen.has(f)) continue; seen.add(f); if(f==='tBrain'||f==='ctBrain'){ out.add(f); continue; } const cs=callers[f]; if(!cs||!cs.size){ out.add('корень:'+f); continue; } cs.forEach(x=>st.push(x)); } return [...out].sort(); }
const R={}; sites.forEach(s=>{ const r=roots(s.fn); const k=s.team?'team задан':r.join('+'); (R[k]=R[k]||[]).push(s.at+' '+s.fn); });
for(const [k,v] of Object.entries(R)) console.log(v.length, k, '|', v.join('; '));
