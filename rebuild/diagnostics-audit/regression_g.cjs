// Регрессии для эпизодов D (P05–P09, W01–W08, O01, I04/I09/I16/I25).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const journal = read('engine/match/journal.js');
const events = journal.slice(journal.indexOf('function simEvOn('), journal.indexOf('function feedKill('));
function run(body, files) {
  const c = vm.createContext({assert});
  for (const src of [`
    var tick=0, roundNum=1, roundState='live', matchNum=3, TICK_HZ=64;
    var DM=Math, nadeTaskObserved=function(){}, NADE_FAIL=null, NADE_FC=null;
    var teamEco={CT:{roundType:'full'},T:{roundType:'full'}}, teamTac={T:{phase:'setup'}};
    var bomb={site:'A',plantTick:0}, fires=[], TASK_STALE=500;
    function actor(id,team) { return {id,team,alive:true,hp:100,baseX:0,baseY:0,x:0,y:0,z:0,
      post:{tag:'anchor',x:90,y:0,z:0},path:[[90,0,0]],pathIdx:0,state:'patrol',curSpeed:2,nades:{smoke:1}}; }
    var b=actor('CT0','CT'), a=actor('T0','T'), mates=actor('CT1','CT'), bots=[b,a,mates];
    function emit(name,args,effect) { var c=simEvIn(name,args); return simEvOut(c,effect && effect()); }
    function at(t) { tick=t; if(typeof probTick==='function') probTick(); if(typeof WATCH!=='undefined') WATCH.tick(); }
  `, events, ...files.map(read), body]) vm.runInContext('"use strict";\n' + src,c);
  return c.fixture;
}
const movement = 'engine/debug/problem-watch.js';
run(`
  bots=[b];
  for(let t=0;t<=321;t++){ b.baseX=t<161 ? t/3 : (321-t)/3; at(t); }
  assert.equal(PROB.n.stall,0,'выход и возврат — движение во всём окне');
  b.atPost=true;
  for(let t=322;t<700;t++) at(t);
  assert.equal(PROB.n.stall,0,'удержание поста');
  b.atPost=false; b.curSpeed=0;
  for(let t=700;t<=1080;t++){
    tick=t;
    if(t===850) b.post={tag:'rotate',x:105,y:25,z:0};
    probStep(b,'wall',false,[90,0,0]);
    at(t);
  }
  assert.equal(PROB.n.stall,1,'нулевая скорость и смена задачи в одном стоянии');
  var row=PROB.all.find(e=>e.kind==='stall');
  assert.equal(row.facts.fromTick,700); assert.equal(row.tick,1020);
  assert.equal(row.facts.firstBlock.reason,'wall'); assert.equal(row.facts.tasks.length,2);
  b.alive=false; at(1081); assert.equal(row.facts.endTick,1081);
  b.alive=true; b.atPost=true;
  b.z=50; probNav(b,'navSnap',[0,0,0,null]); assert.equal(PROB.n.nav,1,'вертикальная коррекция');
  b.x=70; at(1082); assert.equal(PROB.n.nav,1,'координаты показа');
  tick=1083; for(let i=0;i<405;i++) probNav(b,'navSnap',[0,0,0,null]);
  assert.equal(PROB.all.length,407); assert.equal(PROB.ev.length,400);
  roundNum++; at(1084); assert.equal(PROB.all.length,407);
  matchNum++; at(0); assert.equal(PROB.all.length,0);
  b.post={tag:'alpha',x:80,y:0,z:0}; at(1); b.post={tag:'contact:hold',x:85,y:0,z:0}; at(2);
  b.post={tag:'alpha',x:80,y:0,z:0}; at(3); assert.equal(PROB.n.tug,0);
  b.post={tag:'alpha',x:81,y:0,z:0}; at(4);
  b.post={tag:'alpha',x:80,y:0,z:0}; at(5); assert.equal(PROB.n.tug,1,'смена цели того же тега');
  at(6); assert.equal(PROB.n.tug,1);
`, [movement]);
console.log('PASS movement: positions, retargeting, boundaries, causes, >400, round and match');
const rec = run(`
  b.post={tag:'waitPop',x:20,y:0,z:0}; b.atPost=true;
  at(1); at(512); assert.equal(WATCH.report().n.wait,0); at(513); at(514);
  assert.equal(WATCH.report().n.wait,1);
  b.atPost=false; at(515);
  assert.equal(WATCH.report().all.wait[0][4].toTick,515);
  var team={site:'A',phase:'exec'};
  for(let i=0;i<5;i++) emit('tSetSite',[team,'A'],()=>team.site='A');
  assert.equal(WATCH.report().n.flip,0);
  at(516); emit('tSetSite',[team,'B'],()=>team.site='B');
  at(517); emit('tSetSite',[team,'A'],()=>team.site='A');
  assert.equal(WATCH.report().n.flip,1);
  var task={type:'smoke',x:100,y:100,start:tick}, flash={type:'flash',team:'T',thrower:a,x:10,y:5,z:4,born:tick};
  b.nadeTask=task; emit('nadeTaskObserved',[b]);
  NADE_FC='pause';
  emit('throwNade',[b,'smoke',100,100,0,'task',null,task],()=>false);
  assert.equal(Object.getOwnPropertyDescriptor(b,'nadeTask').get,undefined);
  emit('throwNade',[b,'flash',100,100],()=>{emit('nadeLaunch',[{...flash,thrower:b}]); return true;});
  emit('nadeTaskEnd',[b,'higher-priority'],()=>b.nadeTask=null);
  assert.equal(Object.keys(WATCH.report().nade.thrown).length,0);
  assert.equal(WATCH.report().nade.lost['CT|full|smoke'],1);
  b.nadeTask={...task};
  emit('nadeTaskObserved',[b]);
  var smoke={...flash,type:'smoke',team:'CT',thrower:b};
  emit('throwNade',[b,'smoke',100,100,0,'task',null,b.nadeTask],()=>{emit('nadeLaunch',[smoke]); return true;});
  emit('nadeTaskEnd',[b,'done'],()=>b.nadeTask=null);
  emit('detonate',[smoke]);
  assert.equal(WATCH.report().nade.thrown['CT|full|smoke'],1);
  assert.equal(WATCH.report().nade.detonated['CT|full|smoke'],1);
  emit('feedKill',[mates,b,'AK',false,{smoke:true}]);
  emit('feedKill',[a,b,'AK',false,{smoke:true}]);
  assert.equal(WATCH.report().n.smokeProjected,1);
  assert.equal(WATCH.report().n.danger,0,'близость к C4 / флешке сама по себе');
  emit('applyDamage',[null,b,6,'C4',{}],()=>b.hp-=6);
  var fire={x:1,y:0,z:0,born:tick}; fires.push(fire); b._fireIn={f:fire,t:tick};
  emit('applyDamage',[a,b,2,'молотов',{}],()=>b.hp-=2);
  at(518); emit('applyDamage',[a,b,3,'молотов',{}],()=>b.hp-=3);
  b._fireIn=null; at(519);
  assert.equal(WATCH.report().all.danger[1][4].toTick,519);
  assert.equal(WATCH.report().all.danger[1][4].hits.length,2);
  emit('flashExposure',[flash,b,1,0.5,false],()=>b.blindUntil=550);
  emit('flashExposure',[flash,a,0.5,0.5,true],()=>a.blindUntil=535);
  assert.equal(WATCH.report().dangerBy['flash.unwarned'],1);
  assert.equal(WATCH.report().dangerBy['flash.known'],1);
  for(let i=0;i<60;i++) emit('applyDamage',[null,b,1,'C4',{}],()=>b.hp--);
  var W=WATCH.report(true); assert.equal(W.n.danger,64); assert.equal(W.all.danger.length,64);
  assert.equal(W.ev.danger.length,40); assert.ok(W.complete,JSON.stringify(W.errors));
  var fixture={match:matchNum,ticks:tick,prob:[],watch:W};
`, ['tools/measure/audit/watch.js']);
console.log('PASS watch: episodes, typed causes, attempt identity, 64 contributions, 40 samples');
run(`
  bots=[b]; function inv(t){ at(t); INV.tick(0); }
  b.pathIdx=2; b.post.tag='lineup';
  for(let t=1;t<=20;t++) inv(t);
  assert.equal(INV.R['I-01'].n,1); assert.equal(INV.R['I-04'].n,1);
  b.pathIdx=1;b.nadeTask={}; inv(21);
  assert.equal(INV.R['I-01'].all[0].data.until,21);
  assert.equal(INV.R['I-04'].all[0].data.from,1);
  assert.equal(INV.R['I-04'].all[0].data.until,21);
  for(let i=0;i<405;i++) probNav(b,'navSnap',[1,1,0,null]); inv(22); inv(23);
  assert.equal(INV.R['I-09'].n,405); assert.equal(INV.R['I-09'].all.length,405);
  b.heardSound={kind:'call',tick:22}; b._visible=[a];
  emit('knowSound',[b,{kind:'steps',src:a.id,tick:23},'hearing'],()=>b.heardSound={});
  assert.equal(INV.R['I-16'].n,0); assert.equal(INV.R['I-25'].n,1);
  emit('knowIntel',[b,{x:0,y:0}],()=>{});
  assert.equal(INV.R['I-16'].n,1);
  for(let t=24;t<=28;t++){ inv(t);
    emit('setPostResult',[b,'slot',{ok:false,why:'higher'}]);
    emit('setPostResult',[b,'slot',{ok:false,why:'higher'}]);
    NADE_FC='pause'; emit('throwNade',[b,'smoke'],()=>false); }
  assert.equal(INV.R['I-07'].all[0].data.ticks,5);
  assert.equal(INV.R['I-26'].all[0].data.responses[0][2],2);
  assert.equal(INV.R['I-12'].n,1);
  inv(29); emit('setPostResult',[b,'slot',{ok:true}]);
  assert.equal(INV.R['I-07'].all[0].data.until,29);
  assert.equal(INV.R['I-12'].all[0].data.from,24);
  inv(30); assert.equal(INV.R['I-12'].all[0].data.until,30);
  var valid={alive:true,hp:100,atPost:false,pathIdx:0,lastIntel:null,heardSound:null,nadeTask:null,
    _reloading:false,_climb:null,_fall:null,_jc:null,_boost:null,blindUntil:0,throwUntil:0,roundKills:0,roundDmg:0,
    money:4500,primary:'AK',x:555};
  Object.assign(b,valid);
  emit('resetRound',[]); assert.equal(INV.R['I-14'].n,0,'экономика, оружие и спавн легально меняются');
  b._climb={}; emit('resetRound',[]); assert.equal(INV.R['I-14'].n,1);
  assert.equal(INV.R['I-14'].all[0].data.field,'_climb');
  tick=40; for(let k=0;k<4;k++) probEvent('stall',b,'fixture','blockedStep',{});
  INV.tick(0); INV.tick(0);
  assert.equal(INV.R['I-10'].n,1);
  assert.equal(INV.R['I-10'].all[0].data.contributors.length,3);

`, [movement, 'tools/measure/invariants.js']);
console.log('PASS invariants: I-01, I-04, I-07/26, I-09/10, I-12, I-14, I-16 and I-25');
if (process.argv[2]) fs.writeFileSync(process.argv[2],JSON.stringify(rec));
