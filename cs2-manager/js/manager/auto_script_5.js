
(() => {
  if (window.__finalLiveDetailSyncV6) return;
  window.__finalLiveDetailSyncV6 = true;
  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
  function resolveDetailItem() {
    const b = currentTournament?.broadcast;
    const id = broadcastDetailMatchId;
    if (!b || !id) return null;
    const pools = [b.active || [], b.queue || [], b.finished || []];
    for (const pool of pools) {
      const hit = pool.find(item =>
        item && (item.id === id || broadcastMatchKey(item.match) === id)
      );
      if (hit) return hit;
    }
    return null;
  }
  function renderRoundCubes(item) {
    const st = item?.state, m = item?.match;
    const h1 = document.getElementById('timeline-first-half');
    const h2 = document.getElementById('timeline-second-half');
    if (!st || !m || !h1 || !h2) return;
    const parent = h1.closest('.round-timeline-box');
    if (parent) {
      parent.style.display = 'flex';
      parent.style.visibility = 'visible';
      parent.style.opacity = '1';
    }
    const winners = Array.isArray(st.mapRoundWinners) ? st.mapRoundWinners : [];
    const maxRounds = st.overtime ? Math.max(24, Number(st.round) || 0) : 24;
    const ensureCell = (container, roundNo) => {
      let cell = container.querySelector(`[data-round-cell="${roundNo}"]`);
      if (!cell) {
        cell = document.createElement('div');
        cell.className = 'timeline-cell';
        cell.dataset.roundCell = String(roundNo);
        cell.textContent = String(roundNo);
        container.appendChild(cell);
      }
      return cell;
    };
    for (let i = 1; i <= maxRounds; i++) {
      const cell = ensureCell(i <= 12 ? h1 : h2, i);
      const winner = winners[i - 1];
      const highlight = st.roundHighlights?.[i];
      const isOT = !!st.overtime && i > 24;
      cell.classList.toggle('t1-won', winner === 1);
      cell.classList.toggle('t2-won', winner === 2);
      cell.classList.toggle('has-highlight', !!highlight);
      cell.classList.toggle('economy-hot', !!st.roundBuys?.[i]);
      if (winner === 1 || winner === 2) {
        cell.style.background = winner === 1 ? 'rgba(30,144,255,.48)' : 'rgba(255,71,87,.48)';
        cell.style.borderColor = winner === 1 ? 'var(--blue)' : 'var(--loss)';
        cell.style.color = '#fff';
        cell.style.boxShadow = winner === 1
          ? '0 0 0 1px rgba(30,144,255,.22)'
          : '0 0 0 1px rgba(255,71,87,.22)';
        cell.title = `${m.t1} vs ${m.t2} • Раунд ${i} • Победитель: ${winner === 1 ? m.t1 : m.t2}`;
      } else {
        cell.style.background = '#151922';
        cell.style.borderColor = isOT ? 'var(--gold)' : '#232a36';
        cell.style.color = '#7d8b9f';
        cell.style.boxShadow = isOT ? '0 0 0 1px rgba(251,197,49,.16) inset' : 'none';
        cell.title = `${m.t1} vs ${m.t2} • Раунд ${i}`;
      }
      if (highlight) {
        cell.title += ` • ${highlight.icon || '★'} ${highlight.label || ''} — ${highlight.team || ''}`;
      }
    }
    [h1, h2].forEach(container => {
      container.querySelectorAll('[data-round-cell]').forEach(cell => {
        const n = Number(cell.dataset.roundCell || 0);
        cell.style.display = n <= maxRounds ? 'flex' : 'none';
      });
    });
  }
  let detailTickerRenderKey = '';
  let detailHeaderRenderKey = '';
  function renderEventFeed(item) {
    const st = item?.state, m = item?.match;
    const ticker = document.getElementById('match-live-ticker');
    if (!st || !m || !ticker) return;
    const events = Array.isArray(st.events) ? st.events : [];
    const lastEvent = events.length ? events[0] : null;
    const renderKey = [
      item?.id || broadcastMatchKey(m),
      st.phase || '', st.phaseText || '', st.round || 0,
      st.series1 || 0, st.series2 || 0, st.map1 || 0, st.map2 || 0,
      st.overtime ? 1 : 0, events.length,
      lastEvent?.kind || '', lastEvent?.html || ''
    ].join('|');
    if (detailTickerRenderKey === renderKey && ticker.children.length) return;
    detailTickerRenderKey = renderKey;
    const oldScrollTop = ticker.scrollTop;
    const oldScrollHeight = ticker.scrollHeight;
    const wasAtTop = oldScrollTop <= 24;
    const rows = events.length ? events.map(e => {
      const kind = e?.kind || 'normal';
      const cls = kind === 'round'
        ? 'ticker-line broadcast-round-line'
        : kind === 'highlight'
        ? 'broadcast-highlight-line'
        : (kind === 'tactic'
          ? 'broadcast-tactic-line'
          : (kind === 'economy' ? 'broadcast-economy-line' : 'ticker-line'));
      return `<div class="${cls}">${e?.html || ''}</div>`;
    }) : [
      `<div class="ticker-line"><strong>${escapeHtml(m.t1)} vs ${escapeHtml(m.t2)}</strong> • Раунд ${Number(st.round)||0} • ${st.finished ? 'матч завершен' : 'идет игра'}</div>`
    ];
    const phase = st.phaseText || (st.finished ? '🏁 Матч завершен' : '▶ Идет игра');
    const round = Number(st.round) || 0;
    const s1 = Number(st.series1) || 0, s2 = Number(st.series2) || 0;
    const m1 = Number(st.map1) || 0, m2 = Number(st.map2) || 0;
    ticker.style.display = 'block';
    ticker.style.overflowY = 'auto';
    ticker.style.flexDirection = 'column';
    ticker.innerHTML =
      `<div class="broadcast-phase-line">${phase} • Раунд ${round} • серия ${s1}:${s2} • карта ${m1}:${m2}${st.overtime ? ' • 🔥 OT' : ''}</div>` +
      rows.join('');
    if (wasAtTop) {
      ticker.scrollTop = 0;
    } else {
      const grown = Math.max(0, ticker.scrollHeight - oldScrollHeight);
      const newMaxScroll = Math.max(0, ticker.scrollHeight - ticker.clientHeight);
      ticker.scrollTop = Math.min(oldScrollTop + grown, newMaxScroll);
    }
  }
  function syncDetailControls() {
    const b = currentTournament?.broadcast;
    const pause = document.getElementById('tv-pause-btn');
    const skip = document.getElementById('tv-skip-btn');
    if (pause) {
      const running = !!b?.running;
      const paused = !!b?.paused;
      pause.disabled = !running;
      pause.textContent = paused ? '▶ Продолжить эфир' : '⏸ Пауза эфира';
      pause.classList.toggle('broadcast-resume-ready', paused);
      pause.onclick = (ev) => {
        ev['\x70\x72\x65\x76\x65\x6e\x74Default']();
        ev.stopPropagation();
        if (currentTournament?.broadcast?.running && typeof toggleTournamentBroadcastPause === 'function') {
          toggleTournamentBroadcastPause();
        }
      };
    }
    if (skip) {
      const item = resolveDetailItem();
      const done = !!item?.state?.finished || item?.status === 'done';
      skip.disabled = !item || done;
      skip.textContent = done ? '✓ Завершен' : '⏭ Скипнуть этот матч';
      skip.onclick = (ev) => {
        ev['\x70\x72\x65\x76\x65\x6e\x74Default']();
        ev.stopPropagation();
        if (typeof nextBroadcastMatch === 'function') nextBroadcastMatch();
      };
    }
  }
  function syncSelectedDetail() {
    if (!broadcastDetailViewing) return;
    const b = currentTournament?.broadcast;
    const item = resolveDetailItem();
    if (!b || !item) return;
    const st = item?.state;
    const m = item?.match;
    if (!st || !m) return;
    const headerRenderKey = [
      item.id || broadcastMatchKey(item.match),
      st.phase || '', st.phaseText || '', st.round || 0,
      st.series1 || 0, st.series2 || 0, st.map1 || 0, st.map2 || 0,
      st.liveOdds?.p1 || 0, st.liveOdds?.p2 || 0,
      st.finished ? 1 : 0
    ].join('|');
    if (detailHeaderRenderKey !== headerRenderKey) {
      detailHeaderRenderKey = headerRenderKey;
      try {
        broadcastRenderDetail(item);
      } catch (err) {
        console.error('[V6 detail sync header]', err);
      }
    }
    try { renderRoundCubes(item); } catch (err) { console.error('[V6 cube sync]', err); }
    try { renderEventFeed(item); } catch (err) { console.error('[V6 feed sync]', err); }
    syncDetailControls();
  }
  const originalBroadcastRenderDetailV6 = broadcastRenderDetail;
  broadcastRenderDetail = function(item) {
    try {
      originalBroadcastRenderDetailV6(item);
    } finally {
      try {
        const st = item?.state, m = item?.match;
        if (broadcastDetailViewing && st && m &&
            (item.id === broadcastDetailMatchId || broadcastMatchKey(m) === broadcastDetailMatchId)) {
          renderRoundCubes(item);
          renderEventFeed(item);
        }
      } catch (err) {
        console.error('[V6 detail instant sync]', err);
      }
    }
  };
  const originalAddBroadcastEventV6 = addBroadcastEvent;
  addBroadcastEvent = function(st, html, kind = 'normal') {
    originalAddBroadcastEventV6(st, html, kind);
    if (st && !Array.isArray(st.events)) st.events = [];
    if (st?.events) st.events = st.events.filter(e => e && typeof e === 'object');
  };
  const originalTogglePauseV6 = toggleTournamentBroadcastPause;
  toggleTournamentBroadcastPause = function() {
    const before = currentTournament?.broadcast?.paused;
    originalTogglePauseV6();
    const after = currentTournament?.broadcast?.paused;
    if (broadcastDetailViewing && before !== after) syncSelectedDetail();
  };
  const originalOpenDetailV6 = openBroadcastMatchDetail;
  openBroadcastMatchDetail = function(id) {
    const b = currentTournament?.broadcast;
    if (!b) return originalOpenDetailV6(id);
    let item = (b.active || []).find(x => x && (x.id === id || broadcastMatchKey(x.match) === id));
    if (!item) item = (b.queue || []).find(x => x && (x.id === id || broadcastMatchKey(x.match) === id));
    if (!item) item = (b.finished || []).find(x => x && (x.id === id || broadcastMatchKey(x.match) === id));
    if (!item) return;
    if (item.status === 'done' || item.match?.winner) return openCompletedMatchResult(item.match);
    broadcastDetailViewing = true;
    broadcastDetailMatchId = item.id;
    detailTickerRenderKey = '';
    detailHeaderRenderKey = '';
    try { broadcastRenderDetail(item); } catch (e) { console.error('[V6 open detail]', e); }
    const modal = document.getElementById('dice-modal');
    if (modal) modal.style.display = 'flex';
    syncSelectedDetail();
  };
  const style = document.createElement('style');
  style.textContent = `
    #dice-modal .ticker-box{
      display:block !important;
      flex-direction:column !important;
      overflow-y:auto !important;
      overflow-x:hidden !important;
      scrollbar-width:thin !important;
    }
    #dice-modal .timeline-cell.t1-won,
    #dice-modal .timeline-cell.t2-won{
      color:#fff !important;
    }
    #dice-modal .ticker-box{
      scroll-behavior:auto !important;
      overscroll-behavior:contain;
    }
    /* Результат раунда — верхняя строка ленты, выделена, чтобы её было видно сразу */
    #dice-modal .broadcast-round-line{
      background:rgba(255,255,255,.07) !important;
      border-left:2px solid var(--gold, #fbc531);
      color:#fff;
    }
  `;
  document.head.appendChild(style);
  setInterval(() => {
    if (currentTournament?.broadcast?.running && broadcastDetailViewing) {
      syncSelectedDetail();
    }
  }, 150);
})();
