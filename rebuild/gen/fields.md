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
| `heardSound` | 2 | 2 | `knowHear · knowledge`, `knowSound · knowledge` |
| `lastIntel` | 1 | 1 | `knowIntel · knowledge` |
| `planting` | 6 | 3 | `bombActReset · bomb`, `resetBomb · bomb`, `bombTick · bomb` |
| `defusing` | 5 | 3 | `bombActReset · bomb`, `resetBomb · bomb`, `bombTick · bomb` |
| `_route` | 6 | 4 | `startRoute · task`, `routeTick · task`, `routeDrop · task`, `setPostDo · task` |
| `_routeDone` | 3 | 2 | `routeTick · task`, `routeDrop · task` |
| `baseX` | 21 | 11 | `ladderTick · levels`, `resetRound · round`, `movePlace · move`, `navSnap · tick`, `jumpCheckTick · tick-jump`, `strafeKeysTick · tick-keys`, `stepBot · tick-step`, `warmSpawn · modes`, `warmTick · modes`, `sbPlace · modes`, `dvPlace · modes` |
| `baseY` | 21 | 11 | `ladderTick · levels`, `resetRound · round`, `movePlace · move`, `navSnap · tick`, `jumpCheckTick · tick-jump`, `strafeKeysTick · tick-keys`, `stepBot · tick-step`, `warmSpawn · modes`, `warmTick · modes`, `sbPlace · modes`, `dvPlace · modes` |
| `pathIdx` | 20 | 8 | `fireRepath · levels`, `ladderTick · levels`, `navFollowFloor · levels`, `movePath · move`, `movePathIdx · move`, `moveSpeedTick · move`, `navSnap · tick`, `stepBot · tick-step` |
| `_aimFix` | 1 | 1 | `lookSetAimFix · turn` |
| `_ammoFor` | 1 | 1 | `reloadSetAmmoFor · assist` |
| `_area` | 1 | 1 | `navSetArea · levels` |
| `_blind` | 1 | 1 | `soundSetBlind · sound` |
| `_blindBy` | 1 | 1 | `damageSetBlindBy · damage` |
| `_boost` | 1 | 1 | `jumpSetBoost · tick-jump` |
| `_climb` | 1 | 1 | `navSetClimb · levels` |
| `_contact` | 1 | 1 | `contactSetContact · contact` |
| `_covLog` | 1 | 1 | `fightSetCovLog · fight` |
| `_covT` | 1 | 1 | `fightSetCovT · fight` |
| `_detour` | 1 | 1 | `taskSetDetour · task` |
| `_dmgBy` | 1 | 1 | `damageSetDmgBy · damage` |
| `_drawUntil` | 1 | 1 | `equipmentSetDrawUntil · items` |
| `_egC` | 1 | 1 | `huntSetEgC · endgame` |
| `_fall` | 1 | 1 | `navSetFall · levels` |
| `_fc` | 1 | 1 | `fightSetFc · fight` |
| `_fillLock` | 1 | 1 | `taskSetFillLock · task` |
| `_fireExit` | 1 | 1 | `moveSetFireExit · move` |
| `_fireExitFire` | 1 | 1 | `moveSetFireExitFire · move` |
| `_fireIn` | 1 | 1 | `damageSetFireIn · damage` |
| `_flee` | 1 | 1 | `bombSetFlee · bomb` |
| `_heDone` | 2 | 2 | `nadeSetHeDone · self` |
| `_hold` | 1 | 1 | `moveSetHold · tick-step` |
| `_holdLog` | 1 | 1 | `holdSetHoldLog · ct-early` |
| `_huntArrive` | 1 | 1 | `huntSetHuntArrive · brain-t-postplant` |
| `_huntIdx` | 1 | 1 | `huntSetHuntIdx · brain-t-postplant` |
| `_jc` | 1 | 1 | `jumpSetJc · tick-jump` |
| `_jump` | 1 | 1 | `jumpSetJump · tick-jump` |
| `_knife` | 1 | 1 | `equipmentSetKnife · items` |
| `_landAt` | 1 | 1 | `navSetLandAt · levels` |
| `_lkC` | 1 | 1 | `lookSetLkC · look` |
| `_lkPt` | 1 | 1 | `lookSetLkPt · look` |
| `_lkTop` | 1 | 1 | `lookSetLkTop · look` |
| `_lkZ` | 1 | 1 | `lookSetLkZ · look` |
| `_lurkArr` | 1 | 1 | `lurkSetLurkArr · lurker` |
| `_lurkIdx` | 1 | 1 | `lurkSetLurkIdx · lurker` |
| `_lurkPh` | 1 | 1 | `lurkSetLurkPh · lurker` |
| `_mistakes` | 1 | 1 | `setupSetMistakes · ct-setup` |
| `_nadeNo` | 1 | 1 | `nadeSetNadeNo · throw` |
| `_nadeT` | 1 | 1 | `nadeSetNadeT · throw` |
| `_nearestEnemyBot` | 1 | 1 | `engagementSetNearestEnemyBot · engagements` |
| `_offNav` | 1 | 1 | `moveSetOffNav · tick-step` |
| `_onPistol` | 1 | 1 | `soundSetOnPistol · sound` |
| `_prevOffX` | 1 | 1 | `moveSetPrevOffX · tick-step` |
| `_prevOffY` | 1 | 1 | `moveSetPrevOffY · tick-step` |
| `_probe` | 1 | 1 | `lurkSetProbe · lurker` |
| `_probeLock` | 1 | 1 | `taskSetProbeLock · task` |
| `_reloading` | 1 | 1 | `reloadSetReloading · assist` |
| `_roamSoundHandled` | 1 | 1 | `roamSetRoamSoundHandled · fov` |
| `_roamSoundLockUntil` | 1 | 1 | `roamSetRoamSoundLockUntil · fov` |
| `_saveSpot` | 1 | 1 | `retakeSetSaveSpot · save-retake` |
| `_sawEnemy` | 1 | 1 | `engagementSetSawEnemy · engagements` |
| `_secAmmo` | 1 | 1 | `equipmentSetSecAmmo · items` |
| `_stabT` | 1 | 1 | `knifeSetStabT · assist` |
| `_stageInfo` | 1 | 1 | `stageSetStageInfo · igl` |
| `_stopPlantUntil` | 1 | 1 | `bombSetStopPlantUntil · bomb` |
| `_stopWhy` | 1 | 1 | `moveSetStopWhy · move` |
| `_tagUntil` | 1 | 1 | `shotSetTagUntil · shoot` |
| `_ts` | 1 | 1 | `engagementSetTs · engagements` |
| `_unstickT` | 1 | 1 | `moveSetUnstickT · tick-step` |
| `alive` | 4 | 4 | `damageSetAlive · damage` |
| `ammo` | 1 | 1 | `shotSetAmmo · shoot` |
| `armor` | 1 | 1 | `damageSetArmor · damage` |
| `armorHp` | 1 | 1 | `damageSetArmorHp · damage` |
| `atPost` | 1 | 1 | `taskSetAtPost · task` |
| `blindUntil` | 1 | 1 | `damageSetBlindUntil · damage` |
| `burstCount` | 1 | 1 | `shotSetBurstCount · shoot` |
| `contactStreak` | 1 | 1 | `engagementSetContactStreak · engagements` |
| `deaths` | 1 | 1 | `damageSetDeaths · damage` |
| `decisionTick` | 1 | 1 | `engagementSetDecisionTick · engagements` |
| `forcedRetreat` | 1 | 1 | `engagementSetForcedRetreat · engagements` |
| `heading` | 1 | 1 | `moveSetHeading · tick-step` |
| `helmet` | 2 | 2 | `damageSetHelmet · damage` |
| `holdSinceTick` | 1 | 1 | `engagementSetHoldSinceTick · engagements` |
| `hp` | 1 | 1 | `damageSetHp · damage` |
| `kills` | 1 | 1 | `damageSetKills · damage` |
| `kit` | 3 | 2 | `equipmentSetKit · items` |
| `lastShotTick` | 1 | 1 | `shotSetLastShotTick · shoot` |
| `lastStepTick` | 1 | 1 | `moveSetLastStepTick · tick-step` |
| `lookTarget` | 1 | 1 | `lookSetLookTarget · turn` |
| `money` | 1 | 1 | `economySetMoney · economy` |
| `nadeQueue` | 1 | 1 | `nadeSetNadeQueue · decide` |
| `nades` | 1 | 1 | `nadeSetNades · throw` |
| `nextShotTick` | 1 | 1 | `shotSetNextShotTick · shoot` |
| `onStairs` | 1 | 1 | `moveSetOnStairs · tick-step` |
| `pickTick` | 1 | 1 | `engagementSetPickTick · engagements` |
| `primary` | 1 | 1 | `equipmentSetPrimary · items` |
| `reloadUntil` | 1 | 1 | `reloadSetReloadUntil · assist` |
| `retakeRole` | 1 | 1 | `retakeSetRetakeRole · save-retake` |
| `roamCheckStart` | 1 | 1 | `roamSetRoamCheckStart · fov` |
| `roamCheckUntil` | 1 | 1 | `roamSetRoamCheckUntil · fov` |
| `roamChecking` | 1 | 1 | `roamSetRoamChecking · fov` |
| `roamIdx` | 1 | 1 | `roamSetRoamIdx · fov` |
| `roamLookPt` | 1 | 1 | `roamSetRoamLookPt · fov` |
| `roamPrevPt` | 1 | 1 | `roamSetRoamPrevPt · fov` |
| `roamTarget` | 1 | 1 | `roamSetRoamTarget · fov` |
| `roundDmg` | 1 | 1 | `damageSetRoundDmg · damage` |
| `roundKills` | 1 | 1 | `damageSetRoundKills · damage` |
| `secondary` | 1 | 1 | `equipmentSetSecondary · items` |
| `setupLook` | 1 | 1 | `taskSetSetupLook · task` |
| `stateSince` | 1 | 1 | `engagementSetStateSince · engagements` |
| `stuckTicks` | 1 | 1 | `moveSetStuckTicks · tick-step` |
| `throwUntil` | 1 | 1 | `nadeSetThrowUntil · throw` |
| `weapon` | 1 | 1 | `equipmentSetWeapon · items` |
| `x` | 1 | 1 | `moveSetX · move` |
| `y` | 1 | 1 | `moveSetY · move` |
| `z` | 1 | 1 | `navSetZ · levels` |

## `facing`

- **хозяин** `handTurn · turn` — 3 (стр. 118, 125, 128)
- **хозяин** `lookTick · turn` — 2 (стр. 43, 54)
- **хозяин** `freezeLookTick · turn` — 2 (стр. 160, 174)
- **хозяин** `lookFace · turn` — 1 (стр. 9)
- **хозяин** `lookTurnBy · turn` — 1 (стр. 10)
- **хозяин** `lookReset · turn` — 1 (стр. 11)
- **хозяин** `lookTrack · turn` — 1 (стр. 98)

## `walking`

- **хозяин** `moveWalk · move` — 1 (стр. 38)
- **хозяин** `moveWalkTick · move` — 1 (стр. 124)
- **хозяин** `moveSpeedTick · move` — 1 (стр. 188)
- **хозяин** `stepBot · tick-step` — 1 (стр. 257)

## `curSpeed`

- **хозяин** `moveSpeedTick · move` — 5 (стр. 208, 210, 211, 212, 213)
- **хозяин** `stepBot · tick-step` — 5 (стр. 90, 117, 240, 255, 257)
- **хозяин** `jumpFaceWait · levels` — 1 (стр. 111)
- **хозяин** `ladderTick · levels` — 1 (стр. 220)
- **хозяин** `moveSpeed · move` — 1 (стр. 37)

## `post`

- **хозяин** `setPostDo · task` — 1 (стр. 475)
- **хозяин** `clearPostDo · task` — 1 (стр. 528)
- **хозяин** `placeResetPost · task` — 1 (стр. 537)

## `_task`

- **хозяин** `routeTick · task` — 1 (стр. 66)
- **хозяин** `setPostDo · task` — 1 (стр. 430)
- **хозяин** `clearPostDo · task` — 1 (стр. 528)
- **хозяин** `placeResetTask · task` — 1 (стр. 538)

## `_reposUntil`

- **хозяин** `taskKeep · task` — 1 (стр. 282)

## `_waitPopUntil`

- **хозяин** `moveWaitPop · move` — 1 (стр. 24)

## `_avoidPeekUntil`

- **хозяин** `knowAvoidPeek · events` — 1 (стр. 501)

## `_tradeUntil`

- **хозяин** `tradeAlertSet · intel` — 1 (стр. 409)
- **хозяин** `tradeEnd · intel` — 1 (стр. 412)

не бот (то же имя у другого объекта — в проверку владения не идёт): `tradeStart · intel` (408 o)

## `_tradeLock`

- **хозяин** `tradeEnd · intel` — 1 (стр. 412)

не бот (то же имя у другого объекта — в проверку владения не идёт): `tradeStart · intel` (408 o)

## `state`

- **хозяин** `fightStateDo · fight-state` — 1 (стр. 4)
- **хозяин** `fightReset · fight-state` — 1 (стр. 13)

не бот (то же имя у другого объекта — в проверку владения не идёт): `dropBomb · bomb` (112 bomb), `bombTick · bomb` (261 bomb; 302 bomb; 319 bomb), `exuThrown · exec-sync` (70 it), `exuLanded · exec-sync` (82 it), `exuFail · exec-sync` (86 it), `exuReassign · exec-sync` (137 it), `exuTick · exec-sync` (149 it; 151 it; 155 it), `bombPassTick · sound` (85 bomb), `checkRoundEnd · round` (140 bomb), `dvTick · modes` (175 bomb; 176 bomb), `mapEdQueueSave · map-walls` (66 S; 67 S), `mapEdSaveNow · map-walls` (74 S; 81 S; 82 S)

## `nadeTask`

- **хозяин** `exuReassign · exec-sync` — 3 (стр. 128, 131, 132)
- **хозяин** `nadeQueueNext · throw` — 2 (стр. 456, 458)
- **хозяин** `lineupTick · lineups` — 2 (стр. 202, 266)
- **хозяин** `(верх файла) · smoke` — 1 (стр. 37)
- **хозяин** `nadeAskFlash · plan` — 1 (стр. 235)
- **хозяин** `assignNadeDo · throw` — 1 (стр. 414)
- **хозяин** `nadeTaskEnd · decide` — 1 (стр. 257)
- **хозяин** `resetNades · decide` — 1 (стр. 265)

## `holding`

- **хозяин** `engDecide · engagements` — 2 (стр. 136, 157)
- **хозяин** `fightReset · fight-state` — 1 (стр. 13)
- **хозяин** `fightHoldOff · fight-state` — 1 (стр. 14)
- **хозяин** `leaveHold · fight-state` — 1 (стр. 190)

не бот (то же имя у другого объекта — в проверку владения не идёт): `rpEnd · replay` (262 RP), `rpHold · replay` (269 RP)

## `crouching`

- **хозяин** `placeStance · task` — 1 (стр. 536)

## `path`

- **хозяин** `stepBot · tick-step` — 5 (стр. 255, 329, 368, 390, 405)
- **хозяин** `navFollowFloor · levels` — 2 (стр. 388, 427)
- **хозяин** `moveSpeedTick · move` — 2 (стр. 180, 187)
- **хозяин** `fireRepath · levels` — 1 (стр. 30)
- **хозяин** `ladderTick · levels` — 1 (стр. 221)
- **хозяин** `movePath · move` — 1 (стр. 26)
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

- **хозяин** `knowHear · knowledge` — 1 (стр. 104)
- **хозяин** `knowSound · knowledge` — 1 (стр. 106)

## `lastIntel`

- **хозяин** `knowIntel · knowledge` — 1 (стр. 108)

## `planting`

- **хозяин** `bombTick · bomb` — 4 (стр. 248, 255, 260, 273)
- **хозяин** `bombActReset · bomb` — 1 (стр. 19)
- **хозяин** `resetBomb · bomb` — 1 (стр. 100)

## `defusing`

- **хозяин** `bombTick · bomb` — 3 (стр. 317, 319, 358)
- **хозяин** `bombActReset · bomb` — 1 (стр. 19)
- **хозяин** `resetBomb · bomb` — 1 (стр. 100)

## `_route`

- **хозяин** `routeTick · task` — 2 (стр. 58, 65)
- **хозяин** `routeDrop · task` — 2 (стр. 280, 281)
- **хозяин** `startRoute · task` — 1 (стр. 52)
- **хозяин** `setPostDo · task` — 1 (стр. 394)

## `_routeDone`

- **хозяин** `routeDrop · task` — 2 (стр. 280, 281)
- **хозяин** `routeTick · task` — 1 (стр. 65)

## `baseX`

- **хозяин** `stepBot · tick-step` — 7 (стр. 259, 260, 278, 292, 326, 389, 442)
- **хозяин** `ladderTick · levels` — 3 (стр. 211, 215, 219)
- **хозяин** `jumpCheckTick · tick-jump` — 2 (стр. 90, 109)
- **хозяин** `warmTick · modes` — 2 (стр. 96, 99)
- **хозяин** `resetRound · round` — 1 (стр. 214)
- **хозяин** `movePlace · move` — 1 (стр. 23)
- **хозяин** `navSnap · tick` — 1 (стр. 67)
- **хозяин** `strafeKeysTick · tick-keys` — 1 (стр. 53)
- **хозяин** `warmSpawn · modes` — 1 (стр. 28)
- **хозяин** `sbPlace · modes` — 1 (стр. 128)
- **хозяин** `dvPlace · modes` — 1 (стр. 182)

## `baseY`

- **хозяин** `stepBot · tick-step` — 7 (стр. 259, 260, 282, 292, 326, 389, 442)
- **хозяин** `ladderTick · levels` — 3 (стр. 211, 215, 219)
- **хозяин** `jumpCheckTick · tick-jump` — 2 (стр. 90, 109)
- **хозяин** `warmTick · modes` — 2 (стр. 96, 99)
- **хозяин** `resetRound · round` — 1 (стр. 214)
- **хозяин** `movePlace · move` — 1 (стр. 23)
- **хозяин** `navSnap · tick` — 1 (стр. 67)
- **хозяин** `strafeKeysTick · tick-keys` — 1 (стр. 53)
- **хозяин** `warmSpawn · modes` — 1 (стр. 28)
- **хозяин** `sbPlace · modes` — 1 (стр. 128)
- **хозяин** `dvPlace · modes` — 1 (стр. 182)

## `pathIdx`

- **хозяин** `stepBot · tick-step` — 8 (стр. 180, 255, 260, 327, 329, 368, 390, 405)
- **хозяин** `ladderTick · levels` — 4 (стр. 221, 236, 244, 279)
- **хозяин** `navFollowFloor · levels` — 2 (стр. 388, 427)
- **хозяин** `moveSpeedTick · move` — 2 (стр. 180, 187)
- **хозяин** `fireRepath · levels` — 1 (стр. 30)
- **хозяин** `movePath · move` — 1 (стр. 26)
- **хозяин** `movePathIdx · move` — 1 (стр. 36)
- **хозяин** `navSnap · tick` — 1 (стр. 67)

## `_aimFix`

- **хозяин** `lookSetAimFix · turn` — 1 (стр. 180)

## `_ammoFor`

- **хозяин** `reloadSetAmmoFor · assist` — 1 (стр. 351)

## `_area`

- **хозяин** `navSetArea · levels` — 1 (стр. 586)

## `_blind`

- **хозяин** `soundSetBlind · sound` — 1 (стр. 228)

## `_blindBy`

- **хозяин** `damageSetBlindBy · damage` — 1 (стр. 253)

## `_boost`

- **хозяин** `jumpSetBoost · tick-jump` — 1 (стр. 152)

## `_climb`

- **хозяин** `navSetClimb · levels` — 1 (стр. 587)

## `_contact`

- **хозяин** `contactSetContact · contact` — 1 (стр. 398)

## `_covLog`

- **хозяин** `fightSetCovLog · fight` — 1 (стр. 668)

## `_covT`

- **хозяин** `fightSetCovT · fight` — 1 (стр. 669)

## `_detour`

- **хозяин** `taskSetDetour · task` — 1 (стр. 584)

## `_dmgBy`

- **хозяин** `damageSetDmgBy · damage` — 1 (стр. 254)

## `_drawUntil`

- **хозяин** `equipmentSetDrawUntil · items` — 1 (стр. 337)

## `_egC`

- **хозяин** `huntSetEgC · endgame` — 1 (стр. 323)

## `_fall`

- **хозяин** `navSetFall · levels` — 1 (стр. 588)

## `_fc`

- **хозяин** `fightSetFc · fight` — 1 (стр. 670)

## `_fillLock`

- **хозяин** `taskSetFillLock · task` — 1 (стр. 585)

## `_fireExit`

- **хозяин** `moveSetFireExit · move` — 1 (стр. 218)

## `_fireExitFire`

- **хозяин** `moveSetFireExitFire · move` — 1 (стр. 219)

## `_fireIn`

- **хозяин** `damageSetFireIn · damage` — 1 (стр. 255)

## `_flee`

- **хозяин** `bombSetFlee · bomb` — 1 (стр. 370)

## `_heDone`

- `smokeHeTick · smoke-react` — 1 (стр. 189)
- **хозяин** `nadeSetHeDone · self` — 1 (стр. 293)

## `_hold`

- **хозяин** `moveSetHold · tick-step` — 1 (стр. 459)

## `_holdLog`

- **хозяин** `holdSetHoldLog · ct-early` — 1 (стр. 450)

## `_huntArrive`

- **хозяин** `huntSetHuntArrive · brain-t-postplant` — 1 (стр. 236)

## `_huntIdx`

- **хозяин** `huntSetHuntIdx · brain-t-postplant` — 1 (стр. 237)

## `_jc`

- **хозяин** `jumpSetJc · tick-jump` — 1 (стр. 153)

## `_jump`

- **хозяин** `jumpSetJump · tick-jump` — 1 (стр. 154)

## `_knife`

- **хозяин** `equipmentSetKnife · items` — 1 (стр. 338)

## `_landAt`

- **хозяин** `navSetLandAt · levels` — 1 (стр. 589)

## `_lkC`

- **хозяин** `lookSetLkC · look` — 1 (стр. 462)

## `_lkPt`

- **хозяин** `lookSetLkPt · look` — 1 (стр. 463)

## `_lkTop`

- **хозяин** `lookSetLkTop · look` — 1 (стр. 464)

## `_lkZ`

- **хозяин** `lookSetLkZ · look` — 1 (стр. 465)

## `_lurkArr`

- **хозяин** `lurkSetLurkArr · lurker` — 1 (стр. 422)

## `_lurkIdx`

- **хозяин** `lurkSetLurkIdx · lurker` — 1 (стр. 423)

## `_lurkPh`

- **хозяин** `lurkSetLurkPh · lurker` — 1 (стр. 424)

## `_mistakes`

- **хозяин** `setupSetMistakes · ct-setup` — 1 (стр. 463)

## `_nadeNo`

- **хозяин** `nadeSetNadeNo · throw` — 1 (стр. 696)

## `_nadeT`

- **хозяин** `nadeSetNadeT · throw` — 1 (стр. 697)

## `_nearestEnemyBot`

- **хозяин** `engagementSetNearestEnemyBot · engagements` — 1 (стр. 274)

## `_offNav`

- **хозяин** `moveSetOffNav · tick-step` — 1 (стр. 460)

## `_onPistol`

- **хозяин** `soundSetOnPistol · sound` — 1 (стр. 230)

## `_prevOffX`

- **хозяин** `moveSetPrevOffX · tick-step` — 1 (стр. 461)

## `_prevOffY`

- **хозяин** `moveSetPrevOffY · tick-step` — 1 (стр. 462)

## `_probe`

- **хозяин** `lurkSetProbe · lurker` — 1 (стр. 425)

## `_probeLock`

- **хозяин** `taskSetProbeLock · task` — 1 (стр. 586)

## `_reloading`

- **хозяин** `reloadSetReloading · assist` — 1 (стр. 352)

## `_roamSoundHandled`

- **хозяин** `roamSetRoamSoundHandled · fov` — 1 (стр. 80)

## `_roamSoundLockUntil`

- **хозяин** `roamSetRoamSoundLockUntil · fov` — 1 (стр. 81)

## `_saveSpot`

- **хозяин** `retakeSetSaveSpot · save-retake` — 1 (стр. 502)

## `_sawEnemy`

- **хозяин** `engagementSetSawEnemy · engagements` — 1 (стр. 275)

## `_secAmmo`

- **хозяин** `equipmentSetSecAmmo · items` — 1 (стр. 339)

## `_stabT`

- **хозяин** `knifeSetStabT · assist` — 1 (стр. 354)

## `_stageInfo`

- **хозяин** `stageSetStageInfo · igl` — 1 (стр. 269)

## `_stopPlantUntil`

- **хозяин** `bombSetStopPlantUntil · bomb` — 1 (стр. 371)

## `_stopWhy`

- **хозяин** `moveSetStopWhy · move` — 1 (стр. 220)

## `_tagUntil`

- **хозяин** `shotSetTagUntil · shoot` — 1 (стр. 423)

## `_ts`

- **хозяин** `engagementSetTs · engagements` — 1 (стр. 276)

## `_unstickT`

- **хозяин** `moveSetUnstickT · tick-step` — 1 (стр. 463)

## `alive`

- `knowRoundStart · knowledge` — 1 (стр. 308)
- `knowKill · events` — 1 (стр. 250)
- **хозяин** `damageSetAlive · damage` — 1 (стр. 257)
- `plCardUpdate · scoreboard` — 1 (стр. 212)

## `ammo`

- **хозяин** `shotSetAmmo · shoot` — 1 (стр. 424)

## `armor`

- **хозяин** `damageSetArmor · damage` — 1 (стр. 258)

## `armorHp`

- **хозяин** `damageSetArmorHp · damage` — 1 (стр. 259)

## `atPost`

- **хозяин** `taskSetAtPost · task` — 1 (стр. 587)

## `blindUntil`

- **хозяин** `damageSetBlindUntil · damage` — 1 (стр. 260)

## `burstCount`

- **хозяин** `shotSetBurstCount · shoot` — 1 (стр. 425)

## `contactStreak`

- **хозяин** `engagementSetContactStreak · engagements` — 1 (стр. 278)

## `deaths`

- **хозяин** `damageSetDeaths · damage` — 1 (стр. 261)

## `decisionTick`

- **хозяин** `engagementSetDecisionTick · engagements` — 1 (стр. 279)

## `forcedRetreat`

- **хозяин** `engagementSetForcedRetreat · engagements` — 1 (стр. 280)

## `heading`

- **хозяин** `moveSetHeading · tick-step` — 1 (стр. 464)

## `helmet`

- **хозяин** `damageSetHelmet · damage` — 1 (стр. 262)
- `buyFullKit · economy` — 1 (стр. 283)

## `holdSinceTick`

- **хозяин** `engagementSetHoldSinceTick · engagements` — 1 (стр. 281)

## `hp`

- **хозяин** `damageSetHp · damage` — 1 (стр. 263)

## `kills`

- **хозяин** `damageSetKills · damage` — 1 (стр. 264)

не бот (то же имя у другого объекта — в проверку владения не идёт): `hlKill · highlights` (22 H), `rpRecord · replay` (133 OBS_ST)

## `kit`

- `buyFullKit · economy` — 2 (стр. 264, 284)
- **хозяин** `equipmentSetKit · items` — 1 (стр. 340)

## `lastShotTick`

- **хозяин** `shotSetLastShotTick · shoot` — 1 (стр. 426)

## `lastStepTick`

- **хозяин** `moveSetLastStepTick · tick-step` — 1 (стр. 465)

## `lookTarget`

- **хозяин** `lookSetLookTarget · turn` — 1 (стр. 181)

## `money`

- **хозяин** `economySetMoney · economy` — 1 (стр. 443)

## `nadeQueue`

- **хозяин** `nadeSetNadeQueue · decide` — 1 (стр. 270)

## `nades`

- **хозяин** `nadeSetNades · throw` — 1 (стр. 698)

## `nextShotTick`

- **хозяин** `shotSetNextShotTick · shoot` — 1 (стр. 427)

## `onStairs`

- **хозяин** `moveSetOnStairs · tick-step` — 1 (стр. 466)

## `pickTick`

- **хозяин** `engagementSetPickTick · engagements` — 1 (стр. 282)

## `primary`

- **хозяин** `equipmentSetPrimary · items` — 1 (стр. 341)

## `reloadUntil`

- **хозяин** `reloadSetReloadUntil · assist` — 1 (стр. 353)

## `retakeRole`

- **хозяин** `retakeSetRetakeRole · save-retake` — 1 (стр. 503)

## `roamCheckStart`

- **хозяин** `roamSetRoamCheckStart · fov` — 1 (стр. 83)

## `roamCheckUntil`

- **хозяин** `roamSetRoamCheckUntil · fov` — 1 (стр. 84)

## `roamChecking`

- **хозяин** `roamSetRoamChecking · fov` — 1 (стр. 82)

## `roamIdx`

- **хозяин** `roamSetRoamIdx · fov` — 1 (стр. 85)

## `roamLookPt`

- **хозяин** `roamSetRoamLookPt · fov` — 1 (стр. 86)

## `roamPrevPt`

- **хозяин** `roamSetRoamPrevPt · fov` — 1 (стр. 87)

## `roamTarget`

- **хозяин** `roamSetRoamTarget · fov` — 1 (стр. 88)

## `roundDmg`

- **хозяин** `damageSetRoundDmg · damage` — 1 (стр. 265)

## `roundKills`

- **хозяин** `damageSetRoundKills · damage` — 1 (стр. 266)

## `secondary`

- **хозяин** `equipmentSetSecondary · items` — 1 (стр. 342)

## `setupLook`

- **хозяин** `taskSetSetupLook · task` — 1 (стр. 588)

## `stateSince`

- **хозяин** `engagementSetStateSince · engagements` — 1 (стр. 283)

## `stuckTicks`

- **хозяин** `moveSetStuckTicks · tick-step` — 1 (стр. 467)

## `throwUntil`

- **хозяин** `nadeSetThrowUntil · throw` — 1 (стр. 701)

## `weapon`

- **хозяин** `equipmentSetWeapon · items` — 1 (стр. 343)

## `x`

- **хозяин** `moveSetX · move` — 1 (стр. 221)

не бот (то же имя у другого объекта — в проверку владения не идёт): `applyZoneLayerToData · zones` (37 p), `resnapSpawns · zone-danger` (255 sp), `dropBomb · bomb` (112 bomb), `bombTick · bomb` (236 bomb; 261 bomb), `saveOppProfile · tactics` (55 o), `habitAdd · ct-setup` (452 c), `tIglReplan · igl` (104 ctrR; 124 ctr), `knowSources · knowledge` (375 q), `knowApply · events` (71 h), `knowKill · events` (270 B.hyps[0]), `knowRetakeDrift · events` (411 h), `infoGo · ct-early` (360 I), `endgameBrain · endgame` (85 ST), `contactTick · contact` (131 K), `exuScan · exec-sync` (54 it), `nadeSolve · throw` (44 r), `updateNadeTask1 · throw` (598 t), `nadesTick · damage` (223 n), `bombPassTick · sound` (85 bomb), `dvTick · modes` (175 bomb), `probTick · problem-watch` (62 s; 70 s), `(верх файла) · lineup-editor` (188 z.points[zsDrag]), `d3Corpse · view3d` (173 C), `(верх файла) · view3d-frame` (296 d), `rpDraw · replay-play` (31 P.cam), `tsCam · timeout` (230 P.cam)

## `y`

- **хозяин** `moveSetY · move` — 1 (стр. 222)

не бот (то же имя у другого объекта — в проверку владения не идёт): `applyZoneLayerToData · zones` (37 p), `resnapSpawns · zone-danger` (255 sp), `dropBomb · bomb` (112 bomb), `bombTick · bomb` (236 bomb; 261 bomb), `saveOppProfile · tactics` (55 o), `habitAdd · ct-setup` (452 c), `tIglReplan · igl` (104 ctrR; 124 ctr), `knowSources · knowledge` (375 q), `knowApply · events` (71 h), `knowRetakeDrift · events` (411 h), `infoGo · ct-early` (360 I), `endgameBrain · endgame` (85 ST), `contactTick · contact` (131 K), `exuScan · exec-sync` (54 it), `nadeSolve · throw` (44 r), `updateNadeTask1 · throw` (598 t), `nadesTick · damage` (223 n), `bombPassTick · sound` (85 bomb), `dvTick · modes` (175 bomb), `probTick · problem-watch` (62 s; 70 s), `(верх файла) · lineup-editor` (188 z.points[zsDrag]), `(верх файла) · view3d-frame` (296 d), `rpDraw · replay-play` (31 P.cam), `tsCam · timeout` (230 P.cam)

## `z`

- **хозяин** `navSetZ · levels` — 1 (стр. 590)

не бот (то же имя у другого объекта — в проверку владения не идёт): `applyNavTransform · zones` (241 q), `bombTick · bomb` (261 bomb), `hurtReactTick · contact` (369 q), `teamNadePlan · plan` (90 w), `nadesTick · damage` (223 n)
