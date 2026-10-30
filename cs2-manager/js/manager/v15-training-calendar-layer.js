
(() => {
  'use strict';

  const V15_DAY_MS = 24 * 60 * 60 * 1000;
  const V15_GAME_MINUTES_PER_REAL_SECOND = 0.6; // 1 in-game day ≈ 40 real minutes at 1x.
  const V15_MATCH_DURATION_MIN = 120;
  const V15_MATCH_GAP_MIN = 60;
  const V15_MATCH_START_HOUR = 15;
  const V15_MATCH_START_MIN = 30;
  const V15_SPEEDS = [1,2,5];
  let v15Ticker = null;
  let v15LastWallMs = Date.now();
  let v15SaveAccumulator = 0;
  let v15Busy = false;

  function v15Clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function v15Pad(n){ return String(n).padStart(2,'0'); }
  function v15Esc(s){ return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

  function v15EnsureCalendar(){
    if(!seasonState.calendar || typeof seasonState.calendar !== 'object') seasonState.calendar = {};
    const c = seasonState.calendar;
    if(!Number.isFinite(Number(c.currentMs))){
      c.currentMs = new Date(2026,0,5,9,0,0,0).getTime();
    }
    c.speed = V15_SPEEDS.includes(Number(c.speed)) ? Number(c.speed) : 1;
    c.paused = !!c.paused;
    c.lastWallMs = Number(c.lastWallMs) || Date.now();
    c.seasonPlanSeason = Number(c.seasonPlanSeason) || 0;
    c.seasonAnchorMs = Number(c.seasonAnchorMs) || 0;
    c.tournamentMatchCursor = Number(c.tournamentMatchCursor) || 0;
    c.nextMatchAt = Number(c.nextMatchAt) || 0;
    c.lastMatchStartMs = Number(c.lastMatchStartMs) || 0;
    c.lastBootcampMs = Number(c.lastBootcampMs) || 0;
    return c;
  }

  function v15CalendarDate(){ return new Date(v15EnsureCalendar().currentMs); }
  function v15StartOfDayMs(ms){ const d=new Date(ms); d.setHours(9,0,0,0); return d.getTime(); }
  function v15SetClock(ms){ v15EnsureCalendar().currentMs = Math.max(0, Number(ms)||0); }
  function v15AdvanceMinutes(mins, reason=''){
    const c=v15EnsureCalendar();
    if(!Number.isFinite(mins) || mins <= 0) return;
    c.currentMs += mins*60000;
    if(reason) c.lastAdvanceReason = reason;
    v15RenderCalendar();
  }
  function v15FormatRemaining(ms){
    if(ms <= 0) return 'сейчас';
    const totalMin=Math.ceil(ms/60000);
    const d=Math.floor(totalMin/1440), h=Math.floor((totalMin%1440)/60), m=totalMin%60;
    if(d>0) return `${d}д ${h}ч`;
    if(h>0) return `${h}ч ${m}м`;
    return `${m}м`;
  }
  function v15FormatDate(d){
    const wd=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
    return `${v15Pad(d.getDate())}.${v15Pad(d.getMonth()+1)}.${d.getFullYear()} • ${wd}`;
  }
  function v15FormatDateTime(ms){
    const d=new Date(ms);
    return `${v15FormatDate(d)} ${v15Pad(d.getHours())}:${v15Pad(d.getMinutes())}`;
  }

  function v15PlanDefaults(index){
    const plans={
      1:{dayOffset:1,durationDays:2,restBeforeDays:1,startTime:'15:30'},
      2:{dayOffset:4,durationDays:2,restBeforeDays:1,startTime:'15:30'},
      3:{dayOffset:8,durationDays:3,restBeforeDays:2,startTime:'15:30'},
      4:{dayOffset:13,durationDays:2,restBeforeDays:2,startTime:'15:30'},
      5:{dayOffset:17,durationDays:2,restBeforeDays:2,startTime:'15:30'},
      6:{dayOffset:21,durationDays:3,restBeforeDays:2,startTime:'15:30'},
      7:{dayOffset:26,durationDays:2,restBeforeDays:2,startTime:'15:30'},
      8:{dayOffset:30,durationDays:3,restBeforeDays:2,startTime:'15:30'},
      9:{dayOffset:35,durationDays:2,restBeforeDays:2,startTime:'15:30'},
      10:{dayOffset:40,durationDays:7,restBeforeDays:3,startTime:'15:30'}
    };
    return plans[index] || {dayOffset:0,durationDays:2,restBeforeDays:1,startTime:'15:30'};
  }

  function v15DecorateSeasonSchedule(forceAnchor=false){
    v15EnsureCalendar();
    if(!Array.isArray(seasonState.seasonSchedule) || seasonState.seasonSchedule.length < 2) return;
    const targetYear=2026 + (Number(seasonState.currentSeason||1)-1);
    const c=seasonState.calendar;
    const existingYear=c.seasonAnchorMs ? new Date(c.seasonAnchorMs).getFullYear() : 0;
    if(forceAnchor || c.seasonPlanSeason !== seasonState.currentSeason || !c.seasonAnchorMs || existingYear !== targetYear){
      let anchor=new Date(targetYear,0,2,9,0,0,0).getTime();
      const current=v15CalendarDate();
      if(targetYear < current.getFullYear()) anchor=v15StartOfDayMs(c.currentMs)+V15_DAY_MS;
      else if(targetYear === current.getFullYear() && c.currentMs > anchor) anchor=v15StartOfDayMs(c.currentMs)+V15_DAY_MS;
      c.seasonAnchorMs=anchor;
      c.seasonPlanSeason=seasonState.currentSeason;
    }
    for(let i=1;i<=10;i++){
      const step=seasonState.seasonSchedule[i];
      if(!step) continue;
      const def=v15PlanDefaults(i);
      step.calendar=Object.assign({},def,step.calendar||{});
      if(!step.calendar.startTime) step.calendar.startTime='15:30';
      if(!Number.isFinite(Number(step.calendar.dayOffset))) step.calendar.dayOffset=def.dayOffset;
      if(!Number.isFinite(Number(step.calendar.durationDays))) step.calendar.durationDays=def.durationDays;
      const [hh,mm]=String(step.calendar.startTime).split(':').map(Number);
      const startBase=c.seasonAnchorMs + Number(step.calendar.dayOffset)*V15_DAY_MS;
      const sd=new Date(startBase); sd.setHours(hh||15,mm||30,0,0);
      step.calendar.startMs=sd.getTime();
      step.calendar.endMs=sd.getTime()+Math.max(1,Number(step.calendar.durationDays)||2)*V15_DAY_MS;
    }
    try{ localStorage.setItem('cs2_season_state_v61',JSON.stringify(seasonState)); }catch(e){}
  }

  // Wrap schedule generation so every new season receives explicit calendar slots.
  const v15OriginalGenerateDynamicSeasonSchedule = window.generateDynamicSeasonSchedule;
  if(typeof v15OriginalGenerateDynamicSeasonSchedule === 'function'){
    window.generateDynamicSeasonSchedule = function(...args){
      const beforeSeason=Number(seasonState.currentSeason||1);
      const result=v15OriginalGenerateDynamicSeasonSchedule.apply(this,args);
      v15DecorateSeasonSchedule(beforeSeason !== Number(seasonState.currentSeason||1));
      v15RenderCalendar();
      return result;
    };
  }

  function v15NextStep(){
    v15DecorateSeasonSchedule(false);
    return seasonState.seasonSchedule?.[seasonState.tournamentIndex] || null;
  }

  function v15RecommendedCamps(){
    if(currentTournament && !currentTournament.completed) return [];
    const step=v15NextStep();
    if(!step?.calendar?.startMs) return [];
    const c=v15EnsureCalendar();
    const until=step.calendar.startMs-c.currentMs;
    const days=until/V15_DAY_MS;
    if(days < 2.0) return [];
    const field=String(step.fieldProfile||'open');
    if(!['weak','medium','open'].includes(field)) return [];
    const candidates=[];
    teams.forEach(t=>{
      ensurePlayerLayer(t);
      const fatigue=Number(t.fatigue)||0;
      const morale=Number(t.playerLayer?.morale)||90;
      const form=Number(t.form)||100;
      const need=(fatigue>=25?2:0)+(morale<=76?2:0)+(form<=95?1:0);
      if(need>0) candidates.push({t,need,fatigue,morale,form});
    });
    return candidates.sort((a,b)=>b.need-a.need || b.fatigue-a.fatigue).slice(0,4);
  }

  function v15CalendarCampButton(team){
    const disabled=(currentTournament && !currentTournament.completed) ? ' disabled' : '';
    const teamArg=JSON.stringify(team.name).replace(/</g,'\\u003c');
    return `<button type="button" class="secondary calendar-camp-btn" style="color:var(--gold);border-color:var(--gold);"${disabled} onclick="runManualBootcamp(${teamArg})">🏕️ ${disabled?'Занято':'Буткемп'}</button>`;
  }

  function v15RenderCalendar(){
    v15EnsureCalendar();
    v15DecorateSeasonSchedule(false);
    const d=v15CalendarDate();
    const clock=document.getElementById('calendar-clock');
    const date=document.getElementById('calendar-date');
    const speed=document.getElementById('calendar-speed-label');
    const status=document.getElementById('calendar-status-label');
    if(!clock||!date||!speed||!status) return;
    clock.textContent=`${v15Pad(d.getHours())}:${v15Pad(d.getMinutes())}`;
    date.textContent=v15FormatDate(d);
    const c=v15EnsureCalendar();
    speed.textContent=`${c.speed}x`;
    status.textContent=c.paused ? '⏸ Время остановлено' : '▶ Идёт время';
    const pauseBtn=document.getElementById('calendar-pause-btn');
    if(pauseBtn) pauseBtn.textContent=c.paused?'▶ Продолжить':'⏸ Пауза';
    document.querySelectorAll('[data-calendar-speed]').forEach(btn=>{
      btn.classList.toggle('active-speed', Number(btn.dataset.calendarSpeed)===c.speed);
    });
    const nextBox=document.getElementById('calendar-next-event');
    if(nextBox){
      const active=currentTournament && !currentTournament.completed ? currentTournament : null;
      if(active){
        const cal=active.calendar || {};
        const nextMatch=Number(cal.nextMatchAt)||0;
        const planned=Number(cal.plannedStartMs)||c.currentMs;
        const matchText=nextMatch ? `Следующий слот: <b>${v15FormatDateTime(nextMatch)}</b> • через ${v15FormatRemaining(nextMatch-c.currentMs)}` : `Турнир идёт • старт ${v15FormatDateTime(planned)}`;
        nextBox.innerHTML=`🏆 <b>${v15Esc(active.name)}</b><br>${matchText}<br><span style="color:var(--text-muted);">Слоты: по игровому времени • шаг 10 мин</span>`;
      } else {
        const step=v15NextStep();
        if(step?.calendar?.startMs){
          const delta=step.calendar.startMs-c.currentMs;
          const fieldLabel=step.fieldProfile==='weak'?'слабые':step.fieldProfile==='medium'?'средние':step.fieldProfile==='elite'?'элитные':'открытый микс';
          nextBox.innerHTML=`⏱ Следующий ивент: <b>${v15Esc(step.name)}</b><br>Старт: <b>${v15FormatDateTime(step.calendar.startMs)}</b> • через ${v15FormatRemaining(delta)}<br><span style="color:var(--text-muted);">Поле: ${fieldLabel} • длительность: ${step.calendar.durationDays} дн.</span>`;
        }else nextBox.textContent='Расписание сезона пока не сформировано.';
      }
    }
    const campBox=document.getElementById('calendar-camps-box');
    if(campBox){
      const rec=v15RecommendedCamps();
      if(rec.length){
        const step=v15NextStep();
        campBox.innerHTML=`<div class="calendar-camps"><div style="font-size:8.5px;font-weight:900;color:var(--gold);">🏕️ Окно для буткемпа · ${v15Esc(step?.name||'следующий ивент')}</div>${rec.map(x=>`<div class="calendar-camp-item"><div class="calendar-camp-team"><b>${v15Esc(x.t.name)}</b> · 💤${Math.round(x.fatigue)}% · ❤️${Math.round(x.morale)} · F${Math.round(x.form)}%</div>${v15CalendarCampButton(x.t)}</div>`).join('')}<div class="calendar-rest-note">Буткемп не запускается сам: менеджер выбирает, кому и когда идти на сборы. Один сбор занимает 3 игровых дня.</div></div>`;
      }else campBox.innerHTML='';
    }
    v15UpdateManualBootcampStatus();
  }

  function v15StartTick(){
    if(v15Ticker) clearInterval(v15Ticker);
    v15LastWallMs=Date.now();
    v15Ticker=setInterval(()=>{
      const c=v15EnsureCalendar();
      const now=Date.now();
      let realSec=Math.max(0,Math.min(5,(now-v15LastWallMs)/1000));
      v15LastWallMs=now;
      if(!c.paused && realSec>0){
        const deltaMin=realSec*V15_GAME_MINUTES_PER_REAL_SECOND*c.speed;
        v15AdvanceMinutes(deltaMin,'реальное время');
        v15SaveAccumulator+=realSec;
        if(v15SaveAccumulator>=15){
          v15SaveAccumulator=0;
          c.lastWallMs=now;
          try{ saveSeasonState(); }catch(e){}
        }
      }
      v15RenderCalendar();
    },1000);
  }

  window.setGameCalendarSpeed=function(speed){
    const c=v15EnsureCalendar();
    if(!V15_SPEEDS.includes(Number(speed))) return;
    c.speed=Number(speed);
    c.lastWallMs=Date.now();
    v15RenderCalendar();
    try{ saveSeasonState(); }catch(e){}
  };
  window.toggleGameCalendarPause=function(){
    const c=v15EnsureCalendar();
    c.paused=!c.paused;
    c.lastWallMs=Date.now();
    v15RenderCalendar();
    try{ saveSeasonState(); }catch(e){}
  };
  window.skipGameCalendarDay=function(){
    v15AdvanceMinutes(1440,'пропуск дня');
    const c=v15EnsureCalendar();
    c.lastWallMs=Date.now();
    try{ saveSeasonState(); }catch(e){}
    v15RenderCalendar();
  };

  function v15BootcampEligibility(t){
    if(!t) return {ok:false,reason:'Команда не найдена'};
    if(currentTournament && !currentTournament.completed) return {ok:false,reason:'Во время активного турнира буткемп недоступен'};
    ensurePlayerLayer(t);
    const c=v15EnsureCalendar();
    if(c.lastBootcampMs && c.currentMs-c.lastBootcampMs < 3*V15_DAY_MS) return {ok:false,reason:'После предыдущего сбора должно пройти 3 игровых дня'};
    return {ok:true};
  }

  window.runManualBootcamp=function(teamName){
    const t=teams.find(x=>x.name===teamName);
    const chk=v15BootcampEligibility(t);
    if(!chk.ok){ alert(`🏕️ Буткемп: ${chk.reason}.`); return false; }
    ensurePlayerLayer(t);
    const beforeFat=Number(t.fatigue)||0;
    const beforeMor=Number(t.playerLayer?.morale)||90;
    changePlayers(t,{form:4,morale:9,fatigue:-30});
    t.players.forEach(p=>{
      p.tacticalIQ=clampNumber((Number(p.tacticalIQ)||70)+0.8,65,100);
      p.utility=clampNumber((Number(p.utility)||70)+0.7,64,100);
    });
    ensurePlayerLayer(t);
    const weakest=MAP_POOL.slice().sort((a,b)=>(Number(t.maps?.[a])||50)-(Number(t.maps?.[b])||50))[0] || MAP_POOL[0];
    const oldWr=Number(t.maps?.[weakest])||50;
    t.maps[weakest]=Math.min(95,Math.round((oldWr+8)*10)/10);
    if(t.mapStrength){ t.mapStrength[weakest]=Math.min(95,Math.round(((Number(t.mapStrength[weakest])||oldWr)+6)*10)/10); }
    const c=v15EnsureCalendar();
    c.lastBootcampMs=c.currentMs;
    c.currentMs += 3*V15_DAY_MS;
    t.lastBootcampSeason=seasonState.currentSeason;
    t.history=t.history||[];
    t.history.unshift({
      tournament:`Стратегический буткемп • ${v15FormatDate(new Date(c.currentMs))}`,
      season:seasonState.currentSeason,
      place:0,
      placeTitle:'🏕️ Стратегический буткемп',
      isBootcamp:true,
      delta:0,
      durationDays:3,
      fatigueBefore:Math.round(beforeFat),
      fatigueAfter:Math.round(t.fatigue),
      moraleBefore:Math.round(beforeMor),
      moraleAfter:Math.round(t.playerLayer?.morale||beforeMor),
      improvedMap:weakest
    });
    t.rosterLastChange=t.rosterLastChange||null;
    try{ saveTeams(); saveSeasonState(); }catch(e){}
    const msg=`🏕️ ${t.name}: 3 дня буткемпа завершены.\nУсталость: ${Math.round(beforeFat)}% → ${Math.round(t.fatigue)}%\nМораль: ${Math.round(beforeMor)} → ${Math.round(t.playerLayer?.morale||beforeMor)}\nСлабейшая карта: ${weakest} ${Math.round(oldWr)}% → ${Math.round(t.maps[weakest])}%`;
    v15RenderCalendar();
    if(selectedTeamForDetails===t.name && typeof showHistory==='function') showHistory(t.name);
    alert(msg);
    return true;
  };
  window.runManualBootcampSelected=function(){
    if(selectedTeamForDetails) return window.runManualBootcamp(selectedTeamForDetails);
    alert('Выберите команду в рейтинге.');
    return false;
  };

  function v15UpdateManualBootcampStatus(){
    const el=document.getElementById('manual-bootcamp-status');
    if(!el || !selectedTeamForDetails) return;
    const t=teams.find(x=>x.name===selectedTeamForDetails);
    if(!t) return;
    const chk=v15BootcampEligibility(t);
    el.textContent=chk.ok
      ? `3 игровых дня • отдых + мораль + форма + слабейшая карта. Сейчас: 💤${Math.round(t.fatigue||0)}% / ❤️${Math.round(t.playerLayer?.morale||90)}`
      : chk.reason;
  }

  // Intercept match completion so game-calendar time follows series rather than only the real-time ticker.
  const v15OriginalUpdateFatigueAndForm=window.updateFatigueAndForm;
  if(typeof v15OriginalUpdateFatigueAndForm==='function'){
    window.updateFatigueAndForm=function(winner,loser){
      const before=currentTournament;
      const result=v15OriginalUpdateFatigueAndForm.apply(this,arguments);
      if(before && !before.completed){
        // Calendar time already advances continuously with the master calendar clock.
        // Do not add a fixed duration here: that double-counted match time and made
        // the calendar jump by hours after every completed series.
        const c=v15EnsureCalendar();
        if(!before.calendar) before.calendar={plannedStartMs:c.currentMs,nextMatchAt:c.currentMs,tournamentDay:0,matchSlot:0};
        before.calendar.lastCompletedMatchAt=c.currentMs;
        before.calendar.nextMatchAt=Number(before.calendar.nextMatchAt)||c.currentMs;
      }
      v15RenderCalendar();
      return result;
    };
  }

  // Add a calendar rest day between Swiss/GSL stages and the later bracket where those functions are used.
  function v15WrapRestFunction(name, days){
    const original=window[name];
    if(typeof original!=='function' || original.__v15Wrapped) return;
    const wrapped=function(...args){
      const result=original.apply(this,args);
      if(currentTournament){
        v15AdvanceMinutes(days*1440,'турнирный день отдыха');
      }
      v15RenderCalendar();
      return result;
    };
    wrapped.__v15Wrapped=true;
    window[name]=wrapped;
  }
  v15WrapRestFunction('finalizeSwissStage',1);
  v15WrapRestFunction('finalizeGSLStage',1);

  // Major stages have an explicit break before the next stage; Stage 3 gets the longest playoffs break.
  const v15OriginalFinalizeMajorStage=window.finalizeMajorStage;
  if(typeof v15OriginalFinalizeMajorStage==='function' && !v15OriginalFinalizeMajorStage.__v15Wrapped){
    const wrapped=function(stageNo){
      const result=v15OriginalFinalizeMajorStage.apply(this,arguments);
      v15AdvanceMinutes(stageNo===3?2:1,'отдых между Major-этапами');
      v15RenderCalendar();
      return result;
    };
    wrapped.__v15Wrapped=true;
    window.finalizeMajorStage=wrapped;
  }

  // Decorate tournament creation with a planned 15:30 start and persistent calendar metadata.
  const v15OriginalCreateTournament=window.createTournament;
  if(typeof v15OriginalCreateTournament==='function' && !v15OriginalCreateTournament.__v15Wrapped){
    const wrapped=function(...args){
      const step=seasonState.seasonSchedule?.[seasonState.tournamentIndex];
      v15DecorateSeasonSchedule(false);
      const planned=step?.calendar?.startMs||v15EnsureCalendar().currentMs;
      const c=v15EnsureCalendar();
      if(c.currentMs < planned){ c.currentMs=planned; }
      const result=v15OriginalCreateTournament.apply(this,args);
      if(currentTournament){
        currentTournament.calendar={
          plannedStartMs:Math.max(planned,c.currentMs),
          nextMatchAt:Math.max(planned,c.currentMs),
          tournamentDay:0,
          matchSlot:0,
          durationDays:Number(step?.calendar?.durationDays)||2,
          startTime:'15:30'
        };
      }
      c.nextMatchAt=currentTournament?.calendar?.nextMatchAt||c.nextMatchAt;
      v15RenderCalendar();
      try{ saveSeasonState(); }catch(e){}
      return result;
    };
    wrapped.__v15Wrapped=true;
    window.createTournament=wrapped;
  }

  // Keep the no-auto-bootcamp contract even if older compatibility code is reloaded.
  window.maybeAutoBootcamp=function(){ return false; };
  window.runAutomaticBootcamps=function(){ return []; };

  function v15Init(){
    try{
      v15EnsureCalendar();
      // Convert old saves to the new calendar without altering player fatigue.
      if(!seasonState.calendar.seasonAnchorMs || seasonState.calendar.seasonPlanSeason!==seasonState.currentSeason){
        v15DecorateSeasonSchedule(false);
      } else v15DecorateSeasonSchedule(false);
      v15RenderCalendar();
      v15StartTick();
      setTimeout(v15RenderCalendar,300);
    }catch(e){ console.warn('[v15 calendar] init failed',e); }
  }

  // Initial real-time catch-up is intentionally small so an old tab cannot jump an entire season.
  try{
    const c=v15EnsureCalendar();
    if(!c.paused){
      const elapsed=Math.max(0,Math.min(15*60,(Date.now()-Number(c.lastWallMs||Date.now()))/1000));
      c.currentMs += elapsed*V15_GAME_MINUTES_PER_REAL_SECOND*c.speed*60000;
    }
    c.lastWallMs=Date.now();
  }catch(e){}

  v15Init();
})();
