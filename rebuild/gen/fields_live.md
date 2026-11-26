# Живая карта: кто пишет поля бота (генерируется — tools/rebuild/fw_map.js)

Источник — ловец `field_watch.js` на ПК (v582a9_fp_mir, v582a9_fp_anc), 8 матчей каждой карты; доля — от всех записей поля (оценка: стек каждой 16-й записи).
«писатель ← кто вызвал». Хозяин — по `docs/ARCHITECTURE.md`.

## `facing` — записей ≈ 13 990 000, смен значения 8 414 418

| писатель | доля |
|---|---|
| lookTick | 42 % |
| freezeLookTick | 34 % |
| handTurn | 20 % |
| lookTurnBy ← stepTick | 3 % |
| lookTrack ← lookTick | 0.9 % |

## `walking` — записей ≈ 12 928 448, смен значения 107 774

| писатель | доля |
|---|---|
| moveWalkTick ← stepTick | 96 % |
| moveWalk ← fightStrafe | 4 % |
| stepTick | 0.2 % |
| moveWalk ← fightCycleTick | 0.2 % |
| moveSpeedTick ← stepTick | 0.1 % |

## `curSpeed` — записей ≈ 4 169 760, смен значения 3 892 235

| писатель | доля |
|---|---|
| moveSpeedTick ← stepTick | 69 % |
| stepTick | 17 % |
| moveSpeed ← fightStrafe | 11 % |
| ladderTick ← stepTick | 3 % |
| jumpFaceWait ← ladderTick | 0.2 % |

## `post` — записей ≈ 71 008, смен значения 71 063

| писатель | доля |
|---|---|
| setPost | 84 % |
| clearPost | 11 % |
| placeResetPost ← resetRound | 5 % |

## `state` — записей ≈ 21 584, смен значения 20 264

| писатель | доля |
|---|---|
| fightState | 84 % |
| fightReset ← resetRound | 16 % |

## `nadeTask` — записей ≈ 25 904, смен значения 20 252

| писатель | доля |
|---|---|
| updateNadeTask1 ← updateNadeTasks | 36 % |
| assignNade | 26 % |
| resetNades | 14 % |
| lineupTick | 11 % |
| nadeCancel ← applyDamage | 9 % |
| runupTick ← updateNadeTask1 | 3 % |
| nadeQueueNext ← updateNadeTask1 | 1 % |
| nadeAskFlash ← nadeReact | 0.3 % |
| nadeCancel ← tSetSite | 0.2 % |

## `holding` — записей ≈ 67 344, смен значения 15 496

| писатель | доля |
|---|---|
| resolveEngagements | 70 % |
| fightHoldOff ← moveSpeedTick | 22 % |
| fightReset ← resetRound | 5 % |
| leaveHold ← killMoveCover | 2 % |
| leaveHold ← runupTick | 0.4 % |
| leaveHold ← updateNadeTask1 | 0.3 % |
| leaveHold ← postKillDecide | 0.1 % |

## `crouching` — записей ≈ 91 552, смен значения 12 918

| писатель | доля |
|---|---|
| placeStance ← duckDecide | 46 % |
| placeStance ← fightCycleTick | 30 % |
| placeStance ← moveSpeedTick | 16 % |
| placeStance ← resetRound | 4 % |
| placeStance ← leaveHold | 2 % |
| placeStance ← resolveEngagements | 1 % |

## `path` — записей ≈ 156 720, смен значения 156 841

| писатель | доля |
|---|---|
| movePath ← assignNewDestination | 40 % |
| movePath ← setPost | 35 % |
| movePath ← updatePost | 10 % |
| movePath ← clearPost | 4 % |
| fireGoneRepath | 3 % |
| movePath ← resetRound | 2 % |
| navFollowFloor ← stepTick | 1 % |
| ladderTick ← stepTick | 1 % |
| stepTick | 0.9 % |
| moveSpeedTick ← stepTick | 0.6 % |
| movePath ← escapeWallLine | 0.4 % |
| fireRepath | 0.4 % |
| movePath ← bombTick | 0.3 % |
| navSnap ← stepTick | 0.3 % |
| movePath ← resolveEngagements | 0.2 % |
| movePath ← onBlind | 0.2 % |
| movePath ← updateRoamer | 0.2 % |
