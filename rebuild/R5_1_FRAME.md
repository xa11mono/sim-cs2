# Р5.1 — контракт Frame и команды (26.11, шаг 1: опись из кода)

Источник — код (`tools/rebuild/frame_contract.js` → `rebuild/gen/frame.json`): показ — файлы части `show` / `page` (`rebuild/files.json`),
симуляция — остальные. Перегенерировать после правок показа.

## Frame — что показ читает у симуляции
- **Кадр (51 переменных)** — меняются по ходу матча, передаются каждый кадр: `BUY_SHOW`, `CLEARZ`, `CTSET_DBG`, `FREEZE_FX`, `KF_DIRTY`, `LOG_DIRTY`, `LOOKDBG`, `NICKS`, `OPP`, `P`, `PROB`, `REACH`, `SERIES`, `SHOW_Q`, `SIDE_TEAM`, `TACT_DBG`, `TEAM_LOG`, `TEAM_LOGO`, `TEAM_NAME`, `TO_LAST`, `TO_NOW`, `VOICE_DIRTY`, `accumulator`, `beliefLast`, `bomb`, `bots`, `clutchInfo`, `fires`, `groundItems`, `groundWeapons`, `killfeed`, `matchNum`, `nadeFx`, `nadesInAir`, `nowTs`, `paused`, `roundEndTime`, `roundNum`, `roundStartTick`, `roundStartTime`, `roundState`, `score`, `simTime`, `smokes`, `soundPings`, `teamEco`, `teamIntel`, `teamTac`, `tick`, `tracers`, `voiceLines`.
- **Загрузка (94)** — неизменяемые / вход / кэш по реестру состояния (`rebuild/state_classes.json`): карта, константы, таблицы; один раз.
- **Поля бота (141)** — с запасом (то же имя у другого объекта попадает): список — `rebuild/gen/frame.json` «bot».

## Команды — что показ делает с симуляцией
- **Меняют симуляцию (35)** — функция сама пишет поле / переменную симуляции: `applyDamage`, `applyNavTransform`, `applyUserZones`, `applyWalls`, `applyZoneLayer`, `buildWaypointPath`, `clockAcc`, `clockFrameDt`, `clockPause`, `clockSet`, `covList`, `fightReset`, `floorViewTick`, `hearReal`, `logEvent`, `lookFace`, `lookTurnBy`, `m3`, `movePath`, `moveSpeed`, `nadeWorldSet`, `navGridBuild`, `rebuildNav`, `rebuildNavWarp`, `renderVoice`, `resetRound`, `saveUserZonesDebounced`, `stepTick`, `tryShoot`, `visInvalidate`, `wallBoxes`, `wbList`, `zoneDangerSync`, `zoneIndexReset`, `zoneNameCacheReset`.
  Группы: часы (`clockPause`, `clockSet`, `clockAcc`, `clockFrameDt`, `stepTick`), матч (`freshMatch`, `resetRound`), правка карты
  (`applyWalls`, `rebuildNav`, `applyUserZones`, `applyZoneLayer`, …), режимы страницы (демо `applyDamage`, разминка / песочница `lookFace`,
  `movePath`, `fightReset`, …), журнал (`logEvent`, `renderVoice`).
- **Записи переменных симуляции из показа (18)**: `BUILTIN_OFF`, `BUY_SHOW`, `COV_OWN`, `HGT_OWN`, `HL`, `LOOKDBG`, `P`, `SHOW_Q`, `USER_LINEUPS`, `USER_ZONES`, `WALL_POLYS`, `WB_OWN`, `ZONE_NAMES`, `ZONE_SHAPES`, `bomb`, `navAnchors`, `navTransform`, `zoneLayer` — кандидаты в команды
  (редакторы карты, отметки, режимы).
- **Расчёты (84)** — сами состояние не пишут (`hasLOS`, `calloutName`, `m3Line`, …): показ может вызывать свою копию
  кода (в Worker — код симуляции есть и в странице). Транзитивные записи через вызовы — проверить при переносе (Р5.2).

## Дальше (Р5.2)
`frameMake()` у симуляции (кадровые переменные + поля ботов → переносимый объект) и `frameApply(F)` у показа (раскладывает по тем же
именам — код показа не меняется); проверка — кадр холста (`tools/page/frame_hash.js`) от `frameApply(frameMake())` из второй страницы
равен прямому кадру; команды — очередь сообщений к симуляции. Режим «всё в одной странице» остаётся (откат).

## Проверка переносимости (26.11)
Кадр матча 3 Mirage, тик 12000: `structuredClone` проходит у всех кадровых переменных (у `bots`, `bomb`, `nadesInAir` — циклические ссылки
между объектами, `structuredClone` их сохраняет; `JSON` — нет, поэтому передача кадра — `postMessage` / `structuredClone`, не JSON).
`P` в описи — ложное: локальное имя показа (уточнить разбор областей видимости в `frame_contract.js`).

## Прогон 332: фактическая параллельность (разбор 26.11, владелец: «раннер работает с par=1 при 7–8 ГБ свободных»)
Причина — сторож `tools/measure/procguard.py` (до v637a), схема та же, что в журналах 329–331 (`pc-results/<N>/run.log`): Chromium par 8
на Ancient — матчи растут с ~0,6 до ~2 ГБ, допуск смотрел только на «свободно сейчас» → стартовали все 8, память кончалась, сторож снимал
самые новые матчи и резал `cap` 8 → 7 → 6 → 5 → 4 (обратно не поднимал), затем повтор снятых ставил `cap = 1` — до конца пула. В 331
очередь Mirage уже стояла в пуле и ушла с `cap` 4; в 332 фазы (`"phase": true`) идут через один пул по очереди — **все фазы после
первой многоматчевой (Chromium Ancient) шли с `cap = 1`**. Строки журнала 332 — после публикации `pc-results/332` (идущее задание GitHub
журнал не отдаёт); проверить: `guard: мало памяти`, `переигровка снятых`, `par ≤ 1`.
Следствие: отпечатки 332 годны (параллельность не влияет на игру); **сравнение массовой производительности Node и Chromium по 332
некорректно для par 8** — фактически шёл один матч. Исправлено в v637a (тест `tools/measure/procguard_test.py`): допуск по прогнозу пика
(«движок:карта», наибольший замеченный), постепенное восстановление `cap` до `par`, повтор снятых — по одному без снижения `cap`,
конец фазы возвращает `cap` к `par`; фактическая параллельность — `guard_<m>.json` (`par_seen_max`, `par_seen_avg`) и `phase.json`
(`par_max`, `par_avg`, `cap_log`). Замер параллельных матчей — повторить новым сторожем; готовые отпечатки не пересчитывать.

