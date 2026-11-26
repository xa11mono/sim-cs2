# Кто пишет поля бота (генерируется: `tools/rebuild/gen_maps.js`, статический разбор кода)

Запись — присваивание `бот.поле = …` / `++` в функции (файл — номер); то же имя у другого объекта (бомба, редактор, смок выхода) — отдельно. Хозяин — по CLAUDE.md §7; у полей без хозяина его пока нет (назначит перенос каналов).
Живой ловец (кто пишет во время матча, со стеком) — `tools/measure/engine/field_watch.js`.

| поле | мест | функций | из них хозяин |
|---|---|---|---|
| `facing` | 11 | 7 | `lookFace · turn`, `lookTurnBy · turn`, `lookReset · turn`, `lookTick · turn`, `lookTrack · turn`, `handTurn · turn`, `freezeLookTick · turn` |
| `walking` | 4 | 4 | `moveWalk · move`, `moveWalkTick · move`, `moveSpeedTick · move`, `stepBot · tick` |
| `curSpeed` | 13 | 5 | `jumpFaceWait · levels`, `ladderTick · levels`, `moveSpeed · move`, `moveSpeedTick · move`, `stepBot · tick` |
| `post` | 3 | 3 | `setPostDo · task`, `clearPostDo · task`, `placeResetPost · task` |
| `_task` | 4 | 4 | `routeTick · task`, `setPostDo · task`, `clearPostDo · task`, `placeResetTask · task` |
| `_reposUntil` | 1 | 1 | `taskKeep · task` |
| `_waitPopUntil` | 1 | 1 | `moveWaitPop · move` |
| `_avoidPeekUntil` | 1 | 1 | `knowAvoidPeek · events` |
| `_tradeUntil` | 2 | 2 | `tradeAlertSet · intel`, `tradeEnd · intel` |
| `_tradeLock` | 1 | 1 | `tradeEnd · intel` |
| `state` | 2 | 2 | `fightStateDo · fight-state`, `fightReset · fight-state` |
| `nadeTask` | 12 | 8 | `(верх файла) · smoke`, `nadeAskFlash · plan`, `exuReassign · exec-sync`, `assignNadeDo · throw`, `nadeQueueNext · throw`, `lineupTick · lineups`, `nadeTaskEnd · decide`, `resetNades · decide` |
| `holding` | 5 | 4 | `fightReset · fight-state`, `fightHoldOff · fight-state`, `leaveHold · fight-state`, `engDecide · engagements` |
| `crouching` | 1 | 1 | `placeStance · task` |
| `path` | 13 | 7 | `fireRepath · levels`, `ladderTick · levels`, `navFollowFloor · levels`, `movePath · move`, `moveSpeedTick · move`, `navSnap · tick`, `stepBot · tick` |
| `phase` | 1 | 1 | `tPhaseSet · igl` |
| `lookReason` | 2 | 2 | `lookReasonSet · look-arbiter`, `lookApply · look-arbiter` |
| `_lookLvl` | 1 | 1 | `lookApply · look-arbiter` |
| `heardSound` | 0 | 0 | — |
| `lastIntel` | 0 | 0 | — |

## `facing`

- **хозяин** `handTurn · turn` — 3 (стр. 118, 125, 128)
- **хозяин** `lookTick · turn` — 2 (стр. 43, 54)
- **хозяин** `freezeLookTick · turn` — 2 (стр. 160, 174)
- **хозяин** `lookFace · turn` — 1 (стр. 9)
- **хозяин** `lookTurnBy · turn` — 1 (стр. 10)
- **хозяин** `lookReset · turn` — 1 (стр. 11)
- **хозяин** `lookTrack · turn` — 1 (стр. 98)

## `walking`

- **хозяин** `moveWalk · move` — 1 (стр. 24)
- **хозяин** `moveWalkTick · move` — 1 (стр. 109)
- **хозяин** `moveSpeedTick · move` — 1 (стр. 164)
- **хозяин** `stepBot · tick` — 1 (стр. 521)

## `curSpeed`

- **хозяин** `moveSpeedTick · move` — 5 (стр. 184, 186, 187, 188, 189)
- **хозяин** `stepBot · tick` — 5 (стр. 354, 381, 504, 519, 521)
- **хозяин** `jumpFaceWait · levels` — 1 (стр. 110)
- **хозяин** `ladderTick · levels` — 1 (стр. 216)
- **хозяин** `moveSpeed · move` — 1 (стр. 23)

## `post`

- **хозяин** `setPostDo · task` — 1 (стр. 462)
- **хозяин** `clearPostDo · task` — 1 (стр. 515)
- **хозяин** `placeResetPost · task` — 1 (стр. 524)

## `_task`

- **хозяин** `routeTick · task` — 1 (стр. 66)
- **хозяин** `setPostDo · task` — 1 (стр. 417)
- **хозяин** `clearPostDo · task` — 1 (стр. 515)
- **хозяин** `placeResetTask · task` — 1 (стр. 525)

## `_reposUntil`

- **хозяин** `taskKeep · task` — 1 (стр. 277)

## `_waitPopUntil`

- **хозяин** `moveWaitPop · move` — 1 (стр. 21)

## `_avoidPeekUntil`

- **хозяин** `knowAvoidPeek · events` — 1 (стр. 475)

## `_tradeUntil`

- **хозяин** `tradeAlertSet · intel` — 1 (стр. 399)
- **хозяин** `tradeEnd · intel` — 1 (стр. 402)

не бот (то же имя у другого объекта — в проверку владения не идёт): `tradeStart · intel` (398 o)

## `_tradeLock`

- **хозяин** `tradeEnd · intel` — 1 (стр. 402)

не бот (то же имя у другого объекта — в проверку владения не идёт): `tradeStart · intel` (398 o)

## `state`

- **хозяин** `fightStateDo · fight-state` — 1 (стр. 4)
- **хозяин** `fightReset · fight-state` — 1 (стр. 13)

не бот (то же имя у другого объекта — в проверку владения не идёт): `dropBomb · bomb` (96 bomb), `bombTick · bomb` (228 bomb; 269 bomb; 286 bomb), `exuThrown · exec-sync` (70 it), `exuLanded · exec-sync` (82 it), `exuFail · exec-sync` (86 it), `exuReassign · exec-sync` (137 it), `exuTick · exec-sync` (149 it; 151 it; 155 it), `bombPassTick · sound` (86 bomb), `checkRoundEnd · round` (136 bomb), `mapEdQueueSave · map-walls` (66 S; 67 S), `mapEdSaveNow · map-walls` (74 S; 81 S; 82 S), `dvTick · demo` (46 bomb; 47 bomb)

## `nadeTask`

- **хозяин** `exuReassign · exec-sync` — 3 (стр. 128, 131, 132)
- **хозяин** `nadeQueueNext · throw` — 2 (стр. 456, 458)
- **хозяин** `lineupTick · lineups` — 2 (стр. 202, 264)
- **хозяин** `(верх файла) · smoke` — 1 (стр. 37)
- **хозяин** `nadeAskFlash · plan` — 1 (стр. 235)
- **хозяин** `assignNadeDo · throw` — 1 (стр. 414)
- **хозяин** `nadeTaskEnd · decide` — 1 (стр. 253)
- **хозяин** `resetNades · decide` — 1 (стр. 261)

## `holding`

- **хозяин** `engDecide · engagements` — 2 (стр. 133, 153)
- **хозяин** `fightReset · fight-state` — 1 (стр. 13)
- **хозяин** `fightHoldOff · fight-state` — 1 (стр. 14)
- **хозяин** `leaveHold · fight-state` — 1 (стр. 188)

не бот (то же имя у другого объекта — в проверку владения не идёт): `rpEnd · replay` (266 RP), `rpHold · replay` (273 RP)

## `crouching`

- **хозяин** `placeStance · task` — 1 (стр. 523)

## `path`

- **хозяин** `stepBot · tick` — 5 (стр. 519, 593, 632, 654, 669)
- **хозяин** `navFollowFloor · levels` — 2 (стр. 384, 423)
- **хозяин** `moveSpeedTick · move` — 2 (стр. 156, 163)
- **хозяин** `fireRepath · levels` — 1 (стр. 29)
- **хозяин** `ladderTick · levels` — 1 (стр. 217)
- **хозяин** `movePath · move` — 1 (стр. 22)
- **хозяин** `navSnap · tick` — 1 (стр. 66)

не бот (то же имя у другого объекта — в проверку владения не идёт): `hgtCache · map-heights` (16 HGT_C)

## `phase`

- **хозяин** `tPhaseSet · igl` — 1 (стр. 27)

## `lookReason`

- **хозяин** `lookReasonSet · look-arbiter` — 1 (стр. 180)
- **хозяин** `lookApply · look-arbiter` — 1 (стр. 182)

## `_lookLvl`

- **хозяин** `lookApply · look-arbiter` — 1 (стр. 182)

## `heardSound`



не бот (то же имя у другого объекта — в проверку владения не идёт): `knowSound · knowledge` (80 o)

## `lastIntel`



не бот (то же имя у другого объекта — в проверку владения не идёт): `knowIntel · knowledge` (82 o)
