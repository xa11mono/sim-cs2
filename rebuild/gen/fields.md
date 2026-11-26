# Кто пишет поля бота (генерируется: `tools/rebuild/gen_maps.js`, статический разбор кода)

Запись — присваивание `бот.поле = …` / `++` в функции (файл — номер); то же имя у другого объекта (бомба, редактор, смок выхода) — отдельно. Хозяин — по CLAUDE.md §7; у полей без хозяина его пока нет (назначит перенос каналов).
Живой ловец (кто пишет во время матча, со стеком) — `tools/measure/engine/field_watch.js`.

| поле | мест | функций | из них хозяин |
|---|---|---|---|
| `facing` | 11 | 7 | `lookFace · 275`, `lookTurnBy · 275`, `lookReset · 275`, `lookTick · 275`, `lookTrack · 275`, `handTurn · 275`, `freezeLookTick · 275` |
| `walking` | 4 | 4 | `moveWalk · 535`, `moveWalkTick · 535`, `moveSpeedTick · 535`, `stepTick · 540` |
| `curSpeed` | 13 | 5 | `jumpFaceWait · 370`, `ladderTick · 370`, `moveSpeed · 535`, `moveSpeedTick · 535`, `stepTick · 540` |
| `post` | 3 | 3 | `setPostDo · 110`, `clearPostDo · 110`, `placeResetPost · 110` |
| `_task` | 4 | 4 | `routeTick · 110`, `setPostDo · 110`, `clearPostDo · 110`, `placeResetTask · 110` |
| `_reposUntil` | 1 | 1 | `taskKeep · 110` |
| `_waitPopUntil` | 1 | 1 | `moveWaitPop · 535` |
| `_avoidPeekUntil` | 1 | 1 | `knowAvoidPeek · 220` |
| `_tradeUntil` | 2 | 2 | `tradeAlertSet · 190`, `tradeEnd · 190` |
| `_tradeLock` | 1 | 1 | `tradeEnd · 190` |
| `state` | 2 | 2 | `fightStateDo · 500`, `fightReset · 500` |
| `nadeTask` | 30 | 10 | `(верх файла) · 360`, `nadeAskFlash · 365`, `exuReassign · 366`, `assignNadeDo · 380`, `nadeQueueNext · 380`, `runupTick · 380`, `updateNadeTask1 · 380`, `lineupTick · 390`, `nadeCancel · 420`, `resetNades · 420` |
| `holding` | 5 | 4 | `fightReset · 500`, `fightHoldOff · 500`, `leaveHold · 500`, `engDecide · 510` |
| `crouching` | 1 | 1 | `placeStance · 110` |
| `path` | 13 | 7 | `fireRepath · 370`, `ladderTick · 370`, `navFollowFloor · 370`, `movePath · 535`, `moveSpeedTick · 535`, `navSnap · 540`, `stepTick · 540` |
| `phase` | 14 | 6 | — |

## `facing`

- **хозяин** `handTurn · 275` — 3 (стр. 118, 125, 128)
- **хозяин** `lookTick · 275` — 2 (стр. 43, 54)
- **хозяин** `freezeLookTick · 275` — 2 (стр. 160, 174)
- **хозяин** `lookFace · 275` — 1 (стр. 9)
- **хозяин** `lookTurnBy · 275` — 1 (стр. 10)
- **хозяин** `lookReset · 275` — 1 (стр. 11)
- **хозяин** `lookTrack · 275` — 1 (стр. 98)

## `walking`

- **хозяин** `moveWalk · 535` — 1 (стр. 24)
- **хозяин** `moveWalkTick · 535` — 1 (стр. 109)
- **хозяин** `moveSpeedTick · 535` — 1 (стр. 164)
- **хозяин** `stepTick · 540` — 1 (стр. 502)

## `curSpeed`

- **хозяин** `moveSpeedTick · 535` — 5 (стр. 184, 186, 187, 188, 189)
- **хозяин** `stepTick · 540` — 5 (стр. 335, 362, 485, 500, 502)
- **хозяин** `jumpFaceWait · 370` — 1 (стр. 110)
- **хозяин** `ladderTick · 370` — 1 (стр. 216)
- **хозяин** `moveSpeed · 535` — 1 (стр. 23)

## `post`

- **хозяин** `setPostDo · 110` — 1 (стр. 462)
- **хозяин** `clearPostDo · 110` — 1 (стр. 514)
- **хозяин** `placeResetPost · 110` — 1 (стр. 523)

## `_task`

- **хозяин** `routeTick · 110` — 1 (стр. 66)
- **хозяин** `setPostDo · 110` — 1 (стр. 417)
- **хозяин** `clearPostDo · 110` — 1 (стр. 514)
- **хозяин** `placeResetTask · 110` — 1 (стр. 524)

## `_reposUntil`

- **хозяин** `taskKeep · 110` — 1 (стр. 277)

## `_waitPopUntil`

- **хозяин** `moveWaitPop · 535` — 1 (стр. 21)

## `_avoidPeekUntil`

- **хозяин** `knowAvoidPeek · 220` — 1 (стр. 475)

## `_tradeUntil`

- **хозяин** `tradeAlertSet · 190` — 1 (стр. 399)
- **хозяин** `tradeEnd · 190` — 1 (стр. 402)

не бот (то же имя у другого объекта — в проверку владения не идёт): `tradeStart · 190` (398 o)

## `_tradeLock`

- **хозяин** `tradeEnd · 190` — 1 (стр. 402)

не бот (то же имя у другого объекта — в проверку владения не идёт): `tradeStart · 190` (398 o)

## `state`

- **хозяин** `fightStateDo · 500` — 1 (стр. 4)
- **хозяин** `fightReset · 500` — 1 (стр. 13)

не бот (то же имя у другого объекта — в проверку владения не идёт): `dropBomb · 120` (96 bomb), `bombTick · 120` (228 bomb; 269 bomb; 286 bomb), `exuThrown · 366` (70 it), `exuLanded · 366` (82 it), `exuFail · 366` (86 it), `exuReassign · 366` (137 it), `exuTick · 366` (149 it; 151 it; 155 it), `bombPassTick · 460` (86 bomb), `checkRoundEnd · 530` (136 bomb), `mapEdQueueSave · 570` (66 S; 67 S), `mapEdSaveNow · 570` (74 S; 81 S; 82 S), `dvTick · 678` (46 bomb; 47 bomb)

## `nadeTask`

- **хозяин** `updateNadeTask1 · 380` — 14 (стр. 558, 565, 569, 570, 571, 575, 578, 603, …)
- **хозяин** `runupTick · 380` — 4 (стр. 523, 538, 550, 552)
- **хозяин** `exuReassign · 366` — 3 (стр. 128, 131, 132)
- **хозяин** `nadeQueueNext · 380` — 2 (стр. 441, 443)
- **хозяин** `lineupTick · 390` — 2 (стр. 202, 264)
- **хозяин** `(верх файла) · 360` — 1 (стр. 37)
- **хозяин** `nadeAskFlash · 365` — 1 (стр. 235)
- **хозяин** `assignNadeDo · 380` — 1 (стр. 399)
- **хозяин** `nadeCancel · 420` — 1 (стр. 250)
- **хозяин** `resetNades · 420` — 1 (стр. 254)

## `holding`

- **хозяин** `engDecide · 510` — 2 (стр. 133, 152)
- **хозяин** `fightReset · 500` — 1 (стр. 13)
- **хозяин** `fightHoldOff · 500` — 1 (стр. 14)
- **хозяин** `leaveHold · 500` — 1 (стр. 185)

не бот (то же имя у другого объекта — в проверку владения не идёт): `rpEnd · 675` (266 RP), `rpHold · 675` (273 RP)

## `crouching`

- **хозяин** `placeStance · 110` — 1 (стр. 522)

## `path`

- **хозяин** `stepTick · 540` — 5 (стр. 500, 574, 613, 635, 650)
- **хозяин** `navFollowFloor · 370` — 2 (стр. 384, 423)
- **хозяин** `moveSpeedTick · 535` — 2 (стр. 156, 163)
- **хозяин** `fireRepath · 370` — 1 (стр. 29)
- **хозяин** `ladderTick · 370` — 1 (стр. 217)
- **хозяин** `movePath · 535` — 1 (стр. 22)
- **хозяин** `navSnap · 540` — 1 (стр. 66)

не бот (то же имя у другого объекта — в проверку владения не идёт): `hgtCache · 580` (16 HGT_C)

## `phase`

- `tBrainSiteSwitch · 170` — 4 (стр. 217, 232, 276, 277)
- `tIglReplan · 160` — 3 (стр. 105, 128, 132)
- `tBrainExecGo · 170` — 3 (стр. 136, 153, 158)
- `tBrainMidTake · 170` — 2 (стр. 314, 333)
- `tBrain · 170` — 1 (стр. 78)
- `tBrainSetup · 170` — 1 (стр. 609)
