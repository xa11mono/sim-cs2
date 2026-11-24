// Автономная страница: core.js + prec.wasm в base64 внутри одного HTML; расчёт в главном потоке и в Worker из Blob. Открывается по file://.
const fs=require('fs');const core=fs.readFileSync(__dirname+'/core.js','utf8').replace(/if\(typeof module[^\n]*\n/,"");
const w=fs.readFileSync(__dirname+'/prec/target/wasm32-unknown-unknown/release/prec.wasm').toString("base64");
const html=`<!doctype html><meta charset=utf-8><title>standalone wasm+worker</title><body><pre id=o>…</pre><script id=core>${core}</script><script>
var B64="${w}";function bytes(){var s=atob(B64),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
var res={};try{var r=runAll(bytes(),200000);res.main={hash:r.hash,overhead:r.overhead};}catch(e){res.main={err:String(e)};}
try{var src=document.getElementById("core").textContent+"\\nonmessage=function(m){try{var r=runAll(m.data,200000);postMessage({hash:r.hash,overhead:r.overhead});}catch(e){postMessage({err:String(e)});}};";
var wk=new Worker(URL.createObjectURL(new Blob([src],{type:"text/javascript"})));wk.onmessage=function(m){res.worker=m.data;window.__done=res;document.getElementById("o").textContent=JSON.stringify(res);};wk.onerror=function(e){res.worker={err:"worker error "+e.message};window.__done=res;};wk.postMessage(bytes());}catch(e){res.worker={err:String(e)};window.__done=res;}
</script>`;fs.writeFileSync(__dirname+'/standalone.html',html);console.log('standalone.html',html.length);
