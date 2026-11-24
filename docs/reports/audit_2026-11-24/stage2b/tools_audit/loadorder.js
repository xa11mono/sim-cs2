"use strict";
const acorn=require("acorn"), walk=require("acorn-walk"), fs=require("fs"), path=require("path");
const GAME="/home/user/sim-cs2/src/game"; const files=fs.readdirSync(GAME).filter(f=>/\.(html|js)$/.test(f)).sort();
let all="",spans=[]; for(const f of files){const s=fs.readFileSync(path.join(GAME,f),"utf8"); spans.push([all.length,all.length+s.length,f]); all+=s;}
const fileAt=p=>{for(const s of spans) if(p>=s[0]&&p<s[1]) return s[2]; return "?";};
const lineAt=p=>{for(const s of spans) if(p>=s[0]&&p<s[1]) return all.slice(s[0],p).split("\n").length; return 0;};
const blocks=[]; for(const mm of all.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) blocks.push({off:mm.index+mm[0].indexOf(">")+1,src:mm[1]});
const parsed=[]; for(const b of blocks){ try{ parsed.push({b, ast:acorn.parse(b.src.replace(/@@[A-Z_]+@@/g,s=>"0".padEnd(s.length," ")),{ecmaVersion:"latest",allowReturnOutsideFunction:true})}); }catch(e){} }
for(const p of parsed){ const body=[]; for(const st of p.ast.body){ body.push(st); if(st.type==="ExpressionStatement"&&st.expression.type==="CallExpression"&&/Function/.test(st.expression.callee.type)) body.push(...st.expression.callee.body.body); } p.body=body; }
const fns={}, varDecl={};
for(const {b,body} of parsed) for(const st of body){ if(st.type==="FunctionDeclaration") fns[st.id.name]=st;
  if(st.type==="VariableDeclaration") for(const d of st.declarations){ if(d.id.type==="Identifier"){ if(!(d.id.name in varDecl)) varDecl[d.id.name]=[]; varDecl[d.id.name].push(d.start+b.off); if(d.init&&/Function/.test(d.init.type)) fns[d.id.name]=d.init; } } }
function reads(node){ const R=new Set(), C=new Set(); walk.full(node,n=>{ if(n.type==="Identifier"){ if(varDecl[n.name]) R.add(n.name); if(fns[n.name]) C.add(n.name);} }); return {R,C}; }
const memo={}; function closure(fn,seen){ if(memo[fn]) return memo[fn]; seen=seen||new Set(); if(seen.has(fn)) return new Set(); seen.add(fn); if(!fns[fn]) return new Set(); const {R,C}=reads(fns[fn]); const out=new Set(R); for(const c of C) for(const v of closure(c,seen)) out.add(v); memo[fn]=out; return out; }
const res=[];
for(const {b:blk,body} of parsed) for(const st of body){
  if(st.type==="FunctionDeclaration"||(st.type==="ExpressionStatement"&&st.expression.type==="CallExpression"&&/Function/.test(st.expression.callee.type))||st.type==="VariableDeclaration"&&!(st.declarations.some(d=>d.init&&d.init.type==="CallExpression"))) continue;
  // top-level statements that call functions at load
  const calls=new Set(); walk.full(st,n=>{ if(n.type==="CallExpression"&&n.callee.type==="Identifier"&&fns[n.callee.name]) calls.add(n.callee.name); });
  if(!calls.size) continue;
  const pos=st.start+blk.off; const late=new Set();
  for(const c of calls) for(const v of closure(c)) { const decl=varDecl[v]; if(decl && decl.every(p=>p>pos)) late.add(v); }
  if(late.size) res.push({at:fileAt(pos)+":"+lineAt(pos), calls:[...calls].slice(0,4), late:[...late].slice(0,12), n:late.size});
}
console.log(JSON.stringify(res,null,0));
console.error("blocks",blocks.length,"parsed",parsed.length,"fns",Object.keys(fns).length,"vars",Object.keys(varDecl).length, "rebuildNav" in fns, (varDecl.NAV_NEAR_DIRS||[]).map(p=>fileAt(p)+":"+lineAt(p)));
const cl2=closure("rebuildNav"); console.error("closure", cl2.size, cl2.has("NAV_NEAR_DIRS"), cl2.has("JUMP_UP"), cl2.has("LADDERS"));
let tops=0; for(const {b,ast} of parsed) for(const st of ast.body){ if(st.type==="ExpressionStatement") tops++; } console.error("expr stmts", tops);
