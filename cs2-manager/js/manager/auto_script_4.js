
(function(){
  if (window.__finalLiveRepairInstalled) return;
  window.__finalLiveRepairInstalled = true;
  function selected(){
    try { return typeof getSelectedBroadcastItem === 'function' ? getSelectedBroadcastItem() : null; } catch(e){ return null; }
  }
  function forceStart(item){
    const b=currentTournament?.broadcast, st=item?.state;
    if(!b || !st || st.finished || item.status!=='live' || b.paused) return;
    if(st.phase==='map-draft' && st.vetoAnimation?.startedAt && Date.now()-st.vetoAnimation.startedAt>2200){
      if(item.vetoTimer) clearTimeout(item.vetoTimer);
      item.vetoTimer=null;
      st.vetoAnimation.active=false;
      st.phase='playing';
      st.phaseText=`Карта ${st.mapIndex+1} • ${st.maps?.[st.mapIndex]||''}`;
      st.lastRoundAt=Date.now()-Math.max(500, typeof roundDelay==='function'?roundDelay():800);
      try { if(typeof prepareBroadcastRoundBuy==='function') prepareBroadcastRoundBuy(item, Math.max(1,st.round+1)); } catch(e){}
      try { if(typeof addBroadcastEvent==='function') addBroadcastEvent(st,'▶ <strong>Матч начался.</strong>'); } catch(e){}
      try { if(typeof item.resumeBroadcast==='function') item.resumeBroadcast(); } catch(e){}
    }
  }
  function repairDetail(){
    const item=selected();
    if(!item) return;
    forceStart(item);
    const st=item.state, m=item.match;
    const ticker=document.getElementById('match-live-ticker');
    if(ticker && /Матч запускается|разминка команд/i.test(ticker.textContent||'')){
      ticker.innerHTML=`<div class="broadcast-phase-line">${st.phaseText||'▶ Идет игра'} • серия ${st.series1||0}:${st.series2||0} • карта ${st.map1||0}:${st.map2||0}</div><div class="ticker-line">${m.t1} vs ${m.t2} • Раунд+ ${st.round||0} • идет игра</div>`;
    }
    const h1=document.getElementById('timeline-first-half'), h2=document.getElementById('timeline-second-half');
    if(h1 && h2 && !h1.children.length && !h2.children.length){
      const box=h1.closest('.round-timeline-box'); if(box) box.style.display='flex';
      for(let i=1;i<=24;i++){
        const c=document.createElement('div'); c.className='timeline-cell'; c.textContent=i;
        const w=(st.mapRoundWinners||[])[i-1]; if(w===1)c.classList.add('t1-won'); if(w===2)c.classList.add('t2-won');
        (i<=12?h1:h2).appendChild(c);
      }
    }
    const pause=document.getElementById('tv-pause-btn');
    if(pause){
      pause.disabled=false;
      pause.onclick=function(ev){ev['\x70\x72\x65\x76\x65\x6e\x74Default']();ev.stopPropagation(); if(typeof toggleTournamentBroadcastPause==='function') toggleTournamentBroadcastPause();};
    }
    const skip=document.getElementById('tv-skip-btn');
    if(skip){skip.disabled=false; skip.onclick=function(ev){ev['\x70\x72\x65\x76\x65\x6e\x74Default']();ev.stopPropagation();if(typeof nextBroadcastMatch==='function')nextBroadcastMatch();};}
  }
  setInterval(repairDetail,500);
})();
