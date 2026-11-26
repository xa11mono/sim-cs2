# Порядок тика (генерируется: `tools/rebuild/gen_maps.js`)

Что вызывает `stepTick` по порядку исходника (функции игры; отступ — внутри условия / обхода ботов).
Это порядок вызовов в коде, а не замер: что срабатывает в тике — по условиям. Слои фазы 2 (знания → намерения → согласование → исполнители → физика) — в «Устройстве».

- `zoneDangerSync` (vision)
- `clockTick` (tick)
- `simTimeSet` (round)
    - `resetRound` (round) — если simTime - roundEndTime >= ROUND_RESTART_DELAY_SEC
    - `matchBegin` (round) — если simTime - roundEndTime >= 7
  - `freezeLookTick` (turn) — если roundState === "freeze"
  - `nadePrecalcTick` (throw) — если roundState === "freeze"
    - `roundSetState` (round) — если simTime >= roundStartTime
    - `freezeFxReset` (round) — если simTime >= roundStartTime
    - `logEvent` (journal) — если simTime >= roundStartTime
  - `sbTick` (sandbox) — если SANDBOX.on
  - `dvTick` (demo) — если DEMOV.on
  - `weaponPickupTick` (items) — если postRun
  - `itemPickupTick` (items) — если postRun
  - `teamBrains` (contact) — если !postRun
  - `nadeBrains` (decide) — если !postRun
  - `updateNadeTasks` (throw) — если !postRun
  - `nadesTick` (damage) — если !postRun
    - `tClearCalls` (lurker) — если roundState === "live" && tick % 16 === 0
  - `bombBeepTick` (journal) — если !postRun
  - `stepBot` (tick-step) — в обходе (forEach и т.п.)
- `resolveEngagements` (engagements)
- `ecoKnowSeeTick` (economy)
- `smokeSpamTick` (smoke-react)
- `infoFallbackTick` (roles)
- `smokeHeTick` (smoke-react)
- `teamInfoTick` (intel)
- `posTick` (position)
- `knowTick` (events)
- `teamTick` (voice)
- `beliefTick` (belief)
- `checkRoundEnd` (round)
- `probTick` (problem-watch)
