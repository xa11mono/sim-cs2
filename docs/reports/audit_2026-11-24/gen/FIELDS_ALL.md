# Поля бота: все писатели и читатели (генерируется статическим разбором; коммит 334860d)

Источник — `tools_audit/an.js` (acorn по склейке `src/game/*`). Запись — присваивание / `++` полю объекта, который разбор признал ботом
(имя `b`, `bot`, `o`… и чтение у него полей бота; параметр обхода `bots.forEach`). Это **нижняя граница**: запись через другое имя
переменной (`pb._probeLock`, `fetcher._probeLock`) разбор может пропустить — для ключевых полей точный счёт `grep` — в SYSTEM_DEPENDENCIES.md §2.
Сброс раунда (530), разминка (660), песочница (677), демо (678), повтор (675) — тоже писатели, но не в живом тике: помечены `·сброс/режим`.

| поле | файлов-писателей | функций | писатели (функция·файл) | читателей (функций) | файлы-читатели |
|---|---|---|---|---|---|
| `pathIdx` | 10 (+2) | 20 | `rebuildNav·050`, `buildRoamRoutes·070`, `clearPostDo·110`, `setPostDo·110`, `updatePost·110`, `bombTick·120`, `fireGoneRepath·370`, `fireRepath·370`, `ladderTick·370`, `navFollowFloor·370`, `updateRoamer·430`, `onBlind·460`, `assignNewDestination·510`, `escapeWallLine·510`, `resolveEngagements·510`, `resetRound·530`·сброс/режим, `moveSpeedTick·535`, `navSnap·540`, `stepTick·540`, `sbPlace·677`·сброс/режим | 22 | 250 270 366 370 390 410 470 490 540 545 620 |
| `lastIntel` | 6 (+1) | 9 | `knowKill·220`, `contactTick·350`, `detonate·400`, `finishPush·460`, `smokeFadeTick·460`, `assistPeek·480`, `flankAssist·480`, `resolveEngagements·510`, `resetRound·530`·сброс/режим | 17 | 220 250 260 270 290 300 350 400 420 460 510 535 610 |
| `_probeLock` | 6 (+0) | 13 | `infoFallbackTick·300`, `tFallbackTick·300`, `contactTick·350`, `hurtReactTick·350`, `finishPush·460`, `reloadPeek·460`, `lowHpBack·470`, `assistPeek·480`, `flankAssist·480`, `afterKillReact·500`, `killMoveCover·500`, `postKillDecide·500`, `shiftHold·500` | 0 |  |
| `heardSound` | 5 (+1) | 6 | `intelDeath·190`, `knowKill·220`, `smokeFadeTick·460`, `assistPeek·480`, `resetRound·530`·сброс/режим, `moveSoundEmit·540` | 20 | 220 260 270 290 330 350 430 470 480 535 540 610 |
| `nades` | 5 (+1) | 6 | `buyNades·360`, `applyDamage·400`, `resetNades·420`, `buyForPlayer·520`, `startHalf·530`·сброс/режим, `(top)·top` | 38 | 100 180 250 290 320 330 340 350 360 365 366 380 390 410 420 450 460 520 530 630 640 |
| `_route` | 5 (+0) | 8 | `routeTick·110`, `setPostDo·110`, `startRoute·110`, `lurkerBrain·150`, `tIglReplan·160`, `tSetSite·160`, `tBrain·170`, `resetNades·420` | 4 | 110 160 |
| `nadeTask` | 5 (+0) | 9 | `exuReassign·366`, `assignNadeDo·380`, `nadeQueueNext·380`, `runupTick·380`, `updateNadeTask1·380`, `lineupTick·390`, `nadeCancel·420`, `resetNades·420`, `(top)·top` | 32 | 160 170 180 250 290 330 350 366 380 390 410 420 450 460 535 540 677 |
| `baseX` | 4 (+4) | 13 | `ladderTick·370`, `fightCycleTick·470`, `fightStrafe·470`, `escapeWallLine·510`, `resetRound·530`·сброс/режим, `jumpCheckTick·540`, `navSnap·540`, `stepTick·540`, `strafeKeysTick·540`, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим, `sbPlace·677`·сброс/режим, `dvPlace·678`·сброс/режим | 56 | 110 120 170 180 366 370 380 390 430 450 460 470 480 500 510 535 540 545 620 |
| `baseY` | 4 (+4) | 13 | `ladderTick·370`, `fightCycleTick·470`, `fightStrafe·470`, `escapeWallLine·510`, `resetRound·530`·сброс/режим, `jumpCheckTick·540`, `navSnap·540`, `stepTick·540`, `strafeKeysTick·540`, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим, `sbPlace·677`·сброс/режим, `dvPlace·678`·сброс/режим | 55 | 110 120 170 180 366 370 380 390 430 450 460 470 480 500 510 535 540 545 620 |
| `nextShotTick` | 4 (+3) | 7 | `blindBullet·290`, `pistolSwap·460`, `tryShoot·490`, `resolveEngagements·510`, `resetRound·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `sbRevive·677`·сброс/режим | 4 | 290 460 490 510 |
| `weapon` | 4 (+3) | 9 | `makeTeam·070`, `itemPickupTick·450`, `weaponPickupTick·450`, `pistolBack·460`, `pistolSwap·460`, `buyForPlayer·520`, `startHalf·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `dvStart·678`·сброс/режим | 29 | 110 140 190 280 290 340 450 460 470 480 490 500 510 530 620 625 640 660 677 |
| `_saveSpot` | 4 (+1) | 5 | `tBrain·170`, `tSaveHold·180`, `ctBrain·340`, `afterKillReact·500`, `resetRound·530`·сброс/режим | 7 | 110 170 180 340 490 500 |
| `ammo` | 4 (+1) | 6 | `blindBullet·290`, `pistolBack·460`, `pistolSwap·460`, `updateReload·480`, `tryShoot·490`, `warmSpawn·660`·сброс/режим | 12 | 290 450 460 470 480 490 677 |
| `_routeDone` | 4 (+0) | 5 | `routeTick·110`, `lurkerBrain·150`, `tIglReplan·160`, `tSetSite·160`, `tBrain·170` | 1 | 110 |
| `nadeQueue` | 4 (+0) | 5 | `exuReassign·366`, `updateNadeTask1·380`, `nadeCancel·420`, `resetNades·420`, `(top)·top` | 5 | 366 380 390 |
| `roamChecking` | 4 (+0) | 5 | `buildRoamRoutes·070`, `initRoam·070`, `updateRoamer·430`, `resolveEngagements·510`, `stepTick·540` | 7 | 270 430 510 535 540 620 |
| `x` | 3 (+4) | 9 | `ladderTick·370`, `escapeWallLine·510`, `resetRound·530`·сброс/режим, `navSnap·540`, `stepTick·540`, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим, `sbPlace·677`·сброс/режим, `dvPlace·678`·сброс/режим | 214 | 010 020 050 110 120 130 140 150 160 170 180 190 210 220 230 240 250 260 270 275 280 290 300 320 330 340 350 366 370 380 390 400 410 420 430 450 460 470 480 490 500 510 520 530 535 540 545 550 610 620 625 660 670 675 676 677 678 680 top |
| `y` | 3 (+4) | 9 | `ladderTick·370`, `escapeWallLine·510`, `resetRound·530`·сброс/режим, `navSnap·540`, `stepTick·540`, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим, `sbPlace·677`·сброс/режим, `dvPlace·678`·сброс/режим | 214 | 010 020 050 110 120 130 140 150 160 170 180 190 210 220 230 240 250 260 270 275 280 290 300 320 330 340 350 366 370 380 390 400 410 420 430 450 460 470 480 490 500 510 520 530 535 540 545 550 610 620 625 660 670 675 676 677 678 680 top |
| `_ammoFor` | 3 (+3) | 8 | `itemPickupTick·450`, `weaponPickupTick·450`, `pistolBack·460`, `pistolSwap·460`, `updateReload·480`, `resetRound·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `dvStart·678`·сброс/режим | 1 | 480 |
| `_reloading` | 3 (+3) | 7 | `pistolBack·460`, `pistolSwap·460`, `fightCycleTick·470`, `updateReload·480`, `resetRound·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `sbRevive·677`·сброс/режим | 14 | 290 350 450 460 470 480 490 500 620 |
| `primary` | 3 (+3) | 8 | `applyDamage·400`, `weaponPickupTick·450`, `buyItem·520`, `teamAwp·520`, `teamDrops·520`, `startHalf·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `dvStart·678`·сброс/режим | 25 | 130 170 180 280 340 410 450 460 520 530 630 640 660 |
| `blindUntil` | 3 (+2) | 5 | `detonate·400`, `resetNades·420`, `warmSpawn·660`·сброс/режим, `sbRevive·677`·сброс/режим, `(top)·top` | 20 | 150 220 270 290 400 410 435 450 460 490 510 540 545 610 620 625 |
| `defusing` | 3 (+2) | 6 | `bombTick·120`, `resetBomb·120`, `applyDamage·400`, `resetRound·530`·сброс/режим, `moveSpeedTick·535`, `warmSpawn·660`·сброс/режим | 48 | 110 120 250 270 290 300 330 340 350 370 380 390 410 420 450 460 470 480 490 500 510 535 540 545 550 620 670 675 |
| `planting` | 3 (+2) | 5 | `resetBomb·120`, `applyDamage·400`, `resetRound·530`·сброс/режим, `moveSpeedTick·535`, `warmSpawn·660`·сброс/режим | 52 | 110 120 150 170 180 250 270 290 300 330 350 366 370 380 390 410 420 450 460 470 480 490 500 510 535 540 545 550 620 670 675 |
| `secondary` | 3 (+2) | 5 | `applyDamage·400`, `itemPickupTick·450`, `buyItem·520`, `startHalf·530`·сброс/режим, `dvStart·678`·сброс/режим | 11 | 070 450 460 490 520 530 630 640 678 |
| `_knife` | 3 (+1) | 5 | `knifeDefuseTick·450`, `knifeTick·450`, `ambushTick·480`, `tryShoot·490`, `resetRound·530`·сброс/режим | 8 | 170 290 450 490 530 620 640 |
| `burstCount` | 3 (+1) | 4 | `pistolSwap·460`, `tryShoot·490`, `resolveEngagements·510`, `resetRound·530`·сброс/режим | 2 | 490 510 |
| `kit` | 3 (+1) | 5 | `applyDamage·400`, `itemPickupTick·450`, `buyForPlayer·520`, `buyFullKit·520`, `startHalf·530`·сброс/режим | 14 | 120 180 450 520 530 535 540 620 630 640 675 |
| `money` | 3 (+1) | 11 | `buyNades·360`, `applyDamage·400`, `buyArmor·520`, `buyForPlayer·520`, `buyFullKit·520`, `buyItem·520`, `payRoundEconomy·520`, `sellItem·520`, `teamAwp·520`, `resetRound·530`·сброс/режим, `startHalf·530`·сброс/режим | 17 | 360 365 400 450 520 612 630 640 |
| `_fillLock` | 3 (+0) | 3 | `taskKeepUntil·110`, `resetBomb·120`, `saveCancelTrades·180` | 1 | 110 |
| `curSpeed` | 3 (+0) | 5 | `jumpFaceWait·370`, `ladderTick·370`, `moveSpeed·535`, `moveSpeedTick·535`, `stepTick·540` | 26 | 190 210 250 270 280 290 410 450 470 490 535 540 545 550 610 620 677 |
| `path` | 3 (+0) | 7 | `fireRepath·370`, `ladderTick·370`, `navFollowFloor·370`, `movePath·535`, `moveSpeedTick·535`, `navSnap·540`, `stepTick·540` | 25 | 110 250 270 366 370 390 410 470 490 510 535 540 545 620 |
| `reloadUntil` | 3 (+0) | 4 | `pistolBack·460`, `pistolSwap·460`, `fightCycleTick·470`, `updateReload·480` | 4 | 460 470 480 620 |
| `tRole` | 3 (+0) | 3 | `seatPlayers·090`, `ctSeatRoles·140`, `(top)·top` | 49 | 090 120 130 140 150 160 170 190 250 300 320 330 340 350 360 365 380 390 420 450 460 470 480 500 510 520 535 620 630 676 677 |
| `_ts` | 2 (+3) | 6 | `detonate·400`, `resolveEngagements·510`, `resetRound·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим, `sbRevive·677`·сброс/режим | 3 | 490 510 660 |
| `alive` | 2 (+3) | 6 | `applyDamage·400`, `resetRound·530`·сброс/режим, `plCardUpdate·640`, `warmSpawn·660`·сброс/режим, `sbRemove·677`·сброс/режим, `sbRevive·677`·сброс/режим | 128 | 100 110 120 130 140 150 160 170 180 190 220 230 240 250 270 275 280 290 300 320 330 340 350 366 370 380 390 400 410 420 435 450 460 470 480 490 500 510 520 530 540 545 610 612 620 625 630 640 660 670 675 676 677 678 top |
| `armor` | 2 (+3) | 6 | `applyDamage·400`, `armorSoak·400`, `buyArmor·520`, `startHalf·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `dvStart·678`·сброс/режим | 10 | 340 400 470 490 520 530 630 640 |
| `contactStreak` | 2 (+3) | 6 | `detonate·400`, `resolveEngagements·510`, `resetRound·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим, `sbRevive·677`·сброс/режим | 4 | 510 660 670 |
| `helmet` | 2 (+3) | 6 | `applyDamage·400`, `armorSoak·400`, `buyArmor·520`, `startHalf·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `dvStart·678`·сброс/режим | 7 | 490 520 530 630 640 |
| `_area` | 2 (+2) | 6 | `ladderTick·370`, `navFollowFloor·370`, `resetRound·530`·сброс/режим, `navSnap·540`, `stepTick·540`, `sbPlace·677`·сброс/режим | 7 | 120 370 540 |
| `_blind` | 2 (+2) | 4 | `onBlind·460`, `resetRound·530`·сброс/режим, `moveSpeedTick·535`, `sbRevive·677`·сброс/режим | 3 | 290 460 535 |
| `armorHp` | 2 (+2) | 6 | `applyDamage·400`, `armorSoak·400`, `armorHpOf·520`, `buyArmor·520`, `startHalf·530`·сброс/режим, `warmSpawn·660`·сброс/режим | 4 | 400 520 630 |
| `lastShotTick` | 2 (+2) | 4 | `blindBullet·290`, `tryShoot·490`, `resetRound·530`·сброс/режим, `dvTick·678`·сброс/режим | 11 | 170 220 280 350 460 470 480 490 510 540 |
| `z` | 2 (+2) | 6 | `ladderTick·370`, `navFollowFloor·370`, `resetRound·530`·сброс/режим, `navSnap·540`, `stepTick·540`, `sbPlace·677`·сброс/режим | 134 | 050 110 120 130 150 160 170 180 190 220 250 260 270 290 300 320 330 340 350 366 370 380 390 400 410 420 450 460 470 480 490 500 510 535 540 545 620 625 660 670 677 678 top |
| `_contact` | 2 (+1) | 3 | `contactTick·350`, `killMoveCover·500`, `sbRevive·677`·сброс/режим | 12 | 110 160 170 270 320 350 480 500 677 |
| `_drawUntil` | 2 (+1) | 3 | `knifeTick·450`, `tryShoot·490`, `resetRound·530`·сброс/режим | 1 | 490 |
| `_jump` | 2 (+1) | 4 | `navFollowFloor·370`, `resetRound·530`·сброс/режим, `boostEnd·540`, `jumpCheckTick·540` | 1 | 620 |
| `_secAmmo` | 2 (+1) | 3 | `itemPickupTick·450`, `pistolBack·460`, `resetRound·530`·сброс/режим | 1 | 460 |
| `atPost` | 2 (+1) | 5 | `clearPostDo·110`, `setPostDo·110`, `updatePost·110`, `resetRound·530`·сброс/режим, `moveSpeedTick·535` | 40 | 110 140 150 170 250 270 290 320 330 340 350 380 390 410 420 450 470 480 490 500 510 535 545 620 677 |
| `decisionTick` | 2 (+1) | 3 | `leaveHold·500`, `resolveEngagements·510`, `resetRound·530`·сброс/режим | 1 | 510 |
| `forcedRetreat` | 2 (+1) | 3 | `resolveEngagements·510`, `resetRound·530`·сброс/режим, `stepTick·540` | 2 | 510 540 |
| `lookReason` | 2 (+1) | 5 | `lookArbiter·270`, `lookFilter·270`, `smoothLookFilter·270`, `lookTick·275`, `resetRound·530`·сброс/режим | 11 | 270 275 550 677 678 top |
| `_aimFix` | 2 (+0) | 3 | `lookTick·275`, `lookTrack·275`, `stepTick·540` | 2 | 275 540 |
| `_covLog` | 2 (+0) | 2 | `fightCycleTick·470`, `tryShoot·490` | 2 | 470 490 |
| `_covT` | 2 (+0) | 2 | `fightCycleTick·470`, `tryShoot·490` | 2 | 470 490 |
| `_detour` | 2 (+0) | 4 | `clearPostDo·110`, `detourStart·110`, `taskCanSet·110`, `hurtReactTick·350` | 3 | 110 |
| `_fireIn` | 2 (+0) | 2 | `nadesTick·400`, `resetNades·420` | 1 | 400 |
| `_flee` | 2 (+0) | 2 | `bombFleePoint·120`, `tBrain·170` | 2 | 120 170 |
| `_holdLog` | 2 (+0) | 2 | `secondOnSite·320`, `ctBrain·340` | 2 | 320 340 |
| `_landAt` | 2 (+0) | 2 | `navFollowFloor·370`, `landSound·540` | 1 | 540 |
| `_ldArb` | 2 (+0) | 2 | `lookArbiter·270`, `lookTick·275` | 1 | 610 |
| `_lookLvl` | 2 (+0) | 2 | `lookArbiter·270`, `lookTick·275` | 4 | 270 |
| `_mistakes` | 2 (+0) | 2 | `resetMatchMemory·130`, `noteMistake·140` | 2 | 140 630 |
| `_probe` | 2 (+0) | 2 | `tProbes·150`, `tSetSite·160` | 2 | 150 160 |
| `_roamSoundHandled` | 2 (+0) | 2 | `initRoam·070`, `updateRoamer·430` | 1 | 430 |
| `_roamSoundLockUntil` | 2 (+0) | 2 | `initRoam·070`, `updateRoamer·430` | 1 | 430 |
| `_stabT` | 2 (+0) | 2 | `knifeDefuseTick·450`, `ambushTick·480` | 2 | 450 480 |
| `_stageInfo` | 2 (+0) | 4 | `stagePost·160`, `tIglReplan·160`, `tSetSite·160`, `tBrain·170` | 1 | 170 |
| `_stopPlantUntil` | 2 (+0) | 2 | `tBrain·170`, `ctBrain·340` | 4 | 330 500 535 |
| `_stopWhy` | 2 (+0) | 2 | `moveSpeedTick·535`, `stepTick·540` | 4 | 545 550 677 top |
| `className` | 2 (+0) | 2 | `mapEdSwitch·570`, `(top)·top` | 0 |  |
| `holding` | 2 (+0) | 4 | `fightHoldOff·500`, `fightReset·500`, `leaveHold·500`, `resolveEngagements·510` | 10 | 250 370 490 500 510 535 540 545 620 |
| `pfacing` | 2 (+0) | 2 | `freezeLookTick·275`, `stepTick·540` | 1 | 620 |
| `retakeRole` | 2 (+0) | 2 | `resetBomb·120`, `updateRetake·180` | 2 | 180 630 |
| `roamCheckStart` | 2 (+0) | 2 | `initRoam·070`, `updateRoamer·430` | 1 | 540 |
| `roamCheckUntil` | 2 (+0) | 2 | `initRoam·070`, `updateRoamer·430` | 1 | 430 |
| `roamIdx` | 2 (+0) | 3 | `buildRoamRoutes·070`, `initRoam·070`, `updateRoamer·430` | 2 | 430 510 |
| `roamLookPt` | 2 (+0) | 2 | `initRoam·070`, `updateRoamer·430` | 2 | 270 540 |
| `roamPrevPt` | 2 (+0) | 2 | `initRoam·070`, `updateRoamer·430` | 1 | 510 |
| `roamTarget` | 2 (+0) | 3 | `buildRoamRoutes·070`, `initRoam·070`, `assignNewDestination·510` | 2 | 430 535 |
| `stateSince` | 2 (+0) | 2 | `weaponPickupTick·450`, `resolveEngagements·510` | 1 | 510 |
| `textContent` | 2 (+0) | 2 | `mapEdSwitch·570`, `(top)·top` | 0 |  |
| `throwUntil` | 2 (+0) | 2 | `throwNadeTry·380`, `resetNades·420` | 6 | 275 490 535 540 545 |
| `title` | 2 (+0) | 2 | `d3Toggle·625`, `(top)·top` | 2 | 625 top |
| `walking` | 2 (+0) | 4 | `moveSpeedTick·535`, `moveWalk·535`, `moveWalkTick·535`, `stepTick·540` | 10 | 270 350 370 510 540 620 top |
| `hp` | 1 (+4) | 6 | `applyDamage·400`, `resetRound·530`·сброс/режим, `warmSpawn·660`·сброс/режим, `sbRemove·677`·сброс/режим, `sbRevive·677`·сброс/режим, `dvPlace·678`·сброс/режим | 32 | 120 180 330 350 370 380 400 410 460 470 480 490 500 510 535 620 640 675 677 |
| `px` | 1 (+4) | 6 | `resetRound·530`·сброс/режим, `stepTick·540`, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим, `sbPlace·677`·сброс/режим, `dvPlace·678`·сброс/режим | 5 | 470 490 620 625 |
| `py` | 1 (+4) | 6 | `resetRound·530`·сброс/режим, `stepTick·540`, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим, `sbPlace·677`·сброс/режим, `dvPlace·678`·сброс/режим | 5 | 470 490 620 625 |
| `_climb` | 1 (+2) | 3 | `ladderTick·370`, `resetRound·530`·сброс/режим, `sbPlace·677`·сброс/режим | 9 | 270 370 540 545 620 625 |
| `_fall` | 1 (+2) | 3 | `navFollowFloor·370`, `resetRound·530`·сброс/режим, `sbPlace·677`·сброс/режим | 1 | 370 |
| `_fc` | 1 (+2) | 5 | `fcEnd·470`, `fightCycleTick·470`, `resetRound·530`·сброс/режим, `sbPlace·677`·сброс/режим, `sbRemove·677`·сброс/режим | 17 | 250 270 290 350 420 450 470 480 490 510 540 545 550 677 |
| `_hold` | 1 (+2) | 3 | `resetRound·530`·сброс/режим, `stepTick·540`, `sbPlace·677`·сброс/режим | 1 | 250 |
| `_overV` | 1 (+2) | 3 | `floorViewTick·370`, `resetRound·530`·сброс/режим, `sbPlace·677`·сброс/режим | 4 | 370 620 675 677 |
| `_trail` | 1 (+2) | 3 | `resetRound·530`·сброс/режим, `stepTick·540`, `sbPlace·677`·сброс/режим | 5 | 350 460 470 540 620 |
| `_underV` | 1 (+2) | 3 | `floorViewTick·370`, `resetRound·530`·сброс/режим, `sbPlace·677`·сброс/режим | 4 | 370 620 675 677 |
| `heading` | 1 (+2) | 3 | `resetRound·530`·сброс/режим, `stepTick·540`, `warmTick·660`·сброс/режим | 10 | 250 270 410 540 660 |
| `_blindBy` | 1 (+1) | 2 | `detonate·400`, `resetRound·530`·сброс/режим | 1 | 435 |
| `_boost` | 1 (+1) | 3 | `resetRound·530`·сброс/режим, `boostEnd·540`, `jumpCheckTick·540` | 6 | 470 535 540 |
| `_dmgBy` | 1 (+1) | 2 | `applyDamage·400`, `resetRound·530`·сброс/режим | 2 | 400 435 |
| `_fireExit` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `moveSpeedTick·535` | 1 | 535 |
| `_fireExitFire` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `moveSpeedTick·535` | 1 | 535 |
| `_huntArrive` | 1 (+1) | 2 | `tBrain·170`, `resetRound·530`·сброс/режим | 1 | 170 |
| `_huntIdx` | 1 (+1) | 2 | `tBrain·170`, `resetRound·530`·сброс/режим | 1 | 170 |
| `_jc` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `jumpCheckTick·540` | 5 | 490 535 540 |
| `_lurkArr` | 1 (+1) | 2 | `lurkerBrain·150`, `resetRound·530`·сброс/режим | 1 | 150 |
| `_lurkIdx` | 1 (+1) | 2 | `lurkerBrain·150`, `resetRound·530`·сброс/режим | 0 |  |
| `_lurkPh` | 1 (+1) | 2 | `lurkerBrain·150`, `resetRound·530`·сброс/режим | 1 | 150 |
| `_nadeNo` | 1 (+1) | 2 | `nadeNoteFail·380`, `resetRound·530`·сброс/режим | 2 | 380 |
| `_nadeT` | 1 (+1) | 2 | `throwNadeTry·380`, `resetRound·530`·сброс/режим | 1 | 380 |
| `_nearestEnemyBot` | 1 (+1) | 2 | `resolveEngagements·510`, `warmTick·660`·сброс/режим | 11 | 275 400 420 460 470 490 500 510 670 |
| `_onPistol` | 1 (+1) | 3 | `pistolBack·460`, `pistolSwap·460`, `resetRound·530`·сброс/режим | 3 | 460 480 |
| `_prevOffX` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `stepTick·540` | 1 | 540 |
| `_prevOffY` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `stepTick·540` | 1 | 540 |
| `_sawEnemy` | 1 (+1) | 3 | `resolveEngagements·510`, `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим | 69 | 120 140 150 160 170 180 250 270 275 290 300 320 330 340 350 366 380 410 420 450 460 470 480 510 535 540 545 620 660 670 |
| `_tagUntil` | 1 (+1) | 2 | `tryShoot·490`, `resetRound·530`·сброс/режим | 1 | 535 |
| `_unstickT` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `stepTick·540` | 1 | 540 |
| `_visFacing` | 1 (+1) | 2 | `draw·620`, `warmTurn·660`·сброс/режим | 5 | 620 625 675 |
| `deaths` | 1 (+1) | 2 | `applyDamage·400`, `newMatch·530`·сброс/режим | 4 | 340 630 640 |
| `holdSinceTick` | 1 (+1) | 2 | `resolveEngagements·510`, `resetRound·530`·сброс/режим | 2 | 500 510 |
| `kills` | 1 (+1) | 2 | `applyDamage·400`, `newMatch·530`·сброс/режим | 3 | 630 640 |
| `lastStepTick` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `stepTick·540` | 1 | 540 |
| `lookTarget` | 1 (+1) | 2 | `lookTick·275`, `resetRound·530`·сброс/режим | 7 | 290 540 550 625 677 678 |
| `onStairs` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `stepTick·540` | 3 | 490 500 620 |
| `pickTick` | 1 (+1) | 2 | `assignNewDestination·510`, `resetRound·530`·сброс/режим | 0 |  |
| `roundDmg` | 1 (+1) | 2 | `applyDamage·400`, `resetRound·530`·сброс/режим | 2 | 400 630 |
| `roundKills` | 1 (+1) | 2 | `applyDamage·400`, `resetRound·530`·сброс/режим | 3 | 435 630 675 |
| `stuckTicks` | 1 (+1) | 2 | `resetRound·530`·сброс/режим, `stepTick·540` | 1 | 540 |
| `_2nd` | 1 (+0) | 1 | `secondOnSite·320` | 1 | 320 |
| `_actS` | 1 (+0) | 1 | `decideAction·500` | 1 | 510 |
| `_adSpot` | 1 (+0) | 1 | `tBrain·170` | 1 | 170 |
| `_afPt` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_aft` | 1 (+0) | 1 | `afterTaskPick·110` | 1 | 110 |
| `_aftSaid` | 1 (+0) | 1 | `afterTaskPick·110` | 1 | 110 |
| `_agV` | 1 (+0) | 1 | `prePeekDecide·250` | 1 | 250 |
| `_aimTrk` | 1 (+0) | 2 | `lookTick·275`, `lookTrack·275` | 1 | 275 |
| `_amb` | 1 (+0) | 3 | `ambEnd·480`, `ambushStartBack·480`, `ambushTick·480` | 5 | 480 |
| `_apBest` | 1 (+0) | 1 | `updatePost·110` | 1 | 110 |
| `_apId` | 1 (+0) | 1 | `updatePost·110` | 1 | 110 |
| `_apT` | 1 (+0) | 1 | `updatePost·110` | 1 | 110 |
| `_apfC` | 1 (+0) | 1 | `appearFrom·250` | 1 | 250 |
| `_apfP` | 1 (+0) | 1 | `appearFrom·250` | 1 | 250 |
| `_assistNext` | 1 (+0) | 1 | `assistPeek·480` | 1 | 480 |
| `_assistVoice` | 1 (+0) | 1 | `assistPeek·480` | 1 | 480 |
| `_avoidPeekAt` | 1 (+0) | 1 | `knowAvoidPeek·220` | 1 | 220 |
| `_avoidPeekUntil` | 1 (+0) | 1 | `knowAvoidPeek·220` | 1 | 220 |
| `_awpLog` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_belOwn` | 1 (+0) | 1 | `beliefTick·240` | 2 | 240 260 |
| `_bomb` | 1 (+0) | 1 | `hudBombEdge·635` | 1 | 635 |
| `_boostTry` | 1 (+0) | 1 | `jumpCheckTick·540` | 1 | 540 |
| `_bought` | 1 (+0) | 1 | `buyItem·520` | 3 | 520 |
| `_burning` | 1 (+0) | 1 | `moveSpeedTick·535` | 1 | 540 |
| `_chk` | 1 (+0) | 1 | `lookPlan·270` | 1 | 270 |
| `_chkNext` | 1 (+0) | 1 | `lookPlan·270` | 1 | 270 |
| `_clr` | 1 (+0) | 1 | `tBrain·170` | 1 | 170 |
| `_clutch` | 1 (+0) | 1 | `ctClutch·320` | 2 | 320 612 |
| `_contactT` | 1 (+0) | 1 | `contactTick·350` | 2 | 270 350 |
| `_cornerPK` | 1 (+0) | 1 | `cornerLook0·250` | 1 | 250 |
| `_cornerPt` | 1 (+0) | 1 | `cornerLook0·250` | 1 | 250 |
| `_covShot` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_defuseHeard` | 1 (+0) | 1 | `resetBomb·120` | 5 | 120 160 290 450 500 |
| `_delayT` | 1 (+0) | 1 | `ctDelayNade·350` | 1 | 350 |
| `_djErr` | 1 (+0) | 1 | `bombTick·120` | 1 | 120 |
| `_djLog` | 1 (+0) | 1 | `bombTick·120` | 1 | 120 |
| `_djT` | 1 (+0) | 1 | `bombTick·120` | 1 | 120 |
| `_dlLook` | 1 (+0) | 1 | `(top)·top` | 1 | top |
| `_dlMove` | 1 (+0) | 1 | `(top)·top` | 1 | top |
| `_duckT` | 1 (+0) | 1 | `duckDecide·510` | 1 | 510 |
| `_dumpCd` | 1 (+0) | 1 | `nadeReact·410` | 1 | 410 |
| `_dumpVoice` | 1 (+0) | 1 | `nadeReact·410` | 1 | 410 |
| `_dwOnT` | 1 (+0) | 1 | `dangerWalk·470` | 1 | 470 |
| `_dwTick` | 1 (+0) | 1 | `dangerWalk·470` | 1 | 470 |
| `_dwVal` | 1 (+0) | 1 | `dangerWalk·470` | 1 | 470 |
| `_dwWhy` | 1 (+0) | 1 | `dangerWalk·470` | 0 |  |
| `_early` | 1 (+0) | 1 | `ctEarlyPeek·320` | 1 | 320 |
| `_earlyAt` | 1 (+0) | 1 | `ctSetupRole·140` | 1 | 140 |
| `_earlyDone` | 1 (+0) | 1 | `ctSetupRole·140` | 1 | 140 |
| `_earlyLog` | 1 (+0) | 1 | `ctSetupRole·140` | 1 | 140 |
| `_earlyLogged` | 1 (+0) | 1 | `ctSetupRole·140` | 1 | 140 |
| `_earlySaw` | 1 (+0) | 1 | `ctSetupRole·140` | 1 | 140 |
| `_egC` | 1 (+0) | 1 | `endgameBrain·330` | 1 | 330 |
| `_egEnd` | 1 (+0) | 1 | `endgameBrain·330` | 1 | 330 |
| `_egF` | 1 (+0) | 1 | `endgameBrain·330` | 1 | 330 |
| `_egFv` | 1 (+0) | 1 | `endgameBrain·330` | 1 | 330 |
| `_egL` | 1 (+0) | 1 | `endgameBrain·330` | 1 | 330 |
| `_egWait` | 1 (+0) | 1 | `egWaitPartner·330` | 1 | 330 |
| `_entryWait` | 1 (+0) | 1 | `moveSpeedTick·535` | 1 | 535 |
| `_esT` | 1 (+0) | 1 | `exposedShiftTick·250` | 1 | 250 |
| `_exposedUntil` | 1 (+0) | 1 | `tryShoot·490` | 0 |  |
| `_faceWhy` | 1 (+0) | 3 | `lookFace·275`, `lookReset·275`, `lookTurnBy·275` | 0 |  |
| `_fbRound` | 1 (+0) | 2 | `infoFallbackTick·300`, `tFallbackTick·300` | 2 | 300 |
| `_fcCv` | 1 (+0) | 1 | `fightCycleTick·470` | 1 | 470 |
| `_fcD` | 1 (+0) | 1 | `fightCycleTick·470` | 1 | 470 |
| `_fcFlank` | 1 (+0) | 1 | `flankAssist·480` | 1 | 480 |
| `_fcP` | 1 (+0) | 1 | `fightCycleTick·470` | 1 | 470 |
| `_fcS` | 1 (+0) | 1 | `fightCycleTick·470` | 1 | 470 |
| `_fcSnap` | 1 (+0) | 1 | `fightCycleTick·470` | 1 | 550 |
| `_fcV` | 1 (+0) | 1 | `fightCycleTick·470` | 1 | 470 |
| `_fcWhy` | 1 (+0) | 1 | `fcWhy·470` | 2 | 550 677 |
| `_fcWhyT` | 1 (+0) | 1 | `fcWhy·470` | 1 | 550 |
| `_ffFrac` | 1 (+0) | 1 | `applyDamage·400` | 1 | 400 |
| `_finId` | 1 (+0) | 1 | `finishPush·460` | 0 |  |
| `_finNext` | 1 (+0) | 1 | `finishPush·460` | 1 | 460 |
| `_fire` | 1 (+0) | 2 | `fireReady·490`, `tryShoot·490` | 1 | 470 |
| `_fireAcc` | 1 (+0) | 1 | `resetNades·420` | 0 |  |
| `_fireRp` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_fireWaitT` | 1 (+0) | 1 | `stepTick·540` | 1 | 450 |
| `_flankE` | 1 (+0) | 1 | `flankAssist·480` | 1 | 480 |
| `_flankT` | 1 (+0) | 1 | `flankAssist·480` | 1 | 480 |
| `_fleeLog` | 1 (+0) | 1 | `bombFleePoint·120` | 1 | 120 |
| `_fleePt` | 1 (+0) | 1 | `tBrain·170` | 1 | 170 |
| `_flx` | 1 (+0) | 1 | `navFollowFloor·370` | 1 | 370 |
| `_fly` | 1 (+0) | 1 | `navFollowFloor·370` | 1 | 370 |
| `_fpT` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_fpV` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_fsFail` | 1 (+0) | 1 | `endgameBrain·330` | 1 | 330 |
| `_fullKit` | 1 (+0) | 1 | `buyFullKit·520` | 1 | 360 |
| `_fz` | 1 (+0) | 1 | `freezeLookTick·275` | 1 | 275 |
| `_gl` | 1 (+0) | 1 | `smoothLookFilter·270` | 1 | 270 |
| `_glNext` | 1 (+0) | 1 | `smoothLookFilter·270` | 1 | 270 |
| `_hTask` | 1 (+0) | 1 | `holdGroup·280` | 2 | 280 |
| `_hand` | 1 (+0) | 2 | `handTurn·275`, `lookTick·275` | 2 | 275 |
| `_heDodgeLog` | 1 (+0) | 1 | `heDodgeTick·410` | 1 | 410 |
| `_headLvl` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_heat` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_heldAim` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_hes` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_hitFx` | 1 (+0) | 1 | `tryShoot·490` | 0 |  |
| `_hitIn` | 1 (+0) | 1 | `applyDamage·400` | 4 | 350 380 400 470 |
| `_hitOut` | 1 (+0) | 1 | `applyDamage·400` | 5 | 350 400 470 |
| `_holdWhy` | 1 (+0) | 1 | `fightHoldOff·500` | 0 |  |
| `_hot` | 1 (+0) | 1 | `hlContact·495` | 2 | 495 |
| `_hs` | 1 (+0) | 1 | `shiftHold·500` | 2 | 110 500 |
| `_huntStart` | 1 (+0) | 1 | `tBrain·170` | 1 | 170 |
| `_hurtDone` | 1 (+0) | 1 | `hurtReactTick·350` | 1 | 350 |
| `_hurtFrom` | 1 (+0) | 1 | `applyDamage·400` | 1 | 350 |
| `_hurtSndT` | 1 (+0) | 1 | `applyDamage·400` | 1 | 400 |
| `_hurtSrc` | 1 (+0) | 1 | `applyDamage·400` | 1 | 350 |
| `_hurtT` | 1 (+0) | 1 | `applyDamage·400` | 3 | 220 250 350 |
| `_idle` | 1 (+0) | 1 | `draw·620` | 1 | 620 |
| `_idlePhase` | 1 (+0) | 1 | `draw·620` | 0 |  |
| `_idleT` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_intelPre` | 1 (+0) | 1 | `resolveEngagements·510` | 1 | 490 |
| `_jfw` | 1 (+0) | 1 | `jumpFaceWait·370` | 1 | 370 |
| `_jnw` | 1 (+0) | 1 | `ladderTick·370` | 1 | 370 |
| `_jumpPrep` | 1 (+0) | 2 | `jumpFaceWait·370`, `ladderTick·370` | 1 | 270 |
| `_keepWhy` | 1 (+0) | 1 | `taskKeep·110` | 0 |  |
| `_keys` | 1 (+0) | 1 | `strafeKeysTick·540` | 3 | 470 490 540 |
| `_killHow` | 1 (+0) | 1 | `applyDamage·400` | 1 | 620 |
| `_killHowT` | 1 (+0) | 1 | `applyDamage·400` | 1 | 670 |
| `_killer` | 1 (+0) | 1 | `applyDamage·400` | 2 | 670 675 |
| `_knDef` | 1 (+0) | 1 | `knifeDefuseTick·450` | 1 | 170 |
| `_knU` | 1 (+0) | 1 | `knifeTick·450` | 1 | 450 |
| `_kwl` | 1 (+0) | 1 | `knownWayLook·270` | 1 | 270 |
| `_land` | 1 (+0) | 1 | `landLook·270` | 1 | 270 |
| `_lastNade` | 1 (+0) | 1 | `throwNadeTry·380` | 1 | 350 |
| `_lastSawT` | 1 (+0) | 1 | `resolveEngagements·510` | 7 | 180 220 270 290 380 450 510 |
| `_ld` | 1 (+0) | 1 | `lookTick·275` | 2 | 610 |
| `_ldPlan` | 1 (+0) | 1 | `lookPlan·270` | 2 | 610 |
| `_ldZones` | 1 (+0) | 1 | `lookCands0·270` | 2 | 610 |
| `_lkAltPt` | 1 (+0) | 2 | `lookAngleCand·270`, `lookAssigned·270` | 1 | 270 |
| `_lkC` | 1 (+0) | 1 | `lookPlan·270` | 3 | 270 |
| `_lkPick` | 1 (+0) | 1 | `lookPlan·270` | 7 | 110 270 |
| `_lkPt` | 1 (+0) | 1 | `lookPlan·270` | 3 | 110 270 |
| `_lkTop` | 1 (+0) | 1 | `lookPlan·270` | 1 | 550 |
| `_lkW` | 1 (+0) | 1 | `lookTick·275` | 1 | 275 |
| `_lkZ` | 1 (+0) | 1 | `lookPlan·270` | 1 | 270 |
| `_lowHpNext` | 1 (+0) | 1 | `lowHpBack·470` | 1 | 470 |
| `_lp` | 1 (+0) | 1 | `ctLandPunish·330` | 1 | 330 |
| `_lpDone` | 1 (+0) | 1 | `ctLandPunish·330` | 1 | 330 |
| `_lurkGo` | 1 (+0) | 1 | `lurkerBrain·150` | 1 | 150 |
| `_lurkPlan` | 1 (+0) | 1 | `lurkerBrain·150` | 1 | 150 |
| `_lurkSolo` | 1 (+0) | 1 | `lurkerBrain·150` | 1 | 150 |
| `_lvc` | 1 (+0) | 1 | `lookVisible·270` | 1 | 270 |
| `_mateReT` | 1 (+0) | 1 | `contactTick·350` | 1 | 350 |
| `_midBack` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_midCareV` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_midCover` | 1 (+0) | 1 | `midCoverPost·320` | 1 | 320 |
| `_midFlank` | 1 (+0) | 1 | `tBrain·170` | 2 | 150 170 |
| `_moV` | 1 (+0) | 1 | `decideAction·500` | 1 | 500 |
| `_moveWhy` | 1 (+0) | 4 | `movePath·535`, `moveSpeed·535`, `moveWaitPop·535`, `moveWalk·535` | 0 |  |
| `_mwV` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_nadeCd` | 1 (+0) | 2 | `nadeBrains·420`, `resetNades·420` | 1 | 420 |
| `_nadeUseT` | 1 (+0) | 1 | `nadeUseTick·420` | 1 | 420 |
| `_nadeWhy` | 1 (+0) | 1 | `nadeCancel·420` | 0 |  |
| `_nearBombT` | 1 (+0) | 1 | `retakeDefGo·180` | 1 | 180 |
| `_nearestEnemyDist` | 1 (+0) | 1 | `resolveEngagements·510` | 1 | 510 |
| `_netStuck` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_noPlantUntil` | 1 (+0) | 1 | `moveSpeedTick·535` | 0 |  |
| `_noStopLog` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_noisyT` | 1 (+0) | 1 | `stepTick·540` | 1 | 250 |
| `_notice` | 1 (+0) | 1 | `noticeShooter·210` | 2 | 210 |
| `_np` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_nplan` | 1 (+0) | 2 | `npBought·365`, `npRoundStart·365` | 6 | 365 |
| `_nv` | 1 (+0) | 1 | `nadeVelTrack·380` | 1 | 380 |
| `_nvP` | 1 (+0) | 1 | `nadeVelTrack·380` | 1 | 380 |
| `_odK` | 1 (+0) | 1 | `openDirNear·250` | 1 | 250 |
| `_odV` | 1 (+0) | 1 | `openDirNear·250` | 1 | 250 |
| `_odl` | 1 (+0) | 1 | `openDirLook·250` | 1 | 250 |
| `_offNav` | 1 (+0) | 2 | `navSnap·540`, `stepTick·540` | 0 |  |
| `_olK` | 1 (+0) | 1 | `openLook·250` | 1 | 250 |
| `_olV` | 1 (+0) | 1 | `openLook·250` | 1 | 250 |
| `_paused` | 1 (+0) | 1 | `hudPaused·635` | 1 | 635 |
| `_pdT` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_peekLag` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_pickBan` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_pickGo` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_pickIgnore` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_pickSave` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_pickSeen` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_pickSince` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_pickT` | 1 (+0) | 1 | `weaponPickupTick·450` | 1 | 450 |
| `_pie` | 1 (+0) | 1 | `prePeekTick·250` | 3 | 270 535 |
| `_place` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_plantAbort` | 1 (+0) | 1 | `moveSpeedTick·535` | 1 | 550 |
| `_posMem` | 1 (+0) | 1 | `posRoundEnd·280` | 1 | 280 |
| `_posT` | 1 (+0) | 1 | `posTick·280` | 2 | 280 |
| `_postSets` | 1 (+0) | 1 | `setPostDo·110` | 2 | 110 545 |
| `_ppAlt` | 1 (+0) | 1 | `ppTimeNamed·160` | 1 | 160 |
| `_ppDone` | 1 (+0) | 1 | `prePeekDecide·250` | 1 | 250 |
| `_ppFlashR` | 1 (+0) | 1 | `prePeekDecide·250` | 1 | 250 |
| `_ppMate` | 1 (+0) | 1 | `prePeekDecide·250` | 1 | 250 |
| `_ppSaid` | 1 (+0) | 1 | `tBrain·170` | 1 | 170 |
| `_ppTN` | 1 (+0) | 1 | `ppTimeNamed·160` | 1 | 160 |
| `_ppV` | 1 (+0) | 1 | `prePeekDecide·250` | 1 | 250 |
| `_ppWaitUntil` | 1 (+0) | 2 | `prePeekDecide·250`, `prePeekTick·250` | 2 | 250 535 |
| `_preAim` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_proM` | 1 (+0) | 1 | `proSpotLook·110` | 1 | 110 |
| `_proRole` | 1 (+0) | 1 | `proRolePost·310` | 1 | 310 |
| `_progBest` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_progIdx` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_progPath` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_progTick` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_psK` | 1 (+0) | 1 | `proSnap·110` | 1 | 110 |
| `_psM` | 1 (+0) | 1 | `proSnap·110` | 1 | 110 |
| `_psR` | 1 (+0) | 1 | `proSnap·110` | 1 | 110 |
| `_psV` | 1 (+0) | 1 | `proSnap·110` | 1 | 110 |
| `_reactMul` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_reangleNext` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_rearNext` | 1 (+0) | 1 | `smoothLookFilter·270` | 1 | 270 |
| `_repeeked` | 1 (+0) | 1 | `afterKillReact·500` | 1 | 500 |
| `_reposUntil` | 1 (+0) | 1 | `taskKeep·110` | 1 | 110 |
| `_retreatNade` | 1 (+0) | 1 | `nadeBrains·420` | 1 | 420 |
| `_rlCoverT` | 1 (+0) | 1 | `coverForReload·470` | 2 | 470 480 |
| `_rlPeekDone` | 1 (+0) | 1 | `reloadPeek·460` | 1 | 460 |
| `_rotMidLog` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_rtChk` | 1 (+0) | 1 | `resolveEngagements·510` | 1 | 510 |
| `_runWhy` | 1 (+0) | 1 | `moveWalkTick·535` | 2 | 677 top |
| `_safeRotK` | 1 (+0) | 1 | `safeRotate·470` | 1 | 470 |
| `_seatRole` | 1 (+0) | 1 | `ctSeatRoles·140` | 1 | 140 |
| `_seatSide` | 1 (+0) | 1 | `ctSeatRoles·140` | 1 | 140 |
| `_seenAt` | 1 (+0) | 1 | `resolveEngagements·510` | 2 | 500 510 |
| `_selfDone` | 1 (+0) | 1 | `selfExitFlash·410` | 1 | 410 |
| `_selfFlashCd` | 1 (+0) | 1 | `nadeReact·410` | 1 | 410 |
| `_shotAtBy` | 1 (+0) | 1 | `tryShoot·490` | 0 |  |
| `_shotAtT` | 1 (+0) | 1 | `tryShoot·490` | 6 | 170 250 290 540 670 |
| `_shoulderShot` | 1 (+0) | 1 | `tryShoot·490` | 1 | 470 |
| `_sl` | 1 (+0) | 2 | `slNew·270`, `smoothLookFilter·270` | 2 | 270 |
| `_slAtPrev` | 1 (+0) | 1 | `smoothLookFilter·270` | 1 | 270 |
| `_slw` | 1 (+0) | 1 | `smokeLineTick·366` | 1 | 366 |
| `_smkParts` | 1 (+0) | 1 | `resolveEngagements·510` | 1 | 490 |
| `_smokeLog` | 1 (+0) | 1 | `smokeEdgeTick·330` | 1 | 330 |
| `_smokePush` | 1 (+0) | 1 | `smokeEdgeTick·330` | 2 | 330 500 |
| `_smokeShot` | 1 (+0) | 1 | `smokeSpamTick·290` | 1 | 490 |
| `_smokeWait` | 1 (+0) | 1 | `smokeEdgeTick·330` | 1 | 330 |
| `_spam` | 1 (+0) | 1 | `smokeSpamTick·290` | 5 | 270 290 450 610 |
| `_spamDone` | 1 (+0) | 1 | `smokeSpamTick·290` | 1 | 290 |
| `_stanceWhy` | 1 (+0) | 1 | `placeStance·110` | 0 |  |
| `_stateWhy` | 1 (+0) | 1 | `fightStateDo·500` | 2 | 550 677 |
| `_stateWhyT` | 1 (+0) | 1 | `fightStateDo·500` | 1 | 550 |
| `_stepDist` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_stepP` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_stopPlantLog` | 1 (+0) | 1 | `ctBrain·340` | 1 | 340 |
| `_stuckResets` | 1 (+0) | 1 | `stepTick·540` | 1 | 540 |
| `_swSaid` | 1 (+0) | 1 | `contactTick·350` | 1 | 350 |
| `_takeAt` | 1 (+0) | 1 | `tBrain·170` | 1 | 170 |
| `_tap` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_task` | 1 (+0) | 4 | `clearPostDo·110`, `placeResetTask·110`, `routeTick·110`, `setPostDo·110` | 17 | 110 340 350 450 490 500 677 |
| `_tcV` | 1 (+0) | 1 | `decideAction·500` | 1 | 500 |
| `_tgt` | 1 (+0) | 1 | `resolveEngagements·510` | 1 | 510 |
| `_thrownT` | 1 (+0) | 1 | `throwNadeTry·380` | 1 | 220 |
| `_tnMiss` | 1 (+0) | 1 | `throwNadeDo·380` | 1 | 380 |
| `_tradeLock` | 1 (+0) | 1 | `tradeEnd·190` | 2 | 110 190 |
| `_tradeUntil` | 1 (+0) | 2 | `tradeAlertSet·190`, `tradeEnd·190` | 1 | 190 |
| `_utilW` | 1 (+0) | 1 | `tBrain·170` | 1 | 170 |
| `_utilWDone` | 1 (+0) | 1 | `tBrain·170` | 1 | 170 |
| `_visLag` | 1 (+0) | 1 | `tryShoot·490` | 1 | 490 |
| `_visible` | 1 (+0) | 1 | `resolveEngagements·510` | 21 | 190 210 220 230 240 470 480 500 510 520 620 625 677 |
| `_waitPopKey` | 1 (+0) | 1 | `moveWaitPop·535` | 1 | 535 |
| `_waitPopUntil` | 1 (+0) | 1 | `moveWaitPop·535` | 1 | 535 |
| `_walkWhy` | 1 (+0) | 1 | `moveWalkTick·535` | 2 | 677 top |
| `_zoomTick` | 1 (+0) | 1 | `updatePost·110` | 1 | 110 |
| `crouching` | 1 (+0) | 1 | `placeStance·110` | 11 | 380 450 470 480 490 510 620 625 675 |
| `defuseCooldownUntil` | 1 (+0) | 1 | `moveSpeedTick·535` | 1 | 120 |
| `defuseUntil` | 1 (+0) | 1 | `bombTick·120` | 6 | 120 370 620 630 675 |
| `disabled` | 1 (+0) | 1 | `(top)·top` | 0 |  |
| `ears` | 1 (+0) | 2 | `knowHearing·210`, `knowRoundStart·210` | 1 | 210 |
| `f` | 1 (+0) | 1 | `plCardUpdate·640` | 1 | 640 |
| `facing` | 1 (+0) | 7 | `freezeLookTick·275`, `handTurn·275`, `lookFace·275`, `lookReset·275`, `lookTick·275`, `lookTrack·275`, `lookTurnBy·275` | 20 | 270 275 290 370 400 430 490 540 620 625 660 670 675 |
| `fakeHoldUntil` | 1 (+0) | 2 | `bombTick·120`, `resetBomb·120` | 3 | 120 270 540 |
| `fakeUntil` | 1 (+0) | 2 | `bombTick·120`, `resetBomb·120` | 1 | 120 |
| `know` | 1 (+0) | 1 | `knowRoundStart·210` | 21 | 210 220 230 240 410 420 450 |
| `post` | 1 (+0) | 3 | `clearPostDo·110`, `placeResetPost·110`, `setPostDo·110` | 87 | 110 140 150 160 170 180 190 250 270 280 290 300 320 330 340 350 366 370 380 390 410 420 450 460 470 480 490 500 510 535 540 545 550 612 620 677 678 |
| `prof` | 1 (+0) | 1 | `seatPlayers·090` | 10 | 090 190 320 330 340 380 490 500 630 676 |
| `reactionTicks` | 1 (+0) | 1 | `seatPlayers·090` | 3 | 290 470 490 |
| `role` | 1 (+0) | 1 | `(top)·top` | 7 | 070 430 500 510 535 677 |
| `skill` | 1 (+0) | 1 | `seatPlayers·090` | 5 | 400 470 490 510 |
| `state` | 1 (+0) | 2 | `fightReset·500`, `fightStateDo·500` | 31 | 110 120 250 330 350 380 410 420 430 450 470 480 500 510 535 540 545 550 620 677 |
| `voice` | 1 (+0) | 1 | `teamTick·230` | 6 | 230 380 |
| `weight` | 1 (+0) | 1 | `knowBuild·210` | 1 | 220 |
| `windows` | 1 (+0) | 1 | `knowBuild·210` | 0 |  |
| `_dvName` | 0 (+1) | 2 | `dvStart·678`·сброс/режим, `dvStop·678`·сброс/режим | 1 | 678 |
| `_sbGo` | 0 (+1) | 1 | `sbTick·677`·сброс/режим | 3 | 540 677 |
| `_sbOff` | 0 (+1) | 2 | `sbPanel·677`·сброс/режим, `sbToggle·677`·сброс/режим | 6 | 490 540 677 |
| `_sbWalk` | 0 (+1) | 1 | `sbPanel·677`·сброс/режим | 3 | 535 677 |
| `_wIdx` | 0 (+1) | 1 | `warmTick·660`·сброс/режим | 1 | 660 |
| `_wPath` | 0 (+1) | 2 | `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим | 1 | 660 |
| `_wRespawn` | 0 (+1) | 2 | `warmSpawn·660`·сброс/режим, `warmTick·660`·сброс/режим | 1 | 660 |
| `_wv` | 0 (+1) | 1 | `warmTick·660`·сброс/режим | 1 | 660 |
| `assists` | 0 (+1) | 1 | `newMatch·530`·сброс/режим | 0 |  |

Поля, которые только читаются этим разбором (пишутся через другое имя объекта или при создании бота в `makeTeam`, 070):

`_coverDir`, `_defuseCont`, `_dlog`, `_heardReload`, `_killedBy`, `_ppChk`, `_ppPro`, `_ppSplit`, `_rebal`, `_shift`, `addEventListener`, `ava`, `born`, `carrier`, `classList`, `concat`, `count`, `d`, `danger`, `e3`, `est`, `gear`, `getAttribute`, `h`, `hb`, `hit`, `id`, `k`, `kind`, `length`, `levelOk`, `m`, `map`, `nick`, `num`, `obs`, `onLadder`, `own`, `plant`, `plantUntil`, `poly`, `pri`, `prior`, `push`, `ready`, `route`, `sc`, `score`, `sec`, `site`, `spawnOx`, `spawnOy`, `spawnPt`, `style`, `t`, `team`, `tr`, `undefended`, `w`, `walls`, `wp`, `x1`, `x2`, `y1`, `y2`
