# L1 91191538 (родитель 70c00553)

Итог: **нарушения: I-23 mirage** · 1262 с

## Анализ влияния: 91191538422c6d90536eb6b46cd604ce42586204~1..91191538422c6d90536eb6b46cd604ce42586204

**Изменены файлы игры:** engine/core/modes.js, engine/match/round.js, engine/nades/throw-checks.js, engine/nades/throw.js

**Изменённые функции (27):** swapSides, smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, nadeOwnerOf, nadeOwnerOk, assignNade, nadeQueueNext, nadeVelTrack, nadeBotVel, updateNadeTasks, runupFor, nadeRunPlan, runupStart, runupTick, updateNadeTask1, nadeThrowSpot, nadeSetNadeNo, nadeSetNadeT, nadeSetNades, nadeAddToStock, nadeChangeStock, nadeSetThrowUntil, throwNadeTry

**Изменены объявления вне функций:** NADE_NO_TO, NADE_NO_FROM, NADE_HIT_GAP, NADE_LOW_HP, NADE_FOE_R, NADE_FOE_P, NADE_STILL_V, LU_AT, LU_NEAR, RUN_V, RUN_COS, RUN_SEC, RUN_MARGIN, RUN_PAST, RUN_NEAR, RUN_OWN_A, RUN_STRAIGHT, NADE_SPOT_R

**Механики изменённых файлов:**
- round: смена сторон и раунд: buyPhase, sideSwapNow, swapSides, freshMatch, endRound, resetRound
- throw-checks: гранаты: проверки и учёт броска (вторая часть throw.js, деление Р4.4 — склейка та же): неудачи броска, «почему не себе», дым над точкой, ведение задания гранаты, запись счётчиков гранат
- throw: гранаты: закуп buyNades, дым и видимость smokeBlocks; бросок throwNade (подбор физикой nadeSolve); полёт — физика 3D (30.10): 385_nades_flight (nadeLaunch / nadeStep / nadeAim), луч кубиком m3NadeTrace (035), отчёт docs/reports/GRENADE_PHYSICS_IMPLEMENTATION.md; бросок смока с разбега runupTick (эта
- modes: состояние режимов страницы (демо, песочница, разминка) и надпись смены сторон, которые читает / пишет ядро (Р5)

**Что пишут изменённые функции и кто это читает:**
- `.CT` — читают 60 функций: taskKeepUntil (task), taskSlackSec (task), timeoutCheck (tactics), ctShareW (ct-setup), chooseCtSetup (ct-setup), ctSeatRoles (ct-setup), ctRoleNow (ct-setup), ctRoleShift (ct-setup), rememberRound (ct-setup), ctBombSite (save-retake), teamSaving (save-retake), cl0save (save-retake), …
- `.T` — читают 77 функций: isSniper (rosters), taskKeepUntil (task), updatePost (task), bombTick (bomb), saveOppProfile (tactics), loadOppProfile (tactics), timeoutCheck (tactics), chooseTactic (tactics), rememberRound (ct-setup), lurkerBrain (lurker), tProbes (lurker), tClearCalls (lurker), …
- `._hereTried` — читают 1 функций: updateNadeTask1 (throw-checks)
- `._lastNade` — читают 2 функций: contactInfo (contact), throwNadeTry (throw)
- `._nadeNo` — читают 3 функций: nadeNoteFail (throw-checks), nadeFailedHere (throw-checks), nadeSetNadeNo (throw-checks)
- `._nadeT` — читают 2 функций: nadeReady (throw), nadeSetNadeT (throw-checks)
- `._nearFail` — читают 1 функций: updateNadeTask1 (throw-checks)
- `._nv` — читают 4 функций: nadeVelTrack (throw-checks), nadeBotVel (throw-checks), hudNum (fx), hudTwStep (fx)
- `._nvP` — читают 1 функций: nadeVelTrack (throw-checks)
- `._spotTried` — читают 1 функций: updateNadeTask1 (throw-checks)
- `._thrownT` — читают 2 функций: knowMeRevealed (events), throwNadeTry (throw)
- `.assists` — читают 3 функций: feedKill (journal), swapSides (round), newMatch (round)
- `.avoid` — читают 5 функций: timeoutCheck (tactics), coachPlan (tactics), chooseTactic (tactics), chooseCtSetup (ct-setup), swapSides (round)
- `.aware` — читают 3 функций: throwNadeTry (throw), detonate (damage), heDodgeTick (self)
- `.exuThrown` — читают 2 функций: throwNadeTry (throw), updateNadeTasks (throw-checks)
- `.from` — читают 46 функций: m3Load (geometry3d), zoneDijkstraTS (path-search), r7Path (path-search), pickSpots (sites-spots), tProbes (lurker), tBrainExecute (brain-t-phases), reachReset (reach), knowKill (events), knowRetakeDrift (events), itemKnown (events), knowTeamLook (events), knowHypSpread (events), …
- `.gen` — читают 5 функций: visBuild (vision), visReady (vision), r7Path (path-search), nadeRunPlan (throw-checks), updateNadeTask1 (throw-checks)
- `.int` — читают 1 функций: updateNadeTask1 (throw-checks)
- `.luId` — читают 3 функций: nadeQueueNext (throw-checks), runupFor (throw-checks), updateNadeTask1 (throw-checks)
- `.nadeTask` — читают 41 функций: tProbes (lurker), tSetSite (igl), tBrainExecute (brain-t-phases), updateRetake (save-retake), retakeUtil (save-retake), prePeekDecide (look-peek), smokeHeTick (smoke-react), siteRebalanceTick (roles), smokeEdgeTick (endgame), delayCanThrow (contact), ctDelayNade (contact), nadeAskFlash (plan), …
- `.nades` — читают 48 функций: choosePlant (sites-spots), tProbes (lurker), updateRetake (save-retake), retakeUtil (save-retake), intelDeath (intel), prePeekDecide (look-peek), smokeHeTick (smoke-react), ctEarlyPeek (ct-early), smokeEdgeTick (endgame), ctBrainCall (brain-ct), ctBrainPlayers (brain-ct-players), contactTick (contact), …
- `.plan` — читают 10 функций: timeoutCheck (tactics), chooseTactic (tactics), chooseCtSetup (ct-setup), smoothLookFilter (look), teamNadePlan (plan), swapSides (round), tdTactic (team), tsScript (timeout), tsFocus (timeout), tsBoard (timeout)
- `.runEnd` — читают 3 функций: nadeRunPlan (throw-checks), runupTick (throw-checks), updateNadeTask1 (throw-checks)
- `.runFail` — читают 3 функций: nadeRunPlan (throw-checks), runupTick (throw-checks), updateNadeTask1 (throw-checks)
- `.runMin` — читают 1 функций: runupTick (throw-checks)
- `.runOwn` — читают 2 функций: nadeRunPlan (throw-checks), runupTick (throw-checks)
- `.runOwnI` — читают 1 функций: nadeRunPlan (throw-checks)
- `.runOwnTried` — читают 1 функций: nadeRunPlan (throw-checks)
- `.runPh` — читают 7 функций: throwNadeTry (throw), nadeRunPlan (throw-checks), runupTick (throw-checks), updateNadeTask1 (throw-checks), moveWalkTick (move), moveSpeedTick (move), jumpCheckTick (tick-jump)
- `.runR` — читают 2 функций: runupFor (throw-checks), nadeRunPlan (throw-checks)
- `.runStart` — читают 1 функций: runupTick (throw-checks)
- `.runT0` — читают 1 функций: runupTick (throw-checks)
- `.runWalk` — читают 2 функций: runupTick (throw-checks), moveWalkTick (move)
- `.streak` — читают 3 функций: timeoutCheck (tactics), timeoutWant (tactics), swapSides (round)
- `.throwUntil` — читают 6 функций: lookTick (turn), nadeSetThrowUntil (throw-checks), tryShoot (shoot), jumpCheckTick (tick-jump), strafeKeysTick (tick-keys), probTick (problem-watch)
- `.until` — читают 57 функций: taskKeepUntil (task), taskCanSet (task), detourOk (task), timeoutCheck (tactics), chooseTactic (tactics), chooseCtSetup (ct-setup), tProbes (lurker), posClearValid (lurker), tBrain (brain-t), tBrainExecute (brain-t-phases), tradeGoing (intel), lookCands0 (look), …
- `.why` — читают 24 функций: setPost (task), tBrainExecGo (brain-t), tBrainExecute (brain-t-phases), ctDelayNade (contact), exuScan (exec-sync), exuFail (exec-sync), exuReassign (exec-sync), exuTick (exec-sync), exuGate (exec-sync), throwNadeDo (throw), throwNadeTry (throw), assignNade (throw-checks), …
- `.x` — читают 547 функций: applyZoneLayerToData (zones), autoPortals (zones), rebuildNavWarp (zones), navMapPoint (zones), applyNavTransform (zones), pointInPoly (navmesh), navGridBuild (navmesh), zoneOf (navmesh), dist2 (navmesh), segOverlap (navmesh), computePortal (navmesh), m3SolidGrid (geometry3d), …
- `.y` — читают 545 функций: applyZoneLayerToData (zones), autoPortals (zones), rebuildNavWarp (zones), navMapPoint (zones), applyNavTransform (zones), pointInPoly (navmesh), navGridBuild (navmesh), zoneOf (navmesh), dist2 (navmesh), segOverlap (navmesh), computePortal (navmesh), m3SolidGrid (geometry3d), …
- `LU_AT` — читают 2 функций: updatePost (task), updateNadeTask1 (throw-checks)
- `LU_NEAR` — читают 2 функций: smokeLineTick (exec-sync), updateNadeTask1 (throw-checks)
- `NADE_FOE_P` — читают 1 функций: nadeSelfWhyNot (throw-checks)
- `NADE_FOE_R` — читают 1 функций: nadeSelfWhyNot (throw-checks)
- `NADE_HIT_GAP` — читают 1 функций: nadeSelfWhyNot (throw-checks)
- `NADE_LOW_HP` — читают 1 функций: nadeSelfWhyNot (throw-checks)
- `NADE_NO_FROM` — читают 1 функций: nadeFailedHere (throw-checks)
- `NADE_NO_TO` — читают 1 функций: nadeFailedHere (throw-checks)
- `NADE_SPOT_R` — читают 1 функций: nadeThrowSpot (throw-checks)
- `NADE_STILL_V` — читают 1 функций: updateNadeTask1 (throw-checks)
- `RUN_COS` — читают 1 функций: runupTick (throw-checks)
- `RUN_MARGIN` — читают 1 функций: runupStart (throw-checks)
- `RUN_NEAR` — читают 2 функций: updatePost (task), runupTick (throw-checks)
- `RUN_OWN_A` — читают 1 функций: nadeRunPlan (throw-checks)
- `RUN_PAST` — читают 1 функций: runupTick (throw-checks)
- `RUN_SEC` — читают 2 функций: nadeRunPlan (throw-checks), runupTick (throw-checks)
- `RUN_STRAIGHT` — читают 1 функций: runupStart (throw-checks)
- `RUN_V` — читают 1 функций: runupTick (throw-checks)
- `SIDE_TEAM` — читают 11 функций: pnum (tuning), seatPlayers (rosters), saveOppProfile (tactics), loadOppProfile (tactics), timeoutCheck (tactics), ctSeatRoles (ct-setup), swapSides (round), endRound (round), rpWorldWith (modes), seriesUpdate (scoreboard), rpNewRec (replay)
- `TO_DEATHS` — читают 2 функций: timeoutCheck (tactics), coachPlan (tactics)
- `nadesInAir` — читают 18 функций: tBrainExecute (brain-t-phases), smokeLinePending (exec-sync), throwNadeTry (throw), smokeCovered (throw-checks), assignNadeDo (throw-checks), nadesTick (damage), heDodgeTick (self), nadeReact (self), resetNades (decide), matchBegin (round), rpWorldWith (modes), drawSmokes (draw-fx), …

**Задетые механики (читатели записанного; число функций):**
- throw-checks: гранаты: проверки и учёт броска (вторая часть throw.js, деление Р4.4 — склейка та же): неудачи броска, «почему не себе», дым над точкой, ведение задания гранаты, запись счётчиков гранат — 108
- fight: движение в перестрелке (одно место): fightCycleTick — на линии (стрейф и контрстрейф fightStrafe, v390) → за укрытие fightCover → снова; числа PEEK_PRO, STRAFE_PRO; безопасная ротация, мало HP — 53
- exec-sync: синхронизация выхода T с гранатами (одно место, v481): жизненный цикл смока выхода EXU (exuTick, exuThrown, exuLanded), можно ли выходить exuGate / exuPending, резервный исполнитель exuBackup / exuReassign — 49
- events: … события знания: knowCall, knowClearZone, knowKill, knowTick — 44
- task: позиция: setPost / updatePost, арбитр места TASK_LEVEL, свойства задач TASK_PROP / taskProp (v527); отклонение вместо отказа taskDetourKind / detourOk (v547); «дошёл» POST_ARRIVE; маршруты startRoute / routeTick — 42
- save-retake: сейв pickSaveSpot, ретейк updateRetake — 36
- look-peek: взгляд (одно место, v381): арбитр lookArbiter / LOOK_LEVEL, общий фильтр lookFilter; делёж углов lookCands, lookPlan, smoothLookFilter; пики до контакта prePeekTick, углы cornerLook; взгляд в прыжке jumpLook (v548; доворот у края — jumpFaceWait, 370); числа LOOK, threatEntrances; поворот (одно место — 35
- contact: реакция на контакт (одно место): contactTick; teamBrains; CT задерживает гранатой (одно место, v419): ctDelayNade — 34
- ct-setup: позиции по названиям зон, расстановки CT chooseCtSetup, любимые углы — 33
- lurker: лёркер lurkerBrain, пробы, «проверено — пусто» markClear — 33
- ct-early: эндгейм, клатч CT, ранний пик CT, мид — 32
- bomb: бомба: bombTick, урон взрыва bombDamageAt (BOMB_DMG), куда бежать bombFleePoint, дефуз — 31
- intel: память команды v166 (только радар + войс): intelPush, teamInfoTick, commSend = радар, intelEstimate, lkpNear, названия зон calloutName — 30
- lineups: гранаты: закуп buyNades, дым и видимость smokeBlocks; бросок throwNade (подбор физикой nadeSolve); полёт — физика 3D (30.10): 385_nades_flight (nadeLaunch / nadeStep / nadeAim), луч кубиком m3NadeTrace (035), отчёт docs/reports/GRENADE_PHYSICS_IMPLEMENTATION.md; бросок смока с разбега runupTick (эта — 29
- knowledge: знание бота о врагах (одно место): KNOW, hearReal; запись «что слышал» / «где последний раз враг» — knowHear / knowSound / knowIntel (одна точка, Р3.2 знание ш.3); гипотезы know*; позиции про KNOW_POSITIONS — 28
- position: где встать по почерку, оружию и прошлому раунду (одно место): posPref, posPickName, posTick; «держать район» holdSpot / holdGroup, варианты holdCands — 28
- tactics: тактики T chooseTactic, память матча memSnapshot/memRestore/memStart, MEM_BOX, профиль соперника OPP.by; тактические паузы (v460): TOUT, timeoutCheck / timeoutWant, план тренера coachPlan, TO_NOW; показ паузы — 676_timeout_show (ts*) — 27
- sound: звук emitSound, мелкие ситуации (пас бомбы, добить, смок уходит, ослеплён, пистолет) — 27
- assist: дабл-пик, фланг, перезарядка updateReload — 27
- look-arbiter: взгляд: арбитр (LOOK_LEVEL, lookArbiterR / lookApply), заявки знания (lookKnowCands), поручённый угол, взгляд в прыжке jumpLook, общий фильтр lookFilter, threatEntrances; разбор взгляда LOOKDBG — 26
- throw: гранаты: закуп buyNades, дым и видимость smokeBlocks; бросок throwNade (подбор физикой nadeSolve); полёт — физика 3D (30.10): 385_nades_flight (nadeLaunch / nadeStep / nadeAim), луч кубиком m3NadeTrace (035), отчёт docs/reports/GRENADE_PHYSICS_IMPLEMENTATION.md; бросок смока с разбега runupTick (эта — 26
- round: смена сторон и раунд: buyPhase, sideSwapNow, swapSides, freshMatch, endRound, resetRound — 25
- plan: план гранат команды (одно место, v428): закуп под план раунда по зонам, хозяин и момент гранаты — teamNadePlan, npBought, npCanUse, npUse, npZoneOf; данные — MAP.nadeplan (tools/map/nadeplan_bake.py) — 25
- self: гранаты: закуп buyNades, дым и видимость smokeBlocks; бросок throwNade (подбор физикой nadeSolve); полёт — физика 3D (30.10): 385_nades_flight (nadeLaunch / nadeStep / nadeAim), луч кубиком m3NadeTrace (035), отчёт docs/reports/GRENADE_PHYSICS_IMPLEMENTATION.md; бросок смока с разбега runupTick (эта — 25
- endgame: эндгейм, клатч CT, ранний пик CT, мид — 24
- items: трассеры, свой на линии bulletVictim; выпадение при смерти dropWeaponOnDeath → groundWeapons / groundItems (itemPickupTick); нож knifeTick; подбор оружия — 24
- look: взгляд (одно место, v381): арбитр lookArbiter / LOOK_LEVEL, общий фильтр lookFilter; делёж углов lookCands, lookPlan, smoothLookFilter; пики до контакта prePeekTick, углы cornerLook; взгляд в прыжке jumpLook (v548; доворот у края — jumpFaceWait, 370); числа LOOK, threatEntrances; поворот (одно место — 24
- path-search: поиск пути: zoneDijkstra (контекст ctx), воронка funnel, полосы botLane, путь buildWaypointPath, линия видимости hasLOS — 23
- sites-spots: сайты, точки планта, pickSpots; «рядом» для решений — по пути nearP (v532) — 22
- look-threat: карта команды belief из гипотез: beliefTick; чтение beliefZoneKnown; взгляд (одно место, v381): арбитр lookArbiter / LOOK_LEVEL, общий фильтр lookFilter; делёж углов lookCands, lookPlan, smoothLookFilter; пики до контакта prePeekTick, углы cornerLook; взгляд в прыжке jumpLook (v548; доворот у края — — 22
- observer: разминка warm*; автообсервер obs* (числа OBS_K, бой obsFight, слежка OBS.lock), мини-карта; повтор клатча rp* (запись rpRecord, клип rpBuild, эмоции rpEmotions, перейти к раунду rpGoto / #round=М.Р); звук snd*, разбор событий игры для показа showSync (звуки, баннеры, карточка раунда, закупка), главн — 21
- levels: навмеш и пути: rebuildNav, zoneDijkstra, funnel, buildWaypointPath; связи выше прыжка navCutTall / перепад navEdgeDz (v533); уровни/лестницы/подъёмы navAtLevel, laddersBuild, ladderTick (подъём через промежуточный ящик — mid, v533); под / над этажом floorCover / floorViewTick (v535); «на полу» — одн — 21
- smoke-react: смоки: прострел smokeSpamTick, smokeEnemyPossible; дыры от пуль smokeBulletHole / что видно сквозь дыру smokeHoleParts (v548) — 20
- decide: гранаты: закуп buyNades, дым и видимость smokeBlocks; бросок throwNade (подбор физикой nadeSolve); полёт — физика 3D (30.10): 385_nades_flight (nadeLaunch / nadeStep / nadeAim), луч кубиком m3NadeTrace (035), отчёт docs/reports/GRENADE_PHYSICS_IMPLEMENTATION.md; бросок смока с разбега runupTick (эта — 20
- zone-danger: кто кого видит (одно место, 3D): VIS_*, visLine, visParts, visFloorAt, visInvalidate; через неё hasLOS и таблица «откуда простреливается» computeZoneDanger — 20
- brain-ct: мозг CT ctBrain — части в прежнем порядке (Р3.2 команда): ctBrainBombDown (бомба выбита) → ctBrainCall (колл по сайтам) → ctBrainRotate (ротации по коллу) → ctBrainFlank (фланг) → ctBrainSave (сейв / ретейк команды) → ctBrainPlayers (по игроку); общее — контекст K — 19
- move: шагом / бегом / стоять (одно место, v522): moveWalkWhy (причина шага), moveRunWhy (отмена шага), moveWalkTick, целевая скорость moveSpeedTick; причины у бота _walkWhy / _runWhy / _stopWhy — 18
- smoke: смоки: прострел smokeSpamTick, smokeEnemyPossible; дыры от пуль smokeBulletHole / что видно сквозь дыру smokeHoleParts (v548); гранаты: закуп buyNades, дым и видимость smokeBlocks; бросок throwNade (подбор физикой nadeSolve); полёт — физика 3D (30.10): 385_nades_flight (nadeLaunch / nadeStep / nadeA — 18
- damage: гранаты: закуп buyNades, дым и видимость smokeBlocks; бросок throwNade (подбор физикой nadeSolve); полёт — физика 3D (30.10): 385_nades_flight (nadeLaunch / nadeStep / nadeAim), луч кубиком m3NadeTrace (035), отчёт docs/reports/GRENADE_PHYSICS_IMPLEMENTATION.md; бросок смока с разбега runupTick (эта — 18
- lineup-editor: рисование вспомогательного: навмеш/зоны (режимы редактирования); редактор лайнапов и форм зон — 18
- modes: состояние режимов страницы (демо, песочница, разминка) и надпись смены сторон, которые читает / пишет ядро (Р5) — 17
- brain-t: мозг T tBrain — части в прежнем порядке (Р3.2 команда): вступление и роли в tBrain; tBrainExecGo (сейв, момент выхода, постплант) → tBrainSiteSwitch (смена сайта, IGL) → tBrainMidTake (мид, чтение расстановки CT) → tBrainTeam (постплант-позиции, сейв) → tBrainBomb (за бомбой) → фаза: tBrainSetup / tBrainExecute / tBrainPostplant; общее — контекст K — 16
- view3d: 3D-вид (кнопка «3D», только показ, v571): D3, сцена d3Build (пол — навмеш, ящики — m3() до D3_CUT), кадр d3Frame, таблички d3Tag; своё WebGL2 — 16
- roles: роли pRole, tFallbackTick, ребаланс сайта; про-позиции ppLayer/proPick — 15
- fight-state: режим боя (state: patrol / hold / engage / retreat) — одна точка записи fightState (v525), оценка decideAction; после фрага afterKillMove, findCover; оценка размена duelBalance / duelEval / duelOdds и конец перестрелки снаружи fcEnd — в 470_fight_cycle — 15
- igl: IGL tIglReplan, стадии stagePost / tSetSite — 15
- look-debug: проверка «кто кого видит» visToolDraw; разбор взгляда lookDbgPanel — 15
- reach: тайминги «может ли там уже кто-то быть»: beliefBuild, reach* — 15
- engagements: перестрелки resolveEngagements — этапы: кто кого видит engSee (visParts) → цель engTarget → контакт и режим боя engDecide → отход engRetreatCheck → взгляд (275) → выстрелы engShoot; assignNewDestination — 14
- paths: кто кого видит (одно место, 3D): VIS_*, visLine, visParts, visFloorAt, visInvalidate; через неё hasLOS и таблица «откуда простреливается» computeZoneDanger; навмеш и пути: rebuildNav, zoneDijkstra, funnel, buildWaypointPath; связи выше прыжка navCutTall / перепад navEdgeDz (v533); уровни/лестницы/по — 14
- timeout: тактики T chooseTactic, память матча memSnapshot/memRestore/memStart, MEM_BOX, профиль соперника OPP.by; тактические паузы (v460): TOUT, timeoutCheck / timeoutWant, план тренера coachPlan, TO_NOW; показ паузы — 676_timeout_show (ts*) — 13
- navmesh: загрузка карты MAP, зоны, слой зон, калибровка навмеша; навмеш .nav, порталы, авто-стены — 12
- replay: разминка warm*; автообсервер obs* (числа OBS_K, бой obsFight, слежка OBS.lock), мини-карта; повтор клатча rp* (запись rpRecord, клип rpBuild, эмоции rpEmotions, перейти к раунду rpGoto / #round=М.Р); звук snd*, разбор событий игры для показа showSync (звуки, баннеры, карточка раунда, закупка), главн — 11
- brain-t-phases: мозг T, фазы раунда до планта: tBrainSetup (сетап, стадии) и tBrainExecute (выход) — части tBrain (Р3.2), контекст K — 11
- shoot: стрельба tryShoot (целится в видимое); ошибка прицела aimSigma, разброс shotSpread, «стрелять с ходу» FIRE_K/fireVAcc (v390) — 11
- nav-zones: рисование вспомогательного: навмеш/зоны (режимы редактирования); редактор лайнапов и форм зон — 10
- zones: загрузка карты MAP, зоны, слой зон, калибровка навмеша; навмеш .nav, порталы, авто-стены — 10
- turn: взгляд (одно место, v381): арбитр lookArbiter / LOOK_LEVEL, общий фильтр lookFilter; делёж углов lookCands, lookPlan, smoothLookFilter; пики до контакта prePeekTick, углы cornerLook; взгляд в прыжке jumpLook (v548; доворот у края — jumpFaceWait, 370); числа LOOK, threatEntrances; поворот (одно место — 9
- voice: память команды v166 (только радар + войс): intelPush, teamInfoTick, commSend = радар, intelEstimate, lkpNear, названия зон calloutName; войс (одно место «что сказали»): TEAM, teamNotice, teamChannel, teamDeath, teamTick → knowCall — 8
- draw-map: кадр: карта и слои анализа — зоны, опасность, навмеш, лучи (drawZones, drawDanger, drawNav, drawRays); было одним файлом view/draw.js (Р4.4, 26.11) — 8
- sandbox: песочница (одно место, v536): SANDBOX, sbTick (часы стоят), sbPlace / sbRevive / sbRemove, панель sbRender / sbLogic; приказ sbGo — 7
- app: разминка warm*; автообсервер obs* (числа OBS_K, бой obsFight, слежка OBS.lock), мини-карта; повтор клатча rp* (запись rpRecord, клип rpBuild, эмоции rpEmotions, перейти к раунду rpGoto / #round=М.Р); звук snd*, разбор событий игры для показа showSync (звуки, баннеры, карточка раунда, закупка), главн — 7
- team: (v566, владелец 12.11: «как разбор взгляда — для закупов, расстановок, клатчей: почему так играют, зачем») разбор команды — 6
- killfeed: киллфид — рисует renderFeed (иконки KF_ICON, затухание kfExpireTick), силуэты летящих гранат NADE_ICON / nadeImg, баннеры, карточка раунда, экономика на экране — 6
- tick-jump: прыжки и подсадки: звук приземления, подсадка (boost), клавиши в воздухе, проверка прыжка на ходу (jumpCheckTick); было одним файлом engine/core/tick.js (Р4.4, 26.11) — 6
- draw-fx: кадр: дым, огонь, гранаты в полёте, трассеры (drawSmokes, drawTracers); было одним файлом view/draw.js (Р4.4, 26.11) — 6
- vision: кто кого видит (одно место, 3D): VIS_*, visLine, visParts, visFloorAt, visInvalidate; через неё hasLOS и таблица «откуда простреливается» computeZoneDanger — 6
- weapons-bots: оружие, боты makeTeam, роумер — 6
- belief: карта команды belief из гипотез: beliefTick; чтение beliefZoneKnown — 6
- fov: оружие, боты makeTeam, роумер — 6
- economy: экономика: decideRoundType0, buyForPlayer; что берут — доли про smgFor, PRO_PISTOL (tools/pro/buy_pro.py) — 6
- tick: часы тика (TICK_HZ, пауза, шаг кадра), звук шагов moveSoundEmit, подход к дефузу, привязка к навмешу navSnap; было одним файлом engine/core/tick.js (Р4.4, 26.11) — 6
- brain-ct-players: мозг CT по игроку: ctBrainPlayers — часть ctBrain (Р3.2), контекст K — 5
- draw-bots: кадр: боты — значки, взгляд, подписи (drawBots); контур области areaPath; было одним файлом view/draw.js (Р4.4, 26.11) — 5
- problem-watch: счёт ошибок движения (одно место, только наблюдает, v407): PROB / probTick — застрял (с причиной), перенос, перетягивание; слой «ошибки движения», сторож замера — 5
- rosters: профили игроков, команды LINEUP, SIDE_TEAM, seatPlayers — 4
- draw: кадр радара: draw() — порядок частей кадра (карта, гранаты и выстрелы, слои, боты); было одним файлом view/draw.js (Р4.4, 26.11) — 4
- view3d-frame: 3D-вид (показ): кадр d3Frame, проекция d3Proj, таблички d3Tag, запуск вида — 4
- replay-play: повтор клатча (показ): проигрывание — скорость, рисование rpDraw, звук rpSound, переход к раунду — 4
- demo: (v571) РАУНД ИЗ ДЕМКИ («режим тени», В136) — одно место — 4
- journal: журнал матча (данные игры, с 17.11): строки консоли logEvent, войса voiceFeed / voiceKind, киллфида feedKill (+ знание о смерти, ассист, клатч clutchInfo) / feedBombKill / feedEvent, серия SERIES, решения команд TEAM_LOG, расписание писка бомбы bombBeepTick; события для показа — очередь SHOW_Q (show — 3
- scoreboard: табло scoreboardUpdate, панели игроков playersUpdate — 3
- geometry3d: 3D-геометрия игры (А5 Mirage, А6 Ancient — с v388 у обеих карт, MAP.map3d): m3(), луч m3Line/m3Hit, этажи m3Floors, «в стене» m3Solid/m3SolidHit, распаковка zInflate — 3
- draw-layers: кадр: слои отладки и подсказок (drawLayers); было одним файлом view/draw.js (Р4.4, 26.11) — 3
- highlights: (v447, владелец 28.10) ХАЙЛАЙТЫ — «игрок в ударе» — одно место — 2
- tick-keys: клавиши стрейфа по нажатиям про (strafeKeysTick, KEYS_PRO); было одним файлом engine/core/tick.js (Р4.4, 26.11) — 2
- fx: (v430) движение HUD — одно место: масштаб HUD под окно, «прокрутка» чисел, вспышки — 2
- map-walls: редактор карты MAPED (вкладки, Ctrl+Z, база; стены); высоты; укрытия; прострелы — 2
- brain-t-postplant: мозг T после планта: tBrainPostplant — часть tBrain (Р3.2), контекст K — 2
- pro-positions: роли pRole, tFallbackTick, ребаланс сайта; про-позиции ppLayer/proPick — 2
- tick-step: шаг движка: stepTick (порядок тика) и stepBot (ход одного бота); было одним файлом engine/core/tick.js (Р4.4, 26.11) — 2
- map-heights: редактор карты MAPED (вкладки, Ctrl+Z, база; стены); высоты; укрытия; прострелы — 2
- warmup: разминка warm*; автообсервер obs* (числа OBS_K, бой obsFight, слежка OBS.lock), мини-карта; повтор клатча rp* (запись rpRecord, клип rpBuild, эмоции rpEmotions, перейти к раунду rpGoto / #round=М.Р); звук snd*, разбор событий игры для показа showSync (звуки, баннеры, карточка раунда, закупка), главн — 2
- tuning: переключатели и числа движка BAL — 1

**Сцены реестра, где выполняются изменённые функции (38 из 38; карта сцен — 2026-11-27T14:39:43.211Z):**
- anchor_pick_stable (tools/measure/audit/scenarios.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- fov_second_enemy_behind (tools/measure/audit/scenarios.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- no_nade_on_teammate (tools/measure/audit/scenarios.js) — smokeCovered, nadeNoteFail, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, …
- reaction_first_contact (tools/measure/audit/scenarios.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- save_over_lineup (tools/measure/audit/scenarios.js) — smokeCovered, nadeNoteFail, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, …
- site_switch_clears_old (tools/measure/audit/scenarios.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- team_lkp_without_voice (tools/measure/audit/scenarios.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- belief_heard_not_said (tools/measure/audit/scenarios2.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- belief_radar_seen (tools/measure/audit/scenarios2.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- belief_said_in_voice (tools/measure/audit/scenarios2.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- belief_stale_decays (tools/measure/audit/scenarios2.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- flash_teammate_record (tools/measure/audit/scenarios2.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- known_target_reappears (tools/measure/audit/scenarios2.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- second_target_unexpected (tools/measure/audit/scenarios2.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- switch_no_old_staging (tools/measure/audit/scenarios2.js) — smokeCovered, nadeNoteFail, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, …
- target_lost_just_before (tools/measure/audit/scenarios2.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- cornerlook_microshift (tools/measure/audit/scenarios3.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- flash_mate_behind_cover (tools/measure/audit/scenarios3.js) — smokeCovered, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, runupFor, …
- flash_mate_heard_late (tools/measure/audit/scenarios3.js) — smokeCovered, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, runupFor, …
- flash_mate_unwarned (tools/measure/audit/scenarios3.js) — smokeCovered, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, runupFor, …
- flash_mate_warned (tools/measure/audit/scenarios3.js) — smokeCovered, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, runupFor, …
- molly_firecommit_rule (tools/measure/audit/scenarios3.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- molly_ignited_on_mate (tools/measure/audit/scenarios3.js) — smokeCovered, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, runupFor, …
- molly_path_through_own_fire (tools/measure/audit/scenarios3.js) — swapSides, smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, …
- switch_residual_classified (tools/measure/audit/scenarios3.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- cornerlook_stale_point_at_feet (tools/measure/audit/scenarios4.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- memory_held_ages (tools/measure/audit/scenarios4.js) — smokeCovered, nadeRevealOk, nadeVelTrack, updateNadeTasks, runupFor, runupStart, …
- molly_mate_at_real_landing (tools/measure/audit/scenarios4.js) — smokeCovered, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, runupFor, …
- molly_thrower_not_at_feet (tools/measure/audit/scenarios4.js) — smokeCovered, nadeRevealOk, nadeVelTrack, nadeBotVel, updateNadeTasks, runupFor, …
- switch_B_to_A (tools/measure/audit/scenarios4.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- switch_bomb_at_old_site (tools/measure/audit/scenarios4.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- carrier_not_alone_to_plant (tools/measure/audit/scenarios5.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- fill_reaches_spot (tools/measure/audit/scenarios5.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- probe_all_give_info (tools/measure/audit/scenarios5.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- probe_ct_main_episode (tools/measure/audit/scenarios5.js) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …
- smoke_hit_returns_fire (tools/measure/audit/scenarios5.js) — smokeCovered, nadeRevealOk, nadeOwnerOf, nadeVelTrack, updateNadeTasks, runupFor, …
- mir_jump360 (rebuild/scenarios.json) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, assignNade, …
- mir_stuck_window (rebuild/scenarios.json) — smokeCovered, nadeNoteFail, nadeFailedHere, nadeSelfWhyNot, assignNadeDo, nadeRevealOk, …


## Сборки (родитель → коммит)
- mirage: 33e6c11a084a (собрана) → aa631d167137 (собрана)
- ancient: 1f241b05d6e0 (собрана) → a3892a33f703 (собрана)
- страница изменилась и правка не только в функциях игры (rebuild/files.json, rebuild/state_classes.json) — проверяются все сцены

## Короткий отпечаток (2 матча × 15 000 тиков, родитель → коммит)
- mirage м3: 1319435218 → 1319435218 (тот же)
- mirage м7: 1680812199 → 1680812199 (тот же)
- ancient м3: 4239270815 → 4239270815 (тот же)
- ancient м7: 4054336257 → 4054336257 (тот же)
- игра не изменилась на этом окне

## Инварианты и ядра (коммит)
- инварианты mirage: код 0 — I-31: 159 | первый: {"tick":3062,"round":1,"bot":"T2","data":{"want":"tradeB","holds":"siteholdB:B Site","lv":1,"by":"html"}}
- I-23 mirage: код 1 —   PROB.ev[1].why.arb: "2.4 с назад: заявка «rotate» ур. 8: да — поставлен" → null
- ядро = эталон mirage: код 0 — сверок 1501876, расхождений 0
- инварианты ancient: код 0 — I-31: 87 | первый: {"tick":2495,"round":1,"bot":"CT2","data":{"want":"backstab","holds":"ambush","lv":9,"by":"ambushTick"}}
- I-23 ancient: код 0 — расхождения нет до тика 9016 (матч 3, проверка каждые 64 тиков)
- ядро = эталон ancient: код 0 — сверок 1159382, расхождений 0

## Все сцены (38 из 38): ответ родителя → коммита
- anchor_pick_stable: {"ok":true,"distinctPicks":1} (тот же)
- fov_second_enemy_behind: {"ok":true,"seesBehind":false,"lineOpen":true,"seesFront":true} (тот же)
- no_nade_on_teammate: {"ok":false,"heOnMate":false,"mollyOnMate":false,"heWhenClear":false} (тот же)
- reaction_first_contact: {"ok":true,"firstShotTick":20,"expectAtLeast":16,"dist":461} (тот же)
- save_over_lineup: {"ok":false,"tags":["lineup","save","save"]} (тот же)
- site_switch_clears_old: {"ok":true,"route":false,"nade":false,"restarted":false,"hasOnePlace":true} (тот же)
- team_lkp_without_voice: {"ok":false,"err":"ReferenceError: LKP is not defined"} (тот же)
- belief_heard_not_said: {"ok":true,"mapChange":0} (тот же)
- belief_radar_seen: {"ok":true,"mass":1} (тот же)
- belief_said_in_voice: {"ok":false,"valid":true,"sec":20,"control":0,"voiced":0,"thisEnemy":[0,0]} (тот же)
- belief_stale_decays: {"ok":true,"info":"только запись","after2s":0.141,"after22s":0.098} (тот же)
- flash_teammate_record: {"ok":true,"info":"только запись","mateBlindSec":0.42,"enemyBlindSec":0.44,"throwerBlindSec":0,"note":"свой слепнет ×0,18 всегда — колла «флешу» в войсе нет"} (тот же)
- known_target_reappears: {"ok":true,"ticksToShot":1,"reactTicks":16} (тот же)
- second_target_unexpected: {"ok":true,"ticksToShotB":21,"reactTicks":16,"streakA":61} (тот же)
- switch_no_old_staging: {"ok":true,"round":1,"oldSite":"B","waitingAtOld":[]} (тот же)
- target_lost_just_before: {"ok":true,"ticksToShot":1,"reactTicks":16} (тот же)
- cornerlook_microshift: {"ok":true,"valid":true,"holders":20,"steps":303,"turns20":0,"causes":{},"examples":[]} (тот же)
- flash_mate_behind_cover: {"ok":true,"valid":true,"pop":{"tick":1130,"x":989.0580633568716,"y":745.9611476749812,"warned":1060,"mateAware":false,"mateSees":false,"mate":0,"enemy":1.44,"thrower":0}} (тот же)
- flash_mate_heard_late: {"ok":true,"valid":true,"pop":{"tick":1130,"x":468.1929043197501,"y":1288.4007583785478,"mateAware":false,"mateSees":true,"mate":1.38,"enemy":0.45,"thrower":0}} (тот же)
- flash_mate_unwarned: {"ok":true,"valid":true,"pop":{"tick":1130,"x":468.1929043197501,"y":1288.4007583785478,"mateAware":false,"mateSees":true,"mate":1.38,"enemy":0.45,"thrower":0}} (тот же)
- flash_mate_warned: {"ok":true,"valid":true,"pop":{"tick":1130,"x":468.1929043197501,"y":1288.4007583785478,"warned":1060,"mateAware":false,"mateSees":true,"mate":0,"enemy":0.45,"thrower":0}} (тот же)
- molly_firecommit_rule: {"ok":false,"valid":true,"fullHp":false,"lowHp":false,"holding":false,"hpNeeded":68} (тот же)
- molly_ignited_on_mate: {"ok":true,"valid":true,"ticksToExit":55,"limit":100,"ticksInFire":55,"hpLost":4,"fireCommit":false} (тот же)
- molly_path_through_own_fire: {"ok":false,"valid":true,"at":"3:104192 T3 plantspot","ticksInFire":2,"movedAt":104222,"fireUntil":104629,"hpLost":0} (тот же)
- switch_residual_classified: {"ok":false,"valid":true,"classes":{"лёркер":11,"граната после смены":2,"НЕ объяснено":6,"мид / нейтрально":2},"unexplained":["3:5 A→B T1(awp) пост repos:killmove → НЕ объяснено","3:5 A→B T2(support) пост smokeLine → НЕ объяснено","7:1 A→B T2(support) пост repos:hurt → НЕ объяснено","7:8 A→B T1(awp) пост repos:back → НЕ объяснено","7:8 A→B T3(igl) пост repos:back → НЕ объяснено","7:10 A→B T2(support) пост repos:hurt → НЕ объяснено"],"rows":["3:1 B→A T4(lurker) пост route:Tunnel → лёркер","3:1 B→A T4(lurker) маршрут route:Tunnel → лёркер","3:2 B→A T1(awp) граната lineup molly:лайнап «про: молотов Jun → граната после смены","3:4 B→A T0(entry) граната lineup molly:лайнап «про: молотов Jun → граната после смены","3:4 B→A T4(lurker) пост route:Tunnel → лёркер","3:4 B→A T4(lurker) маршрут route:Tunnel → лёркер","3:5 A→B T1(awp) пост repos:killmove → НЕ объяснено","3:5 A→B T2(support) пост smokeLine → НЕ объяснено","3:5 A→B T4(lurker) пост route:Split → лёркер","3:5 A→B T4(lurker) маршрут route:Split → лёркер","7:1 A→B T2(support) пост repos:hurt → НЕ объяснено","7:1 A→B T4(lurker) пост route:Split → лёркер","7:1 A→B T4(lurker) маршрут route:Split → лёркер","7:7 A→B T2(support) пост contact:hold → мид / нейтрально","7:8 A→B T1(awp) пост repos:back → НЕ объяснено","7:8 A→B T3(igl) пост repos:back → НЕ объяснено","7:8 A→B T4(lurker) пост route:Split → лёркер","7:8 A→B T4(lurker) маршрут route:Split → лёркер","7:10 A→B T0(entry) пост contact:hold → мид / нейтрально","7:10 A→B T2(support) пост repos:hurt → НЕ объяснено","7:10 A→B T4(lurker) маршрут repos:fallback → лёркер"]} (тот же)
- cornerlook_stale_point_at_feet: {"ok":true,"valid":true,"holders":16,"keptPointAtFeet":0,"examples":[]} (тот же)
- memory_held_ages: {"ok":true,"valid":true,"worstOddsError":"0 %","heldWeight":{"стоял":{"2 с":[0.487,"0 %"],"5 с":[0.394,"0 %"],"10 с":[0.298,"0 %"],"20 с":[0.211,"0 %"],"40 с":[0.114,"0 %"]},"шёл":{"2 с":[0.487,"0 %"],"5 с":[0.394,"0 %"],"10 с":[0.298,"0 %"],"20 с":[0.211,"0 %"],"40 с":[0.114,"0 %"]},"бежал":{"2 с":[0.192,"0 %"],"5 с":[0.14,"0 %"],"10 с":[0.096,"0 %"],"20 с":[0.063,"0 %"],"40 с":[0.031,"0 %"]}}} (тот же)
- molly_mate_at_real_landing: {"ok":false,"valid":true,"thrown":true,"mateTicksInFire":0,"mateToTarget":77,"mateToLanding":50} (тот же)
- molly_thrower_not_at_feet: {"ok":false,"valid":false,"nearThrow":true,"nearFireDist":80,"farFireDist":null,"radius":72} (тот же)
- switch_B_to_A: {"ok":true,"valid":true,"cases":4,"classes":{"лёркер":6,"граната после смены":2,"место броска гранаты":1},"unexplained":[],"rows":["3:1 B→A T4(lurker) пост route:Tunnel → лёркер","3:1 B→A T4(lurker) маршрут route:Tunnel → лёркер","3:2 B→A T1(awp) граната lineup molly:лайнап «про: молотов Jun → граната после смены","3:4 B→A T0(entry) граната lineup molly:лайнап «про: молотов Jun → граната после смены","3:4 B→A T4(lurker) пост route:Tunnel → лёркер","3:4 B→A T4(lurker) маршрут route:Tunnel → лёркер","7:13 B→A T1(awp) пост lineup → место броска гранаты","7:13 B→A T4(lurker) пост route:Tunnel → лёркер","7:13 B→A T4(lurker) маршрут route:Tunnel → лёркер"]} (тот же)
- switch_bomb_at_old_site: {"ok":true,"valid":true,"cases":4,"bombHandled":4,"classes":{"бомба у старого сайта":8,"лёркер":7,"граната после смены":1,"место броска гранаты":1},"unexplained":[],"rows":["3:1 B→A T1(awp) пост fetchCover → бомба у старого сайта","3:1 B→A T2(support) пост fetch → бомба у старого сайта","3:1 B→A T4(lurker) пост route:Tunnel → лёркер","3:1 B→A T4(lurker) маршрут route:Tunnel → лёркер","3:2 B→A T0(entry) пост fetchCover → бомба у старого сайта","3:2 B→A T1(awp) граната lineup molly:лайнап «про: молотов Jun → граната после смены","3:2 B→A T2(support) пост fetch → бомба у старого сайта","3:2 B→A T3(igl) пост lineup → место броска гранаты","3:4 B→A T0(entry) пост fetchCover → бомба у старого сайта","3:4 B→A T3(igl) пост fetch → бомба у старого сайта","3:4 B→A T4(lurker) пост lineup → лёркер","3:4 B→A T4(lurker) маршрут lineup → лёркер","3:4 B→A T4(lurker) граната lineup smoke:лайнап «про: смок Lamp R → лёркер","3:11 B→A T1(awp) пост fetchCover → бомба у старого сайта","3:11 B→A T2(support) пост fetch → бомба у старого сайта","3:11 B→A T4(lurker) пост route:Tunnel → лёркер","3:11 B→A T4(lurker) маршрут route:Tunnel → лёркер"]} (тот же)
- carrier_not_alone_to_plant: {"ok":false,"valid":true,"plants":17,"aloneShare":9.1,"bombjoinCalls":0} (тот же)
- fill_reaches_spot: {"ok":false,"valid":false,"fills":0,"reached":0,"sample":[]} (тот же)
- probe_all_give_info: {"ok":true,"valid":true,"probes":9,"withInfo":9,"sample":["CT0: выгляну за инфой на «A Main» → план команды сменился","CT4: выгляну за инфой на «A Main» → инфо","CT0: выгляну за инфой на «A Main» → инфо","CT1: выгляну за инфой на миде → инфо","CT4: выгляну за инфой на «A Main» → план команды сменился","CT1: выгляну за инфой на миде → инфо","CT1: выгляну за инфой на миде → инфо","T2: подпушу мид, посмотрю, сколько их там → инфо","T0: подпушу Short, посмотрю, сколько их там → план команды сменился"]} (тот же)
- probe_ct_main_episode: {"ok":false,"ended":{},"valid":false,"peekers":[],"deep":{},"call":null,"teamClearZones":null,"roundSec":"30.0"} (тот же)
- smoke_hit_returns_fire: {"ok":false,"valid":false,"reactTicks":null,"smokeBlocks":true} (тот же)
- mir_jump360: false (тот же)
- mir_stuck_window: true (тот же)

## Работа проверки
- кэш: взято 0, посчитано 90 · параллельно до 4 из 4 · запусков Chromium для сцен 1
- время (настенное, с): проверки (всего) 1190.8 · scene switch_B_to_A 470.2 · scene switch_B_to_A 469.3 · scene carrier_not_alone_to_plant 350.9 · scene carrier_not_alone_to_plant 350.9 · scene molly_path_through_own_fire 213.6 · scene molly_path_through_own_fire 213.4 · scene switch_residual_classified 196.7 · scene switch_residual_classified 195.2 · scene cornerlook_microshift 185.5 · scene cornerlook_microshift 185.1 · scene fill_reaches_spot 174.8
