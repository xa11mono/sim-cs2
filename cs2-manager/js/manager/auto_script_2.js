
(() => {
  'use strict';
  const V7 = {
    version: 7,
    autoSeason: false,
    autoStartDelay: 900,
    autoAdvanceDelay: 850,
    autoBusy: false,
    speedPreset: seasonState.tvSpeedPreset || 'realistic',
    speedPresets: {
      fast: {label:'⚡ Быстро', speed:2.0, parallel:3},
      realistic: {label:'🎮 Реалистично', speed:1.2, parallel:2},
      cinematic: {label:'🎬 Кинематографично', speed:0.65, parallel:1}
    },
    recaps: seasonState.seasonRecaps || {},
    hintCache: seasonState.pickemHints || {}
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const teamByName = (name) => teams.find(t => t?.name === name) || null;
  const teamNames = () => teams.map(t => t.name);
  const uniq = arr => [...new Set(Array.isArray(arr) ? arr : [])];
  function v7Save() {
    seasonState.autoSeason = V7.autoSeason;
    seasonState.tvSpeedPreset = V7.speedPreset;
    seasonState.seasonRecaps = V7.recaps;
    seasonState.pickemHints = V7.hintCache;
    try {
      saveSeasonState();
      saveTeams();
    } catch (e) {}
  }
  try {
    const moreRegular = [
      'IEM Summer Circuit', 'CCT Europe Series Finals', 'United21 Championship',
      'RES Regional Championship', 'Fire Cup Global', 'Pinnacle Cup Championship',
      'ESL Challenger Atlanta', 'CCT Season Finals', 'Gamebox Invitational',
      'Global Esports Open', 'Circuit Breakers Cup', 'Arena Masters',
      'Rising Nations Cup', 'Continental Clash', 'Frontier League Finals'
    ];
    const moreElite = [
      'IEM Spring Finals', 'IEM Fall Finals', 'ESL Pro Tour Masters',
      'BLAST Premier Fall Final', 'DreamHack Masters Finals', 'World Esports Invitational'
    ];
    const moreMajor = [
      'PGL Major Krakow', 'BLAST.tv Major Madrid', 'IEM Major London'
    ];
    TOUR_DATABASE.regular.push(...moreRegular.filter(n => !TOUR_DATABASE.regular.includes(n)));
    TOUR_DATABASE.elite.push(...moreElite.filter(n => !TOUR_DATABASE.elite.includes(n)));
    TOUR_DATABASE.major.push(...moreMajor.filter(n => !TOUR_DATABASE.major.includes(n)));
  } catch (e) {}
  function v7EnsureMapModel() {
    teams.forEach(t => {
      t.mapStrength = t.mapStrength || {};
      t.mapStats = t.mapStats || {};
      t.mapStatsVersion = 3;
      MAP_POOL.forEach(map => {
        let strength = Number(t.mapStrength[map]);
        if (!Number.isFinite(strength) || strength < 35 || strength > 95) {
          strength = Number(t.maps?.[map]);
        }
        if (!Number.isFinite(strength) || strength < 35 || strength > 95) {
          strength = 50 + Math.random() * 25;
        }
        t.mapStrength[map] = Math.round(clamp(strength, 35, 95) * 10) / 10;
        if (!t.mapStats[map]) t.mapStats[map] = {wins:0, losses:0};
      });
    });
  }
  function v7ZeroSeasonMapStats() {
    teams.forEach(t => {
      t.mapStrength = t.mapStrength || {};
      t.mapStats = {};
      t.mapStatsVersion = 3;
      t.mapHistory = [];
      t.mapPickHistory = {};
      MAP_POOL.forEach(map => {
        let strength = Number(t.mapStrength[map]);
        if (!Number.isFinite(strength)) strength = Number(t.maps?.[map]);
        if (!Number.isFinite(strength)) strength = 50;
        t.mapStrength[map] = Math.round(clamp(strength,35,95)*10)/10;
        t.mapStats[map] = {wins:0, losses:0};
        t.maps = t.maps || {};
        t.maps[map] = 0;
      });
    });
    seasonState.mapStatsSeason = seasonState.currentSeason;
  }
  function v7SeasonWinrate(teamName, mapName) {
    const t = teamByName(teamName);
    if (!t || !mapName) return 0;
    const r = t.mapStats?.[mapName];
    const games = (Number(r?.wins)||0) + (Number(r?.losses)||0);
    if (games <= 0) return 0;
    return Math.round((Number(r.wins)||0) / games * 1000) / 10;
  }
  function v7MapStrength(teamName, mapName) {
    const t = teamByName(teamName);
    const v = Number(t?.mapStrength?.[mapName]);
    return Number.isFinite(v) ? v : 50;
  }
  v7EnsureMapModel();
  if (seasonState.mapEngineV7 !== true) {
    seasonState.mapEngineV7 = true;
    seasonState.mapStatsSeason = seasonState.currentSeason;
    v7Save();
  }
  const originalGetMapWinrate = getMapWinrate;
  getMapWinrate = function(teamName, mapName) {
    return v7SeasonWinrate(teamName, mapName);
  };
  const originalConductMapVeto = conductMapVeto;
  conductMapVeto = function(t1Name, t2Name, mode='BO3') {
    const t1 = teamByName(t1Name), t2 = teamByName(t2Name);
    if (!t1 || !t2) return originalConductMapVeto(t1Name, t2Name, mode);
    const old1 = t1.maps, old2 = t2.maps;
    t1.maps = {...(t1.mapStrength || old1 || {})};
    t2.maps = {...(t2.mapStrength || old2 || {})};
    try {
      return originalConductMapVeto(t1Name, t2Name, mode);
    } finally {
      t1.maps = old1;
      t2.maps = old2;
    }
  };
  const originalMaybeAutoBootcamp = maybeAutoBootcamp;
  maybeAutoBootcamp = function(t) {
    if (!t) return false;
    const oldMaps = t.maps;
    t.maps = {...(t.mapStrength || oldMaps || {})};
    try { return originalMaybeAutoBootcamp(t); }
    finally {
      t.maps = oldMaps || {};
      MAP_POOL.forEach(map => {
        if (!t.maps) t.maps = {};
        t.maps[map] = v7SeasonWinrate(t.name, map);
      });
    }
  };
  function v7FindBroadcastItem(t1Name, t2Name) {
    const b = currentTournament?.broadcast;
    if (!b) return null;
    return (b.active || []).find(item => item?.match?.t1 === t1Name && item?.match?.t2 === t2Name)
      || (b.active || []).find(item => item?.match?.t1 === t2Name && item?.match?.t2 === t1Name)
      || null;
  }
function v7MapProbability(t1Name, t2Name, mapName) {
    const t1 = teamByName(t1Name), t2 = teamByName(t2Name);
    if (!t1 || !t2 || !mapName) return 0.5;
    const matchProb = calcMatchOdds(t1Name, t2Name, true)?.p1_win ?? 0.5;
    let p = 0.5 + (matchProb - 0.5) * 0.45;
    const mapDiff = v7MapStrength(t1Name, mapName) - v7MapStrength(t2Name, mapName);
    p += clamp(mapDiff, -25, 25) / 100 * 0.22;
    const item = v7FindBroadcastItem(t1Name, t2Name);
    const st = item?.state;
    if (st && st.maps) {
      if (st.mapIndex === 0) p += 0.09;
      if (st.mapIndex === 1) p -= 0.09;
    }
    const formDiff = clamp((Math.round(Number(t1.form)||100)) - (Math.round(Number(t2.form)||100)), -12, 12);
    p += formDiff / 100 * 0.07;
    const fat1 = Number(t1.fatigue) || 0;
    const fat2 = Number(t2.fatigue) || 0;
    let fatigueDiff = 0;
    if (fat1 >= 40) fatigueDiff -= (fat1 - 40) * 0.004;
    if (fat2 >= 40) fatigueDiff += (fat2 - 40) * 0.004;
    p += fatigueDiff;
    if (st && !st.finished) {
      const signedScore = st.__match?.t1 === t1Name ? (st.map1 - st.map2) : (st.map2 - st.map1);
      p += clamp(signedScore, -6, 6) * 0.009;
      const sideForT1 = st.__match?.t1 === t1Name ? 1 : 2;
      const recent = getBroadcastTeamTrend(st, sideForT1, 5);
      p += clamp(recent.streak, -5, 5) * 0.007;
      const impact = st.v7SpecialImpact;
      if (impact) {
        const direct = impact[sideForT1];
        const opp = impact[sideForT1 === 1 ? 2 : 1];
        p += clamp((direct?.value || 0) - (opp?.value || 0), -0.025, 0.025);
      }
    }
    return clamp(p, 0.12, 0.88);
  }
  calcMapWinProbability = function(t1Name, t2Name, mapName) {
    return v7MapProbability(t1Name, t2Name, mapName);
  };
  function v7FavoriteName() { return seasonState.favoriteTeam || ''; }
  function v7RenderFavoritePanel() { const old=document.getElementById('v7-favorite-panel'); if(old) old.remove(); }
  window.v7SetFavoriteTeam = function(name) {
    const value = String(name || '').trim();
    if (value && !teamByName(value)) return;
    seasonState.favoriteTeam = value;
    v7Save();
    v7RenderFavoritePanel();
    renderRating();
    renderTournament();
    if (value && !currentTournament) window.v7StartCurrentSeason();
  };
  window.v7SetAutoSeason = function(enabled) {
    V7.autoSeason = !!enabled;
    v7Save();
  };
  function v7HighlightFavorite(root) {
    const fav = v7FavoriteName();
    if (!fav || !root) return;
    root.querySelectorAll('.match[data-v7-t1]').forEach(el => {
      const hit = el.dataset.v7T1 === fav || el.dataset.v7T2 === fav;
      el.classList.toggle('v7-favorite-match', hit);
      const old = el.querySelector('.v7-fav-badge');
      if (hit && !old && !el.querySelector('.v7-fav-badge')) {
        const b = document.createElement('div');
        b.className='v7-fav-badge'; b.textContent='⭐ FOLLOW'; el.prepend(b);
      }
      if (!hit && old) old.remove();
    });
  }
  const originalRenderRating = renderRating;
  renderRating = function() {
    originalRenderRating();
    v7RenderFavoritePanel();
    const fav = v7FavoriteName();
    document.querySelectorAll('#rating-table tbody tr').forEach((tr, idx) => {
      const team = teams[idx];
      if (!team) return;
      const old = tr.querySelector('.v7-rating-star');
      if (team.name === fav) {
        tr.classList.add('v7-favorite-row');
        if (!old) tr.children[1]?.insertAdjacentHTML('afterbegin','<span class="v7-rating-star">⭐</span> ');
      } else {
        tr.classList.remove('v7-favorite-row');
        old?.remove();
      }
    });
  };
  const originalCreateMatchElement = createMatchElement;
  createMatchElement = function(m, onAction, isFinal=false) {
    const el = originalCreateMatchElement(m,onAction,isFinal);
    if (m) {
      el.dataset.v7T1 = m.t1 || '';
      el.dataset.v7T2 = m.t2 || '';
    }
    return el;
  };
  const originalRenderTournament = renderTournament;
  renderTournament = function() {
    if (!currentTournament) return;
    originalRenderTournament();
    v7HighlightFavorite(document);
  };
  window.v7FollowNextFavoriteMatch = function() {
    const fav = v7FavoriteName();
    if (!fav) return alert('Сначала выберите любимую команду.');
    const live = currentTournament?.broadcast?.active?.find(x => x.match?.t1 === fav || x.match?.t2 === fav);
    if (live) return openBroadcastMatchDetail(live.id);
    const next = (currentTournament ? getBroadcastPlayableMatches() : []).find(x => x.match?.t1 === fav || x.match?.t2 === fav);
    if (next) return openManualMatchPreview(next.match, next.callback);
    const queued = currentTournament?.broadcast?.queue?.find(x => x.match?.t1 === fav || x.match?.t2 === fav);
    if (queued) return openBroadcastScheduledPreview(queued.match);
    alert('Матч любимой команды пока не найден в текущем этапе.');
  };
  /* ---------- better economy ---------- */
  const originalPrepareBroadcastRoundBuy = prepareBroadcastRoundBuy;
  prepareBroadcastRoundBuy = function(item, roundNo) {
    const plan = originalPrepareBroadcastRoundBuy(item, roundNo);
    if (!plan) return plan;
    ['t1','t2'].forEach(key => {
      const buy = plan[key];
      const bank = Number(item?.state?.economy?.[key]?.money ?? buy.bank ?? 0);
      if (bank >= 5000 && ['eco','deagle','half','pistol'].includes(buy.type)) {
        buy.type = 'full';
        buy.reason = 'достаточный банк • обязательный полный закуп';
      } else if (bank >= 3600 && ['eco','pistol'].includes(buy.type)) {
        buy.type = 'half';
        buy.reason = 'банк выше эко-порога • переход к полу-закупу';
      } else if (bank >= 2900 && buy.type === 'eco') {
        buy.type = 'force';
        buy.reason = 'банк достаточный для форса';
      }
      buy.bank = bank;
    });
    item.state.economy.t1.lastBuy = plan.t1.type;
    item.state.economy.t2.lastBuy = plan.t2.type;
    return plan;
  };
  /* ---------- speed presets ---------- */
  function v7ApplyPreset(key, rerender=true) {
    const p = V7.speedPresets[key];
    if (!p) return;
    V7.speedPreset = key;
    tvPlaybackSpeed = p.speed;
    seasonState.tvSpeedPreset = key;
    v7Save();
    document.querySelectorAll('.v7-speed-preset').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === key));
    document.querySelectorAll('.tv-speed-btn').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.speed) === p.speed));
    if (rerender) renderBroadcastPanel();
  }
  getMaxParallelMatches = function() {
    return V7.speedPresets[V7.speedPreset]?.parallel || 2;
  };
  function v7InjectSpeedPresets() {
    const ctrl = document.getElementById('tv-playback-controls');
    if (!ctrl || document.getElementById('v7-speed-presets')) return;
    const wrap=document.createElement('span');
    wrap.id='v7-speed-presets';
    wrap.className='v7-speed-presets';
    wrap.innerHTML = `<span class="v7-speed-label">ПРЕСЕТ:</span>${Object.entries(V7.speedPresets).map(([key,p])=>`<button type="button" class="secondary v7-speed-preset" data-preset="${key}">${p.label}</button>`).join('')}`;
    ctrl.prepend(wrap);
    wrap.querySelectorAll('.v7-speed-preset').forEach(btn => btn.addEventListener('click',()=>v7ApplyPreset(btn.dataset.preset)));
    v7ApplyPreset(V7.speedPreset, false);
  }
  document.querySelectorAll('.tv-speed-btn').forEach(btn => btn.addEventListener('click', function(){
    V7.speedPreset = 'manual';
    tvPlaybackSpeed = Number(this.dataset.speed) || tvPlaybackSpeed;
    seasonState.tvSpeedPreset = 'manual';
    v7Save();
    document.querySelectorAll('.v7-speed-preset').forEach(b=>b.classList.remove('active'));
  }));
  const originalGetBroadcastStatusText = getBroadcastStatusText;
  getBroadcastStatusText = function(item) {
    const st=item?.state;
    if (st?.phase === 'technical-pause') return `🛠 Техническая пауза${st.technicalReason ? ` • ${st.technicalReason}` : ''}`;
    return originalGetBroadcastStatusText(item);
  };
  const originalGetBroadcastStateClass = getBroadcastStateClass;
  getBroadcastStateClass = function(item) {
    const st=item?.state;
    if (st?.phase === 'technical-pause') return 'technical';
    return originalGetBroadcastStateClass(item);
  };
  const originalFormatBroadcastScore = formatBroadcastScore;
  formatBroadcastScore = function(item) {
    const st=item?.state;
    if (st?.phase === 'technical-pause') {
      return `${st.map1}:${st.map2} • ${st.series1}:${st.series2} • 🛠 ТЕХ ПАУЗА`;
    }
    return originalFormatBroadcastScore(item);
  };
  const originalBroadcastAdvancePhase = broadcastAdvancePhase;
  broadcastAdvancePhase = function(item, now) {
    const st=item?.state;
    if (st?.phase === 'technical-pause') {
      if (now < st.phaseUntil) return false;
      const who=st.technicalTeam || 'состав';
      st.phase='playing';
      st.technicalTeam=null;
      st.technicalReason=null;
      st.phaseUntil=0;
      st.lastRoundAt=now;
      addBroadcastEvent(st, `🔧 <strong>Техническая пауза завершена.</strong> ${who} готовы продолжать.`);
      st.phaseText = st.overtime ? `🔥 Овертайм • ${st.map1}:${st.map2}` : `Карта ${st.mapIndex+1} • ${st.map1}:${st.map2}`;
      return true;
    }
    return originalBroadcastAdvancePhase(item,now);
  };
  const TECHNICAL_EVENTS = [
    {reason:'сломался игровой ПК', icon:'🖥️'},
    {reason:'замена мыши / периферии', icon:'🖱️'},
    {reason:'проблема с сетью', icon:'🌐'},
    {reason:'сбой клиентского оборудования', icon:'🔌'},
    {reason:'проверка технического соединения', icon:'🧰'},
    {reason:'замена кабеля / монитора', icon:'🖥️'}
  ];
  const BIG_EVENTS = [
    {type:'comeback', icon:'🔥', text:'МЕГА-КАМБЕК'},
    {type:'collapse', icon:'📉', text:'КОМАНДА РАЗВАЛИВАЕТСЯ'}
  ];
  function v7MaybeBigEvent(item) {
    const st=item?.state, m=item?.match;
    if (!st || !m || st.finished || st.phase !== 'playing') return false;
    st.v7BigCooldown = Math.max(0, Number(st.v7BigCooldown)||0);
    if (st.v7BigCooldown > 0) return false;
    const diff = Math.abs(st.map1-st.map2);
    if (diff < 4 || st.round < 8) return false;
    if (Math.random() > 0.014) return false;
    const trailingSide = st.map1 < st.map2 ? 1 : 2;
    const leadingSide = trailingSide===1 ? 2 : 1;
    const type = Math.random() < 0.60 ? 'comeback' : 'collapse';
    st.v7SpecialImpact = st.v7SpecialImpact || {1:null,2:null};
    if (type === 'comeback') {
      st.v7SpecialImpact[trailingSide] = {value:0.16, roundsLeft:6};
      st.v7SpecialImpact[leadingSide] = {value:-0.05, roundsLeft:6};
      const team = trailingSide===1?m.t1:m.t2;
      addBroadcastEvent(st, `🔥 <strong>МЕГА-КАМБЕК НАЧИНАЕТСЯ!</strong> ${team} отстают ${Math.min(st.map1,st.map2)}:${Math.max(st.map1,st.map2)}, но полностью меняют темп.` , 'highlight');
    } else {
      st.v7SpecialImpact[leadingSide] = {value:-0.17, roundsLeft:5};
      st.v7SpecialImpact[trailingSide] = {value:0.08, roundsLeft:5};
      const team = leadingSide===1?m.t1:m.t2;
      addBroadcastEvent(st, `📉 <strong>РАЗВАЛ!</strong> ${team} теряют контроль над картой несмотря на лидерство.` , 'highlight');
    }
    st.v7BigCooldown=8;
    return true;
  }
  function v7MaybeTechnicalPause(item, now) {
    const st=item?.state, m=item?.match;
    if (!st || !m || st.finished || st.phase !== 'playing' || st.round < 3) return false;
    if (st.__v7TechMapIndex !== st.mapIndex) {
      st.__v7TechMapIndex = st.mapIndex;
      st.__v7TechUsed = false;
    }
    if (st.__v7TechUsed) return false;
    if (Math.random() > 0.038) return false;
    const side = Math.random() < 0.5 ? 1 : 2;
    const reason = TECHNICAL_EVENTS[Math.floor(Math.random()*TECHNICAL_EVENTS.length)];
    st.__v7TechUsed = true;
    st.technicalTeam = side===1?m.t1:m.t2;
    st.technicalReason = `${reason.icon} ${reason.reason}`;
    st.phase='technical-pause';
    st.phaseUntil = now + Math.round(6500 / Math.max(0.5,tvPlaybackSpeed));
    st.phaseText = `🛠 Техническая пауза • ${st.technicalTeam}`;
    addBroadcastEvent(st, `🛠 <strong>Техническая пауза:</strong> ${st.technicalTeam} — ${reason.icon} ${reason.reason}.`);
    return true;
  }
  function v7TickImpacts(st) {
    if (st?.v7SpecialImpact) {
      [1,2].forEach(side=>{
        const x=st.v7SpecialImpact[side];
        if (!x) return;
        x.roundsLeft--;
        if (x.roundsLeft<=0) st.v7SpecialImpact[side]=null;
        else x.value *= 0.72;
      });
    }
    if (st) st.v7BigCooldown=Math.max(0,(Number(st.v7BigCooldown)||0)-1);
  }
  const originalMaybeTriggerBroadcastTacticalPause = maybeTriggerBroadcastTacticalPause;
  maybeTriggerBroadcastTacticalPause = function(item, now) {
    if (v7MaybeTechnicalPause(item, now)) return true;
    v7MaybeBigEvent(item);
    return originalMaybeTriggerBroadcastTacticalPause(item, now);
  };
  const originalConsumeBroadcastTacticalImpact = consumeBroadcastTacticalImpact;
  consumeBroadcastTacticalImpact = function(st) {
    originalConsumeBroadcastTacticalImpact(st);
    v7TickImpacts(st);
  };
  const originalBroadcastRenderDetail = broadcastRenderDetail;
  broadcastRenderDetail = function(item) {
    originalBroadcastRenderDetail(item);
    const title = document.querySelector('#dice-modal .momentum-wrap .match-section-title');
    if (title) title.textContent = '🎯 Вероятность победы на карте';
    const st=item?.state, m=item?.match;
    if (!st || !m || st.finished) return;
    const map=st.maps?.[st.mapIndex];
    if (!map) return;
    const liveOdds = st.liveOdds;
    if (!liveOdds) return;
    const p1 = Number(liveOdds.p1) || 50;
    const p2 = Number(liveOdds.p2) || (100 - p1);
    const a=document.getElementById('mom-fill-t1'), b=document.getElementById('mom-fill-t2');
    const la=document.getElementById('mom-t1-pct'), lb=document.getElementById('mom-t2-pct');
    if(a)a.style.width=`${p1}%`; if(b)b.style.width=`${p2}%`;
    if(la)la.textContent=`${m.t1}: ${p1}% (${liveOdds.c1}x)`; if(lb)lb.textContent=`(${liveOdds.c2}x) ${p2}% :${m.t2}`;
    const t1Card=document.getElementById('team1-live-name')?.parentElement;
    const t2Card=document.getElementById('team2-live-name')?.parentElement;
    if(t1Card) t1Card.querySelector('.map-live-winrates')?.querySelector('.map-live-winrate')?.replaceChildren(document.createTextNode(`${p1}% шанс`));
    if(t2Card) t2Card.querySelector('.map-live-winrates')?.querySelector('.map-live-winrate')?.replaceChildren(document.createTextNode(`${p2}% шанс`));
  };
  function v7RefreshMatchProbBars() {
    document.querySelectorAll('.match[data-v7-t1][data-v7-t2]').forEach(el => {
      const t1=el.dataset.v7T1,t2=el.dataset.v7T2;
      const bar=el.querySelector('.prob-bar-fill');
      const row=el.querySelector('.bet-info-row');
      if (!bar || !row) return;
      const live=v7FindBroadcastItem(t1,t2);
      const liveOdds = live?.state?.liveOdds;
      let p1, p2;
      if (liveOdds) {
        p1 = Number(liveOdds.p1) || 50;
        p2 = Number(liveOdds.p2) || (100 - p1);
      } else {
        const p = calcMatchOdds(t1,t2,false)?.p1_win ?? 0.5;
        p1 = Math.round(p*100); p2 = 100-p1;
      }
      bar.style.width=`${p1}%`;
      if(row.children[0]) row.children[0].textContent=`${p1}%`;
      if(row.children[1]) row.children[1].textContent=`${p2}%`;
    });
  }
  const oldRT2=renderTournament;
  renderTournament=function(){ oldRT2(); v7HighlightFavorite(document); v7RefreshMatchProbBars(); v7RenderFavoritePanel(); v7InjectSpeedPresets(); };
  const originalComputePickemStageHints = computePickemStageHints;
  function v7PickemHintKey(stTeams) {
    const names=uniq((stTeams||[]).map(x=>x.name)).sort();
    return `${seasonState.currentSeason}|${currentTournament?.name || 'major'}|${names.join(',')}`;
  }
  computePickemStageHints = function(stTeams) {
    const key=v7PickemHintKey(stTeams);
    if (Object.prototype.hasOwnProperty.call(V7.hintCache,key)) return [...(V7.hintCache[key]||[])];
    const result=originalComputePickemStageHints(stTeams) || [];
    V7.hintCache[key]=[...result];
    v7Save();
    return result;
  };
  function v7IsFinalMatch(m) {
    if (!currentTournament || !m) return false;
    if (currentTournament.grandFinal === m) return true;
    const u=currentTournament.upperRounds;
    return Array.isArray(u) && u.length>0 && u[u.length-1]?.includes(m);
  }
  const originalRecordH2HWin = recordH2HWin;
  recordH2HWin = function(winner, loser) {
    originalRecordH2HWin(winner, loser);
    const m = collectTournamentMatches(currentTournament || {}).find(x => x.t1 && x.t2 && x.winner === winner && ((x.t1===winner&&x.t2===loser)||(x.t2===winner&&x.t1===loser)) && v7IsFinalMatch(x) && !x.__v7RivalryCounted);
    if(!m) return;
    m.__v7RivalryCounted=true;
    seasonState.rivalries=seasonState.rivalries||{};
    const key=getH2HKey(winner,loser);
    const r=seasonState.rivalries[key] || {teams:[m.t1,m.t2],meetings:0,finals:0};
    r.meetings=(r.meetings||0)+1;
    r.finals=(r.finals||0)+1;
    seasonState.rivalries[key]=r;
    v7Save();
  };
  function v7RivalryFor(t1,t2) {
    const r=seasonState.rivalries?.[getH2HKey(t1,t2)];
    return (r && r.finals>=2) ? r : null;
  }
  const originalGetMatchHype = getMatchHype;
  getMatchHype = function(t1,t2) {
    const base=originalGetMatchHype(t1,t2);
    const rival=v7RivalryFor(t1,t2);
    if(!rival) return base;
    const out=base || {level:'super',label:'⚔️ ЗАКЛЯТЫЕ СОПЕРНИКИ',viewers:'1.25M'};
    out.level='super';
    out.label='⚔️ ЗАКЛЯТЫЕ СОПЕРНИКИ';
    const oldM=parseFloat(String(out.viewers||'0').replace('M',''))||0;
    out.viewers=`${Math.max(1.15, oldM * 1.18).toFixed(2)}M`;
    return out;
  };
  function v7SeasonPerformance(team, seasonNo) {
    const hs=(team.history||[]).filter(h=>h.season===seasonNo && !h.isBootcamp);
    const sumDelta=hs.reduce((s,h)=>s+(Number(h.delta)||0),0);
    const placeScore=hs.reduce((s,h)=>{
      const p=Number(h.place)||99;
      return s + (p===1?34:p===2?24:p===3?18:p===4?14:p<=8?8:p<=12?3:1);
    },0);
    return sumDelta + placeScore;
  }
  function v7BuildAwards(endedSeason, champion, beforeRanks) {
    const finalRanks={}; [...teams].sort((a,b)=>b.pts-a.pts).forEach((t,i)=>finalRanks[t.name]=i+1);
    const scored=teams.map(t=>({t,score:v7SeasonPerformance(t,endedSeason),start:beforeRanks[t.name]||99,finish:finalRanks[t.name]||99})).sort((a,b)=>b.score-a.score);
    const mvp=scored[0]?.t?.name || champion;
    const candidates=scored.filter(x=>x.t.name!==champion);
    const breakthrough=[...candidates].sort((a,b)=>(b.start-b.finish)-(a.start-a.finish))[0]?.t?.name || champion;
    const topPool=scored.filter(x=>x.start<=8).sort((a,b)=>a.score-b.score);
    const disappointment=topPool[0]?.t?.name || candidates[candidates.length-1]?.t?.name || champion;
    return {rosterOfYear:champion,mvp,breakthrough,disappointment};
  }
  function v7BuildRecap(endedSeason, endedYear, awards) {
    const hist=(seasonState.tournamentHistory||[]).filter(x=>x.season===endedSeason);
    const sorted=[...teams].sort((a,b)=>v7SeasonPerformance(b,endedSeason)-v7SeasonPerformance(a,endedSeason));
    const dom=sorted[0]?.name || awards.rosterOfYear;
    const rivals=Object.values(seasonState.rivalries||{}).filter(r=>r.finals>=2).sort((a,b)=>(b.finals||0)-(a.finals||0)).slice(0,4);
    const lines=[];
    lines.push(`СЕЗОН ${endedSeason} • ${endedYear}`);
    lines.push('════════════════════════════════');
    lines.push(`🏆 РОСТЕР ГОДА: ${awards.rosterOfYear}`);
    lines.push(`🥇 MVP СЕЗОНА: ${awards.mvp}`);
    lines.push(`🚀 ПРОРЫВ ГОДА: ${awards.breakthrough}`);
    lines.push(`📉 РАЗОЧАРОВАНИЕ СЕЗОНА: ${awards.disappointment}`);
    lines.push(`🔥 ДОМІНАНТ ПО СЕЗОННОЙ ФОРМЕ: ${dom}`);
    if(rivals.length){
      lines.push(''); lines.push('⚔️ СОПЕРНИЧЕСТВА:');
      rivals.forEach(r=>lines.push(`• ${r.teams?.[0] || ''} vs ${r.teams?.[1] || ''} — ${r.finals} финальных встреч`));
    }
    lines.push(''); lines.push('🏟 ТУРНИРЫ СЕЗОНА:');
    hist.slice().reverse().forEach(x=>{
      const upset=x.upsets ? ` • апсеты: ${x.upsets}` : '';
      lines.push(`• ${x.name} — чемпион: ${x.champion}${upset}`);
    });
    return lines.join('\n');
  }
  function v7ShowRecap(seasonNo) {
    const text=V7.recaps[seasonNo];
    if(!text) return alert('Рекап для этого сезона ещё не создан.');
    let modal=document.getElementById('v7-recap-modal');
    if(!modal){
      modal=document.createElement('div'); modal.id='v7-recap-modal'; modal.className='modal-backdrop';
      modal.innerHTML=`<div class="modal-box v7-recap-box"><div class="v7-recap-head"><b>📜 РЕКАП СЕЗОНА</b><button type="button" class="secondary" onclick="document.getElementById('v7-recap-modal').style.display='none'">✕</button></div><textarea id="v7-recap-text" readonly></textarea><div class="v7-recap-actions"><button class="primary" id="v7-recap-copy">📋 Копировать</button><button class="secondary" onclick="document.getElementById('v7-recap-text').select()">Выделить</button></div></div>`;
      document.body.appendChild(modal);
      document.getElementById('v7-recap-copy').onclick=async()=>{
        const ta=document.getElementById('v7-recap-text');
        try { await navigator.clipboard.writeText(ta.value); document.getElementById('v7-recap-copy').textContent='✅ Скопировано'; setTimeout(()=>document.getElementById('v7-recap-copy').textContent='📋 Копировать',1000); }
        catch(e){ ta.select(); document.execCommand('copy'); }
      };
    }
    document.getElementById('v7-recap-text').value=text;
    modal.style.display='flex';
  }
  window.v7ShowRecap=v7ShowRecap;
  const originalRenderSeasonBanner=renderSeasonBanner;
  renderSeasonBanner=function(){
    originalRenderSeasonBanner();
    const hof=document.getElementById('hall-of-fame');
    if(!hof) return;
    const entries=seasonState.hallOfFame||[];
    if(!entries.length){ v7RenderFavoritePanel(); return; }
    hof.innerHTML=entries.map((item,idx)=>{
      const a=item.awards||{};
      const main=`<div class="hof-card-item v7-hof-main"><div><span class="badge badge-season">Сезон ${item.season} (${item.year||2026})</span><div class="hof-champ-name">🏆 ${esc(a.rosterOfYear || item.champion)}</div><div class="v7-hof-caption">РОСТЕР ГОДА • главная награда сезона</div></div><div class="v7-hof-side"><div>🥇 MVP: <b>${esc(a.mvp||'—')}</b></div><div>🚀 Прорыв: <b>${esc(a.breakthrough||item.risingStar||'—')}</b></div><div>📉 Разочарование: <b>${esc(a.disappointment||'—')}</b></div><button class="secondary v7-hof-recap" onclick="window.v7ShowRecap(${item.season})">📜 Рекап</button></div></div>`;
      if(idx>0) return `<div class="hof-card-item v7-hof-small"><span>Сезон ${item.season}</span><b>${esc(a.rosterOfYear||item.champion)}</b><span>• MVP ${esc(a.mvp||'—')}</span></div>`;
      return main;
    }).join('');
    v7RenderFavoritePanel();
  };
  const originalFinalizeTournamentRating=finalizeTournamentRating;
  finalizeTournamentRating=function(){
    if(!currentTournament || currentTournament.completed) return;
    const endedSeason=seasonState.currentSeason;
    const beforeRanks={}; [...teams].sort((a,b)=>b.pts-a.pts).forEach((t,i)=>beforeRanks[t.name]=i+1);
    const champGuess=Object.entries(currentTournament.placements||{}).find(([n,p])=>p.place===1)?.[0] || '—';
    originalFinalizeTournamentRating();
    const seasonEnded=seasonState.currentSeason !== endedSeason;
    if(seasonEnded){
      const entry=seasonState.hallOfFame?.find(x=>x.season===endedSeason);
      const champ=entry?.champion || champGuess;
      const awards=v7BuildAwards(endedSeason,champ,beforeRanks);
      if(entry){ entry.awards=awards; entry.risingStar = awards.breakthrough; }
      V7.recaps[endedSeason]=v7BuildRecap(endedSeason, 2026+(endedSeason-1), awards);
      v7ZeroSeasonMapStats();
      v7Save();
      renderSeasonBanner();
    }
  };
  const originalInitTournamentCycle=initTournamentCycle;
  window.v7StartCurrentSeason=function(){
    originalInitTournamentCycle();
    renderTournament();
    renderRating();
    updateTournamentSuggestion();
    saveSeasonState();
  };
  initTournamentCycle=function(){ window.v7StartCurrentSeason(); };
  const css=document.createElement('style');
  css.textContent=`
    .v7-favorite-panel{border-color:rgba(251,197,49,.42);background:linear-gradient(135deg,rgba(251,197,49,.075),rgba(15,18,24,.96));padding:8px 9px}
    .v7-fav-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.v7-fav-title{font-size:11.5px;font-weight:900;color:var(--gold)}.v7-fav-sub{font-size:8px;color:var(--text-muted);margin-top:1px}.v7-fav-state{font-size:7.5px;font-weight:900;color:var(--gold);border:1px solid rgba(251,197,49,.4);padding:2px 5px;border-radius:7px}.v7-fav-row{display:flex;gap:5px;align-items:center;margin-top:6px}.v7-fav-row select{flex:1;min-width:0}.v7-fav-row button{font-size:8.5px}.v7-fav-focus{font-size:8.5px;margin-top:4px;color:#e7ecf1}.v7-fav-focus.muted{color:var(--text-muted)}.v7-auto-toggle{margin-top:5px;font-size:8.5px;display:flex;flex-direction:row;align-items:center;gap:4px;color:var(--text-muted)}.v7-auto-toggle input{accent-color:var(--gold)}.v7-auto-actions{display:flex;gap:5px;margin-top:5px}.v7-auto-actions button{width:100%;font-size:8.5px}
    .v7-favorite-row td{background:rgba(251,197,49,.045)!important}.v7-rating-star{color:var(--gold);font-weight:900}.v7-favorite-match{border-color:var(--gold)!important;box-shadow:0 0 0 1px rgba(251,197,49,.18),0 4px 14px rgba(0,0,0,.2)!important}.v7-fav-badge{font-size:7px;color:var(--gold);background:rgba(251,197,49,.09);border-bottom:1px solid rgba(251,197,49,.25);padding:1px 4px;text-align:center;font-weight:900}
    .v7-speed-presets{display:inline-flex;align-items:center;gap:3px;margin-right:5px;flex-wrap:wrap}.v7-speed-label{font-size:7.5px;color:var(--gold);font-weight:900}.v7-speed-preset{font-size:7.5px!important;padding:2px 5px!important}.v7-speed-preset.active{border-color:var(--gold)!important;color:var(--gold)!important;background:rgba(251,197,49,.07)!important}
    .match-broadcast-state.technical{color:#c9d1dc;background:rgba(125,139,159,.08);border-top-color:rgba(125,139,159,.3)}
    .match.live-broadcast.broadcast-technical{border-color:#8c9bad;box-shadow:0 0 0 1px rgba(140,155,173,.18)}
    .match.live-broadcast.broadcast-technical::before{content:'🛠 ТЕХ';color:#cbd4df}
    .v7-hof-main{min-height:62px}.v7-hof-caption{font-size:7.8px;color:var(--gold);margin-top:1px;font-weight:800}.v7-hof-side{font-size:8px;text-align:right;line-height:1.35}.v7-hof-side>div{margin:1px 0}.v7-hof-recap{font-size:7.5px!important;padding:2px 5px!important;margin-top:3px}.v7-hof-small{font-size:8px;padding:4px 6px;gap:5px}.v7-hof-small span{color:var(--text-muted)}
    .v7-recap-box{width:820px;max-width:95vw}.v7-recap-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:6px;color:var(--gold)}#v7-recap-text{width:100%;height:430px;resize:vertical;background:#090d13;border:1px solid var(--border);border-radius:7px;color:#dfe6ee;font:11px/1.5 Consolas,monospace;padding:9px;outline:none}.v7-recap-actions{display:flex;justify-content:center;gap:5px;margin-top:6px}.v7-recap-actions button{font-size:8.5px}
    @media(max-width:900px){.v7-speed-presets{width:100%;margin:0 0 3px}.v7-hof-main{flex-direction:column;align-items:flex-start}.v7-hof-side{text-align:left}.v7-fav-row{flex-direction:column;align-items:stretch}}
  `;
  document.head.appendChild(css);
  function v7RefreshBroadcastTechnicalClasses(){
    document.querySelectorAll('.match[data-v7-t1][data-v7-t2]').forEach(el=>{
      const item=v7FindBroadcastItem(el.dataset.v7T1,el.dataset.v7T2);
      el.classList.toggle('broadcast-technical', item?.state?.phase==='technical-pause');
    });
  }
  const oldRenderBroadcastPanel=renderBroadcastPanel;
  renderBroadcastPanel=function(){ oldRenderBroadcastPanel(); v7HighlightFavorite(document); v7RefreshMatchProbBars(); v7RefreshBroadcastTechnicalClasses(); v7RenderFavoritePanel(); v7InjectSpeedPresets(); };
  function v7PatchSeasonResetAfterAnySeasonChange(){
    if (seasonState.mapEngineV7 && seasonState.mapStatsSeason === seasonState.currentSeason) return;
    v7EnsureMapModel();
    v7ZeroSeasonMapStats();
    v7Save();
  }
  v7PatchSeasonResetAfterAnySeasonChange();
  v7RenderFavoritePanel();
  v7InjectSpeedPresets();
  renderRating();
  if (currentTournament) renderTournament();
  renderSeasonBanner();
  renderTournamentArchive();
  if (!V7.speedPresets[V7.speedPreset]) V7.speedPreset='realistic';
  v7ApplyPreset(V7.speedPreset,false);
  if (V7.autoSeason && v7FavoriteName() && !currentTournament) {
    setTimeout(()=>window.v7StartCurrentSeason(), V7.autoStartDelay);
  }
  if (seasonState.v7Welcome !== true) {
    seasonState.v7Welcome=true;
    v7Save();
    const banner=document.getElementById('event-alert-box');
    if(banner){ banner.style.display='block'; banner.innerHTML='⭐ <b>v7:</b> выберите любимую команду — сезон и турнирный эфир теперь могут идти автоматически.'; }
  }
})();
