
(() => {
  'use strict';

  function v17Calendar(){
    if(typeof v15EnsureCalendar==='function') return v15EnsureCalendar();
    if(!seasonState.calendar || typeof seasonState.calendar!=='object') seasonState.calendar={};
    return seasonState.calendar;
  }

  function v17GetNextTournamentStep(){
    try{
      if(typeof v15NextStep==='function') return v15NextStep();
      const idx=Number(seasonState.tournamentIndex)||1;
      return seasonState.seasonSchedule?.[idx] || null;
    }catch(e){ return null; }
  }

  function v17HasActiveTournament(){
    return !!(typeof currentTournament!=='undefined' && currentTournament && !currentTournament.completed);
  }

  function v17SetTournamentFormFromSchedule(){
    try{
      if(typeof updateTournamentSuggestion==='function') updateTournamentSuggestion();
    }catch(e){ console.warn('[v17] schedule form sync failed',e); }
  }

  function v17StartScheduledTournament(){
    if(v17HasActiveTournament()) return true;
    const step=v17GetNextTournamentStep();
    if(!step) return false;
    const c=v17Calendar();
    const start=Number(step.calendar?.startMs)||0;
    if(start>0 && c.currentMs<start) return false;

    // Put the form in sync with the scheduled event before automatic launch.
    v17SetTournamentFormFromSchedule();
    try{
      if(typeof initTournamentCycle==='function'){
        initTournamentCycle();
      }else if(typeof createTournament==='function'){
        createTournament();
        if(typeof renderTournament==='function') renderTournament();
        if(typeof renderRating==='function') renderRating();
        if(typeof saveSeasonState==='function') saveSeasonState();
      }
    }catch(err){
      console.error('[v17] automatic scheduled tournament launch failed:',err);
      const status=document.getElementById('tour-status');
      if(status) status.innerText=`⚠️ Не удалось автоматически открыть турнир: ${err?.message||'ошибка'}`;
      return false;
    }
    if(!v17HasActiveTournament()) return false;

    const cc=v17Calendar();
    const actualStart=Math.max(Number(cc.currentMs)||0, start||0);
    cc.nextMatchAt=actualStart;
    try{ saveSeasonState(); }catch(e){}
    if(typeof v15RenderCalendar==='function') v15RenderCalendar();
    return true;
  }

  function v17SmartSkip(){
    const c=v17Calendar();

    // During a running event, keep Skip as a normal one-day jump.
    if(v17HasActiveTournament()){
      if(typeof v15AdvanceMinutes==='function') v15AdvanceMinutes(1440,'пропуск дня');
      else c.currentMs += 1440*60000;
      c.lastWallMs=Date.now();
      try{ saveSeasonState(); }catch(e){}
      if(typeof v15RenderCalendar==='function') v15RenderCalendar();
      return;
    }

    // Between events: jump directly to the next tournament's scheduled start.
    const step=v17GetNextTournamentStep();
    if(!step){
      if(typeof v15AdvanceMinutes==='function') v15AdvanceMinutes(1440,'пропуск дня');
      c.lastWallMs=Date.now();
      if(typeof v15RenderCalendar==='function') v15RenderCalendar();
      return;
    }
    const start=Number(step.calendar?.startMs)||0;
    if(start>0 && c.currentMs<start){
      c.currentMs=start;
      c.lastAdvanceReason='переход к началу следующего турнира';
    }

    // If the scheduled start was already missed while the user skipped manually,
    // treat the event as due now instead of requiring another manual click.
    v17StartScheduledTournament();

    c.lastWallMs=Date.now();
    try{ saveSeasonState(); }catch(e){}
    if(typeof v15RenderCalendar==='function') v15RenderCalendar();
  }

  window.skipGameCalendarDay=v17SmartSkip;

  function v17RefreshSkipLabel(){
    const btn=document.getElementById('calendar-skip-btn');
    if(!btn) return;
    if(v17HasActiveTournament()){
      btn.textContent='⏭ День';
      btn.title='Пропустить 1 игровой день турнира';
      return;
    }
    const step=v17GetNextTournamentStep();
    if(step?.calendar?.startMs){
      const c=v17Calendar();
      if(Number(step.calendar.startMs)>Number(c.currentMs)){
        btn.textContent='⏭ К турниру';
        btn.title='Пропустить время до начала следующего турнира';
      }else{
        btn.textContent='▶ Начать турнир';
        btn.title='Начать запланированный турнир, который уже наступил';
      }
    }else{
      btn.textContent='⏭ День';
      btn.title='Пропустить 1 игровой день';
    }
  }

  // Automatically open a scheduled tournament when the virtual clock reaches it.
  function v17AutoStartDueTournament(){
    if(v17HasActiveTournament()) return false;
    const step=v17GetNextTournamentStep();
    if(!step?.calendar?.startMs) return false;
    const c=v17Calendar();
    if(Number(c.currentMs) < Number(step.calendar.startMs)) return false;
    return v17StartScheduledTournament();
  }

  const priorAdvance = window.v15AdvanceMinutes;
  if(typeof priorAdvance==='function' && !priorAdvance.__v17Wrapped){
    const wrapped=function(mins,reason=''){
      const r=priorAdvance.apply(this,arguments);
      try{ v17AutoStartDueTournament(); }catch(e){ console.warn('[v17] auto-start after advance failed',e); }
      try{ v17RefreshSkipLabel(); }catch(e){}
      return r;
    };
    wrapped.__v17Wrapped=true;
    window.v15AdvanceMinutes=wrapped;
  }

  // Hook the calendar render so the button always reflects the current state.
  const priorRender=window.v15RenderCalendar;
  if(typeof priorRender==='function' && !priorRender.__v17Wrapped){
    const wrapped=function(){
      const r=priorRender.apply(this,arguments);
      try{ v17RefreshSkipLabel(); }catch(e){}
      return r;
    };
    wrapped.__v17Wrapped=true;
    window.v15RenderCalendar=wrapped;
  }

  // Also check the real-time clock once per second. This means the user can simply
  // let time run and the scheduled event will open when its start time is reached.
  if(window.v15Ticker && typeof window.v15Ticker==='number'){
    // no-op; original ticker is owned by v15 and cannot be safely replaced here.
  }
  setInterval(()=>{
    try{
      if(!v17HasActiveTournament()) v17AutoStartDueTournament();
      v17RefreshSkipLabel();
    }catch(e){}
  },1000);

  // Initialize once after the page has restored the state.
  setTimeout(()=>{
    try{ v17AutoStartDueTournament(); }catch(e){}
    try{ v17RefreshSkipLabel(); }catch(e){}
  },500);
})();
