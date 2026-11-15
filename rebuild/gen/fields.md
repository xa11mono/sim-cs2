# Кто пишет поля бота (генерируется: `tools/rebuild/gen_maps.js`, статический разбор кода)

Запись — присваивание `бот.поле = …` / `++` в функции (файл — номер); то же имя у другого объекта (бомба, редактор, смок выхода) — отдельно. Хозяин — по CLAUDE.md §7; у полей без хозяина его пока нет (назначит перенос каналов).
Живой ловец (кто пишет во время матча, со стеком) — `tools/measure/engine/field_watch.js`.

| поле | мест | функций | из них хозяин |
|---|---|---|---|
| `facing` | 15 | 9 | — |
| `walking` | 6 | 6 | `moveWalkTick · 535`, `moveSpeedTick · 535` |
| `curSpeed` | 19 | 9 | `moveSpeedTick · 535` |
| `post` | 3 | 3 | `setPost · 110` |
| `state` | 3 | 3 | `fightState · 500` |
| `nadeTask` | 28 | 11 | — |
| `holding` | 7 | 6 | — |
| `crouching` | 7 | 6 | — |
| `path` | 37 | 21 | — |
| `phase` | 14 | 2 | — |

## `facing`

- `handTurn · 510` — 3 (стр. 288, 295, 298)
- `resolveEngagements · 510` — 2 (стр. 213, 224)
- `freezeLookTick · 540` — 2 (стр. 23, 37)
- `stepTick · 540` — 2 (стр. 462, 580)
- `warmTurn · 660` — 2 (стр. 17, 19)
- `throwNadeTry · 380` — 1 (стр. 305)
- `lookTrack · 510` — 1 (стр. 268)
- `resetRound · 530` — 1 (стр. 204)
- `dvPlace · 678` — 1 (стр. 53)

## `walking`

- `fightStrafe · 470` — 1 (стр. 141)
- `fightCycleTick · 470` — 1 (стр. 341)
- `resetRound · 530` — 1 (стр. 205)
- **хозяин** `moveWalkTick · 535` — 1 (стр. 85)
- **хозяин** `moveSpeedTick · 535` — 1 (стр. 138)
- `stepTick · 540` — 1 (стр. 491)

## `curSpeed`

- **хозяин** `moveSpeedTick · 535` — 5 (стр. 158, 160, 161, 162, 163)
- `stepTick · 540` — 5 (стр. 326, 353, 474, 489, 491)
- `fightStrafe · 470` — 2 (стр. 106, 141)
- `warmTick · 660` — 2 (стр. 54, 84)
- `jumpFaceWait · 370` — 1 (стр. 97)
- `ladderTick · 370` — 1 (стр. 198)
- `resetRound · 530` — 1 (стр. 204)
- `sbPlace · 677` — 1 (стр. 38)
- `dvPlace · 678` — 1 (стр. 53)

## `post`

- **хозяин** `setPost · 110` — 1 (стр. 445)
- `clearPost · 110` — 1 (стр. 467)
- `resetRound · 530` — 1 (стр. 222)

## `state`

- **хозяин** `fightState · 500` — 1 (стр. 4)
- `resetRound · 530` — 1 (стр. 203)
- `sbRevive · 677` — 1 (стр. 42)

не бот (то же имя у другого объекта — в проверку владения не идёт): `dropBomb · 120` (96 bomb), `bombTick · 120` (228 bomb; 269 bomb; 286 bomb), `exuThrown · 366` (70 it), `exuLanded · 366` (82 it), `exuFail · 366` (86 it), `exuReassign · 366` (137 it), `exuTick · 366` (149 it; 151 it; 155 it), `bombPassTick · 460` (86 bomb), `checkRoundEnd · 530` (125 bomb), `mapEdQueueSave · 570` (66 S; 67 S), `mapEdSaveNow · 570` (74 S; 81 S; 82 S), `dvTick · 678` (46 bomb; 47 bomb)

## `nadeTask`

- `updateNadeTask1 · 380` — 11 (стр. 519, 524, 528, 531, 555, 573, 583, 588, …)
- `runupTick · 380` — 4 (стр. 484, 499, 511, 513)
- `exuReassign · 366` — 3 (стр. 128, 131, 132)
- `nadeQueueNext · 380` — 2 (стр. 402, 404)
- `lineupTick · 390` — 2 (стр. 188, 248)
- `tSetSite · 160` — 1 (стр. 211)
- `(верх файла) · 360` — 1 (стр. 37)
- `nadeAskFlash · 365` — 1 (стр. 235)
- `assignNade · 380` — 1 (стр. 391)
- `applyDamage · 400` — 1 (стр. 160)
- `resetNades · 420` — 1 (стр. 250)

## `holding`

- `resolveEngagements · 510` — 2 (стр. 112, 131)
- `weaponPickupTick · 450` — 1 (стр. 286)
- `leaveHold · 500` — 1 (стр. 175)
- `resetRound · 530` — 1 (стр. 203)
- `moveSpeedTick · 535` — 1 (стр. 135)
- `sbRevive · 677` — 1 (стр. 42)

не бот (то же имя у другого объекта — в проверку владения не идёт): `rpEnd · 675` (262 RP), `rpHold · 675` (269 RP)

## `crouching`

- `moveSpeedTick · 535` — 2 (стр. 138, 156)
- `fightCycleTick · 470` — 1 (стр. 341)
- `leaveHold · 500` — 1 (стр. 175)
- `duckDecide · 510` — 1 (стр. 11)
- `resolveEngagements · 510` — 1 (стр. 91)
- `resetRound · 530` — 1 (стр. 204)

## `path`

- `stepTick · 540` — 5 (стр. 489, 563, 602, 624, 639)
- `assignNewDestination · 510` — 4 (стр. 345, 352, 361, 369)
- `updatePost · 110` — 3 (стр. 471, 495, 504)
- `bombTick · 120` — 3 (стр. 240, 321, 326)
- `updateRoamer · 430` — 3 (стр. 30, 59, 68)
- `resolveEngagements · 510` — 2 (стр. 163, 181)
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
- `escapeWallLine · 510` — 1 (стр. 333)
- `resetRound · 530` — 1 (стр. 201)
- `navSnap · 540` — 1 (стр. 84)
- `sbPlace · 677` — 1 (стр. 38)

не бот (то же имя у другого объекта — в проверку владения не идёт): `hgtCache · 580` (16 HGT_C)

## `phase`

- `tBrain · 170` — 11 (стр. 64, 81, 86, 145, 160, 204, 205, 239, …)
- `tIglReplan · 160` — 3 (стр. 105, 128, 132)
