// Чувствительность игры к последнему знаку Math: один и тот же матч в Chromium — как есть и с Math.sin/cos/atan2/exp/log/pow из Rust libm (WASM).
const {chromium}=require('playwright'),fs=require('fs'),url=require('url');
const mode=process.argv[2], TICKS=+process.argv[3]||20000, wasm=fs.readFileSync(__dirname+'/prec/target/wasm32-unknown-unknown/release/prec.wasm').toString('base64');
(async()=>{const br=await chromium.launch();const pg=await br.newPage();await pg.route(/^https?:/,r=>r.abort());
await pg.goto(url.pathToFileURL(require('path').resolve(__dirname,'../../../../../sim.html')).href);await pg.waitForTimeout(1200);
const r=await pg.evaluate(([mode,TICKS,b64])=>__ev(`
 var calls={sin:0,cos:0,atan2:0,exp:0,log:0,pow:0};
 if("${mode}"==="libm"){ var s=atob("${b64}"),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
   var E=new WebAssembly.Instance(new WebAssembly.Module(u),{}).exports; Math.sin=E.m_sin;Math.cos=E.m_cos;Math.atan2=E.m_atan2;Math.exp=E.m_exp;Math.log=E.m_log;Math.pow=E.m_pow; }
 freshMatch(3); var h=2166136261>>>0, F=new Float64Array(1), U=new Uint32Array(F.buffer), out=[];
 function mix(v){F[0]=+v||0;h=Math.imul(h^U[0],16777619)>>>0;h=Math.imul(h^U[1],16777619)>>>0;}
 for(var t=0;t<${TICKS};t++){ stepTick(); bots.forEach(function(b){mix(b.x);mix(b.y);mix(b.facing);mix(b.hp);}); if(t%16===15) out.push(h); }
 JSON.stringify({ticks:tick,round:roundNum,h:out})`),[mode,TICKS,wasm]);
fs.writeFileSync(__dirname+'/sens_'+mode+'_'+process.argv[4]+'.json',r);await br.close();console.log(mode,'done');})();
