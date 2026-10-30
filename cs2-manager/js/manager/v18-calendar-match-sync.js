
(() => {
  'use strict';

  const V18_WARMUP_MIN = 15;          // после создания сетки до первого матча
  const V18_BO1_SLOT_MIN = 105;       // плановый интервал между слотами BO1
  const V18_BO3_SLOT_MIN = 165;       // плановый интервал между слотами BO3
  const V18_BO5_SLOT_MIN = 240;       // плановый интервал между слотами BO5
  const V18_DELAY_TOLERANCE_MIN = 0;  // матч стартует сразу, если его слот уже прошёл

  const nowGame = () => {
    try {
      if (typeof v15EnsureCalendar === 'function') return Number(v15EnsureCalendar().currentMs) || Date.now();
    } catch (e) {}
    try { return Number(seasonState?.calendar?.currentMs) || Date.now(); } catch (e) { return Date.now(); }
  };
  const cal = () => {
    try {
      if (typeof v15EnsureCalendar === 'function') return v15EnsureCalendar();
    } catch (e) {}
    if (!seasonState.calendar || typeof seasonState.calendar !== 'object') seasonState.calendar = {};
    return seasonState.calendar;
  };
  const isCalendarPaused = () => !!cal().paused;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function modeSlotMin(match) {
    const mode = typeof getBroadcastMode === 'function' ? getBroadcastMode(match) : 'BO3';
    if (mode === 'BO1') return V18_BO1_SLOT_MIN;
    if (mode === 'BO5') return V18_BO5_SLOT_MIN;
    return V18_BO3_SLOT_MIN;
  }

  function ensureTournamentWarmup(t) {
    if (!t) return;
    const c = cal();
    if (!t.calendar || typeof t.calendar !== 'object') {
      t.calendar = {
        plannedStartMs: nowGame(),
        nextMatchAt: 0,
        tournamentDay: 0,
        matchSlot: 0,
        durationDays: 2,
        startTime: '15:30'
      };
    }
    if (!Number(t.calendar.warmupStartAt)) t.calendar.warmupStartAt = nowGame();
    if (!Number(t.calendar.autoBroadcastAt)) {
      t.calendar.autoBroadcastAt = Math.max(nowGame(), Number(t.calendar.warmupStartAt) || nowGame()) + V18_WARMUP_MIN * 60000;
    }
    if (!Number(t.calendar.nextMatchAt) || Number(t.calendar.nextMatchAt) < Number(t.calendar.autoBroadcastAt)) {
      t.calendar.nextMatchAt = Number(t.calendar.autoBroadcastAt);
    }
    if (t.calendar.broadcastAutoStartPending === undefined) t.calendar.broadcastAutoStartPending = true;
    if (!t.calendar.gameScheduleVersion) t.calendar.gameScheduleVersion = 18;
    if (!t.calendar.firstMatchPlannedAt) t.calendar.firstMatchPlannedAt = Number(t.calendar.autoBroadcastAt);
    if (!Number.isFinite(Number(t.calendar.actualStartAt))) t.calendar.actualStartAt = 0;
    c.nextMatchAt = Number(t.calendar.nextMatchAt) || c.nextMatchAt;
  }

  function tournamentIsActive() {
    try { return !!(typeof currentTournament !== 'undefined' && currentTournament && !currentTournament.completed); }
    catch (e) { return false; }
  }

  function broadcastIsRunning() {
    try { return !!currentTournament?.broadcast?.running; } catch (e) { return false; }
  }

  function setTourStatus(text) {
    const el = document.getElementById('tour-status');
    if (el) el.innerText = text;
  }

  function renderWarmupStatus() {
    if (!tournamentIsActive()) return;
    const t = currentTournament;
    const c = cal();
    ensureTournamentWarmup(t);
    if (!broadcastIsRunning() && t.calendar.broadcastAutoStartPending) {
      const delta = Number(t.calendar.autoBroadcastAt) - Number(c.currentMs || nowGame());
      const total = Math.max(0, Math.ceil(delta / 60000));
      const h = Math.floor(total / 60);
      const m = total % 60;
      const left = h > 0 ? `${h}ч ${m}м` : `${m}м`;
      setTourStatus(`⏳ Сетка готова • первый матч через ${left}`);
    }
  }

  // 1) После генерации турнира НЕ стартуем эфир мгновенно.
  const priorCreate = window.createTournament;
  if (typeof priorCreate === 'function' && !priorCreate.__v18Wrapped) {
    const wrappedCreate = function(...args) {
      const result = priorCreate.apply(this, args);
      if (currentTournament && !currentTournament.completed) {
        ensureTournamentWarmup(currentTournament);
        currentTournament.broadcast = currentTournament.broadcast || {
          running:false, paused:false, queue:[], active:[], finished:[], clock:0, timerIds:[]
        };
        currentTournament.broadcast.v18GameSchedule = true;
        currentTournament.broadcast.v18ScheduleCursor = Number(currentTournament.calendar.autoBroadcastAt);
        currentTournament.broadcast.v18AutoStartPending = true;
        setTourStatus(`⏳ Сетка готова • разминка 15 игровых минут`);
        try { if (typeof v15RenderCalendar === 'function') v15RenderCalendar(); } catch (e) {}
        try { saveSeasonState(); } catch (e) {}
      }
      return result;
    };
    wrappedCreate.__v18Wrapped = true;
    window.createTournament = wrappedCreate;
    try { createTournament = wrappedCreate; } catch (e) {}
  }

  // 2) Очередь эфира переводим на ИГРОВОЕ время, а не Date.now().
  const priorBuildQueue = window.buildBroadcastQueue;
  if (typeof priorBuildQueue === 'function' && !priorBuildQueue.__v18Wrapped) {
    const wrappedBuildQueue = function(...args) {
      const b = currentTournament?.broadcast;
      const result = priorBuildQueue.apply(this, args);
      if (!b || !currentTournament) return result;
      ensureTournamentWarmup(currentTournament);
      b.v18GameSchedule = true;
      if (!Number(b.v18ScheduleCursor)) {
        b.v18ScheduleCursor = Number(currentTournament.calendar.autoBroadcastAt) || nowGame();
      }
      const queue = Array.isArray(b.queue) ? b.queue : [];
      let cursor = Number(b.v18ScheduleCursor) || nowGame();
      const unscheduled = queue
        .filter(item => !Number(item.v18PlannedTime))
        .sort((a,b2) => (Number(a.batchId)||0) - (Number(b2.batchId)||0));

      // Назначаем время пакетам матчей. Два параллельных матча получают один слот.
      let i = 0;
      while (i < unscheduled.length) {
        const batchId = unscheduled[i].batchId;
        const batch = [];
        while (i < unscheduled.length && unscheduled[i].batchId === batchId) batch.push(unscheduled[i++]);
        const slotAt = Math.max(cursor, nowGame());
        batch.forEach(item => {
          item.v18PlannedTime = slotAt;
          item.time = slotAt;
          item.gameScheduledAt = slotAt;
          item.v18ScheduleVersion = 18;
        });
        const slotMin = Math.max(...batch.map(item => modeSlotMin(item.match)));
        cursor = slotAt + slotMin * 60000;
      }
      b.v18ScheduleCursor = cursor;
      b.scheduleCursorGame = cursor;
      return result;
    };
    wrappedBuildQueue.__v18Wrapped = true;
    window.buildBroadcastQueue = wrappedBuildQueue;
    try { buildBroadcastQueue = wrappedBuildQueue; } catch (e) {}
  }

  // 3) Следующий слот не стартует раньше назначенного игрового времени.
  // Если слот уже прошёл из-за затянувшейся серии, ВСЕ будущие матчи сдвигаются вперёд на задержку.
  const priorScheduleBatch = window.scheduleNextBroadcastBatch;
  if (typeof priorScheduleBatch === 'function' && !priorScheduleBatch.__v18Wrapped) {
    const wrappedScheduleBatch = function(...args) {
      const b = currentTournament?.broadcast;
      if (!b || !b.running) return priorScheduleBatch.apply(this, args);
      if (b.paused || isCalendarPaused()) {
        try { renderBroadcastPanel(); } catch (e) {}
        return;
      }
      try { buildBroadcastQueue(); } catch (e) { console.warn('[v18] queue build', e); }
      if (Array.isArray(b.active) && b.active.length) return;
      const queue = Array.isArray(b.queue) ? b.queue : [];
      if (!queue.length) {
        try { renderBroadcastPanel(); } catch (e) {}
        return priorScheduleBatch.apply(this, args);
      }
      const ordered = queue.slice().sort((a,b2) => Number(a.time||0) - Number(b2.time||0));
      const first = ordered[0];
      const gameNow = nowGame();
      const planned = Number(first.time) || gameNow;
      if (planned > gameNow + V18_DELAY_TOLERANCE_MIN*60000) {
        try { renderBroadcastPanel(); } catch (e) {}
        return;
      }
      const delay = Math.max(0, gameNow - planned);
      if (delay > 0) {
        queue.forEach(item => {
          if (Number(item.time) >= planned) {
            item.time = Number(item.time) + delay;
            item.v18ShiftedByMs = (Number(item.v18ShiftedByMs)||0) + delay;
          }
        });
      }
      const result = priorScheduleBatch.apply(this, args);
      renderWarmupStatus();
      return result;
    };
    wrappedScheduleBatch.__v18Wrapped = true;
    window.scheduleNextBroadcastBatch = wrappedScheduleBatch;
    try { scheduleNextBroadcastBatch = wrappedScheduleBatch; } catch (e) {}
  }

  // 4) При запуске матча показываем реальное игровое время старта и фиксируем задержку.
  const priorLaunch = window.launchBroadcastMatch;
  if (typeof priorLaunch === 'function' && !priorLaunch.__v18Wrapped) {
    const wrappedLaunch = function(item, ...args) {
      const gameNow = nowGame();
      if (item) {
        item.plannedTime = Number(item.v18PlannedTime || item.time || gameNow);
        item.actualStartAt = gameNow;
        item.delayedByMs = Math.max(0, gameNow - item.plannedTime);
        // Сама строка расписания теперь показывает ФАКТИЧЕСКОЕ игровое время старта.
        item.time = gameNow;
        if (currentTournament?.calendar) currentTournament.calendar.lastActualMatchStartAt = gameNow;
      }
      const result = priorLaunch.apply(this, [item, ...args]);
      try { renderBroadcastPanel(); } catch (e) {}
      return result;
    };
    wrappedLaunch.__v18Wrapped = true;
    window.launchBroadcastMatch = wrappedLaunch;
    try { launchBroadcastMatch = wrappedLaunch; } catch (e) {}
  }

  // 5) Календарная пауза = полная пауза матчей. Таймеры эфира больше не живут отдельно от календаря.
  const priorToggleCalendarPause = window.toggleGameCalendarPause;
  if (typeof priorToggleCalendarPause === 'function' && !priorToggleCalendarPause.__v18Wrapped) {
    const wrappedToggle = function(...args) {
      priorToggleCalendarPause.apply(this, args);
      const paused = isCalendarPaused();
      const b = currentTournament?.broadcast;
      if (b?.running) {
        if (paused && !b.paused) {
          if (typeof toggleTournamentBroadcastPause === 'function') toggleTournamentBroadcastPause();
        } else if (!paused && b.paused) {
          if (typeof toggleTournamentBroadcastPause === 'function') toggleTournamentBroadcastPause();
        }
      }
      try { v15RenderCalendar(); } catch (e) {}
      renderWarmupStatus();
    };
    wrappedToggle.__v18Wrapped = true;
    window.toggleGameCalendarPause = wrappedToggle;
    try { toggleGameCalendarPause = wrappedToggle; } catch (e) {}
  }

  // 6) Автоматический старт эфира через 15 игровых минут после генерации сетки.
  function v18AutoStartBroadcastIfDue() {
    if (!tournamentIsActive() || broadcastIsRunning()) return false;
    const t = currentTournament;
    ensureTournamentWarmup(t);
    if (!t.calendar.broadcastAutoStartPending) return false;
    if (isCalendarPaused()) return false;
    const cNow = nowGame();
    if (cNow < Number(t.calendar.autoBroadcastAt)) {
      renderWarmupStatus();
      return false;
    }
    t.calendar.broadcastAutoStartPending = false;
    t.calendar.actualStartAt = cNow;
    try {
      if (typeof startTVBroadcastMode === 'function') startTVBroadcastMode();
      if (t.broadcast) {
        t.broadcast.v18AutoStartPending = false;
        t.broadcast.v18GameSchedule = true;
        t.broadcast.v18ScheduleCursor = cNow;
      }
      setTourStatus('🔴 Турнирный эфир автоматически запущен • по 2 матча одновременно');
      try { saveSeasonState(); } catch (e) {}
      try { v15RenderCalendar(); } catch (e) {}
      return true;
    } catch (e) {
      console.error('[v18] auto broadcast start failed', e);
      t.calendar.broadcastAutoStartPending = true;
      setTourStatus(`⚠️ Не удалось запустить эфир: ${e?.message || 'ошибка'}`);
      return false;
    }
  }

  // Ручной запуск эфира отменяет отложенный автозапуск.
  const priorStart = window.startTVBroadcastMode;
  if (typeof priorStart === 'function' && !priorStart.__v18Wrapped) {
    const wrappedStart = function(...args) {
      if (currentTournament?.calendar) {
        currentTournament.calendar.broadcastAutoStartPending = false;
        // Ручная кнопка «Запустить эфир» должна запускать сразу, не ждать 15-минутную разминку.
        currentTournament.calendar.autoBroadcastAt = nowGame();
      }
      const result = priorStart.apply(this, args);
      if (currentTournament?.broadcast && isCalendarPaused() && !currentTournament.broadcast.paused) {
        try { toggleTournamentBroadcastPause(); } catch (e) {}
      }
      return result;
    };
    wrappedStart.__v18Wrapped = true;
    window.startTVBroadcastMode = wrappedStart;
    try { startTVBroadcastMode = wrappedStart; } catch (e) {}
  }

  // Остановка эфира должна реально выключать автозапуск, чтобы Stop не запускал эфир обратно.
  const priorStop = window.stopTournamentBroadcast;
  if (typeof priorStop === 'function' && !priorStop.__v18Wrapped) {
    const wrappedStop = function(...args) {
      if (currentTournament?.calendar) currentTournament.calendar.broadcastAutoStartPending = false;
      return priorStop.apply(this, args);
    };
    wrappedStop.__v18Wrapped = true;
    window.stopTournamentBroadcast = wrappedStop;
    try { stopTournamentBroadcast = wrappedStop; } catch (e) {}
  }

  // 7) При каждом реальном тике календаря проверяем старт и следующий матч.
  const priorAdvance = window.v15AdvanceMinutes;
  if (typeof priorAdvance === 'function' && !priorAdvance.__v18Wrapped) {
    const wrappedAdvance = function(...args) {
      const result = priorAdvance.apply(this, args);
      try { v18AutoStartBroadcastIfDue(); } catch (e) {}
      try {
        const b = currentTournament?.broadcast;
        if (b?.running && !b.paused && !isCalendarPaused() && (!b.active || b.active.length === 0)) {
          scheduleNextBroadcastBatch();
        }
      } catch (e) {}
      return result;
    };
    wrappedAdvance.__v18Wrapped = true;
    window.v15AdvanceMinutes = wrappedAdvance;
  }

  // 8) Render календаря: для активного турнира показываем разминку/следующий слот в игровом времени.
  const priorRenderCalendar = window.v15RenderCalendar;
  if (typeof priorRenderCalendar === 'function' && !priorRenderCalendar.__v18Wrapped) {
    const wrappedRender = function(...args) {
      const result = priorRenderCalendar.apply(this, args);
      try {
        const t = currentTournament;
        const box = document.getElementById('calendar-next-event');
        if (t && !t.completed && box) {
          ensureTournamentWarmup(t);
          const cNow = nowGame();
          if (t.calendar.broadcastAutoStartPending && !t.broadcast?.running) {
            const delta = Math.max(0, Number(t.calendar.autoBroadcastAt) - cNow);
            const mins = Math.ceil(delta/60000);
            box.innerHTML = `🏆 <b>${esc(t.name)}</b><br>Сетка сформирована • первый матч в <b>${v15FormatDateTime(Number(t.calendar.autoBroadcastAt))}</b> • через <b>${mins}м</b><br><span style="color:var(--text-muted);">Разминка перед первым матчем: ${V18_WARMUP_MIN} игровых минут</span>`;
          } else if (t.broadcast?.running) {
            const b = t.broadcast;
            const active = (b.active||[]).length;
            const future = (b.queue||[]).filter(x=>Number(x.time)>cNow).sort((a,b2)=>Number(a.time)-Number(b2.time));
            const next = future[0];
            const label = next ? `Следующий слот: <b>${v15FormatDateTime(Number(next.time))}</b> • через ${Math.max(0,Math.ceil((Number(next.time)-cNow)/60000))}м` : (active ? 'Все запланированные слоты текущего этапа уже выданы' : 'Ждём следующую игру');
            box.innerHTML = `🏆 <b>${esc(t.name)}</b><br>${label}<br><span style="color:var(--text-muted);">Сейчас в эфире: ${active} • расписание сдвигается, если серия затянулась</span>`;
          }
        }
      } catch (e) {}
      return result;
    };
    wrappedRender.__v18Wrapped = true;
    window.v15RenderCalendar = wrappedRender;
  }

  // 9) Рендер расписания: game-time + индикатор задержки.
  const priorRenderBroadcast = window.renderBroadcastPanel;
  if (typeof priorRenderBroadcast === 'function' && !priorRenderBroadcast.__v18Wrapped) {
    const wrappedBroadcastRender = function(...args) {
      const result = priorRenderBroadcast.apply(this, args);
      try {
        const b = currentTournament?.broadcast;
        const schedule = document.getElementById('broadcast-schedule-list');
        if (!b || !schedule) return result;
        schedule.querySelectorAll('.schedule-row[data-schedule-id]').forEach(row => {
          const id = row.dataset.scheduleId;
          const item = [...(b.active||[]), ...(b.queue||[]), ...(b.finished||[])].find(x => x.id === id);
          if (!item) return;
          const timeEl = row.querySelector('.schedule-time');
          if (timeEl && item.status !== 'done') {
            const planned = Number(item.plannedTime || item.v18PlannedTime || item.time || 0);
            const actual = Number(item.actualStartAt || 0);
            if (item.status === 'live' && actual) {
              timeEl.textContent = new Date(actual).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
            } else if (planned) {
              timeEl.textContent = new Date(planned).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
            }
          }
          if (item.delayedByMs > 0 && item.status !== 'done') {
            const status = row.querySelector('.schedule-status');
            if (status && !status.textContent.includes('+' )) {
              const mins = Math.round(item.delayedByMs/60000);
              status.innerHTML += ` <span style="color:var(--gold);">(+${mins}м)</span>`;
            }
          }
        });
      } catch (e) {}
      return result;
    };
    wrappedBroadcastRender.__v18Wrapped = true;
    window.renderBroadcastPanel = wrappedBroadcastRender;
    try { renderBroadcastPanel = wrappedBroadcastRender; } catch (e) {}
  }

  // 10) Если календарь на паузе — никаких матчей. Если время пошло — продолжаем с того же места.
  setInterval(() => {
    try {
      if (!tournamentIsActive()) return;
      if (v18AutoStartBroadcastIfDue()) return;
      const b = currentTournament?.broadcast;
      if (b?.running && isCalendarPaused()) {
        if (!b.paused && typeof toggleTournamentBroadcastPause === 'function') toggleTournamentBroadcastPause();
        return;
      }
      if (b?.running && !b.paused && !isCalendarPaused() && (!b.active || b.active.length === 0)) {
        scheduleNextBroadcastBatch();
      }
      renderWarmupStatus();
    } catch (e) {}
  }, 500);

  // Автоматически выключаем только техническую привязку после окончания турнира.
  setInterval(() => {
    try {
      if (currentTournament?.completed) {
        currentTournament.calendar = currentTournament.calendar || {};
        currentTournament.calendar.broadcastAutoStartPending = false;
      }
    } catch (e) {}
  }, 1500);

  setTimeout(() => {
    try {
      if (currentTournament && !currentTournament.completed) {
        ensureTournamentWarmup(currentTournament);
        if (currentTournament.broadcast?.running && isCalendarPaused() && !currentTournament.broadcast.paused) {
          toggleTournamentBroadcastPause();
        }
        v18AutoStartBroadcastIfDue();
        if (!currentTournament.broadcast?.running) renderWarmupStatus();
      }
    } catch (e) {}
  }, 300);
})();
