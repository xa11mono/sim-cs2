// Закрытая тестовая страница-артефакт (разрешение владельца 24.11): WASM внутри HTML, Worker из Blob / data:, общая память, Math браузера.
// Результат — в базу артефакта (коллекция runs), Claude читает его ArtifactData. Запуск: node make_probe.js <выходной.html>
const fs=require('fs');
const core=fs.readFileSync(__dirname+'/core.js','utf8').replace(/if\(typeof module[^\n]*\n/,'');
const wasm=fs.readFileSync(__dirname+'/prec/target/wasm32-unknown-unknown/release/prec.wasm').toString('base64');
const REF={ // хэши 20 000 входов core.js (evidence/artifact_probe_refs.json)
 node22:{"sin":"4ee8b2d9","cos":"b4ea5f42","tan":"849cffad","atan2":"e7883000","exp":"b693f15c","log":"bdb46959","pow":"b9a6eb30","hypot":"5d4cac54","sqrt":"eb516bd4"},
 chromium158:{"sin":"e6e38f19","cos":"8e403a8d","tan":"8a38b291","atan2":"6d6d022a","exp":"d3fa1059","log":"7090192e","pow":"4fd9cdd5","hypot":"5d4cac54","sqrt":"eb516bd4"},
 libm:{"sin":"e9524b73","cos":"2f534465","tan":"849cffad","atan2":"e7883000","exp":"b693f15c","log":"4ca11693","pow":"c87fd075","hypot":"d0b3582c","sqrt":"eb516bd4"}};
const html=`<title>Стенд среды sim-cs2</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* одна колонка: заголовок, сводка, таблица проверок */
:root{--bg:#f3f5f2;--fg:#1d2420;--muted:#5d6a62;--line:#d5ddd7;--ok:#1f7a45;--bad:#b3261e;--warn:#8a5a00;--card:#ffffff;
--f-head:"Space Grotesk",system-ui,sans-serif;--f-body:"Inter",system-ui,sans-serif;--f-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141a17;--fg:#e4ebe6;--muted:#97a69d;--line:#2c3631;--ok:#5cc98a;--bad:#f2867e;--warn:#e0b45a;--card:#1b231f;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#141a17;--fg:#e4ebe6;--muted:#97a69d;--line:#2c3631;--ok:#5cc98a;--bad:#f2867e;--warn:#e0b45a;--card:#1b231f;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--f-body);line-height:1.5}
main{max-width:760px;margin:0 auto;padding-block:28px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:18px}
h1{font-family:var(--f-head);font-size:1.6rem;margin:0;text-wrap:balance}
p{margin:0;color:var(--muted);max-width:65ch}
#status{font-weight:600}
.wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:.92rem}
td{padding:8px 12px;border-top:1px solid var(--line);vertical-align:top}
tr:first-child td{border-top:0}
td:first-child{width:42%}
td.v{font-family:var(--f-mono);font-size:.85rem;word-break:break-word}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@600&display=swap">
<main>
<h1>Стенд среды sim-cs2</h1>
<p>Страница проверяет, что будущая сборка игры сможет работать здесь: ядро WASM внутри одного HTML, фоновый поток для расчёта, общая память. Ещё она определяет, какая реализация математики в этом браузере. Игру не запускает.</p>
<p id="status">Проверки идут…</p>
<div class="wrap"><table id="t"></table></div>
</main>
<script id="core">${core}</script>
<script>
var B64="${wasm}", REF=${JSON.stringify(REF)}, N=20000, R={env:{},tests:{}};

function bytes(){var s=atob(B64),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
function row(name,val,cls){var tr=document.createElement("tr"),a=document.createElement("td"),b=document.createElement("td");a.textContent=name;b.textContent=val;b.className="v "+(cls||"");tr.append(a,b);document.getElementById("t").append(tr);}
function eq(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function whichMath(h){var o={};NAMES.forEach(function(f){o[f]=["node22","chromium158","libm"].filter(function(k){return REF[k][f]===h[f];}).join("+")||"другая";});return o;}
function workerTest(kind){return new Promise(function(res){var src=document.getElementById("core").textContent+"\\nself.onmessage=function(m){try{var i=new WebAssembly.Instance(new WebAssembly.Module(m.data),{});postMessage({libm:hashes(wasmFill(i,1,"+N+")),js:hashes(jsFill("+N+"))});}catch(e){postMessage({err:String(e)});}};";
 var t=setTimeout(function(){res({err:"нет ответа за 15 с"});},15000),w;
 try{ if(kind==="blob") w=new Worker(URL.createObjectURL(new Blob([src],{type:"text/javascript"})));
  else if(kind==="blob-module") w=new Worker(URL.createObjectURL(new Blob([src],{type:"text/javascript"})),{type:"module"});
  else w=new Worker("data:text/javascript;base64,"+btoa(unescape(encodeURIComponent(src))));
  w.onmessage=function(m){clearTimeout(t);res(m.data);w.terminate();}; w.onerror=function(e){clearTimeout(t);res({err:"ошибка Worker: "+(e.message||"без текста")});};
  w.postMessage(bytes()); }catch(e){clearTimeout(t);res({err:String(e)});} });}
async function run(){
 var ua=navigator.userAgentData; R.env={ua:navigator.userAgent,brands:ua?ua.brands.map(function(b){return b.brand+" "+b.version;}).join(", "):null,platform:ua?ua.platform:navigator.platform,cores:navigator.hardwareConcurrency,crossOriginIsolated:!!self.crossOriginIsolated,sab:typeof SharedArrayBuffer!=="undefined",when:new Date().toISOString()};
 row("Браузер",R.env.brands||R.env.ua); row("Изоляция страницы (нужна для общей памяти)",R.env.crossOriginIsolated?"есть":"нет",R.env.crossOriginIsolated?"ok":"warn"); row("SharedArrayBuffer",R.env.sab?"есть":"нет",R.env.sab?"ok":"warn");
 var inst=null;
 try{inst=new WebAssembly.Instance(new WebAssembly.Module(bytes()),{});R.tests.wasm_sync={ok:true};row("WASM из HTML, синхронно","работает","ok");}catch(e){R.tests.wasm_sync={ok:false,err:String(e)};row("WASM из HTML, синхронно",String(e),"bad");}
 try{var r2=await WebAssembly.instantiate(bytes(),{});R.tests.wasm_async={ok:!!r2.instance};row("WASM из HTML, асинхронно","работает","ok");if(!inst)inst=r2.instance;}catch(e){R.tests.wasm_async={ok:false,err:String(e)};row("WASM из HTML, асинхронно",String(e),"bad");}
 if(inst){var hl=hashes(wasmFill(inst,1,N));R.tests.libm_bitexact={ok:eq(hl,REF.libm),hash:hl};row("Rust libm в WASM = нативный Rust (бит в бит)",eq(hl,REF.libm)?"совпадает":"НЕ совпадает",eq(hl,REF.libm)?"ok":"bad");
  var ov=overhead(inst);R.tests.call_ns=ov;row("Вызов WASM / JS, нс",ov.wasm_ns_per_call+" / "+ov.js_ns_per_call);}
 var hj=hashes(jsFill(N));R.tests.js_math={hash:hj,match:whichMath(hj)};row("Math этого браузера",JSON.stringify(R.tests.js_math.match));
 for(var k of ["blob","blob-module","data"]){var w=await workerTest(k);var ok=!w.err&&eq(w.libm,REF.libm);R.tests["worker_"+k]={ok:ok,err:w.err||null,js_same_as_page:w.js?eq(w.js,hj):null};row("Worker ("+k+") + WASM внутри",w.err?w.err:(ok?"работает, libm бит в бит":"работает, но libm не совпал"),w.err?"bad":(ok?"ok":"bad"));}
 var st=document.getElementById("status");
 try{ if(!window.claude){st.textContent="Проверки готовы. Сохранение недоступно вне claude.ai.";return;}
  var db=await window.claude.use("db"); if(!db){st.textContent="Проверки готовы. Сохранение недоступно: войдите в claude.ai.";return;}
  var id="run-"+Date.now()+"-"+Math.floor(Math.random()*1e6); await db.doc("runs/"+id).set(R); st.textContent="Проверки готовы, результат сохранён ("+id+").";st.className="ok";
 }catch(e){st.textContent="Проверки готовы, сохранить не удалось: "+(e&&e.code||e);st.className="bad";}
}
run();
</script>`;
fs.writeFileSync(process.argv[2],html);console.log(process.argv[2],html.length);
