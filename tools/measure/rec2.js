// (В5) nades: [..., ls, скорость бойца в миг броска px/с, лайнап 1/0]
// (22.11, аудит 045/046/011) nades + [причина, заказчик (forC.by), eid]; recall + [живых T, живых CT, убийств CT у старого сайта, T у старого сайта]; act + [контакт «тег>враг»]; ctcall — колл CT каждые 32 тика [тик, сайт, счёт, с с последнего наблюдения, goOn, ротаторов, сейв]; carh — 3 тяжёлые гипотезы команды о носителе [тик, id, [[x,y,w]…]]; bsum — карта команды каждые 64 тика [тик, команда, сумма belief, живых врагов]
// один воспроизводимый матч: позиции/фраги/раунды/закуп/гранаты + детектор дёрганий каждый тик
// (05.11, план «ускорение проверок») снимки раундов: /*@@SNAPS@@*/ → walk_run.py вставляет SNAP_ON = 1 (базовый прогон пишет REC.snaps —
// снимок в конце каждого раунда, на границе тика, из него новая версия переигрывает следующий раунд с закупкой); при переигровке
// строка «freshMatch» заменяется восстановлением снимка. В снимке — только то, что изменилось с загрузки страницы (постоянные таблицы
// кода — из новой версии), без точных кэшей (WPM, ZDJ, KPC — их содержимое не меняет результат) и без отметок (MK*)
var SNAP_ON = 0, SNAP_S0 = {}, SNAP_SKIP = /^(WPM|ZDJ|KPC|MK.*)$/, SNAP_NEXT = 0;
/*@@SNAPS@@*/
if(SNAP_ON) mkSnapList().forEach(function(e){ if(SNAP_SKIP.test(e[0])) return; try{ SNAP_S0[e[0]] = mkPack(e[1]()); }catch(x){} });
// (Т-1, 25.11) состояние вне переменных (подсказки броска, их цена, живой кэш путей — src/snapshot.js mkSnapExt): в снимок раунда, если
// отличается от начала; старые сборки (нет mkSnapExt) — как раньше
var SNAP_EXT0 = (SNAP_ON && typeof mkSnapExt === 'function') ? mkPack(mkSnapExt()) : null;
function snapTake(){ var o = {}; mkSnapList().forEach(function(e){ if(SNAP_SKIP.test(e[0])) return; var v = e[1](), s; try{ s = mkPack(v); }catch(x){ return; } if(s !== SNAP_S0[e[0]]) o[e[0]] = v; });
  if(SNAP_EXT0 !== null){ var X = mkSnapExt(); if(mkPack(X) !== SNAP_EXT0){ o.__ext = X; o.__fmt = MK_SNAP_FMT; } }
  if(typeof mkSnapRefs === 'function'){ o.__refs = mkSnapRefs(o); o.__fmt = MK_SNAP_FMT; }   // (Т-1б) ссылки на неизменяемые данные — путём
  return mkPack(o); }
var R_END = 0;
freshMatch(__M__);
var M0=matchNum;
/*@@FP_SETUP@@*/
/*@@WATCH@@*/
var REC={rounds:[], kills:[], pos:[], plants:[], buys:[], nades:[], ctcall:[], carh:[], bsum:[], jit:{alive:0, look:0, moveEng:0, moveIdle:0, moveOther:0, ev:[]}}, rs=null, cur=null;
// (Р0.4, 24.11) подписка на события симуляции (435 simEvOn) вместо подмены функций игры; старые сборки без simEvOn (базы прошлых версий,
// старые отметки) — та же подписка через обёртку. fn(фаза 'in' | 'out', аргументы, результат, что вернул вход)
function evOn(name, fn){ if(typeof simEvOn==='function') return simEvOn(name, fn); var o=eval(name); if(typeof o!=='function') return; eval(name+' = function(){ var s=fn("in", arguments), r=o.apply(this, arguments); fn("out", arguments, r, s); return r; }'); }
evOn('feedKill', function(ph,A){ if(ph!=='in') return; var att=A[0],vic=A[1],weap=A[2],hs=A[3]; REC.kills.push([tick, att?att.id:null, att?att.team:null, att?Math.round(att.x):null, att?Math.round(att.y):null, vic.id, vic.team, Math.round(vic.x), Math.round(vic.y), String(weap), hs?1:0, att&&att.weapon?att.weapon.key:null, vic.tRole||'']); });
evOn('endRound', function(ph,A){ if(ph!=='in') return; var w=A[0],reason=A[1]; if(SNAP_ON) SNAP_NEXT = roundNum + 1; if(cur){ cur.t1=tick; cur.winner=w; cur.reason=reason; cur.bomb=bomb.state; } });
evOn('throwNade', function(ph,A,res,S){ var b=A[0],type=A[1],tx=A[2],ty=A[3]; if(ph==='in') return {ok0:roundState==='live' && b.nades && b.nades[type]>0, x0:b.x, y0:b.y, sp0:Math.round(b.curSpeed||0), lu0:(A[6]||A[7])?1:0, ls:tick-(b.lastShotTick||-999), why0:String(A[5]||(b.nadeTask&&b.nadeTask.why)||''), own0:(b.nadeTask&&b.nadeTask.forC&&b.nadeTask.forC.by)||'', eid0:(b.nadeTask&&b.nadeTask.eid)||''};
  if(S.ok0 && res!==false) REC.nades.push([tick, b.team, type, b.id, (b.tRole||b.ctRole||''), Math.round(S.x0), Math.round(S.y0), Math.round(tx), Math.round(ty), S.ls, S.sp0, S.lu0, S.why0, S.own0, S.eid0]); });   // (v370) только состоявшийся бросок (throwNade может отказать)
// (v181) стрельба: каждый выстрел пулей — тик, стрелок, команда, оружие, дистанция, цель,
// сколько тиков враг уже виден, скорость стрелка (одинаково для любой версии)
REC.shots=[]; evOn('tryShoot', function(ph,A,r,S){ var sh=A[0],tg=A[1],dist=A[2]; if(ph==='in') return {a0:sh.ammo, l0:sh.lastShotTick}; if(roundState==='live' && (sh.ammo<S.a0 || sh.lastShotTick!==S.l0)) REC.shots.push([tick, sh.id, sh.team, sh.weapon?sh.weapon.key:'', Math.round(dist), tg.id, sh.contactStreak|0, Math.round(sh.curSpeed||0), sh._smokeShot?1:0, sh._prep?sh._prep.src:'']); });
// гранатные детекторы: где разорвалась и стрелял ли рядом враг бросавшего за последнюю секунду
REC.det=[]; evOn('detonate', function(ph,A){ if(ph!=='in') return; var n=A[0]; if(roundState==='live'){ var sh=0; bots.forEach(function(o){ if(o.alive && o.team!==n.team && Math.hypot(o.x-n.x,o.y-n.y)<400 && tick-(o.lastShotTick||-999)<=64) sh++; }); REC.det.push([tick, n.team, n.type, Math.round(n.x), Math.round(n.y), sh, n.thrower?n.thrower.id:'', String(n.why||'')]); } });
var H={};
// (05.11, владелец: «за один прогон записать всё, потом выбирать ситуации») полная запись для разборов — только наблюдает:
// dmg — каждый урон [тик, кто, команда, кому, урон, источник, HP жертвы после]; see — каждое новое появление врага в поле зрения
// [тик, кто видит, кого, дистанция px]; act — каждые 32 тика у живого [тик, бот, задача, решение боя, фаза цикла перестрелки,
// ослеплён 1/0, сидит 1/0, на посту 1/0]; в раунде — план IGL, начало выхода
REC.dmg=[]; REC.see=[]; REC.act=[]; var SEEN={};
// (05.11, замечания владельца Д1–Д5) fc — смена фазы цикла перестрелки [тик, бот, было, стало, враг, дист px, враг жив 1/0, видит врага 1/0,
// HP]; task — смена задачи [тик, бот, задача]; voice — каждая показанная реплика войса [тик, команда, кто, текст, вид]; slow — тик дольше
// 25 мс [тик, мс, гранат в полёте, у скольких задание гранаты, задание у кого (тип)]; exu — события смоков выхода (366)
REC.fc=[]; REC.task=[]; REC.voice=[]; REC.slow=[]; REC.exu=[]; var FCP={}, TKP={};
// duel — строки журнала игры о решениях в бою (почему ушёл с линии / держит / отходит / атакует, союзников рядом, врагов видит) [тик, текст]
REC.duel=[]; var DUEL_RE=/укрыт|с линии|в плечо|выгляд|держ|отход|отступ|атак|дуэл|пик|размен|добив|сближ|не лезет/;
if(typeof logEvent==='function'){ evOn('logEvent', function(ph,A){ if(ph!=='in') return; var text=A[0]; if(roundState==='live' && REC.duel.length<40000 && DUEL_RE.test(String(text))) REC.duel.push([tick, String(text).slice(0,200)]); }); }
if(SNAP_ON){ REC.snaps = {}; }
if(typeof voiceFeed==='function'){ evOn('voiceFeed', function(ph,A){ if(ph!=='in') return; if(roundState==='live') REC.voice.push([tick, A[0], A[1]||'', String(A[2]), A[3]||'']); }); }
if(typeof exuEv==='function'){ evOn('exuEv', function(ph,A){ if(ph!=='out') return; var kind=A[0],it=A[1],extra=A[2]; REC.exu.push([tick, kind, it?it.id:null, it?it.owner:null, it?!!it.crit:null, it?it.site:null, it&&it.x!=null?Math.round(it.x):null, it&&it.y!=null?Math.round(it.y):null, extra?JSON.stringify(extra).slice(0,160):'']); }); }
evOn('applyDamage', function(ph,A,r,h0){ var att=A[0],b=A[1],dmg=A[2],src=A[3]; if(ph==='in') return b?b.hp:0; if(roundState==='live'&&b) REC.dmg.push([tick, att?att.id:null, att?att.team:null, b.id, Math.round(Math.min(h0,dmg)), String(src||''), Math.max(0,Math.round(b.hp))]); });
// (v262) К4: ротация CT — кто на какой сайт идёт по колу (ct.rot); разворот = сайт сменился (A→B) или сняли и снова
// послали на тот же в одном раунде; «бросили» = сняли с ротации без планта/смерти/конца раунда. К5: бомбу выбили
// (носитель погиб) — кто через 5 с её держит взглядом, сколько CT ближе 900 px, куда колл.
// (v518, пак владельца 09.11, шаг 0 — чего не было в записи) jump — прыжок / спрыг бота [тик, бот, x, y, z, вверх 1/0, на месте (удержание) 1/0, задача];
// arrive — «дошёл до поста» с высотой не своего пола [тик, бот, задача, z бота, верхний пол у точки поста]; defst — начал дефуз [тик, кто, назначен ретейком];
// recall — смена сайта T [тик, с, на, кто вызвал (функция)]; pick — подбор оружия [тик, текст]; he — урон HE [тик, жертва, 3D-линия от точки разрыва 1/0];
// blind — ослепление [тик, кто, секунд, чья флешка]
// refuse — арбитр задач отказал [тик, бот, какую задачу хотели поставить, какая держит, её уровень, идёт отклонение (вид)] — чья механика кому не дала
REC.refuse=[];
if(typeof setPost==='function'){ evOn('setPost', function(ph,A,r){ if(ph!=='out') return; var b=A[0],tag=A[4];
  if(r===false&&roundState==='live'&&b){ var T=b._task; REC.refuse.push([tick, b.id, String(tag), T?String(T.tag):'', T?T.lv:0, b._detour&&tick<b._detour.until?'detour':'post']); }
  }); }
REC.jump=[]; REC.arrive=[]; REC.defst=[]; REC.recall=[]; REC.pick=[]; REC.he=[]; REC.blind=[]; var ATP={}, DFP={}, BLP={};
if(typeof tSetSite==='function'){ evOn('tSetSite', function(ph,A){ if(ph!=='in') return; var tt=A[0],site=A[1]; var old=tt&&tt.site; if(roundState==='live'&&old&&site&&old!==site){ var fr=String(new Error().stack||'').split('\n'), fi=-1; fr.forEach(function(l,i){ if(/at (?:\S+\.)?tSetSite\b/.test(l)) fi=i; }); var st=fr[fi+1]||'';   // кто вызвал tSetSite: строка после кадра tSetSite (подписка или обёртка — одинаково)
  var S0=SITES[old], kN=S0?((teamIntel.T&&teamIntel.T.sig)||[]).filter(function(sg){ return sg.type==='kill' && sg.tick>=roundStartTick && Math.hypot(sg.x-S0.x,sg.y-S0.y)<700; }).length:0, tN=S0?bots.filter(function(o){ return o.team==='T'&&o.alive&&Math.hypot(o.x-S0.x,o.y-S0.y)<700; }).length:0; REC.recall.push([tick, old, site, (st.match(/at (\w+)/)||[])[1]||'?', aliveCount('T'), aliveCount('CT'), kN, tN]); } }); }
if(typeof logEvent==='function'){ evOn('logEvent', function(ph,A){ if(ph!=='in') return; var text=A[0]; if(roundState==='live'&&/подобрал/.test(String(text))&&REC.pick.length<5000) REC.pick.push([tick, String(text).slice(0,120)]); }); }
evOn('detonate', function(ph,A){ if(ph!=='in') return; var n=A[0]; if(roundState==='live'&&n&&n.type==='he'&&typeof visLine==='function'){ bots.forEach(function(b){ if(!b.alive||Math.hypot(b.x-n.x,b.y-n.y)>NADE.he.radius) return; if(!hasLOS(n.x,n.y,b.x,b.y,null,b.z)) return;
  var l3=visLine(n.x,n.y,n.z,b.x,b.y,visFloorAt(b.x,b.y,b.z)+VIS_EYE.crouch,false)?1:0; REC.he.push([tick, b.id, l3]); }); } });
REC.rotx={n:0, rev:0, back:0, drop:0, ev:[]}; REC.bd=[]; var RX={}, BD=null, BS0=null;
// При автоматическом переходе matchBegin восстанавливает состояние загрузки,
// включая PROB. Снять отчёт нужно на конце текущего матча, до перехода.
for(var t=0;t<__T__ && roundState!=='matchover';t++){ var _t0=performance.now(); stepTick(); var _dt=performance.now()-_t0; if(_dt>25 && roundState==='live'){ var _nt=bots.filter(function(b){return b.alive&&b.nadeTask;}); REC.slow.push([tick, Math.round(_dt), (typeof nadesInAir!=='undefined'&&nadesInAir.length)||0, _nt.length, _nt.map(function(b){return b.id+':'+b.nadeTask.type;}).join(' ')]); } if(typeof WATCH!=='undefined') WATCH.tick();
 if(SNAP_NEXT && matchNum===M0){ REC.snaps[SNAP_NEXT] = {t:tick, s:snapTake()}; SNAP_NEXT = 0; }
 if(R_END && roundNum > R_END) break;
 if(matchNum!==M0) break;
 /*@@FP_SAMPLE@@*/
 if(roundState!==rs){ if(roundState==='live'){ cur={r:roundNum, t0:tick, ctType:teamEco.CT.roundType, tType:teamEco.T.roundType, tac:(typeof teamTac!=='undefined'&&teamTac.T&&teamTac.T.tac)?teamTac.T.tac.id:null, tsite:(typeof teamTac!=='undefined'&&teamTac.T)?teamTac.T.site:null, ctSetup:(typeof teamTac!=='undefined'&&teamTac.CT&&teamTac.CT.setup)?teamTac.CT.setup.id:null}; REC.rounds.push(cur);
   bots.forEach(function(b){ REC.buys.push([roundNum, b.id, b.team, b.primary||'', b.secondary||'', b.armor?1:0, b.helmet?1:0, b.kit?1:0, b.nades?(b.nades.smoke+b.nades.flash+b.nades.he+b.nades.molly):0, b.money]); }); H={}; }
   rs=roundState; }
 if(roundState!=='live'){ RX={}; BD=null; BS0=null; continue; }
 (function(){ var ct=teamTac.CT, pl=bomb.state==='planted';
  bots.forEach(function(b){ if(b.team!=='CT') return; var r=RX[b.id]||(RX[b.id]={cur:null, seen:{}});
   if(!b.alive||pl){ r.cur=null; return; }
   var c=(ct.rot&&ct.rot[b.id]&&ct.call)?ct.call.site:null; if(c===r.cur) return;
   if(c){
     REC.rotx.n++; var kind=r.cur?'rev':r.seen[c]?'back':'start';
     if(kind!=='start') REC.rotx[kind]++;
     REC.rotx.ev.push([tick,b.id,r.cur||'-',c,kind,roundNum]);
     r.seen[c]=1;
   } else { REC.rotx.drop++; REC.rotx.ev.push([tick,b.id,r.cur,null,'drop',roundNum]); }
   r.cur=c; });
  var dd=bomb.state==='dropped'&&bots.some(function(o){ return o.team==='T'&&!o.alive&&Math.hypot(o.x-bomb.x,o.y-bomb.y)<20; });
  if(dd&&!BD){ BD={t0:tick, r:roundNum, x:Math.round(bomb.x), y:Math.round(bomb.y), place:String(calloutName(bomb.x,bomb.y)||''), call0:ct.call?ct.call.site:null}; REC.bd.push(BD); }
  if(BD&&BD.t5==null&&tick-BD.t0>=320){ var cts=bots.filter(function(o){ return o.team==='CT'&&o.alive; });
   BD.t5=tick; BD.state5=bomb.state; BD.call5=ct.call?ct.call.site:null; BD.watch=(ct.bombWatch&&ct.bombWatch.id)?ct.bombWatch.id:null;
   BD.eyes=cts.filter(function(o){ return Math.hypot(o.x-BD.x,o.y-BD.y)<1000&&hasVision(o.x,o.y,BD.x,BD.y); }).length;
   BD.near=cts.filter(function(o){ return Math.hypot(o.x-BD.x,o.y-BD.y)<900; }).length; BD.cts=cts.length;
   BD.dist=cts.map(function(o){ return Math.round(Math.hypot(o.x-BD.x,o.y-BD.y)); }).sort(function(a,c){ return a-c; }); }
  if(BD&&BD.pick==null&&bomb.state==='carried') BD.pick=tick-BD.t0;
 })();
 if(bomb.state==='planted' && cur && cur.plant==null){ cur.plant=tick; cur.site=bomb.site; REC.plants.push([tick, bomb.site, Math.round(bomb.x), Math.round(bomb.y)]); }

 if(roundState==='live') bots.forEach(function(b){ var V=b.alive?(b._visible||[]):[], now={}; V.forEach(function(v){ now[v.id]=1; if(!(SEEN[b.id]||{})[v.id]) REC.see.push([tick, b.id, v.id, Math.round(Math.hypot(v.x-b.x,v.y-b.y))]); }); SEEN[b.id]=now; });
 if(roundState==='live') bots.forEach(function(b){ var ph=b.alive&&b._fc?b._fc.ph:''; if((FCP[b.id]||'')!==ph){ var e=b._fc&&b._fc.e; REC.fc.push([tick, b.id, FCP[b.id]||'', ph, e?e.id:'', e?Math.round(Math.hypot(e.x-b.x,e.y-b.y)):0, e&&e.alive?1:0, b._sawEnemy?1:0, Math.round(b.hp), (tick-(b._fcWhyT||-9)<=1)?b._fcWhy:'']); FCP[b.id]=ph; }
   var tg=b.alive&&b.post?String(b.post.tag):''; if((TKP[b.id]||'')!==tg){ REC.task.push([tick, b.id, tg]); TKP[b.id]=tg; } });
 if(roundState==='live') bots.forEach(function(b){ if(!b.alive) return;
   if(b._jump&&b._jump.t===tick&&REC.jump.length<20000) REC.jump.push([tick, b.id, Math.round(b.x), Math.round(b.y), Math.round(b.z||0), b._jump.up?1:0, b._jc?1:0, b.post?String(b.post.tag):'']);
   if(b.atPost&&!ATP[b.id]&&b.post&&b.z!=null){ var fz=visFloorAt(b.post.x,b.post.y,null); if(Math.abs(fz-b.z)>40) REC.arrive.push([tick, b.id, String(b.post.tag), Math.round(b.z), Math.round(fz)]); } ATP[b.id]=!!b.atPost;
   if(b.defusing&&!DFP[b.id]) REC.defst.push([tick, b.id, (bomb.retake&&bomb.retake.defId)||'']); DFP[b.id]=!!b.defusing;
   var bu=b.blindUntil||0; if(bu>tick&&bu>(BLP[b.id]||0)+8) REC.blind.push([tick, b.id, Math.round((bu-tick)/TICK_HZ*10)/10, b._blindBy||'']); BLP[b.id]=bu; });
 if(tick%32===0 && roundState==='live') bots.forEach(function(b){ if(b.alive) REC.act.push([tick, b.id, b.post?String(b.post.tag):'', b.state||'', b._fc?b._fc.ph:'', tick<(b.blindUntil||0)?1:0, b.crouching?1:0, b.atPost?1:0, b._walkWhy||'', b._runWhy||'', b._stopWhy||'', (tick-(b._stateWhyT||-99)<32)?b._stateWhy:'', b.lookReason||'', b._lookLvl||0, b._contact?(String(b._contact.tag||'')+'>'+(b._contact.id||'')):'']); });
 if(tick%32===0 && roundState==='live' && typeof teamTac!=='undefined' && teamTac.CT){ var CC=teamTac.CT.call, GO=teamTac.CT.go; REC.ctcall.push([tick, CC?CC.site:'', CC?Math.round(CC.count*100)/100:0, CC?Math.round((tick-(CC.evTick||CC.tick))/6.4)/10:-1, (GO&&CC&&GO.site===CC.site)?1:0, Object.keys(teamTac.CT.rot||{}).length, teamTac.CT.saving?1:0]);
   var cid=teamIntel.CT&&teamIntel.CT.carrierId; if(cid && typeof knowEnemySpots==='function'){ REC.carh.push([tick, cid, (knowEnemySpots('CT',cid)||[]).slice().sort(function(a,c){ return c.w-a.w; }).slice(0,3).map(function(q){ return [Math.round(q.x),Math.round(q.y),Math.round(q.w*100)/100]; })]); } }   // (22.11, аудит 046) колл CT и гипотезы о носителе
 if(tick%64===0 && roundState==='live' && typeof beliefCount==='function' && typeof BZ!=='undefined' && BZ.ids){ var ALLZ=[]; for(var zi=0; zi<BZ.ids.length; zi++) ALLZ.push(zi); ['CT','T'].forEach(function(tm){ REC.bsum.push([tick, tm, Math.round(beliefCount(tm, ALLZ)*100)/100, bots.filter(function(o){ return o.alive&&o.team!==tm; }).length]); }); }   // (22.11, аудит 011) карта команды против живых   // (13.11) + причина и уровень взгляда (В132 п.1)
 if(cur && typeof teamTac!=='undefined' && teamTac.T){ if(cur.lowPlan===undefined) cur.lowPlan=teamTac.T.lowPlan||null; if(cur.exec==null && teamTac.T.execStart!=null) cur.exec=teamTac.T.execStart; }
 if(tick%16===0){ REC.hp=REC.hp||[]; bots.forEach(function(b){ if(b.alive) REC.hp.push([tick, b.id, b.hp]); }); }   // (v373) HP — для сравнения раскладов с про
 if(tick%16===0) bots.forEach(function(b){ REC.pos.push([tick, b.id, b.team==='CT'?1:0, Math.round(b.x), Math.round(b.y), b.alive?1:0, Math.round((b.facing||0)*100)/100, b.weapon?b.weapon.key:'', b._knife?1:0]); });
 bots.forEach(function(b){ if(!b.alive){ delete H[b.id]; return; } REC.jit.alive++;
  var h=H[b.id]||(H[b.id]={p:[],f:[]}); h.p.push([b.x,b.y]); h.f.push(b.facing||0); if(h.p.length>12){h.p.shift();h.f.shift();} if(h.p.length<12) return;
  var a=h.p[0],m=h.p[5],c=h.p[11], v1x=m[0]-a[0],v1y=m[1]-a[1],v2x=c[0]-m[0],v2y=c[1]-m[1], l1=Math.hypot(v1x,v1y),l2=Math.hypot(v2x,v2y);
  if(l1>5&&l2>5&&(v1x*v2x+v1y*v2y)/(l1*l2)<-0.6){
    var group=b._sawEnemy?'Eng':!b.post?'Idle':'Other';
    REC.jit['move'+group]++;
    REC.jit.ev.push([group.toLowerCase(),tick,b.id,Math.round(b.x),Math.round(b.y),b.post?b.post.tag:'']);
    h.p=[]; h.f=[]; return;
  }
  var d1=h.f[5]-h.f[0], d2=h.f[11]-h.f[5]; d1=Math.atan2(Math.sin(d1),Math.cos(d1)); d2=Math.atan2(Math.sin(d2),Math.cos(d2));
  if(!b._sawEnemy&&Math.abs(d1)>0.87&&Math.abs(d2)>0.87&&d1*d2<0){ REC.jit.look++; REC.jit.ev.push(['look',tick,b.id,Math.round(b.x),Math.round(b.y),b.post?b.post.tag:'']); h.p=[]; h.f=[]; }
 });
}
if(typeof WATCH!=='undefined') REC.watch=WATCH.report(true);
// (Р3.6, владелец 26.11) причины всех увеличений счётчиков ошибок движения — полный журнал матча (событие, причина stall.*, след решения)
if(typeof PROB!=='undefined' && PROB.all) REC.prob=PROB.all.map(function(e){ return [e.tick, e.id, e.kind, e.sub||null, e.text, e.x, e.y, e.round, e.why||null, e.seq == null ? null : e.seq, e.ep||null, e.facts||null]; });
REC.match=M0; REC.ticks=tick; REC.finished=matchNum===M0 && roundState==='matchover'; if(typeof VOICE_STATS!=='undefined') REC.voice=VOICE_STATS;
/*@@FP_FINISH@@*/
JSON.stringify(REC)
