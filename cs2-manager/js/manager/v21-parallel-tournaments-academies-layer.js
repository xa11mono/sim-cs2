
(() => {
  'use strict';

  const V21_VERSION = 1;
  const V21_T2_COUNT = 18;
  const V21_T3_COUNT = 18;
  const V21_ACADEMY_COUNT = 8;
  const V21_DAY = 24*60*60*1000;
  const V21_SLOT_MIN = 10;

  const V21_ACADEMIES = [
    {name:'Spirit Academy', parent:'Team Spirit', pts:245, flag:'🇷🇺', language:'Russian', roster:['VILBy','Kiryasoo','Netrix','s1nside','k0gaSs'], coach:'Flash_1'},
    {name:'NAVI Junior', parent:'NAVI', pts:225, flag:'🇺🇦', country:'UA', language:'English', roster:['MahaR','FAZERY','skizzyee','yoki','kodak'], coach:'snatchie'},
    {name:'G2 Ares', parent:'G2', pts:215, flag:'🇪🇺', language:'English', roster:['SHiNE','hitori','Junyme','yksjupe','kl1m'], coach:'innersh1ne'},
    {name:'MOUZ NXT', parent:'MOUZ', pts:205, flag:'🇪🇺', language:'English', roster:['opdust','ay0k','Nikodeon','eSx','mixer'], coach:'lmbt'},
    // v33: ещё семь академий; составы — молодые игроки, которых генерирует игра (реальных данных о юниорах нет)
    {name:'Astralis Talent', parent:'Astralis', pts:200, flag:'🇩🇰', country:'DK', language:'Danish', coach:'—'},
    {name:'HEROIC Academy', parent:'HEROIC', pts:190, flag:'🇩🇰', country:'DK', language:'Danish', coach:'—'},
    {name:'FURIA Academy', parent:'FURIA', pts:195, flag:'🇧🇷', country:'BR', language:'Portuguese', coach:'—'},
    {name:'Falcons Force', parent:'Team Falcons', pts:210, flag:'🇸🇦', countries:['SA','DK','SE','FI','EE'], language:'English', coach:'—'},
    {name:'BIG Academy', parent:'BIG', pts:180, flag:'🇩🇪', country:'DE', language:'German', coach:'—'},
    {name:'fnatic Rising', parent:'fnatic', pts:175, flag:'🇬🇧', countries:['GB','SE','DK','PL'], language:'English', coach:'—'},
    {name:'paiN Academy', parent:'paiN', pts:170, flag:'🇧🇷', country:'BR', language:'Portuguese', coach:'—'}
  ];
  // уникальные ники для юниоров: слоги, без совпадений с уже существующими игроками
  function v33YouthNicks(seed, n){
    const A=['zy','kr','v','sh','n','bl','r','fl','x','dr','j','st','k','qu','m','tr','h','sk','l','gr'], B=['a','e','i','o','u','y','ai','ex','ix','on','an','er'], C=['n','x','k','z','r','ss','nt','kk','lo','ro','ne','ze','ka','ty','yx','th','1x','0n','v1','ky'];
    const taken=new Set(teams.flatMap(t=>(t.players||[]).map(p=>String(p.nick).toLowerCase())).concat((transferState.freeAgents||[]).map(p=>String(p.nick).toLowerCase())));
    const mix=x=>{ x=Math.imul(x^(x>>>16),0x45d9f3b); x=Math.imul(x^(x>>>16),0x45d9f3b); return (x^(x>>>16))>>>0; };
    const out=[]; for(let i=0;out.length<n&&i<500;i++){ const h=mix(hashTeamName(seed+':'+i)+i*0x9e3779b9); let s=A[h%A.length]+B[(h>>>5)%B.length]+C[(h>>>10)%C.length]; if((h>>>15)%3===0) s=s[0].toUpperCase()+s.slice(1); if(!taken.has(s.toLowerCase())){ taken.add(s.toLowerCase()); out.push(s); } }
    return out;
  }
  const V21_T2_NAMES = ['CCT Europe Series','European Pro League','ESL Challenger','RES Regional Championship','United21 League','Thunderpick Regional Cup','YaLLa Compass Contenders','Pinnacle Regional Masters','CCT Online Europe'];
  const V21_T3_NAMES = ['CCT Rising Series','United21 Division','Open Challenger Cup','Rookie Clash','European Pro League 2nd Division','Future Stars Cup','Regional Academy Cup','Grassroots CS2 Cup','Entry League'];
  const V21_ACADEMY_NAMES = ['European Academy League','Academy Cup Europe','CCT Academy Series','Young Guns Championship','MOUZ Academy Invitational','Rising Academy League','Prospects Clash','Academy Open'];

  function v21Esc(s){ return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function v21Clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function v21Cal(){ try{return typeof v15EnsureCalendar==='function'?v15EnsureCalendar():seasonState.calendar||(seasonState.calendar={});}catch(e){return seasonState.calendar||(seasonState.calendar={});} }
  function v21Now(){ return Number(v21Cal().currentMs)||Date.now(); }
  function v21Ceil10(ms){ const d=new Date(Number(ms)||v21Now()); d.setSeconds(0,0); const m=d.getMinutes(); d.setMinutes(m+((V21_SLOT_MIN-(m%V21_SLOT_MIN))%V21_SLOT_MIN),0,0); return d.getTime(); }
  function v21YearStart(){ return new Date(2026+(Number(seasonState.currentSeason||1)-1),0,2,9,0,0,0).getTime(); }
  function v21NormalizeState(){
    if(!seasonState || typeof seasonState!=='object') return;
    seasonState.maxTournaments=9999;
    if(!Array.isArray(seasonState.parallelSchedule)) seasonState.parallelSchedule=[];
    if(!seasonState.parallelState || typeof seasonState.parallelState!=='object') seasonState.parallelState={version:V21_VERSION,lastRunMs:0};
  }

  function v21MakeAcademyTeam(def){
    if(teams.some(t=>t.name===def.name)) return;
    if(def.parent && !teams.some(t=>t.name===def.parent && !t.isAcademy)) return;   // академия только при основной команде в пуле
    if(!def.roster){ const R=window.V33Reserve, cs=def.countries||(def.country?[def.country]:null), real=[]; if(R) for(let i=0;i<5;i++){ const x=R.take({countries:cs,max:66,young:true})||R.take({countries:cs,young:true}); if(x) real.push(x); } def=Object.assign({},def,{roster:real.length===5?real.map(x=>x.nick):v33YouthNicks(def.name,5),_real:real.length===5?real:null}); }
    const t={name:def.name,pts:def.pts,style:'Tactical',maps:generateMapStats(),mapStats:{},mapStatsVersion:2,mapHistory:[],history:[],streak:0,form:100,fatigue:0,prevRank:null,lastBootcampSeason:0,trophies:{majors:0,elite:0,regular:0,grandFinalsWon:0},activeModifier:null,seasonStartRank:null,seasonChampionships:0,players:[],coach:{name:def.coach,flag:def.flag},playerLayerVersion:PLAYER_LAYER_VERSION,rosterLastChange:null,tempStandIn:null,isAcademy:true,academyParent:def.parent,academyLanguage:def.language};
    MAP_POOL.forEach(m=>{ const wr=Number(t.maps[m])||50; const wins=Math.round(20*wr/100); t.mapStats[m]={wins,losses:20-wins}; });
    t.players=def.roster.map((nick,idx)=>{ const p=createPlayerFromNick(t,nick,idx); p.status='STARTER'; p.country=(def._real&&def._real[idx]?def._real[idx].country:'')||(PLAYER_META_2026[nick]||{}).country||def.country||(def.countries?def.countries[idx%def.countries.length]:(def.flag==='🇷🇺'?'RU':'')); p.language=def.language; p.flag=p.country?countryFlag(p.country):def.flag; if(!def.roster0) p.age=p.age||(17+(hashTeamName(nick)%3)); p.form=v21Clamp(Number(p.form)||100,88,108); return p; });
    ensurePlayerLayer(t);
    TEAM_REGION_FLAG[def.name]=def.flag;
    TEAM_ROSTER_2026[def.name]=def.roster.slice();
    teams.push(t);
  }
  function v21EnsureAcademies(){ V21_ACADEMIES.forEach(v21MakeAcademyTeam); }

  function v21EligiblePool(kind){
    v21EnsureAcademies();
    const ac=teams.filter(t=>t.isAcademy);
    const base=teams.filter(t=>!t.isAcademy);
    if(kind==='academy') return ac.slice();
    const sorted=base.slice().sort((a,b)=>b.pts-a.pts);
    if(kind==='tier2') return [...sorted.slice(7,30),...ac].sort((a,b)=>b.pts-a.pts).slice(0,18);
    return [...sorted.slice(18),...ac].sort((a,b)=>b.pts-a.pts).slice(0,18);
  }

  function v21PickParticipants(kind, seed, n, busy){
    let pool=v21EligiblePool(kind);
    if(busy&&busy.size){
      pool=pool.filter(t=>!busy.has(t.name));
      if(kind!=='academy'&&pool.length<(n||8)+2){ const top=new Set(teams.filter(t=>!t.isAcademy).sort((a,b)=>b.pts-a.pts).slice(0,7).map(t=>t.name)); teams.filter(t=>!top.has(t.name)&&!busy.has(t.name)&&!pool.includes(t)).forEach(t=>pool.push(t)); }
    }
    if(!pool.length) return [];
    let count=n||(kind==='academy'?4:8);
    if(pool.length<count) count=pool.length;
    const arr=pool.slice().sort((a,b)=>((hashTeamName(a.name)+seed)%997)-((hashTeamName(b.name)+seed)%997));
    if(kind==='academy') return arr.slice(0,Math.min(count,arr.length));
    // Keep academies visible in Tier-2/3, but never let them fill the whole field.
    const academy=arr.filter(t=>t.isAcademy).slice(0,2);
    const rest=arr.filter(t=>!t.isAcademy).slice(0,count-academy.length);
    return [...academy,...rest].slice(0,count);
  }

  function v21BuildParallelSchedule(){
    v21NormalizeState();
    const year=2026+(Number(seasonState.currentSeason||1)-1);
    const anchor=new Date(year,0,2,9,0,0,0).getTime();
    const events=[];
    const push=(tier,kind,name,dayOffset,durationDays,idx)=>{
      const start=new Date(anchor+dayOffset*V21_DAY); start.setHours(kind==='academy'?10:tier==='3'?12:14,0,0,0);
      const startMs=start.getTime();
      const fmt=v22Fmt(kind,tier,idx);
      const ev={
        id:`S${seasonState.currentSeason}-${tier}-${idx}-${hashTeamName(name+dayOffset)}`,
        season:seasonState.currentSeason, year, tier, kind, name:`${name} ${year}`, fieldProfile:tier==='2'?'medium':'weak',
        startMs,endMs:startMs+durationDays*V21_DAY, prize:tier==='2'?50000:(kind==='academy'?25000:15000),
        pointsMult:tier==='2'?0.35:(kind==='academy'?0.18:0.12), participants:[], format:fmt,
        status:'scheduled', currentRound:0, matches:[], results:[], standings:[], winner:null, nextRoundAt:startMs+30*60000,
        academyOnly:kind==='academy', initialized:false, completedAt:0
      };
      events.push(ev);
    };
    for(let i=0;i<V21_T2_COUNT;i++) push('2','tier2',V21_T2_NAMES[i%V21_T2_NAMES.length],8+i*18,2+(i%3===0?1:0),i);
    for(let i=0;i<V21_T3_COUNT;i++) push('3','tier3',V21_T3_NAMES[i%V21_T3_NAMES.length],4+i*11,2+(i%4===0?1:0),100+i);
    for(let i=0;i<V21_ACADEMY_COUNT;i++) push('2','academy',V21_ACADEMY_NAMES[i%V21_ACADEMY_NAMES.length],6+i*42,2,200+i);
    events.sort((a,b)=>a.startMs-b.startMs);
    try{ v22Assign(events,[]); }catch(e){ console.warn('[v23] assign',e); }
    seasonState.parallelSchedule=events;
    seasonState.parallelState={version:V21_VERSION,lastRunMs:v21Now(),v23:true};
    try{saveSeasonState();}catch(e){}
  }

  function v21BgOdds(a,b){
    const ea=(Number(a.pts)||500)*(Number(a.form||100)/100)*(1-(Number(a.fatigue)||0)*0.006);
    const eb=(Number(b.pts)||500)*(Number(b.form||100)/100)*(1-(Number(b.fatigue)||0)*0.006);
    const d=ea-eb; const p=1/(1+Math.pow(10,-d/1150));
    return v21Clamp(p,0.18,0.82);
  }
  function v21SimSeries(a,b){
    if(!a||!b) return null;
    const p=v21BgOdds(a,b); let aw=0,bw=0;
    for(let map=0;map<3 && aw<2 && bw<2;map++){ const pa=v21Clamp(p + ((Number(a.maps?.[MAP_POOL[map]])||50)-(Number(b.maps?.[MAP_POOL[map]])||50))/800,-0.12,0.12); if(Math.random()<pa) aw++; else bw++; }
    return {winner:aw>bw?a.name:b.name,loser:aw>bw?b.name:a.name,score:`${Math.max(aw,bw)}-${Math.min(aw,bw)}`};
  }
  function v21ApplyBgMatch(a,b,winner,ev){
    [a,b].forEach(t=>{ ensurePlayerLayer(t); t.players.forEach(p=>{ p.fatigue=v21Clamp(Number(p.fatigue||0)+1.0,0,100); p.form=v21Clamp(Number(p.form||100)+(t.name===winner?0.08:-0.05),80,120); p.morale=v21Clamp(Number(p.morale||90)+(t.name===winner?0.25:-0.15),45,100); }); ensurePlayerLayer(t); t.streak = t.name===winner ? Math.max(0,Number(t.streak||0))+1 : Math.min(0,Number(t.streak||0))-1; });
    const loser=b.name===winner?b:a;
    const winTeam=a.name===winner?a:b;
    const bonus=Math.max(1,Math.round(2*ev.pointsMult));
    winTeam.pts=Math.min(2000,Number(winTeam.pts||500)+bonus);
    loser.pts=Math.max(50,Number(loser.pts||500)-Math.max(0,Math.round(ev.pointsMult)));
    try{ recordMapResult(a.name,b.name,MAP_POOL[Math.floor(Math.random()*MAP_POOL.length)],winner,ev.name,'', 'Фоновый матч'); }catch(e){}
  }
  // ===== v22: реальные сетки Tier-2/3 и академий (single/double/swiss/gsl), привязанные к игровому календарю =====
  const V22_RESOLVE_MIN=150, V22_SLOT_MIN=180, V22_PER_DAY=3;
  const V22_FMT_LABEL={single:'Single Elim',double:'Double Elim',swiss:'Swiss',gsl:'GSL Groups'};
  function v22Names(arr){ return (arr||[]).map(x=>typeof x==='string'?x:x.name); }
  function v22Fmt(kind,tier,idx){ if(kind==='academy') return ['single','gsl','double'][idx%3]; return ['single','double','swiss','gsl'][(idx+(tier==='2'?0:2))%4]; }
  function v22Size(kind,fmt,tier){ if(kind==='academy') return teams.filter(t=>t.isAcademy).length>=8?8:4; return (tier==='3'&&(fmt==='single'||fmt==='swiss'))?16:8; }
  function v22Idx(br){ const o={}; br.matches.forEach(m=>{o[m.id]=m;}); return o; }
  function v22Fill(br,ix){ br.matches.forEach(m=>{ ['1','2'].forEach(k=>{ if(m['t'+k]) return; const s=m['s'+k]||{}; if(s.w&&ix[s.w]&&ix[s.w].w) m['t'+k]=ix[s.w].w; else if(s.l&&ix[s.l]&&ix[s.l].l) m['t'+k]=ix[s.l].l; }); }); }
  function v22Fmtd(ms){ const d=new Date(ms); return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }

  function v22BuildBracket(ev){
    const all=v22Names(ev.participants);
    const seeds=all.map(n=>teams.find(t=>t.name===n)).filter(Boolean).sort((a,b)=>b.pts-a.pts).map(t=>t.name);
    let n=seeds.length>=16?16:seeds.length>=8?8:seeds.length>=4?4:0;
    if(ev.format!=='single'&&ev.format!=='swiss'&&n>8) n=8;
    if(ev.format==='double'&&n<4) n=0;
    seeds.length=n; ev.participants=seeds.slice();
    const br={format:ev.format,rounds:[],matches:[],swiss:ev.format==='swiss',final:null};
    ev.br=br; ev.results=[]; ev.matches=[]; ev.winner=null; ev.standings=[]; ev.initialized=true;
    if(!n){ ev.status='completed'; ev.completedAt=Date.now(); return; }
    const T=t=>({t}),W=w=>({w}),L=l=>({l});
    const add=(id,grp,rname,wave,s1,s2)=>{ let r=br.rounds.find(x=>x.name===rname&&x.grp===grp); if(!r){ r={name:rname,grp,wave,ids:[]}; br.rounds.push(r); }
      br.matches.push({id,r:br.rounds.indexOf(r),wave,s1,s2,t1:s1.t||null,t2:s2.t||null,w:null,l:null,sc:'',at:0}); r.ids.push(id); return id; };
    const rn=s=>s===1?'Финал':s===2?'Полуфинал':`1/${s} финала`;
    const f=ev.format;
    if(f==='single'){
      let size=n/2,wave=0,cur=[]; for(let k=0;k<size;k++) cur.push(add(`s0_${k}`,'',rn(size),0,T(seeds[k]),T(seeds[n-1-k])));
      while(size>1){ size/=2; wave++; const nx=[]; for(let k=0;k<size;k++) nx.push(add(`s${wave}_${k}`,'',rn(size),wave,W(cur[2*k]),W(cur[2*k+1]))); cur=nx; }
      br.finalId=cur[0];
    } else if(f==='double'){
      const UB='Верхняя сетка',LB='Нижняя сетка',GF='Финал';
      if(n>=8){
        const u1=[0,1,2,3].map(k=>add(`u1_${k}`,UB,'UB R1',0,T(seeds[k]),T(seeds[7-k])));
        const u2=[0,1].map(k=>add(`u2_${k}`,UB,'UB Полуфинал',1,W(u1[2*k]),W(u1[2*k+1])));
        const l1=[0,1].map(k=>add(`l1_${k}`,LB,'LB R1',1,L(u1[2*k]),L(u1[2*k+1])));
        const l2=[0,1].map(k=>add(`l2_${k}`,LB,'LB R2',2,W(l1[k]),L(u2[1-k])));
        const uf=add('uf',UB,'UB Финал',2,W(u2[0]),W(u2[1]));
        const l3=add('l3',LB,'LB R3',3,W(l2[0]),W(l2[1]));
        const lf=add('lf',LB,'LB Финал',4,W(l3),L(uf));
        br.finalId=add('gf',GF,'Гранд-финал',5,W(uf),W(lf));
      } else {
        const u1=[0,1].map(k=>add(`u1_${k}`,UB,'UB Полуфинал',0,T(seeds[k]),T(seeds[3-k])));
        const uf=add('uf',UB,'UB Финал',1,W(u1[0]),W(u1[1]));
        const l1=add('l1',LB,'LB R1',1,L(u1[0]),L(u1[1]));
        const lf=add('lf',LB,'LB Финал',2,W(l1),L(uf));
        br.finalId=add('gf',GF,'Гранд-финал',3,W(uf),W(lf));
      }
    } else if(f==='gsl'){
      const groups=n>=8?[[0,3,4,7],[1,2,5,6]]:[[0,1,2,3]], gid=[];
      groups.forEach((g,gi)=>{ const G='Группа '+'AB'[gi], tt=g.map(i=>seeds[i]);
        const o1=add(`g${gi}o1`,G,'Открытие',0,T(tt[0]),T(tt[3])), o2=add(`g${gi}o2`,G,'Открытие',0,T(tt[1]),T(tt[2]));
        const wn=add(`g${gi}w`,G,'Победителей',1,W(o1),W(o2)), el=add(`g${gi}e`,G,'Элиминация',1,L(o1),L(o2));
        const dc=add(`g${gi}d`,G,'Decider',2,L(wn),W(el)); gid.push({wn,dc}); });
      if(n>=8){ const a=add('ps1','Плей-офф','Полуфинал',3,W(gid[0].wn),W(gid[1].dc)), b=add('ps2','Плей-офф','Полуфинал',3,W(gid[1].wn),W(gid[0].dc)); br.finalId=add('pf','Плей-офф','Финал',4,W(a),W(b)); }
      else br.finalId=add('pf','Плей-офф','Финал',3,W(gid[0].wn),W(gid[0].dc));
    } else {
      const R=Math.round(Math.log2(n));
      for(let r=0;r<R;r++) for(let k=0;k<n/2;k++) add(`w${r}_${k}`,'Швейцарка','Тур '+(r+1),r,r===0?T(seeds[k]):{sw:1},r===0?T(seeds[n/2+k]):{sw:1});
      ev.standings=seeds.map(t=>({team:t,wins:0,losses:0,pts:0}));
    }
    // Слоты: пары матчей одной волны стартуют одновременно; новая волна — только после полного слота предыдущей.
    br.matches.sort((a,b)=>a.wave-b.wave);
    let slot=0,lastWave=-1,inSlot=0;
    br.matches.forEach(m=>{ if(m.wave!==lastWave){ if(lastWave!==-1&&inSlot>0) slot++; inSlot=0; lastWave=m.wave; } if(inSlot===2){ slot++; inSlot=0; }
      m.at=ev.startMs+Math.floor(slot/V22_PER_DAY)*V21_DAY+(slot%V22_PER_DAY)*V22_SLOT_MIN*60000; inSlot++; });
    ev.endMs=Math.max(...br.matches.map(m=>m.at))+V22_SLOT_MIN*60000;
    ev.nextRoundAt=ev.startMs; ev.status='scheduled';
  }
  function v22Migrate(ev){
    if(!ev.format) ev.format=v22Fmt(ev.kind,ev.tier,Number(String(ev.id).split('-')[2])||0);
    const need=v22Size(ev.kind,ev.format,ev.tier); ev.participants=v22Names(ev.participants).slice(0,need);
    ev.status='scheduled'; ev.completedAt=0; v22BuildBracket(ev);
  }
  function v22SwissPair(ev,ix,m){
    const rd=ev.br.rounds[m.r]; if(rd.paired) return; rd.paired=true;
    const played=new Set(ev.br.matches.filter(x=>x.w).map(x=>[x.t1,x.t2].sort().join('|')));
    const left=ev.standings.slice().sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.pts-a.pts).map(x=>x.team), pairs=[];
    while(left.length>1){ const a=left.shift(); let j=left.findIndex(b=>!played.has([a,b].sort().join('|'))); if(j<0) j=0; pairs.push([a,left.splice(j,1)[0]]); }
    rd.ids.forEach((id,i)=>{ if(pairs[i]){ ix[id].t1=pairs[i][0]; ix[id].t2=pairs[i][1]; } });
  }
  function v22Finish(ev,now){
    const br=ev.br; ev.status='completed'; ev.completedAt=now;
    const wins={},loss={}; br.matches.forEach(m=>{ if(m.w&&m.l&&m.sc!=='w/o'){ wins[m.w]=(wins[m.w]||0)+1; loss[m.l]=(loss[m.l]||0)+1; } });
    let order;
    if(br.swiss){ ev.standings.sort((a,b)=>b.pts-a.pts||b.wins-a.wins||a.losses-b.losses); order=ev.standings.map(x=>x.team); }
    else { const f=v22Idx(br)[br.finalId]||{};
      order=ev.participants.slice().sort((a,b)=>(a===f.w?-1:b===f.w?1:a===f.l?-1:b===f.l?1:0)||((wins[b]||0)-(wins[a]||0))||((loss[a]||0)-(loss[b]||0)));
      ev.standings=order.map(t=>({team:t,wins:wins[t]||0,losses:loss[t]||0,pts:(wins[t]||0)*3})); }
    ev.winner=order[0]; ev.placements=order;
    if (typeof window.hubArchiveParallel === 'function') {
      try { window.hubArchiveParallel(ev); } catch (e) { console.warn('[HLTV Hub] parallel archive failed', e); }
    }
    const hubArchiveId = 'P-' + ev.id;
    order.forEach((name,i)=>{ const t=teams.find(x=>x.name===name); if(!t) return; t.history=t.history||[];
      const award=i===0?Math.round(12*ev.pointsMult):0; if(award) t.pts=Math.min(2000,Number(t.pts||0)+award);
      t.history.unshift({tournament:ev.name,season:ev.season,place:i+1,placeTitle:i===0?'🏆 Фоновый турнир':'Фоновый турнир',fieldProfile:ev.fieldProfile,delta:award,archiveId:hubArchiveId}); });
  }
  function v22Advance(ev,now){
    const br=ev.br, ix=v22Idx(br); let ch=false;
    for(const m of br.matches){
      if(m.w) continue;
      if(now<m.at+V22_RESOLVE_MIN*60000) break;
      if(br.swiss&&!m.t1) v22SwissPair(ev,ix,m);
      v22Fill(br,ix);
      if(!m.t1||!m.t2){ m.w=m.t1||m.t2||'—'; m.l='—'; m.sc='w/o'; ch=true; continue; }
      const a=teams.find(t=>t.name===m.t1), b=teams.find(t=>t.name===m.t2);
      if(!a||!b){ m.w=a?m.t1:m.t2; m.l=a?m.t2:m.t1; m.sc='w/o'; ch=true; continue; }
      try{ const q=calcMatchOdds(m.t1,m.t2,false); if(q) m.o={c1:q.c1,c2:q.c2,p1:q.pct1,p2:q.pct2}; }catch(e){}
      const res=v22Series(a,b);
      m.w=res.winner; m.l=res.loser; m.sc=res.score; m.maps=res.maps; ch=true;
      if(br.swiss){ const sw=ev.standings.find(x=>x.team===m.w), sl=ev.standings.find(x=>x.team===m.l); if(sw){sw.wins++;sw.pts+=3;} if(sl) sl.losses++; }
      v21ApplyBgMatch(a,b,res.winner,ev);
      ev.results.unshift({round:m.r+1,at:m.at,t1:m.t1,t2:m.t2,winner:m.w,loser:m.l,score:m.sc});
    }
    v22Fill(br,ix);
    if(!ev.winner&&br.matches.length&&br.matches.every(m=>m.w)){ v22Finish(ev,now); ch=true; }
    return ch;
  }
  let v22OpenId=null, v22Sig='';
  function v21ProcessParallel(now){
    v21NormalizeState(); if(!seasonState.parallelSchedule.length) v21BuildParallelSchedule();
    let changed=false;
    if(!seasonState.parallelState.v23){
      const evs=seasonState.parallelSchedule.filter(e=>e.season===seasonState.currentSeason);
      const fixed=evs.filter(e=>e.status==='live'||e.status==='completed'||now>=e.startMs);
      const flex=evs.filter(e=>!fixed.includes(e)).sort((a,b)=>a.startMs-b.startMs);
      flex.forEach(e=>{ if(!e.format) e.format=v22Fmt(e.kind,e.tier,Number(String(e.id).split('-')[2])||0); e.participants=v22Names(e.participants); });
      try{ v22Assign(flex,fixed); }catch(e){ console.warn('[v23] reassign',e); }
      seasonState.parallelState.v23=true; changed=true;
    }
    for(const ev of seasonState.parallelSchedule){
      if(ev.season!==seasonState.currentSeason||ev.status==='completed') continue;
      if(!ev.br){ v22Migrate(ev); changed=true; }
      if(now<ev.startMs) continue;
      if(ev.status==='scheduled'){ try{ v22SwapBusy(ev); }catch(e){ console.warn('[v23] swap',e); } ev.status='live'; changed=true; }
      if(ev.status==='completed') continue;
      if(v22Advance(ev,now)) changed=true;
    }
    seasonState.parallelState.lastRunMs=now;
    if(changed){ try{saveTeams();saveSeasonState();renderRating();}catch(e){} }
    v21RenderSwitcher();
    if(v22OpenId&&document.getElementById('v21-parallel-modal')?.classList.contains('open')) v21OpenTournament(v22OpenId,true);
  }
  function v22Progress(e){ const ms=e.br?.matches||[]; return `${ms.filter(m=>m.w).length}/${ms.length} матчей`; }
  // В таблице «Турниры сейчас» — только основной турнир и реально идущие параллельные. Остальные смотрим в календаре.
  function v21CurrentItems(){
    const arr=[]; const now=v21Now();
    if(currentTournament&&!currentTournament.completed){ const run=!!currentTournament.broadcast?.running; arr.push({main:true,id:'main',name:currentTournament.name,tier:'1',status:run?'live':'scheduled',meta:run?'Эфир идёт • основной турнир':'Основной турнир • ожидание слота'}); }
    (seasonState.parallelSchedule||[]).filter(e=>e.season===seasonState.currentSeason&&e.status==='live'&&now>=e.startMs).forEach(e=>arr.push({id:e.id,name:e.name,tier:e.kind==='academy'?'academy':e.tier,status:'live',meta:`${V22_FMT_LABEL[e.format]||''} • ${v22Progress(e)}`}));
    return arr;
  }
  function v21RenderSwitcher(){
    const box=document.getElementById('v21-ts-list'), count=document.getElementById('v21-ts-count'); if(!box) return;
    const items=v21CurrentItems(); if(count) count.textContent=`${items.length} идут сейчас`;
    if(!items.length){ const now=v21Now(); const nx=(seasonState.parallelSchedule||[]).filter(e=>e.season===seasonState.currentSeason&&e.startMs>now).sort((a,b)=>a.startMs-b.startMs)[0];
      box.innerHTML=`<div style="font-size:8px;color:var(--text-muted);padding:4px;">Параллельных турниров сейчас нет${nx?` • ближайший: ${v21Esc(nx.name)} (${v22Fmtd(nx.startMs)})`:''}. Всё расписание — в календаре.</div>`; return; }
    box.innerHTML=items.map(x=>{ const live=x.status==='live', dot=x.tier==='2'?'t2':x.tier==='3'?'t3':x.tier==='academy'?'academy':'';
      return `<div class="v21-ts-card ${live?'live':''} ${x.main?'focus':''}"><span class="v21-ts-dot ${dot} ${live?'live':''}"></span><div class="v21-ts-main"><div class="v21-ts-name">${v21Esc(x.name)}</div><div class="v21-ts-meta">${v21Esc(x.meta)}</div></div><button type="button" class="secondary v21-ts-open" onclick="v21OpenTournament('${x.id}')">${x.main?'Фокус':'Открыть'}</button></div>`; }).join('');
  }
  // ===== v23: без двойных участий, реальные детали матчей, ремонт расписания Tier-1 =====
  function v22Sod(ms){ const d=new Date(ms); d.setHours(0,0,0,0); return d.getTime(); }
  function v22Tier1Windows(){
    const idx=Number(seasonState.tournamentIndex)||1;
    return (seasonState.seasonSchedule||[]).map((s,i)=>(s&&s.calendar&&s.calendar.startMs&&i>=idx)?[s.calendar.startMs-V21_DAY,(s.calendar.endMs||s.calendar.startMs+4*V21_DAY)+V21_DAY]:null).filter(Boolean);
  }
  // Команда не может играть два турнира одновременно: окна событий не пересекаются по составам.
  function v22Assign(list,fixed){
    const done=fixed.slice(), t1w=v22Tier1Windows();
    const top=new Set(teams.filter(t=>!t.isAcademy).sort((a,b)=>b.pts-a.pts).slice(0,20).map(t=>t.name));
    list.forEach((ev,i)=>{
      const need=v22Size(ev.kind,ev.format,ev.tier), seed=Number(String(ev.id).split('-')[2])||i, base=ev.startMs; let picked=null;
      for(let a=0;a<45&&!picked;a++){
        const s=base+a*V21_DAY, busy=new Set();
        done.forEach(o=>{ if(o.startMs<s+6*V21_DAY&&(o.endMs||o.startMs+3*V21_DAY)>s) v22Names(o.participants).forEach(n=>busy.add(n)); });
        if(t1w.some(w=>w[0]<s+5*V21_DAY&&w[1]>s)) top.forEach(n=>busy.add(n));
        ev.startMs=s;
        const p=v22Names(v21PickParticipants(ev.kind,seed,need,busy));
        if(p.length>=need||(a>=20&&p.length>=4)) picked=p;
      }
      ev.participants=picked||[]; v22BuildBracket(ev); done.push(ev);
    });
  }
  // Перед стартом события заменяем команды, которые в этот момент уже играют основной турнир или другое live-событие.
  function v22SwapBusy(ev){
    const busy=new Set();
    try{ if(currentTournament&&!currentTournament.completed) v22Names(currentTournament.participants).forEach(n=>busy.add(n)); }catch(e){}
    (seasonState.parallelSchedule||[]).forEach(o=>{ if(o!==ev&&o.status==='live') v22Names(o.participants).forEach(n=>busy.add(n)); });
    if(!v22Names(ev.participants).some(n=>busy.has(n))) return;
    const keep=v22Names(ev.participants).filter(n=>!busy.has(n)), all=new Set(keep);
    busy.forEach(n=>all.add(n));
    const need=v22Size(ev.kind,ev.format,ev.tier);
    const extra=v22Names(v21PickParticipants(ev.kind,7,need+keep.length+4,busy)).filter(n=>!keep.includes(n));
    ev.participants=keep.concat(extra).slice(0,need); v22BuildBracket(ev);
  }
  function v22SetStepDay(s,day){
    const c=v21Cal(), st=new Date(Number(c.seasonAnchorMs)+day*V21_DAY); st.setHours(15,0,0,0);
    const dur=Number(s.calendar.durationDays)||4;
    s.calendar.dayOffset=day; s.calendar.startMs=st.getTime(); s.calendar.endMs=st.getTime()+dur*V21_DAY;
  }
  // Ремонт: старая функция applySeasonFieldProfiles переименовывала Tier-1 №2/5/7 в «слабые» турниры.
  function v22RepairTier1(){
    const S=seasonState; if(S.tier1FixV23) return; S.tier1FixV23=true;
    if(!Array.isArray(S.seasonSchedule)||S.seasonSchedule.length<14) return;
    const old=S.seasonSchedule, arr=v21GenerateTier1Schedule(true);
    arr.forEach((s,i)=>{ if(!s||!old[i]) return; Object.keys(old[i]).forEach(k=>{ if(!(k in s)) s[k]=old[i][k]; }); });
  }
  // Ремонт: если Tier-1 сыграны раньше своих дат — переносим их в прошлое, а следующий ставим через ~5 дней.
  // v24: раньше это чинилось один раз за сейв (флаг tier1SyncV23) и только когда были
  // «просроченные» прошлые турниры. Из-за этого разрыв в 150+ дней до следующего Tier-1
  // мог появиться снова после починки (или вообще без просроченных турниров) и больше
  // никогда не исправлялся. Теперь функция идемпотентна (повторный вызов на уже
  // синхронизированном расписании ничего не меняет) и вызывается регулярно, а не один раз.
  function v22SyncTier1(){
    const S=seasonState;
    const arr=S.seasonSchedule, c=v21Cal(), now=v21Now(), idx=Math.max(1,Number(S.tournamentIndex)||1), anchor=Number(c.seasonAnchorMs)||0;
    if(!Array.isArray(arr)||arr.length<3||!anchor||idx<=1) return;
    const dayNow=Math.floor((v22Sod(now)-v22Sod(anchor))/V21_DAY);
    let changed=false;
    const past=arr.slice(1,idx).filter(s=>s&&s.calendar&&s.calendar.startMs>now);
    if(past.length){ past.forEach((s,j)=>v22SetStepDay(s,dayNow-(past.length-j)*3)); changed=true; }
    const nx=arr[idx];
    if(nx&&nx.calendar){
      const target=dayNow+5, cur=Number(nx.calendar.dayOffset);
      if(cur>target){
        const d=cur-target;
        for(let i=idx;i<arr.length;i++) if(arr[i]&&arr[i].calendar) v22SetStepDay(arr[i],Number(arr[i].calendar.dayOffset)-d);
        changed=true;
      }
    }
    if(!changed) return;
    // Даты сдвинулись — составы, набранные под старое расписание, могли задвоиться
    // между основным Tier-1 и параллельными Tier-2/3/академиями. Пересобираем составы
    // у ближайших ещё не сыгранных параллельных турниров, чтобы команда не оказалась
    // одновременно в двух турнирах.
    try{ (S.parallelSchedule||[]).forEach(ev=>{ if(ev&&ev.status!=='completed'&&Number(ev.startMs)<now+10*V21_DAY) v22SwapBusy(ev); }); }catch(e){ console.warn('[v24] swap busy after sync',e); }
    try{saveSeasonState();}catch(e){}
  }
  function v22Series(a,b){
    const p=v21BgOdds(a,b); let aw=0,bw=0; const maps=[], pool=MAP_POOL.slice().sort(()=>Math.random()-.5);
    for(let i=0;i<3&&aw<2&&bw<2;i++){
      const map=pool[i], pa=v21Clamp(p+((Number(a.maps&&a.maps[map])||50)-(Number(b.maps&&b.maps[map])||50))/800,0.08,0.92);
      const aWin=Math.random()<pa, ot=Math.random()<0.13, win=ot?16:13, lose=ot?14:3+Math.floor(Math.random()*9);
      maps.push({map,s1:aWin?win:lose,s2:aWin?lose:win,ot,w:aWin?1:2}); if(aWin) aw++; else bw++;
    }
    return {winner:aw>bw?a.name:b.name,loser:aw>bw?b.name:a.name,score:`${Math.max(aw,bw)}-${Math.min(aw,bw)}`,maps};
  }
  function v22Rounds(seed,s1,s2,w){
    let x=seed>>>0; const rnd=()=>{ x=(x+0x6D2B79F5)>>>0; let t=x; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return((t^(t>>>14))>>>0)/4294967296; };
    const arr=[...Array(s1).fill(1),...Array(s2).fill(2)];
    for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    if(arr.length&&arr[arr.length-1]!==w){ const k=arr.lastIndexOf(w); if(k>=0) [arr[k],arr[arr.length-1]]=[arr[arr.length-1],arr[k]]; }
    return arr;
  }
  window.v22Detail=function(evId,mid){
    const ev=(seasonState.parallelSchedule||[]).find(x=>x.id===evId), m=ev&&ev.br&&ev.br.matches.find(x=>x.id===mid);
    if(!m||!m.w||!m.maps) return;
    const maps=m.maps.map((x,i)=>({map:x.map,t1Score:x.s1,t2Score:x.s2,overtime:!!x.ot,winner:x.w===1?m.t1:m.t2,rounds:v22Rounds(hashTeamName(ev.id+mid+i),x.s1,x.s2,x.w)}));
    const s1=m.maps.filter(x=>x.w===1).length, s2=m.maps.length-s1;
    const fake={t1:m.t1,t2:m.t2,winner:m.w,score:`Счет: ${s1} - ${s2}`,event:ev.name,broadcastResult:{mode:'BO3',t1:m.t1,t2:m.t2,series1:s1,series2:s2,maps,vetoLog:[]}};
    const dm=document.getElementById('dice-modal'); if(dm) dm.style.zIndex=13500;
    try{ openCompletedMatchResult(fake); }catch(e){ console.warn('[v23] detail',e); }
  };
  function v22MatchHtml(ev,m,now){
    const done=!!m.w, both=m.t1&&m.t2, live=!done&&both&&now>=m.at, sc=String(m.sc||'').split('-'), hasMaps=done&&m.maps&&m.maps.length;
    let o=done?m.o:null;
    if(!o&&both){ try{ const q=calcMatchOdds(m.t1,m.t2,false); if(q) o={c1:q.c1,c2:q.c2,p1:q.pct1,p2:q.pct2}; }catch(e){} }
    const row=k=>{
      const nm=m['t'+k]; if(!nm) return '<div class="team-btn tbd-slot" style="cursor:default"><span><i style="color:var(--text-muted)">TBD</i></span></div>';
      const t=teams.find(x=>x.name===nm), rank=t?teams.indexOf(t)+1:0, fat=(!done&&t&&Number(t.fatigue)>0)?`<span class="team-fatigue-badge">💤${Math.round(t.fatigue)}%</span>`:'';
      return `<div class="team-btn ${done&&m.w===nm?'winner':''}" style="cursor:inherit"><span>${v21Esc(nm)}${rank?` <span class="bracket-team-rank">#${rank}</span>`:''}${fat}</span><span>${o?`<span class="team-coeff">${o['c'+k]}x</span>`:''}${done?` <b>${m.w===nm?(sc[0]||''):(sc[1]||'')}</b>`:''}</span></div>`;
    };
    const bar=(!done&&o)?`<div class="betting-bar-container"><div class="prob-bar"><div class="prob-bar-fill" style="width:${o.p1}%"></div></div><div class="bet-info-row"><span>${o.p1}%</span><span>${o.p2}%</span></div></div>`:'';
    const foot=done?'✓ '+v22Fmtd(m.at):live?'🔴 идёт • '+v22Fmtd(m.at):'🗓 '+v22Fmtd(m.at);
    const click=hasMaps?` onclick="v22Detail('${ev.id}','${m.id}')" title="Открыть результаты карт" style="width:205px;cursor:pointer"`:' style="width:205px"';
    return `<div class="match ${live?'live-broadcast':''}"${click}>${row(1)}${row(2)}${bar}<div class="match-broadcast-state">${foot}</div>${hasMaps?`<div style="font-size:9px;text-align:center;color:var(--text-muted);padding:2px 3px">${m.maps.map(x=>`${x.map} ${x.s1}:${x.s2}${x.ot?' OT':''}`).join(' • ')}</div><button type="button" class="secondary broadcast-detail-btn" onclick="event.stopPropagation();v22Detail('${ev.id}','${m.id}')">📺 Детали матча</button>`:''}</div>`;
  }
  function v22BracketHtml(ev){
    const br=ev.br; if(!br||!br.matches.length) return '<div style="font-size:10px;color:var(--text-muted)">Сетка ещё не сформирована.</div>';
    const ix=v22Idx(br); v22Fill(br,ix); const now=v21Now(), groups=[];
    br.rounds.forEach(r=>{ let g=groups.find(x=>x.name===r.grp); if(!g){ g={name:r.grp,rounds:[]}; groups.push(g); } g.rounds.push(r); });
    let html=groups.map(g=>`${g.name?`<div class="v22-grp">${v21Esc(g.name)}</div>`:''}<div class="v22-cols">${g.rounds.map(r=>`<div class="round" style="min-width:196px"><div class="round-title">${v21Esc(r.name)}</div><div class="round-matches-container">${r.ids.map(id=>v22MatchHtml(ev,ix[id],now)).join('')}</div></div>`).join('')}</div>`).join('');
    if(br.swiss&&ev.standings.length) html=`<div class="v21-parallel-section" style="margin-bottom:8px"><h4>Таблица Swiss</h4>${ev.standings.slice().sort((a,b)=>b.pts-a.pts||b.wins-a.wins||a.losses-b.losses).map((x,i)=>`<div class="v21-standing-row"><span>#${i+1}</span><b>${v21Esc(x.team)}</b><span>${x.wins}-${x.losses}</span></div>`).join('')}</div>`+html;
    return html;
  }
  function v21OpenTournament(id,silent){
    if(id==='main'){ try{document.getElementById('v21-parallel-modal')?.classList.remove('open'); document.querySelector('.bracket-scroll-area')?.scrollTo({top:0,behavior:'smooth'});}catch(e){} return; }
    const ev=(seasonState.parallelSchedule||[]).find(x=>x.id===id); if(!ev) return;
    const modal=document.getElementById('v21-parallel-modal'), body=document.getElementById('v21-parallel-body'), title=document.getElementById('v21-parallel-title'), kicker=document.getElementById('v21-parallel-kicker'); if(!modal||!body) return;
    if(!ev.br&&ev.status==='completed'){ title.textContent=ev.name; kicker.textContent='Завершён (старый формат)'; body.innerHTML=`<div class="v21-parallel-section"><h4>Итог</h4>${(ev.standings||[]).slice(0,12).map((x,i)=>`<div class="v21-standing-row"><span>#${i+1}</span><b>${v21Esc(x.team)}</b><span>${x.wins}-${x.losses}</span></div>`).join('')}</div>`; v22OpenId=null; modal.classList.add('open'); return; }
    if(!ev.br) v22Migrate(ev);
    const done=(ev.br.matches||[]).filter(m=>m.w).length, sig=`${ev.id}|${ev.status}|${done}|${Math.floor(v21Now()/600000)}`;
    if(silent&&sig===v22Sig) return; v22Sig=sig; v22OpenId=id;
    title.textContent=ev.name;
    const st=ev.status==='completed'?'✅ завершён':ev.status==='live'?'🔴 идёт':`⏳ старт ${v22Fmtd(ev.startMs)}`;
    kicker.textContent=`${ev.kind==='academy'?'🎓 Академии':ev.tier==='2'?'🔷 Tier-2':'🟣 Tier-3'} • ${V22_FMT_LABEL[ev.format]||ev.format} • ${(ev.participants||[]).length} команд • $${Math.round(ev.prize).toLocaleString('en-US')} • ${v22Progress(ev)} • ${st}`;
    const win=ev.winner?`<div class="v21-parallel-section" style="margin-bottom:8px">🏆 Победитель: <b>${v21Esc(ev.winner)}</b>${ev.placements?` • 2 место: ${v21Esc(ev.placements[1]||'—')} • 3 место: ${v21Esc(ev.placements[2]||'—')}`:''}</div>`:'';
    body.innerHTML=win+`<div class="v22-wrap">${v22BracketHtml(ev)}</div>`;
    modal.classList.add('open');
  }
  window.v21OpenTournament=v21OpenTournament;
  window.v21CloseParallel=function(ev){ if(ev&&ev.target!==ev.currentTarget) return; v22OpenId=null; v22Sig=''; document.getElementById('v21-parallel-modal')?.classList.remove('open'); };

  function v21GenerateTier1Schedule(noParallel){
    v21NormalizeState();
    const y=2026+(Number(seasonState.currentSeason||1)-1);
    const defs=[
      ['elite',`IEM Katowice (Spodek Arena) ${y}`,15,4,16,'double','elite'],
      ['regular',`BLAST Premier Spring Groups ${y}`,42,4,16,'single','open'],
      ['elite',`ESL Pro League Season ${y}`,68,5,16,'gsl','elite'],
      ['major',`PGL Major Spring ${y}`,98,7,16,'swiss','major'],
      ['regular',`CCT Season Finals Europe ${y}`,135,4,16,'single','open'],
      ['elite',`IEM Dallas ${y}`,160,4,16,'double','elite'],
      ['elite',`BLAST Premier Spring Final ${y}`,188,4,16,'double','elite'],
      ['major',`Perfect World Major Summer ${y}`,215,7,16,'swiss','major'],
      ['elite',`IEM Cologne (Lanxess Arena) ${y}`,255,5,16,'double','elite'],
      ['regular',`BLAST Premier Fall Groups ${y}`,288,4,16,'single','open'],
      ['elite',`ESL Pro League Playoffs ${y}`,315,5,16,'gsl','elite'],
      ['major',`BLAST.tv Winter Major ${y}`,340,7,16,'swiss','major'],
      ['elite',`IEM Chengdu ${y}`,365,5,16,'double','elite'],
      ['elite',`BLAST Premier World Final ${y}`,400,4,16,'double','elite']
    ];
    const arr=[null];
    const anchor=new Date(y,0,2,9,0,0,0).getTime();
    const cal=v21Cal();
    cal.seasonAnchorMs=anchor; cal.seasonPlanSeason=seasonState.currentSeason;
    defs.forEach((d,i)=>{ const [type,name,day,dur,size,format,field]=d; const start=new Date(anchor+day*V21_DAY); start.setHours(15,0,0,0); const startMs=start.getTime(); arr[i+1]={type,name,min:type==='major'?500:type==='elite'?450:250,max:2000,size,format,fieldProfile:field,calendar:{dayOffset:day,durationDays:dur,restBeforeDays:Math.max(1,Math.min(3,Math.floor(dur/2))),startTime:'15:00',startMs,endMs:startMs+dur*V21_DAY}}; });
    seasonState.seasonSchedule=arr; seasonState.tournamentIndex=Math.min(Math.max(1,Number(seasonState.tournamentIndex)||1),arr.length-1); seasonState.maxTournaments=9999;
    if(typeof v15DecorateSeasonSchedule==='function') v15DecorateSeasonSchedule(false);
    try{saveSeasonState();}catch(e){}
    if(!noParallel) v21BuildParallelSchedule();
    return arr;
  }
  const oldGenerate=window.generateDynamicSeasonSchedule;
  window.generateDynamicSeasonSchedule=v21GenerateTier1Schedule;

  // Make academy players promotable even when the parent language differs from the buyer.
  const oldAccept=window.playerWillAccept;
  if(typeof oldAccept==='function' && !oldAccept.__v21Wrapped){
    const wrapped=function(p,fromTeam,toTeam){
      if(fromTeam?.isAcademy && !toTeam?.isAcademy && teamRankValue(toTeam)>=teamRankValue(fromTeam)+80){ return true; }
      return oldAccept.apply(this,arguments);
    };
    wrapped.__v21Wrapped=true; window.playerWillAccept=wrapped; try{playerWillAccept=wrapped;}catch(e){}
  }
  const oldProcess=window.processTransferMarket;
  if(typeof oldProcess==='function' && !oldProcess.__v21Wrapped){
    const wrapped=function(reason){
      const result=oldProcess.apply(this,arguments);
      // Academy promotion window: one high-potential academy player may be promoted or sold after market runs.
      try{
        v21EnsureAcademies();
        const buyers=teams.filter(t=>!t.isAcademy && teamRankValue(t)>=650 && Number(t.fatigue||0)>=18).sort((a,b)=>teamRankValue(b)-teamRankValue(a)).slice(0,4);
        for(const to of buyers){
          const out=to.players?.filter(p=>p.status==='STARTER').sort((a,b)=>playerPower(a)-playerPower(b))[0]; if(!out) continue;
          const candidates=[];
          for(const from of teams.filter(t=>t.isAcademy)){
            ensurePlayerLayer(from);
            for(const p of from.players.filter(p=>p.status==='STARTER')){
              const imp=playerPower(p)-playerPower(out); if(imp<5) continue;
              candidates.push({from,p,imp});
            }
          }
          candidates.sort((a,b)=>b.imp-a.imp);
          if(candidates[0] && Math.random()<0.28) applyPlayerTransfer(candidates[0].from,to,candidates[0].p,'академическое продвижение / продажа');
        }
      }catch(e){console.warn('[v21] academy market',e);}
      return result;
    };
    wrapped.__v21Wrapped=true; window.processTransferMarket=wrapped; try{processTransferMarket=wrapped;}catch(e){}
  }

  // End the season by the last scheduled Tier-1 tournament, not an arbitrary cap of 10.
  window.v21ShouldEndSeason=function(){
    const len=Math.max(0,(seasonState.seasonSchedule||[]).length-1);
    return len>0 && Number(seasonState.tournamentIndex||1)>=len;
  };
  const oldFinalize=window.finalizeTournamentRating;
  if(typeof oldFinalize==='function' && !oldFinalize.__v21Wrapped){
    const wrapped=function(...args){
      const len=Math.max(1,(seasonState.seasonSchedule||[]).length-1);
      seasonState.maxTournaments=(Number(seasonState.tournamentIndex||1)>=len)?len:9999;
      const r=oldFinalize.apply(this,args);
      seasonState.maxTournaments=9999;
      try{saveSeasonState();}catch(e){}
      return r;
    };
    wrapped.__v21Wrapped=true; window.finalizeTournamentRating=wrapped; try{finalizeTournamentRating=wrapped;}catch(e){}
  }

  // Keep the season progress compact and explicit.
  const oldRenderBanner=window.renderSeasonBanner;
  if(typeof oldRenderBanner==='function' && !oldRenderBanner.__v21Wrapped){
    const wrapped=function(...args){ const r=oldRenderBanner.apply(this,args); const el=document.getElementById('season-progress'); if(el) el.textContent=`Tier-1: ${seasonState.tournamentIndex}/${Math.max(0,(seasonState.seasonSchedule||[]).length-1)} • T2/3: ${(seasonState.parallelSchedule||[]).filter(e=>e.season===seasonState.currentSeason).length}`; return r; };
    wrapped.__v21Wrapped=true; window.renderSeasonBanner=wrapped; try{renderSeasonBanner=wrapped;}catch(e){}
  }

  // Parallel layer piggybacks on the same calendar clock. When time is skipped, all background events catch up.
  const oldAdvance=window.v15AdvanceMinutes;
  if(typeof oldAdvance==='function' && !oldAdvance.__v21Wrapped){
    const wrapped=function(...args){ const r=oldAdvance.apply(this,args); try{v21ProcessParallel(v21Now());}catch(e){console.warn('[v21] parallel tick',e);} return r; };
    wrapped.__v21Wrapped=true; window.v15AdvanceMinutes=wrapped;
  }

  // Build the larger scene immediately and migrate old saves.
  v21NormalizeState();
  v21EnsureAcademies();
  if(!Array.isArray(seasonState.seasonSchedule) || seasonState.seasonSchedule.length<14) v21GenerateTier1Schedule();
  try{ v22RepairTier1(); v22SyncTier1(); }catch(e){ console.warn('[v23] tier1 repair',e); }
  if(!Array.isArray(seasonState.parallelSchedule) || !seasonState.parallelSchedule.length) v21BuildParallelSchedule();
  try{saveTeams();saveSeasonState();}catch(e){}
  v21ProcessParallel(v21Now());
  v21RenderSwitcher();

  // Rebuild parallel scene for every new season after the core game moves the season counter.
  const oldGenBound=window.generateDynamicSeasonSchedule;
  // The assignment above is already the authoritative generator; decorate on-demand by the existing UI.
  setInterval(()=>{ try{v22SyncTier1();}catch(e){} try{v21ProcessParallel(v21Now()); v21RenderSwitcher();}catch(e){} },1500);
})();
