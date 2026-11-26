# Кто пишет поля бота (генерируется: `tools/rebuild/gen_maps.js`, статический разбор кода)

Запись — присваивание `бот.поле = …` / `++` в функции (файл — номер); то же имя у другого объекта (бомба, редактор, смок выхода) — отдельно. Хозяин — по CLAUDE.md §7; у полей без хозяина его пока нет (назначит перенос каналов).
Живой ловец (кто пишет во время матча, со стеком) — `tools/measure/engine/field_watch.js`.

| поле | мест | функций | из них хозяин |
|---|---|---|---|
| `facing` | 11 | 7 | `lookFace · turn`, `lookTurnBy · turn`, `lookReset · turn`, `lookTick · turn`, `lookTrack · turn`, `handTurn · turn`, `freezeLookTick · turn` |
| `walking` | 4 | 4 | `moveWalk · move`, `moveWalkTick · move`, `moveSpeedTick · move`, `stepBot · tick-step` |
| `curSpeed` | 13 | 5 | `jumpFaceWait · levels`, `ladderTick · levels`, `moveSpeed · move`, `moveSpeedTick · move`, `stepBot · tick-step` |
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
| `path` | 13 | 7 | `fireRepath · levels`, `ladderTick · levels`, `navFollowFloor · levels`, `movePath · move`, `moveSpeedTick · move`, `navSnap · tick`, `stepBot · tick-step` |
| `phase` | 1 | 1 | `tPhaseSet · igl` |
| `lookReason` | 2 | 2 | `lookReasonSet · look-arbiter`, `lookApply · look-arbiter` |
| `_lookLvl` | 1 | 1 | `lookApply · look-arbiter` |
| `heardSound` | 0 | 0 | — |
| `lastIntel` | 0 | 0 | — |
| `planting` | 6 | 3 | `bombActReset · bomb`, `resetBomb · bomb`, `bombTick · bomb` |
| `defusing` | 5 | 3 | `bombActReset · bomb`, `resetBomb · bomb`, `bombTick · bomb` |
| `_route` | 6 | 4 | `startRoute · task`, `routeTick · task`, `routeDrop · task`, `setPostDo · task` |
| `_routeDone` | 3 | 2 | `routeTick · task`, `routeDrop · task` |
| `baseX` | 21 | 11 | `ladderTick · levels`, `resetRound · round`, `movePlace · move`, `navSnap · tick`, `jumpCheckTick · tick-jump`, `strafeKeysTick · tick-keys`, `stepBot · tick-step`, `warmSpawn · warmup`, `warmTick · warmup`, `sbPlace · sandbox`, `dvPlace · demo` |
| `baseY` | 21 | 11 | `ladderTick · levels`, `resetRound · round`, `movePlace · move`, `navSnap · tick`, `jumpCheckTick · tick-jump`, `strafeKeysTick · tick-keys`, `stepBot · tick-step`, `warmSpawn · warmup`, `warmTick · warmup`, `sbPlace · sandbox`, `dvPlace · demo` |

## `facing`

- **хозяин** `handTurn · turn` — 3 (стр. 118, 125, 128)
- **хозяин** `lookTick · turn` — 2 (стр. 43, 54)
- **хозяин** `freezeLookTick · turn` — 2 (стр. 160, 174)
- **хозяин** `lookFace · turn` — 1 (стр. 9)
- **хозяин** `lookTurnBy · turn` — 1 (стр. 10)
- **хозяин** `lookReset · turn` — 1 (стр. 11)
- **хозяин** `lookTrack · turn` — 1 (стр. 98)

## `walking`

- **хозяин** `moveWalk · move` — 1 (стр. 27)
- **хозяин** `moveWalkTick · move` — 1 (стр. 112)
- **хозяин** `moveSpeedTick · move` — 1 (стр. 166)
- **хозяин** `stepBot · tick-step` — 1 (стр. 251)

## `curSpeed`

- **хозяин** `moveSpeedTick · move` — 5 (стр. 186, 188, 189, 190, 191)
- **хозяин** `stepBot · tick-step` — 5 (стр. 84, 111, 234, 249, 251)
- **хозяин** `jumpFaceWait · levels` — 1 (стр. 111)
- **хозяин** `ladderTick · levels` — 1 (стр. 217)
- **хозяин** `moveSpeed · move` — 1 (стр. 26)

## `post`

- **хозяин** `setPostDo · task` — 1 (стр. 467)
- **хозяин** `clearPostDo · task` — 1 (стр. 520)
- **хозяин** `placeResetPost · task` — 1 (стр. 529)

## `_task`

- **хозяин** `routeTick · task` — 1 (стр. 66)
- **хозяин** `setPostDo · task` — 1 (стр. 422)
- **хозяин** `clearPostDo · task` — 1 (стр. 520)
- **хозяин** `placeResetTask · task` — 1 (стр. 530)

## `_reposUntil`

- **хозяин** `taskKeep · task` — 1 (стр. 282)

## `_waitPopUntil`

- **хозяин** `moveWaitPop · move` — 1 (стр. 24)

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

не бот (то же имя у другого объекта — в проверку владения не идёт): `dropBomb · bomb` (105 bomb), `bombTick · bomb` (237 bomb; 278 bomb; 295 bomb), `exuThrown · exec-sync` (70 it), `exuLanded · exec-sync` (82 it), `exuFail · exec-sync` (86 it), `exuReassign · exec-sync` (137 it), `exuTick · exec-sync` (149 it; 151 it; 155 it), `bombPassTick · sound` (86 bomb), `checkRoundEnd · round` (137 bomb), `mapEdQueueSave · map-walls` (66 S; 67 S), `mapEdSaveNow · map-walls` (74 S; 81 S; 82 S), `dvTick · demo` (46 bomb; 47 bomb)

## `nadeTask`

- **хозяин** `exuReassign · exec-sync` — 3 (стр. 128, 131, 132)
- **хозяин** `nadeQueueNext · throw` — 2 (стр. 456, 458)
- **хозяин** `lineupTick · lineups` — 2 (стр. 202, 264)
- **хозяин** `(верх файла) · smoke` — 1 (стр. 37)
- **хозяин** `nadeAskFlash · plan` — 1 (стр. 235)
- **хозяин** `assignNadeDo · throw` — 1 (стр. 414)
- **хозяин** `nadeTaskEnd · decide` — 1 (стр. 254)
- **хозяин** `resetNades · decide` — 1 (стр. 262)

## `holding`

- **хозяин** `engDecide · engagements` — 2 (стр. 133, 153)
- **хозяин** `fightReset · fight-state` — 1 (стр. 13)
- **хозяин** `fightHoldOff · fight-state` — 1 (стр. 14)
- **хозяин** `leaveHold · fight-state` — 1 (стр. 188)

не бот (то же имя у другого объекта — в проверку владения не идёт): `rpEnd · replay` (266 RP), `rpHold · replay` (273 RP)

## `crouching`

- **хозяин** `placeStance · task` — 1 (стр. 528)

## `path`

- **хозяин** `stepBot · tick-step` — 5 (стр. 249, 323, 362, 384, 399)
- **хозяин** `navFollowFloor · levels` — 2 (стр. 385, 424)
- **хозяин** `moveSpeedTick · move` — 2 (стр. 158, 165)
- **хозяин** `fireRepath · levels` — 1 (стр. 30)
- **хозяин** `ladderTick · levels` — 1 (стр. 218)
- **хозяин** `movePath · move` — 1 (стр. 25)
- **хозяин** `navSnap · tick` — 1 (стр. 67)

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

## `planting`

- **хозяин** `bombTick · bomb` — 4 (стр. 224, 231, 236, 249)
- **хозяин** `bombActReset · bomb` — 1 (стр. 19)
- **хозяин** `resetBomb · bomb` — 1 (стр. 93)

## `defusing`

- **хозяин** `bombTick · bomb` — 3 (стр. 293, 295, 334)
- **хозяин** `bombActReset · bomb` — 1 (стр. 19)
- **хозяин** `resetBomb · bomb` — 1 (стр. 93)

## `_route`

- **хозяин** `routeTick · task` — 2 (стр. 58, 65)
- **хозяин** `routeDrop · task` — 2 (стр. 280, 281)
- **хозяин** `startRoute · task` — 1 (стр. 52)
- **хозяин** `setPostDo · task` — 1 (стр. 386)

## `_routeDone`

- **хозяин** `routeDrop · task` — 2 (стр. 280, 281)
- **хозяин** `routeTick · task` — 1 (стр. 65)

## `baseX`

- **хозяин** `stepBot · tick-step` — 7 (стр. 253, 254, 272, 286, 320, 383, 436)
- **хозяин** `ladderTick · levels` — 3 (стр. 208, 212, 216)
- **хозяин** `jumpCheckTick · tick-jump` — 2 (стр. 90, 109)
- **хозяин** `warmTick · warmup` — 2 (стр. 79, 82)
- **хозяин** `resetRound · round` — 1 (стр. 211)
- **хозяин** `movePlace · move` — 1 (стр. 23)
- **хозяин** `navSnap · tick` — 1 (стр. 67)
- **хозяин** `strafeKeysTick · tick-keys` — 1 (стр. 53)
- **хозяин** `warmSpawn · warmup` — 1 (стр. 12)
- **хозяин** `sbPlace · sandbox` — 1 (стр. 36)
- **хозяин** `dvPlace · demo` — 1 (стр. 53)

## `baseY`

- **хозяин** `stepBot · tick-step` — 7 (стр. 253, 254, 276, 286, 320, 383, 436)
- **хозяин** `ladderTick · levels` — 3 (стр. 208, 212, 216)
- **хозяин** `jumpCheckTick · tick-jump` — 2 (стр. 90, 109)
- **хозяин** `warmTick · warmup` — 2 (стр. 79, 82)
- **хозяин** `resetRound · round` — 1 (стр. 211)
- **хозяин** `movePlace · move` — 1 (стр. 23)
- **хозяин** `navSnap · tick` — 1 (стр. 67)
- **хозяин** `strafeKeysTick · tick-keys` — 1 (стр. 53)
- **хозяин** `warmSpawn · warmup` — 1 (стр. 12)
- **хозяин** `sbPlace · sandbox` — 1 (стр. 36)
- **хозяин** `dvPlace · demo` — 1 (стр. 53)
