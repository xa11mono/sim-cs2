# Общие переменные верхнего уровня: кто пишет и кто читает (генерируется; коммит 334860d)

Только переменные, которые **пишут** функции из двух и более файлов или из файла, отличного от файла объявления. Запись — присваивание
переменной или её полю (`X = …`, `X.f = …`). Читатели — число функций и файлы.

| переменная | объявлена | пишут (функция·файл) | читают: функций | читают: файлы |
|---|---|---|---|---|
| `ACCEL` | 070 | `(top)·top` | 3 | 380 540 660 |
| `BAL` | 080 | `(top)·top` | 21 | 100 150 170 190 280 300 310 320 330 340 350 380 400 470 490 500 530 540 675 top |
| `BUILTIN_OFF` | 390 | `refreshLineupList·560`, `(top)·top` | 4 | 390 560 top |
| `BUY_SHOW` | 520 | `buyShowStart·640` | 4 | 640 |
| `BZ` | 200 | `outwardLook·140`, `beliefBuild·200`, `bzOf·200`, `bzPortals·260`, `infoNext·320` | 67 | 100 110 120 140 150 160 170 190 200 220 240 250 260 270 275 280 290 320 330 340 350 380 390 410 450 470 480 540 610 |
| `CLEARZ` | 150 | `clearzReset·150`, `markClear·150`, `tClearCalls·150`, `lkpTick·190` | 12 | 140 150 170 190 320 390 620 |
| `CLIMB_AT` | 370 | `buildWaypointPath0·050`, `laddersBuild·370` | 3 | 050 270 370 |
| `COV_AUTO` | 030 | `(top)·top` | 1 | top |
| `COV_OWN` | 030 | `medCApply·590`, `(top)·top` | 5 | 030 590 top |
| `CT_SHIFT` | 140 | `(top)·top` | 2 | 140 top |
| `D3` | 625 | `d3AutoCam·625`, `d3Build·625`, `d3Corpse·625`, `d3FlyThru·625`, `d3FpBot·625`, `d3Frame·625`, `d3Hist·625`, `d3Init·625`, `d3NadeCam·625`, `d3Tag·625`, `d3Toggle·625`, `(top)·top` | 16 | 625 675 680 top |
| `ED_CACHE` | 100 | `buildSites·100`, `spotExposure·100`, `tSideZone·190` | 2 | 100 190 |
| `FREEZE_FX` | 520 | `freezeFxReset·530`, `rpWorldDraw·675` | 8 | 520 620 640 675 |
| `HGT_AUTO` | 030 | `(top)·top` | 5 | 030 580 top |
| `HGT_OWN` | 030 | `medHApply·580`, `(top)·top` | 6 | 030 040 580 top |
| `HL` | 495 | `(top)·top` | 8 | 400 495 625 top |
| `HOLD_CANDS` | 280 | `applyWalls·030`, `visInvalidate·040`, `holdCands·280` | 4 | 030 040 280 530 |
| `HUD_REDUCED` | 635 | `(top)·top` | 4 | 635 675 676 |
| `KF_DIRTY` | 435 | `feedBombKill·435`, `feedEvent·435`, `feedKill·435`, `resetRound·530`, `showSync·680` | 1 | 680 |
| `KF_ICON` | 630 | `(top)·top` | 9 | 620 625 630 635 640 top |
| `LAST_CLEAR` | 260 | `beliefReset·200`, `beliefTick·240`, `freshMatch·530` | 2 | 240 260 |
| `LOG_DIRTY` | 435 | `logEvent·435`, `showSync·680` | 1 | 680 |
| `LOOKDBG` | 270 | `(top)·top` | 8 | 270 275 610 top |
| `LOOK_REPLAN` | 270 | `lookTick·275`, `applyDamage·400` | 2 | 275 400 |
| `M3_SOLID` | 035 | `m3SolidGrid·035`, `rebuildNav·050` | 1 | 035 |
| `MAPED` | 570 | `mapEdAddTab·570`, `mapEdBegin·570`, `mapEdChanged·570`, `mapEdCommit·570`, `mapEdLoadFromDb·570`, `mapEdQueueSave·570`, `mapEdResetToCode·570`, `mapEdSetOn·570`, `mapEdSwitch·570`, `(top)·top` | 21 | 550 570 580 590 top |
| `MED_B` | 600 | `medBApply·600`, `medBAuto·600`, `medBDelete·600`, `(top)·top` | 5 | 600 top |
| `MED_C` | 590 | `medCApply·590`, `medCAuto·590`, `medCDelete·590`, `(top)·top` | 5 | 590 top |
| `MED_H` | 580 | `(top)·top` | 2 | 580 top |
| `MED_W` | 570 | `medWDelete·570`, `medWFinishPoly·570`, `medWSet·570`, `(top)·top` | 4 | 570 top |
| `MEM_BOX` | 130 | `resetMatchMemory·130`, `swapSides·530` | 2 | 130 530 |
| `NAV_CLIMB_UP` | 010 | `(top)·top` | 4 | 050 370 top |
| `NAV_GRID` | 020 | `navGridBuild·020`, `levelBlocked·040`, `rebuildNav·050` | 13 | 020 040 050 210 370 380 677 |
| `NAV_ZONE` | 210 | `rebuildNav·050`, `navZoneBuild·210` | 2 | 210 |
| `NICKS` | 080 | `seatPlayers·090`, `rpWorldDraw·675` | 8 | 080 090 675 top |
| `OBS` | 670 | `obsCtx·670`, `obsFrame·670`, `obsManual·670`, `obsOverlay·670`, `obsSet·670`, `rpEnd·675`, `rpJump·675`, `tsEnd·676`, `(top)·top` | 16 | 625 670 675 676 top |
| `OBS_ST` | 670 | `obsSet·670`, `rpRecord·675` | 2 | 670 675 |
| `OPP` | 130 | `oppNorm·130`, `saveOppProfile·130`, `freshMatch·530`, `(top)·top` | 4 | 130 top |
| `OUTWARD_CACHE` | 140 | `buildSites·100`, `outwardLook·140`, `beliefBuild·200` | 3 | 140 200 530 |
| `PL_ICON` | 640 | `(top)·top` | 2 | 640 top |
| `PORTAL_MIN_OVERLAP` | 020 | `rebuildNav·050` | 1 | 020 |
| `PORTAL_TOL` | 020 | `rebuildNav·050` | 1 | 020 |
| `PORTAL_W` | 260 | `beliefTick·240`, `lookPlan·270` | 4 | 240 260 270 |
| `POSCLR` | 150 | `posClearTick·150`, `freshMatch·530` | 3 | 150 |
| `PP` | 310 | `knowPlant·220`, `ppGrid·310`, `ppZoneCells·310` | 5 | 100 220 310 |
| `PRO_LINEUPS_RAW` | 300 | `(top)·top` | 2 | 320 top |
| `RC_HALF` | 680 | `endRound·530`, `showSync·680` | 1 | 680 |
| `ROAM_READY` | 060 | `(top)·top` | 1 | 060 |
| `RP` | 675 | `rpDraw·675`, `rpEnd·675`, `rpFrame·675`, `rpGoto·675`, `rpHold·675`, `rpJump·675`, `rpPlay·675`, `rpRecord·675`, `rpRoundEnd·675`, `rpStop·675`, `showSnd·675`, `(top)·top` | 16 | 675 676 680 top |
| `SANDBOX` | 677 | `sbPanel·677`, `sbRemove·677`, `sbRender·677`, `sbToggle·677`, `(top)·top` | 9 | 530 535 540 677 top |
| `SERIES` | 435 | `endRound·530`, `(top)·top` | 5 | 530 640 top |
| `SHOW_Q` | 435 | `showSync·680` | 2 | 435 680 |
| `SIDE_TEAM` | 090 | `newMatch·530`, `swapSides·530`, `rpWorldDraw·675` | 11 | 080 090 130 140 530 640 675 |
| `SND` | 680 | `sndFireTick·680`, `sndGain·680`, `sndInit·680`, `sndLoad·680`, `sndPickup·680`, `(top)·top` | 20 | 675 680 top |
| `SND_CAP` | 680 | `(top)·top` | 3 | 680 top |
| `SPD_K` | 080 | `(top)·top` | 17 | 210 250 270 290 300 450 480 490 610 top |
| `SPEED` | 070 | `(top)·top` | 59 | 050 110 120 150 160 170 180 200 210 220 280 290 340 350 365 366 370 380 390 410 450 470 480 490 535 540 545 660 top |
| `SPOT_TEAM` | 100 | `teamBrains·350` | 1 | 100 |
| `TEAMDBG` | 612 | `(top)·top` | 2 | 612 top |
| `TOUT` | 130 | `timeoutCheck·130`, `timeoutsReset·130`, `swapSides·530` | 5 | 130 140 530 |
| `TO_DEATHS` | 130 | `timeoutsReset·130`, `swapSides·530` | 2 | 130 |
| `TO_FORCE` | 130 | `timeoutCheck·130`, `(top)·top` | 1 | 130 |
| `TS` | 676 | `resolveEngagements·510`, `warmTick·660`, `rpJump·675`, `tsEls·676`, `tsEnd·676`, `tsFrame·676`, `tsReplayLast·676`, `tsStart·676` | 11 | 140 510 660 670 675 676 |
| `T_SPAWN` | 060 | `applyUserZones·060`, `applyZoneLayer·060`, `(top)·top` | 25 | 050 060 070 100 140 170 180 190 200 210 260 320 430 520 660 676 top |
| `USER_LINEUPS` | 390 | `(top)·top` | 9 | 390 560 top |
| `USER_ZONES` | 060 | `loadUserZones·060`, `(top)·top` | 9 | 060 070 100 550 620 top |
| `VOICE_DIRTY` | 435 | `voiceFeed·435`, `resetRound·530`, `showSync·680` | 1 | 680 |
| `VOICE_KEY_KIND` | 435 | `(top)·top` | 2 | 435 top |
| `VT` | 610 | `vtCompute·610`, `(top)·top` | 5 | 610 top |
| `WALL_POLYS` | 030 | `medWSet·570`, `(top)·top` | 10 | 030 040 570 top |
| `WARM` | 660 | `freshMatch·530`, `warmEnd·660`, `warmStart·660`, `warmTick·660`, `rpJump·675`, `dvStart·678` | 13 | 530 640 660 670 675 677 678 680 |
| `WB_AUTO` | 030 | `(top)·top` | 2 | 030 top |
| `WB_OWN` | 030 | `medBApply·600`, `(top)·top` | 5 | 030 600 top |
| `WEAPONS` | 070 | `(top)·top` | 39 | 030 070 180 340 400 410 450 460 520 530 590 620 630 640 660 675 678 top |
| `ZONE_CENTROIDS` | 060 | `applyZoneLayer·060`, `(top)·top` | 4 | 060 070 200 top |
| `ZONE_NAMES` | 190 | `saveZoneNameFromInput·560`, `(top)·top` | 11 | 130 190 270 560 676 top |
| `ZONE_SHAPES` | 010 | `saveZoneShape·560`, `(top)·top` | 3 | 010 560 top |
| `aggrObs` | 140 | `loadOppProfile·130`, `memRestore·130`, `memStart·130`, `aggrNote·140`, `rememberRound·140` | 4 | 130 140 |
| `awpSmokeCd` | 460 | `awpSmokeTick·460`, `freshMatch·530` | 1 | 460 |
| `beliefLast` | 200 | `lkpSet·190`, `beliefReset·200`, `beliefObserve·240`, `beliefTick·240` | 64 | 110 120 140 150 160 170 180 190 220 240 250 260 270 290 300 320 330 340 350 365 380 410 420 450 460 470 480 500 610 620 |
| `beliefSeen` | 200 | `beliefReset·200`, `beliefObserve·240`, `beliefTick·240` | 5 | 190 240 |
| `bomb` | 120 | `bombPathLen·120`, `bombTick·120`, `dropBomb·120`, `resetBomb·120`, `tBrain·170`, `ctBombPos·180`, `updateRetake·180`, `bombPassTick·460`, `checkRoundEnd·530`, `rpWorldDraw·675`, `sbTick·677`, `dvTick·678` | 127 | 110 120 140 150 160 170 180 190 220 240 250 270 280 290 300 310 320 330 340 350 365 366 370 380 390 410 420 435 450 460 470 480 490 500 510 520 530 535 540 550 612 620 625 630 640 670 675 677 678 |
| `btnZoneFinish` | 550 | `finishZoneDraw·550`, `setMode·550`, `(top)·top` | 3 | 550 top |
| `camDragOrig` | 550 | `(top)·top` | 1 | top |
| `camDragStart` | 550 | `(top)·top` | 1 | top |
| `camDragging` | 550 | `(top)·top` | 1 | top |
| `chkLineups` | 560 | `mapEdSetOn·570` | 3 | 560 570 top |
| `clutchInfo` | 435 | `checkClutch·435`, `freshMatch·530`, `resetRound·530` | 5 | 130 435 630 640 |
| `clutchShown` | 435 | `roundClutchResult·435`, `resetRound·530` | 0 |  |
| `covTip` | 580 | `(top)·top` | 1 | top |
| `ctHabit` | 130 | `loadOppProfile·130`, `memRestore·130`, `memStart·130`, `habitAdd·140` | 4 | 130 140 |
| `ctSetupMem` | 130 | `loadOppProfile·130`, `memRestore·130`, `memStart·130`, `rememberRound·140` | 3 | 130 140 |
| `ctx` | 550 | `strafeKeysTick·540`, `drawLineups·560`, `drawZoneShapeHandles·560`, `covDraw·580`, `covLegend·580`, `hgtDraw·580`, `hgtLegend·580`, `wbDraw·590`, `wbLegend·590`, `lookDbgDraw·610`, `visToolDraw·610`, `draw·620`, `d3Draw2D·625`, `obsOverlay·670`, `rpWorldDraw·675`, `dvDraw·678`, `(top)·top` | 19 | 540 560 580 590 610 620 670 675 678 top |
| `cv` | 550 | `visBuild·040`, `fit·550`, `setMode·550`, `rpWorldDraw·675` | 18 | 040 200 460 510 550 580 590 620 625 675 680 top |
| `econClosed` | 630 | `(top)·top` | 2 | 630 top |
| `events` | 140 | `logEvent·435`, `freshMatch·530` | 3 | 435 440 530 |
| `fires` | 360 | `nadeWorldSet·360`, `resetNades·420`, `freshMatch·530` | 22 | 050 270 350 366 370 380 400 410 420 530 540 620 625 670 675 680 |
| `groundItems` | 450 | `resetNades·420`, `freshMatch·530`, `rpWorldDraw·675` | 8 | 180 420 450 530 620 675 |
| `groundWeapons` | 450 | `resetNades·420`, `freshMatch·530`, `rpWorldDraw·675` | 9 | 340 420 450 520 530 620 675 |
| `hgtTip` | 580 | `(top)·top` | 1 | top |
| `hoverZoneId` | 550 | `(top)·top` | 2 | 620 top |
| `img` | 550 | `(top)·top` | 4 | 620 670 676 top |
| `imgFailed` | 550 | `(top)·top` | 1 | 620 |
| `imgReady` | 550 | `(top)·top` | 3 | 620 670 676 |
| `killfeed` | 140 | `feedBombKill·435`, `feedEvent·435`, `feedKill·435`, `freshMatch·530`, `resetRound·530`, `warmEnd·660`, `warmStart·660` | 8 | 435 530 630 675 |
| `lineupPanel` | 560 | `mapEdSetOn·570`, `(top)·top` | 2 | 570 top |
| `lookDbgEl` | 610 | `lookDbgPanel·610`, `(top)·top` | 2 | 610 top |
| `luDrag` | 560 | `lineupClick·560`, `(top)·top` | 1 | top |
| `luHover` | 560 | `lineupClick·560`, `(top)·top` | 1 | 560 |
| `luPending` | 560 | `lineupClick·560`, `selectLineup·560`, `(top)·top` | 4 | 560 top |
| `luSel` | 560 | `refreshLineupList·560`, `selectLineup·560`, `(top)·top` | 4 | 560 top |
| `matchNum` | 520 | `freshMatch·530`, `newMatch·530` | 72 | 050 100 110 120 130 140 150 160 170 180 210 220 230 240 270 280 310 320 340 365 366 390 495 520 530 540 545 640 670 675 680 top |
| `nadeFlags` | 410 | `tIglReplan·160`, `tSetSite·160`, `retakeUtil·180`, `updateRetake·180`, `proGroupDone·320`, `proRollGroup·320`, `lineupTick·390`, `tCrossSmoke·390`, `tSoloThrower·390`, `detonate·400`, `nadeFlagsReset·410`, `selfPlantSmoke·410`, `nadeBrains·420` | 17 | 160 170 180 320 390 400 410 420 530 535 |
| `nadeFx` | 360 | `nadeWorldSet·360`, `resetNades·420`, `freshMatch·530` | 8 | 400 420 530 620 625 675 |
| `nadesInAir` | 360 | `nadeWorldSet·360`, `resetNades·420`, `freshMatch·530` | 18 | 170 366 380 400 410 420 530 620 625 670 675 |
| `navAnchors` | 010 | `loadNavAnchors·010`, `(top)·top` | 5 | 010 550 620 top |
| `navDragOrig` | 550 | `(top)·top` | 1 | top |
| `navDragStart` | 550 | `(top)·top` | 1 | top |
| `navDragging` | 550 | `(top)·top` | 1 | top |
| `navRebuildTimer` | 550 | `scheduleNavRebuild·550`, `(top)·top` | 2 | 550 top |
| `navTransform` | 010 | `(top)·top` | 3 | 050 550 top |
| `navWarpPending` | 550 | `(top)·top` | 3 | 550 620 top |
| `nowTs` | 450 | `frameBody·680` | 15 | 290 435 450 490 540 610 612 620 625 675 678 |
| `plSelected` | 640 | `playersUpdate·640`, `obsFrame·670`, `obsSet·670`, `showSync·680`, `(top)·top` | 10 | 270 625 640 670 top |
| `pointsByName` | 060 | `(top)·top` | 1 | top |
| `portalCount` | 020 | `rebuildNav·050` | 0 |  |
| `portalMissing` | 020 | `rebuildNav·050` | 0 |  |
| `roundEndTime` | 520 | `endRound·530` | 5 | 540 620 640 675 |
| `roundNum` | 520 | `newMatch·530`, `resetRound·530`, `rpWorldDraw·675` | 152 | 100 110 120 130 140 150 160 170 180 190 210 220 230 240 250 270 275 280 300 310 320 330 340 350 360 365 366 380 390 400 410 420 435 450 460 470 480 495 500 520 530 535 540 545 612 620 625 630 640 675 676 680 top |
| `roundStartTick` | 140 | `freshMatch·530`, `resetRound·530`, `roundSetStart·530`, `sbToggle·677` | 30 | 130 140 150 160 170 190 200 210 220 240 300 310 320 340 350 365 390 420 470 612 |
| `roundStartTime` | 520 | `resetRound·530`, `roundSetStart·530`, `sbTick·677`, `sbToggle·677` | 30 | 120 150 170 250 280 300 330 340 366 390 435 470 490 500 520 530 540 612 620 640 675 676 |
| `roundState` | 520 | `endRound·530`, `resetRound·530`, `roundSetState·530`, `warmStart·660`, `rpWorldDraw·675` | 65 | 110 190 210 220 230 240 280 300 330 350 366 370 380 390 400 410 420 435 450 480 520 530 540 545 612 620 625 640 670 675 676 677 678 |
| `score` | 520 | `endRound·530`, `newMatch·530`, `swapSides·530` | 14 | 130 340 520 530 620 630 640 675 top |
| `selectedZoneId` | 550 | `setMode·550`, `(top)·top` | 3 | 550 620 top |
| `simTime` | 140 | `freshMatch·530`, `simTimeSet·530`, `rpWorldDraw·675` | 41 | 120 150 170 250 280 300 330 340 366 390 435 470 490 500 520 530 540 612 620 630 640 675 676 677 |
| `siteHeat` | 130 | `memRestore·130`, `memStart·130`, `endRound·530` | 3 | 130 340 530 |
| `siteHeatPending` | 130 | `tBrain·170`, `endRound·530` | 3 | 170 530 |
| `smokes` | 360 | `nadeWorldSet·360`, `resetNades·420`, `freshMatch·530` | 30 | 170 250 270 290 330 350 360 366 380 400 410 420 460 530 610 620 625 670 675 678 |
| `soundPings` | 450 | `freshMatch·530`, `rpWorldDraw·675` | 5 | 530 540 620 675 |
| `spotCache` | 100 | `buildSites·100`, `pickSpots·100`, `resetRound·530`, `rebuildAfterZoneShape·560` | 2 | 100 530 |
| `tacMem` | 130 | `loadOppProfile·130`, `memRestore·130`, `memStart·130`, `rememberRound·140` | 4 | 130 140 |
| `teamDbgEl` | 612 | `teamDbgPanel·612`, `(top)·top` | 2 | 612 top |
| `teamEco` | 520 | `teamNadePlan·365`, `decideRoundType0·520`, `buyPhase·530`, `freshMatch·530`, `startHalf·530` | 23 | 120 130 140 170 365 410 420 520 530 612 630 |
| `teamIntel` | 190 | `resetTeamIntel·190`, `teamInfoTick·190`, `teamHeardToIntel·230`, `detonate·400`, `tryShoot·490` | 40 | 150 160 170 190 220 230 270 290 300 320 330 340 350 380 400 410 430 460 470 480 490 500 620 |
| `teamTac` | 130 | `chooseTactic·130`, `chooseCtSetup·140`, `intelDeath·190`, `endgameBrain·330`, `rpWorldDraw·675` | 65 | 110 120 130 140 150 170 180 190 250 290 300 320 330 340 350 365 366 380 390 410 420 450 460 470 480 490 500 510 530 535 550 612 620 630 670 675 |
| `tracers` | 450 | `freshMatch·530`, `resetRound·530`, `rpWorldDraw·675` | 8 | 290 490 530 620 625 675 |
| `view` | 550 | `fit·550`, `obsFrame·670`, `rpWorldDraw·675`, `tsCam·676`, `tsEnd·676`, `(top)·top` | 33 | 550 560 570 580 590 610 620 625 670 675 676 677 678 top |
| `voiceLines` | 435 | `voiceFeed·435`, `resetRound·530`, `warmEnd·660` | 4 | 435 440 675 |
| `wallSegs` | 020 | `rebuildNav·050` | 1 | 060 |
| `wbTip` | 590 | `(top)·top` | 1 | top |
| `zlDragOrig` | 550 | `(top)·top` | 1 | top |
| `zlDragStart` | 550 | `(top)·top` | 1 | top |
| `zlDragging` | 550 | `(top)·top` | 1 | top |
| `zoneDrawCur` | 550 | `(top)·top` | 1 | 620 |
| `zoneDrawPts` | 550 | `finishZoneDraw·550`, `setMode·550`, `(top)·top` | 3 | 550 620 top |
| `zoneDrawing` | 550 | `finishZoneDraw·550`, `setMode·550`, `(top)·top` | 2 | 620 top |
| `zoneGraph` | 020 | `navCutTall·050`, `navGapsAdd·050`, `rebuildNav·050` | 25 | 020 050 100 110 170 180 280 370 500 620 |
| `zoneLayer` | 010 | `(top)·top` | 5 | 010 060 550 top |
| `zoneMoveOrig` | 550 | `(top)·top` | 1 | top |
| `zoneMoveStart` | 550 | `(top)·top` | 1 | top |
| `zoneMoving` | 550 | `(top)·top` | 1 | top |
| `zoneNameInput` | 550 | `(top)·top` | 2 | 550 top |
| `zoneNameInput2` | 560 | `openZoneName·560`, `(top)·top` | 3 | 560 top |
| `zoneNamePanel` | 560 | `openZoneName·560`, `(top)·top` | 2 | 560 top |
| `zoneNameSel` | 560 | `openZoneName·560`, `(top)·top` | 7 | 560 620 top |
| `zoneScaleBaseDist` | 550 | `(top)·top` | 1 | top |
| `zoneScaleCenter` | 550 | `(top)·top` | 1 | top |
| `zoneScaling` | 550 | `(top)·top` | 1 | top |
| `zoneVertexDragging` | 550 | `(top)·top` | 2 | 620 top |
| `zoneVertexIdx` | 550 | `(top)·top` | 2 | 620 top |
| `zonesById` | 020 | `rebuildNav·050` | 11 | 030 040 050 620 |
| `zsDrag` | 560 | `zoneShapeMouseDown·560`, `(top)·top` | 1 | top |
