
(() => {
  'use strict';
  const DAY=864e5, MN=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const COL={'1':'#f0b429','2':'#4bcffa','3':'#9b59b6','academy':'#58c58a'}, TL={'1':'Tier-1','2':'Tier-2','3':'Tier-3','academy':'Академии'};
  const FL={single:'Single Elim',double:'Double Elim',swiss:'Swiss',gsl:'GSL Groups'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nowMs=()=>Number((seasonState.calendar||{}).currentMs)||Date.now();
  const sod=ms=>{const d=new Date(ms);d.setHours(0,0,0,0);return d.getTime();};
  const fdt=ms=>{const d=new Date(ms);return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});};
  let view=null, sel=0, filt={'1':true,'2':true,'3':true,'academy':true};

  // ---------- 1) Матчи идут волнами по 2: следующая пара не стартует, пока не закончились ОБА матча текущей ----------
  function regroup(b){
    const q=(b.queue||[]).filter(x=>x.status==='scheduled'||!x.status).sort((a,c)=>(a.batchId-c.batchId)||(a.time-c.time));
    for(let i=0;i<q.length;i+=2){ const a=q[i], c=q[i+1]; if(c&&c.batchId!==a.batchId){ c.batchId=a.batchId; c.time=a.time; c.v18PlannedTime=a.time; c.gameScheduledAt=a.time; } }
  }
  const priorSched=window.scheduleNextBroadcastBatch;
  if(typeof priorSched==='function'&&!priorSched.__v22){
    const w=function(...a){
      const b=currentTournament&&currentTournament.broadcast;
      if(b&&b.running){
        if(b.active&&b.active.length) return;            // волна ещё играется — ждём второй матч пары
        try{ if(typeof buildBroadcastQueue==='function') buildBroadcastQueue(); regroup(b); }catch(e){ console.warn('[v22] regroup',e); }
      }
      return priorSched.apply(this,a);
    };
    w.__v22=true; window.scheduleNextBroadcastBatch=w; try{scheduleNextBroadcastBatch=w;}catch(e){}
  }

  // Ручная генерация Tier-1 раньше даты больше не «съедает» расписание: часы переходят к дате старта.
  const priorInit=window.initTournamentCycle;
  if(typeof priorInit==='function'&&!priorInit.__v23){
    const w=function(...a){
      try{
        if(!(currentTournament&&!currentTournament.completed)){
          const st=(seasonState.seasonSchedule||[])[Number(seasonState.tournamentIndex)||1], t=st&&st.calendar&&Number(st.calendar.startMs), c=seasonState.calendar;
          if(t&&c&&Number(c.currentMs)<t){ c.currentMs=t; c.lastAdvanceReason='переход к началу турнира'; }
        }
      }catch(e){}
      return priorInit.apply(this,a);
    };
    w.__v23=true; window.initTournamentCycle=w; try{initTournamentCycle=w;}catch(e){}
  }

  // ---------- 2) Кнопка «Создать турнир» вместо постоянного меню ----------
  window.v22ToggleCreate=function(){
    const c=document.querySelector('.controls'); if(!c) return;
    const open=c.classList.toggle('v22-create-open');
    const b=document.getElementById('v22-create-toggle'); if(b) b.textContent=open?'🛠 Создать турнир ▴':'🛠 Создать турнир ▾';
  };

  // ---------- 3) Календарь в отдельном окне ----------
  function events(){
    const out=[], S=seasonState, idx=Number(S.tournamentIndex)||1, act=!!(currentTournament&&!currentTournament.completed);
    (S.seasonSchedule||[]).forEach((st,i)=>{ if(!st||!st.calendar||!st.calendar.startMs) return;
      out.push({id:'t1-'+i,tier:'1',name:st.name,startMs:st.calendar.startMs,endMs:st.calendar.endMs||st.calendar.startMs+DAY,status:i<idx?'done':(i===idx&&act?'live':'scheduled'),format:st.format,sub:st.type,main:i===idx}); });
    (S.parallelSchedule||[]).filter(e=>e.season===S.currentSeason).forEach(e=>out.push({id:e.id,par:true,tier:e.kind==='academy'?'academy':e.tier,name:e.name,startMs:e.startMs,endMs:e.endMs||e.startMs+DAY,status:e.status==='completed'?'done':(e.status==='live'?'live':'scheduled'),format:e.format}));
    return out.sort((a,b)=>a.startMs-b.startMs);
  }
  const col=e=>e.tier==='1'&&e.sub==='major'?'#eb4d4b':COL[e.tier];
  const short=n=>{n=String(n).replace(/ 20\d\d$/,'');return n.length>17?n.slice(0,16)+'…':n;};
  const icon=e=>e.status==='done'?'✅':e.status==='live'?'🔴':'🗓';
  function item(e){
    return `<div class="v22-ev ${e.status}" style="border-left-color:${col(e)}"><div style="min-width:0"><b>${esc(e.name)}</b><span>${icon(e)} ${fdt(e.startMs)} → ${fdt(e.endMs)}<br>${TL[e.tier]}${e.format?' • '+(FL[e.format]||e.format):''}</span></div>${e.par?`<button type="button" class="secondary" onclick="v21OpenTournament('${e.id}')">Открыть</button>`:''}</div>`;
  }
  function render(){
    const box=document.getElementById('v22-cal-body'); if(!box||!view) return;
    const now=nowMs(), y=view.getFullYear(), mo=view.getMonth(), off=(new Date(y,mo,1).getDay()+6)%7;
    const evs=events().filter(e=>filt[e.tier]);
    let cells='';
    for(let i=0;i<42;i++){
      const d=new Date(y,mo,1-off+i), ds=d.getTime(), de=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime();
      const list=evs.filter(e=>e.startMs<de&&e.endMs>ds);
      cells+=`<div class="v22-day ${d.getMonth()!==mo?'other':''} ${now>=ds&&now<de?'today':''} ${sel===ds?'sel':''}" onclick="v22CalSel(${ds})"><div class="dn">${d.getDate()}</div>${list.slice(0,3).map(e=>`<div class="v22-chip ${e.status}" style="border-left-color:${col(e)}">${esc(short(e.name))}</div>`).join('')}${list.length>3?`<div class="v22-more">+${list.length-3}</div>`:''}</div>`;
    }
    const dayEvs=evs.filter(e=>e.startMs<sel+DAY&&e.endMs>sel), live=evs.filter(e=>e.status==='live'), soon=evs.filter(e=>e.status==='scheduled'&&e.startMs>now).slice(0,8);
    const sec=(t,l,em)=>`<div class="v22-sec"><h4>${t}</h4>${l.length?l.map(item).join(''):`<div class="v22-empty">${em}</div>`}</div>`;
    document.getElementById('v22-cal-title').textContent=`${MN[mo]} ${y}`;
    document.getElementById('v22-cal-now').textContent=`Сейчас: ${fdt(now)}`;
    box.innerHTML=`<div class="v22-grid-wrap"><div class="v22-dow">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<div>${x}</div>`).join('')}</div><div class="v22-grid">${cells}</div></div><div class="v22-side">${sec('🔴 Идут сейчас',live,'Сейчас турниров нет')}${sec('📆 '+new Date(sel).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}),dayEvs,'В этот день турниров нет')}${sec('⏭ Скоро',soon,'Ближайших турниров нет')}</div>`;
  }
  window.v22CalSel=ms=>{ sel=ms; render(); };
  window.v22CalNav=n=>{ view=new Date(view.getFullYear(),view.getMonth()+n,1); render(); };
  window.v22CalToday=()=>{ const d=new Date(nowMs()); view=new Date(d.getFullYear(),d.getMonth(),1); sel=sod(nowMs()); render(); };
  window.v22CalFilt=(k,v)=>{ filt[k]=v; render(); };
  window.v22CalClose=ev=>{ if(ev&&ev.target!==ev.currentTarget) return; document.getElementById('v22-cal-modal')?.classList.remove('open'); };
  window.v22OpenCalendar=()=>{ ensureDom(); window.v22CalToday(); document.getElementById('v22-cal-modal').classList.add('open'); };

  function ensureDom(){
    if(document.getElementById('v22-cal-modal')) return;
    const m=document.createElement('div'); m.id='v22-cal-modal'; m.className='v22-cal-modal'; m.onclick=window.v22CalClose;
    m.innerHTML=`<div class="v22-cal-box" onclick="event.stopPropagation()"><div class="v22-cal-head"><div><div class="v22-cal-h1">🗓 Календарь сезона</div><div id="v22-cal-now" class="v22-cal-sub"></div></div><div class="v22-cal-nav"><button type="button" class="secondary" onclick="v22CalNav(-1)">◀</button><b id="v22-cal-title"></b><button type="button" class="secondary" onclick="v22CalNav(1)">▶</button><button type="button" class="secondary" onclick="v22CalToday()">Сегодня</button></div><div class="v22-cal-filt">${Object.keys(TL).map(k=>`<label style="color:${COL[k]}"><input type="checkbox" checked onchange="v22CalFilt('${k}',this.checked)"> ${TL[k]}</label>`).join('')}</div><button type="button" class="secondary" style="color:var(--loss);border-color:var(--loss);" onclick="v22CalClose()">✕ Закрыть</button></div><div id="v22-cal-body" class="v22-cal-main"></div></div>`;
    document.body.appendChild(m);
  }
  setInterval(()=>{ try{ if(document.getElementById('v22-cal-modal')?.classList.contains('open')) render(); }catch(e){} },2000);
})();
