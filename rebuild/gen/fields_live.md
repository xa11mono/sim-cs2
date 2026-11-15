# Живая карта: кто пишет поля бота (генерируется — tools/rebuild/fw_map.js)

Источник — ловец `field_watch.js` на ПК (v582a5w_fp_mir, v582a5w_fp_anc), 8 матчей каждой карты; доля — от всех записей поля (оценка: стек каждой 16-й записи).
«писатель ← кто вызвал». Хозяин — по `rebuild/DEVICE.md`.

## `facing` — записей ≈ 13 990 000, смен значения 8 414 418

| писатель | доля |
|---|---|
| resolveEngagements | 42 % |
| freezeLookTick | 34 % |
| handTurn | 20 % |
| stepTick | 3 % |
| lookTrack ← resolveEngagements | 0.9 % |

## `walking` — записей ≈ 12 928 448, смен значения 107 774

| писатель | доля |
|---|---|
| moveWalkTick ← stepTick | 96 % |
| fightStrafe ← fightCycleTick | 4 % |
| stepTick | 0.2 % |
| fightCycleTick ← stepTick | 0.2 % |
| moveSpeedTick ← stepTick | 0.1 % |

## `curSpeed` — записей ≈ 4 169 760, смен значения 3 892 235

| писатель | доля |
|---|---|
| moveSpeedTick ← stepTick | 69 % |
| stepTick | 17 % |
| fightStrafe ← fightCycleTick | 11 % |
| ladderTick ← stepTick | 3 % |
| jumpFaceWait ← ladderTick | 0.2 % |

## `post` — записей ≈ 71 008, смен значения 71 063

| писатель | доля |
|---|---|
| setPost | 84 % |
| clearPost | 11 % |
| resetRound | 5 % |

## `state` — записей ≈ 21 584, смен значения 20 264

| писатель | доля |
|---|---|
| fightState ← resolveEngagements | 75 % |
| resetRound | 16 % |
| fightState ← leaveHold | 9 % |

## `nadeTask` — записей ≈ 25 904, смен значения 20 252

| писатель | доля |
|---|---|
| updateNadeTask1 ← updateNadeTasks | 36 % |
| assignNade | 26 % |
| resetNades | 14 % |
| lineupTick | 11 % |
| applyDamage ← tryShoot | 9 % |
| runupTick ← updateNadeTask1 | 3 % |
| nadeQueueNext ← updateNadeTask1 | 1 % |
| nadeAskFlash ← nadeReact | 0.3 % |
| tSetSite | 0.2 % |
| applyDamage ← detonate | 0.2 % |

## `holding` — записей ≈ 67 344, смен значения 15 496

| писатель | доля |
|---|---|
| resolveEngagements | 70 % |
| moveSpeedTick ← stepTick | 22 % |
| resetRound | 5 % |
| leaveHold ← killMoveCover | 2 % |
| leaveHold ← runupTick | 0.4 % |
| leaveHold ← updateNadeTask1 | 0.3 % |
| leaveHold ← postKillDecide | 0.1 % |

## `crouching` — записей ≈ 91 552, смен значения 12 918

| писатель | доля |
|---|---|
| duckDecide ← resolveEngagements | 46 % |
| fightCycleTick ← stepTick | 30 % |
| moveSpeedTick ← stepTick | 16 % |
| resetRound | 4 % |
| resolveEngagements | 1 % |
| leaveHold ← killMoveCover | 1 % |
| leaveHold ← updateNadeTask1 | 0.4 % |
| leaveHold ← runupTick | 0.2 % |
| leaveHold ← postKillDecide | 0.1 % |

## `path` — записей ≈ 156 720, смен значения 156 841

| писатель | доля |
|---|---|
| assignNewDestination ← stepTick | 40 % |
| setPost | 35 % |
| updatePost ← stepTick | 10 % |
| clearPost | 4 % |
| fireGoneRepath | 3 % |
| resetRound | 2 % |
| navFollowFloor ← stepTick | 1 % |
| ladderTick ← stepTick | 1 % |
| stepTick | 0.9 % |
| moveSpeedTick ← stepTick | 0.6 % |
| escapeWallLine ← stepTick | 0.4 % |
| fireRepath | 0.4 % |
| bombTick ← teamBrains | 0.3 % |
| navSnap ← stepTick | 0.3 % |
| resolveEngagements | 0.2 % |
| onBlind ← detonate | 0.2 % |
| updateRoamer ← stepTick | 0.2 % |
