
(() => {
  function getSettingsBackdrop(){ return document.getElementById('settings-drawer-backdrop'); }
  window.openSettingsMenu=function(){ const el=getSettingsBackdrop(); if(el) el.classList.add('open'); };
  window.closeSettingsMenu=function(event){ const el=getSettingsBackdrop(); if(!el) return; if(event && event.target !== el) return; el.classList.remove('open'); };
  window.toggleSettingsMenu=function(){ const el=getSettingsBackdrop(); if(el) el.classList.toggle('open'); };
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') window.closeSettingsMenu(); });

  // The old v7 Favorite Team panel is intentionally removed from the UI.
  try {
    if(typeof seasonState !== 'undefined'){ seasonState.favoriteTeam=''; seasonState.v7Welcome=true; }
    if(typeof V7 !== 'undefined'){ V7.autoSeason=false; V7.favoriteTeam=''; }
  } catch(e) {}
  const removeLegacyFavorite=()=>{ const el=document.getElementById('v7-favorite-panel'); if(el) el.remove(); };
  removeLegacyFavorite();
  setInterval(removeLegacyFavorite, 1000);

  // Harden tournament generation against a bad saved roster / event side-effect.
  const originalCreateTournamentV16 = window.createTournament;
  if(typeof originalCreateTournamentV16==='function' && !originalCreateTournamentV16.__v16Safe){
    const safeCreate=function(customRoster=null){
      try {
        if(typeof teams!=='undefined' && Array.isArray(teams)) teams.forEach(t=>{ try{ ensurePlayerLayer(t); }catch(e){} });
        const result=originalCreateTournamentV16.apply(this,arguments);
        if(!currentTournament) throw new Error('Турнир не был создан');
        currentTournament.participants = Array.isArray(currentTournament.participants) ? currentTournament.participants.filter(Boolean) : [];
        return result;
      } catch(err){
        console.error('v16 createTournament repair:',err);
        // Second pass: suppress only the non-critical random event layer for this creation attempt.
        try {
          const oldEvents=window.triggerRandomEvents;
          if(typeof oldEvents==='function') window.triggerRandomEvents=()=>{};
          const retry=originalCreateTournamentV16.apply(this,arguments);
          window.triggerRandomEvents=oldEvents;
          if(!currentTournament) throw err;
          return retry;
        } catch(retryErr){
          try{ if(typeof window.triggerRandomEvents==='function') window.triggerRandomEvents=window.triggerRandomEvents; }catch(e){}
          throw retryErr;
        }
      }
    };
    safeCreate.__v16Safe=true;
    window.createTournament=safeCreate;
    try { createTournament=safeCreate; } catch(e) {}
  }

  // Make the actual button path resilient and always expose a useful status.
  window.initTournamentCycle = function(){
    try {
      stopAllSimulations();
      createTournament();
      if(!currentTournament) throw new Error('Сетка не создана');
      renderTournament();
      renderRating();
      saveSeasonState();
      stopRequested=false; isTVModeRunning=false; isFastSimRunning=false; isStepSimRunning=false;
      updateSimControlButtons(false);
      const root=document.getElementById('bracket-root-layout');
      const hasContent=!!root && !!root.querySelector('.match,.major-stage-panel,.swiss-container,.gsl-container,.bounty-layout-wrap');
      if(!hasContent) { renderTournament(); }
      const status=document.getElementById('tour-status');
      if(status && !status.innerText.trim()) status.innerText='Турнир начался';
    } catch(err){
      console.error('v16 tournament generation error:',err);
      const status=document.getElementById('tour-status');
      if(status) status.innerText=`⚠️ Не удалось создать турнир: ${err?.message || 'ошибка'}`;
    }
  };
  try { initTournamentCycle=window.initTournamentCycle; } catch(e) {}
})();
