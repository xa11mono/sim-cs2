# Кто пишет поля бота (генерируется: `tools/rebuild/gen_maps.js`, статический разбор кода)

Запись — присваивание `бот.поле = …` / `++` в функции (файл — номер); то же имя у другого объекта (бомба, редактор, смок выхода) — отдельно. Хозяин — по CLAUDE.md §7; у полей без хозяина его пока нет (назначит перенос каналов).
Живой ловец (кто пишет во время матча, со стеком) — `tools/measure/engine/field_watch.js`.

| поле | мест | функций | из них хозяин |
|---|---|---|---|
| `facing` | 11 | 7 | `lookFace · 275`, `lookTurnBy · 275`, `lookReset · 275`, `lookTick · 275`, `lookTrack · 275`, `handTurn · 275`, `freezeLookTick · 275` |
| `walking` | 6 | 6 | `moveWalkTick · 535`, `moveSpeedTick · 535` |
| `curSpeed` | 19 | 9 | `moveSpeedTick · 535` |
| `post` | 3 | 3 | `setPost · 110`, `clearPost · 110`, `placeResetPost · 110` |
| `_task` | 4 | 4 | `routeTick · 110`, `setPost · 110`, `clearPost · 110`, `placeResetTask · 110` |
| `state` | 3 | 3 | `fightState · 500` |
| `nadeTask` | 27 | 10 | `(верх файла) · 360`, `nadeAskFlash · 365`, `exuReassign · 366`, `assignNade · 380`, `nadeQueueNext · 380`, `runupTick · 380`, `updateNadeTask1 · 380`, `lineupTick · 390`, `nadeCancel · 420`, `resetNades · 420` |
| `holding` | 7 | 6 | — |
| `crouching` | 1 | 1 | `placeStance · 110` |
| `path` | 37 | 21 | — |
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

- `fightStrafe · 470` — 1 (стр. 141)
- `fightCycleTick · 470` — 1 (стр. 341)
- `resetRound · 530` — 1 (стр. 205)
- **хозяин** `moveWalkTick · 535` — 1 (стр. 85)
- **хозяин** `moveSpeedTick · 535` — 1 (стр. 138)
- `stepTick · 540` — 1 (стр. 478)

## `curSpeed`

- **хозяин** `moveSpeedTick · 535` — 5 (стр. 158, 160, 161, 162, 163)
- `stepTick · 540` — 5 (стр. 313, 340, 461, 476, 478)
- `fightStrafe · 470` — 2 (стр. 106, 141)
- `warmTick · 660` — 2 (стр. 54, 84)
- `jumpFaceWait · 370` — 1 (стр. 97)
- `ladderTick · 370` — 1 (стр. 198)
- `resetRound · 530` — 1 (стр. 204)
- `sbPlace · 677` — 1 (стр. 38)
- `dvPlace · 678` — 1 (стр. 53)

## `post`

- **хозяин** `setPost · 110` — 1 (стр. 445)
- **хозяин** `clearPost · 110` — 1 (стр. 467)
- **хозяин** `placeResetPost · 110` — 1 (стр. 472)

## `_task`

- **хозяин** `routeTick · 110` — 1 (стр. 66)
- **хозяин** `setPost · 110` — 1 (стр. 400)
- **хозяин** `clearPost · 110` — 1 (стр. 467)
- **хозяин** `placeResetTask · 110` — 1 (стр. 473)

## `state`

- **хозяин** `fightState · 500` — 1 (стр. 4)
- `resetRound · 530` — 1 (стр. 203)
- `sbRevive · 677` — 1 (стр. 42)

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

- `resolveEngagements · 510` — 2 (стр. 109, 128)
- `weaponPickupTick · 450` — 1 (стр. 286)
- `leaveHold · 500` — 1 (стр. 175)
- `resetRound · 530` — 1 (стр. 203)
- `moveSpeedTick · 535` — 1 (стр. 135)
- `sbRevive · 677` — 1 (стр. 42)

не бот (то же имя у другого объекта — в проверку владения не идёт): `rpEnd · 675` (262 RP), `rpHold · 675` (269 RP)

## `crouching`

- **хозяин** `placeStance · 110` — 1 (стр. 471)

## `path`

- `stepTick · 540` — 5 (стр. 476, 550, 589, 611, 626)
- `assignNewDestination · 510` — 4 (стр. 216, 223, 232, 240)
- `updatePost · 110` — 3 (стр. 477, 501, 510)
- `bombTick · 120` — 3 (стр. 240, 321, 326)
- `updateRoamer · 430` — 3 (стр. 30, 59, 68)
- `resolveEngagements · 510` — 2 (стр. 160, 178)
- `moveSpeedTick · 535` — 2 (стр. 130, 137)
- `rpWorldDraw · 675` — 2 (стр. 430, 438)
- `rebuildNav · 050` — 1 (стр. 228)
- `buildRoamRoutes · 070` — 1 (стр. 160)
- `setPost · 110` — 1 (стр. 448)
- `clearPost · 110` — 1 (стр. 467)
- `fireGoneRepath · 370` — 1 (стр. 11)
- `fireRepath · 370` — 1 (стр. 22)
- `ladderTick · 370` — 1 (стр. 199)
- `navFollowFloor · 370` — 1 (стр. 387)
- `onBlind · 460` — 1 (стр. 180)
- `escapeWallLine · 510` — 1 (стр. 204)
- `resetRound · 530` — 1 (стр. 201)
- `navSnap · 540` — 1 (стр. 60)
- `sbPlace · 677` — 1 (стр. 38)

не бот (то же имя у другого объекта — в проверку владения не идёт): `hgtCache · 580` (16 HGT_C)

## `phase`

- `tBrain · 170` — 11 (стр. 64, 81, 86, 145, 160, 204, 205, 239, …)
- `tIglReplan · 160` — 3 (стр. 105, 128, 132)
