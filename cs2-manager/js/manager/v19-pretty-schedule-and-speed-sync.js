
(() => {
  'use strict';

  const V19_SLOT_STEP_MIN = 10;
  const V19_FIRST_MATCH_WARMUP_MIN = 15;
  const V19_DEFAULT_TOURNAMENT_START = '15:00';

  function v19Cal(){
    try { return typeof v15EnsureCalendar === 'function' ? v15EnsureCalendar() : seasonState.calendar; }
    catch(e){ return seasonState.calendar || (seasonState.calendar = {}); }
  }
  function v19NowGame(){
    const c=v19Cal();
    return Number(c.currentMs)||Date.now();
  }
  function v19Ceil10(ms){
    const d=new Date(Number(ms)||v19NowGame());
    d.setSeconds(0,0);
    const mins=d.getMinutes();
    const add=(V19_SLOT_STEP_MIN-(mins%V19_SLOT_STEP_MIN))%V19_SLOT_STEP_MIN;
    if(add>0) d.setMinutes(mins+add,0,0);
    return d.getTime();
  }
  function v19RoundScheduleStepTimes(){
    try{
      const schedule=seasonState.seasonSchedule||[];
      for(let i=1;i<schedule.length;i++){
        const step=schedule[i];
        if(!step || !step.calendar) continue;
        step.calendar.startTime=V19_DEFAULT_TOURNAMENT_START;
        if(typeof v15DecorateSeasonSchedule==='function'){
          // Recompute the day/date with the new 15:00 start time.
          const def=typeof v15PlanDefaults==='function' ? v15PlanDefaults(i) : null;
          if(def && !Number.isFinite(Number(step.calendar.dayOffset))) step.calendar.dayOffset=def.dayOffset;
        }
      }
      if(typeof v15DecorateSeasonSchedule==='function') v15DecorateSeasonSchedule(false);
      // Hard-normalize all scheduled tournament starts to exact :00.
      for(let i=1;i<schedule.length;i++){
        const step=schedule[i];
        if(step?.calendar?.startMs) step.calendar.startMs=v19RoundHour(step.calendar.startMs);
      }
    }catch(e){ console.warn('[v19] schedule normalization failed',e); }
  }
  function v19RoundHour(ms){
    const d=new Date(Number(ms)||v19NowGame());
    d.setMinutes(0,0,0);
    d.setHours(d.getHours(),0,0,0);
    return d.getTime();
  }
  function v19SyncMatchPlaybackSpeed(){
    try{
      const c=v19Cal();
      const speed=Math.max(0.1, Number(c.speed)||1);
      // Calendar speed is the master clock speed. Match simulation follows it too.
      if(typeof tvPlaybackSpeed !== 'undefined') tvPlaybackSpeed=speed;
      else window.tvPlaybackSpeed=speed;
      document.querySelectorAll('.tv-speed-btn').forEach(btn=>{
        const val=Number(btn.dataset.speed);
        btn.style.opacity = Math.abs(val-speed)<0.001 ? '1' : '0.55';
      });
      const label=document.getElementById('calendar-speed-label');
      if(label) label.textContent=`${speed}x`;
    }catch(e){ console.warn('[v19] speed sync failed',e); }
  }
  function v19ApplyPrettyTimesToQueue(){
    const b=currentTournament?.broadcast;
    if(!b) return;
    const items=(b.queue||[]).slice().sort((a,b2)=>Number(a.time||0)-Number(b2.time||0));
    if(!items.length) return;
    // Preserve same-slot parallelism (same batchId) but normalize each slot to 10-minute boundaries.
    const seenBatch=new Map();
    items.forEach(item=>{
      const key=Number.isFinite(item.batchId) ? item.batchId : item.id;
      if(seenBatch.has(key)){
        item.time=seenBatch.get(key);
        item.v18PlannedTime=item.time;
        item.gameScheduledAt=item.time;
        return;
      }
      const normalized=v19Ceil10(item.time);
      item.time=normalized;
      item.v18PlannedTime=normalized;
      item.gameScheduledAt=normalized;
      seenBatch.set(key,normalized);
    });
    // Keep the schedule cursor ahead of the final item.
    const maxTime=Math.max(...items.map(x=>Number(x.time)||0));
    const lastBatch=items.length ? Number(items[items.length-1].batchId||0) : 0;
    if(maxTime>0) b.v18ScheduleCursor=Math.max(Number(b.v18ScheduleCursor)||0,maxTime+10*60000);
  }

  // 1) Existing season tournament starts use 15:00 instead of 15:30.
  try{
    v19RoundScheduleStepTimes();
    if(typeof v15RenderCalendar==='function') v15RenderCalendar();
  }catch(e){}

  // 2) New tournament grids: first match is after warmup, then all slots are on :00/:10/:20/... .
  const priorCreate=window.createTournament;
  if(typeof priorCreate==='function' && !priorCreate.__v19Wrapped){
    const wrapped=function(...args){
      const result=priorCreate.apply(this,args);
      try{
        const t=currentTournament;
        if(t && !t.completed){
          const c=v19Cal();
          t.calendar=t.calendar||{};
          const warmupStart=v19NowGame();
          const first=v19Ceil10(warmupStart + V19_FIRST_MATCH_WARMUP_MIN*60000);
          t.calendar.warmupStartAt=warmupStart;
          t.calendar.autoBroadcastAt=first;
          t.calendar.firstMatchPlannedAt=first;
          t.calendar.nextMatchAt=first;
          t.calendar.startTime='15:00';
          t.calendar.broadcastAutoStartPending=true;
          if(t.broadcast){
            t.broadcast.v18ScheduleCursor=first;
            t.broadcast.v19PrettySchedule=true;
          }
          c.nextMatchAt=first;
        }
      }catch(e){ console.warn('[v19] create normalization failed',e); }
      return result;
    };
    wrapped.__v19Wrapped=true;
    window.createTournament=wrapped;
    try{ createTournament=wrapped; }catch(e){}
  }

  // 3) Queue generation: normalize every planned match time to a clean 10-minute value.
  const priorBuild=window.buildBroadcastQueue;
  if(typeof priorBuild==='function' && !priorBuild.__v19Wrapped){
    const wrapped=function(...args){
      const result=priorBuild.apply(this,args);
      try{
        const t=currentTournament;
        if(t){
          const b=t.broadcast;
          if(b && t.calendar?.autoBroadcastAt){
            b.v18ScheduleCursor=Math.max(Number(b.v18ScheduleCursor)||0, v19Ceil10(Number(t.calendar.autoBroadcastAt)));
          }
          v19ApplyPrettyTimesToQueue();
        }
      }catch(e){ console.warn('[v19] queue normalize failed',e); }
      return result;
    };
    wrapped.__v19Wrapped=true;
    window.buildBroadcastQueue=wrapped;
    try{ buildBroadcastQueue=wrapped; }catch(e){}
  }

  // 4) When the last match of the current batch finishes late, move all future matches
  // to the next clean 10-minute slot after the actual completion time.
  const priorFinish=window.finishBroadcastMatch;
  if(typeof priorFinish==='function' && !priorFinish.__v19Wrapped){
    const wrapped=function(item,winner,loser){
      try{
        const b=currentTournament?.broadcast;
        const lastActive=!!(b && Array.isArray(b.active) && b.active.length===1);
        if(lastActive && Array.isArray(b.queue) && b.queue.length){
          const now=v19NowGame();
          const firstFuture=b.queue.slice().sort((a,b2)=>Number(a.time||0)-Number(b2.time||0))[0];
          const planned=Number(firstFuture?.time)||now;
          const target=v19Ceil10(Math.max(now,planned));
          if(target>planned){
            const delta=target-planned;
            b.queue.forEach(q=>{
              q.time=Number(q.time||now)+delta;
              q.v18PlannedTime=q.time;
              q.v19ShiftedByMs=(Number(q.v19ShiftedByMs)||0)+delta;
            });
          }
          // If the next planned time is already behind the actual completion, push everything ahead.
          const nextNow=b.queue.slice().sort((a,b2)=>Number(a.time||0)-Number(b2.time||0))[0];
          if(nextNow && Number(nextNow.time)<now){
            const delta=v19Ceil10(now)-Number(nextNow.time);
            if(delta>0){
              b.queue.forEach(q=>{
                q.time=Number(q.time||now)+delta;
                q.v18PlannedTime=q.time;
                q.v19ShiftedByMs=(Number(q.v19ShiftedByMs)||0)+delta;
              });
            }
          }
        }
      }catch(e){ console.warn('[v19] late-match reschedule failed',e); }
      return priorFinish.apply(this,arguments);
    };
    wrapped.__v19Wrapped=true;
    window.finishBroadcastMatch=wrapped;
    try{ finishBroadcastMatch=wrapped; }catch(e){}
  }

  // 5) Never replace future times with ugly minute values on launch.
  const priorSchedule=window.scheduleNextBroadcastBatch;
  if(typeof priorSchedule==='function' && !priorSchedule.__v19Wrapped){
    const wrapped=function(...args){
      try{
        const b=currentTournament?.broadcast;
        if(b?.queue?.length){
          b.queue.forEach(q=>{
            if(q.status==='scheduled' && q.time) q.time=v19Ceil10(q.time);
            if(q.status==='scheduled' && q.v18PlannedTime) q.v18PlannedTime=q.time;
          });
        }
      }catch(e){}
      return priorSchedule.apply(this,args);
    };
    wrapped.__v19Wrapped=true;
    window.scheduleNextBroadcastBatch=wrapped;
    try{ scheduleNextBroadcastBatch=wrapped; }catch(e){}
  }

  // 6) Calendar speed is also match speed. Pause remains a true global pause.
  const priorSetSpeed=window.setGameCalendarSpeed;
  if(typeof priorSetSpeed==='function' && !priorSetSpeed.__v19Wrapped){
    const wrapped=function(speed){
      const r=priorSetSpeed.apply(this,arguments);
      v19SyncMatchPlaybackSpeed();
      return r;
    };
    wrapped.__v19Wrapped=true;
    window.setGameCalendarSpeed=wrapped;
    try{ setGameCalendarSpeed=wrapped; }catch(e){}
  }

  // 7) Keep match simulation speed continuously aligned with calendar speed.
  setInterval(()=>{
    try{
      v19SyncMatchPlaybackSpeed();
      const c=v19Cal();
      if(currentTournament && !currentTournament.completed){
        const b=currentTournament.broadcast;
        if(b?.queue?.length) v19ApplyPrettyTimesToQueue();
        if(typeof v15RenderCalendar==='function') v15RenderCalendar();
      }
    }catch(e){}
  },1000);

  v19SyncMatchPlaybackSpeed();
  try{ v19ApplyPrettyTimesToQueue(); }catch(e){}
})();
