# Кто пишет поля бота (генерируется: `tools/rebuild/gen_maps.js`, статический разбор кода)

Запись — присваивание `бот.поле = …` / `++` в функции (файл — номер); то же имя у другого объекта (бомба, редактор, смок выхода) — отдельно. Хозяин — по CLAUDE.md §7; у полей без хозяина его пока нет (назначит перенос каналов).
Живой ловец (кто пишет во время матча, со стеком) — `tools/measure/engine/field_watch.js`.

| поле | мест | функций | из них хозяин |
|---|---|---|---|
| `facing` | 11 | 7 | `lookFace · 275`, `lookTurnBy · 275`, `lookReset · 275`, `lookTick · 275`, `lookTrack · 275`, `handTurn · 275`, `freezeLookTick · 275` |
| `walking` | 4 | 4 | `moveWalk · 535`, `moveWalkTick · 535`, `moveSpeedTick · 535`, `stepTick · 540` |
| `curSpeed` | 13 | 5 | `jumpFaceWait · 370`, `ladderTick · 370`, `moveSpeed · 535`, `moveSpeedTick · 535`, `stepTick · 540` |
| `post` | 3 | 3 | `setPost · 110`, `clearPost · 110`, `placeResetPost · 110` |
| `_task` | 4 | 4 | `routeTick · 110`, `setPost · 110`, `clearPost · 110`, `placeResetTask · 110` |
| `_reposUntil` | 1 | 1 | `taskKeep · 110` |
| `_waitPopUntil` | 1 | 1 | `moveWaitPop · 535` |
| `state` | 2 | 2 | `fightState · 500`, `fightReset · 500` |
| `nadeTask` | 27 | 10 | `(верх файла) · 360`, `nadeAskFlash · 365`, `exuReassign · 366`, `assignNade · 380`, `nadeQueueNext · 380`, `runupTick · 380`, `updateNadeTask1 · 380`, `lineupTick · 390`, `nadeCancel · 420`, `resetNades · 420` |
| `holding` | 5 | 4 | `fightReset · 500`, `fightHoldOff · 500`, `leaveHold · 500`, `resolveEngagements · 510` |
| `crouching` | 1 | 1 | `placeStance · 110` |
| `path` | 13 | 8 | `fireGoneRepath · 370`, `fireRepath · 370`, `ladderTick · 370`, `navFollowFloor · 370`, `movePath · 535`, `moveSpeedTick · 535`, `navSnap · 540`, `stepTick · 540` |
| `phase` | 14 | 2 | — |

## `facing`

- **хозяин** `handTurn · 275` — 3 (стр. 113, 120, 123)
- **хозяин** `lookTick · 275` — 2 (стр. 43, 54)
- **хозяин** `freezeLookTick · 275` — 2 (стр. 155, 169)
- **хозяин** `lookFace · 275` — 1 (стр. 9)
- **хозяин** `lookTurnBy · 275` — 1 (стр. 10)
- **хозяин** `lookReset · 275` — 1 (стр. 11)
- **хозяин** `lookTrack · 275` — 1 (стр. 93)

## `walking`

- **хозяин** `moveWalk · 535` — 1 (стр. 24)
- **хозяин** `moveWalkTick · 535` — 1 (стр. 95)
- **хозяин** `moveSpeedTick · 535` — 1 (стр. 148)
- **хозяин** `stepTick · 540` — 1 (стр. 478)

## `curSpeed`

- **хозяин** `moveSpeedTick · 535` — 5 (стр. 168, 170, 171, 172, 173)
- **хозяин** `stepTick · 540` — 5 (стр. 313, 340, 461, 476, 478)
- **хозяин** `jumpFaceWait · 370` — 1 (стр. 97)
- **хозяин** `ladderTick · 370` — 1 (стр. 198)
- **хозяин** `moveSpeed · 535` — 1 (стр. 23)

## `post`

- **хозяин** `setPost · 110` — 1 (стр. 448)
- **хозяин** `clearPost · 110` — 1 (стр. 470)
- **хозяин** `placeResetPost · 110` — 1 (стр. 475)

## `_task`

- **хозяин** `routeTick · 110` — 1 (стр. 66)
- **хозяин** `setPost · 110` — 1 (стр. 403)
- **хозяин** `clearPost · 110` — 1 (стр. 470)
- **хозяин** `placeResetTask · 110` — 1 (стр. 476)

## `_reposUntil`

- **хозяин** `taskKeep · 110` — 1 (стр. 271)

## `_waitPopUntil`

- **хозяин** `moveWaitPop · 535` — 1 (стр. 21)

## `state`

- **хозяин** `fightState · 500` — 1 (стр. 4)
- **хозяин** `fightReset · 500` — 1 (стр. 8)

не бот (то же имя у другого объекта — в проверку владения не идёт): `dropBomb · 120` (96 bomb), `bombTick · 120` (228 bomb; 269 bomb; 286 bomb), `exuThrown · 366` (70 it), `exuLanded · 366` (82 it), `exuFail · 366` (86 it), `exuReassign · 366` (137 it), `exuTick · 366` (149 it; 151 it; 155 it), `bombPassTick · 460` (86 bomb), `checkRoundEnd · 530` (125 bomb), `mapEdQueueSave · 570` (66 S; 67 S), `mapEdSaveNow · 570` (74 S; 81 S; 82 S), `dvTick · 678` (46 bomb; 47 bomb)

## `nadeTask`

- **хозяин** `updateNadeTask1 · 380` — 11 (стр. 519, 524, 528, 531, 555, 573, 583, 588, …)
- **хозяин** `runupTick · 380` — 4 (стр. 484, 499, 511, 513)
- **хозяин** `exuReassign · 366` — 3 (стр. 128, 131, 132)
- **хозяин** `nadeQueueNext · 380` — 2 (стр. 402, 404)
- **хозяин** `lineupTick · 390` — 2 (стр. 188, 248)
- **хозяин** `(верх файла) · 360` — 1 (стр. 37)
- **хозяин** `nadeAskFlash · 365` — 1 (стр. 235)
- **хозяин** `assignNade · 380` — 1 (стр. 391)
- **хозяин** `nadeCancel · 420` — 1 (стр. 249)
- **хозяин** `resetNades · 420` — 1 (стр. 253)

## `holding`

- **хозяин** `resolveEngagements · 510` — 2 (стр. 109, 128)
- **хозяин** `fightReset · 500` — 1 (стр. 8)
- **хозяин** `fightHoldOff · 500` — 1 (стр. 9)
- **хозяин** `leaveHold · 500` — 1 (стр. 180)

не бот (то же имя у другого объекта — в проверку владения не идёт): `rpEnd · 675` (262 RP), `rpHold · 675` (269 RP)

## `crouching`

- **хозяин** `placeStance · 110` — 1 (стр. 474)

## `path`

- **хозяин** `stepTick · 540` — 5 (стр. 476, 550, 589, 611, 626)
- **хозяин** `moveSpeedTick · 535` — 2 (стр. 140, 147)
- **хозяин** `fireGoneRepath · 370` — 1 (стр. 11)
- **хозяин** `fireRepath · 370` — 1 (стр. 22)
- **хозяин** `ladderTick · 370` — 1 (стр. 199)
- **хозяин** `navFollowFloor · 370` — 1 (стр. 387)
- **хозяин** `movePath · 535` — 1 (стр. 22)
- **хозяин** `navSnap · 540` — 1 (стр. 60)

не бот (то же имя у другого объекта — в проверку владения не идёт): `hgtCache · 580` (16 HGT_C)

## `phase`

- `tBrain · 170` — 11 (стр. 64, 81, 86, 145, 160, 204, 205, 239, …)
- `tIglReplan · 160` — 3 (стр. 105, 128, 132)
