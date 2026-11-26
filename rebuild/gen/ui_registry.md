# Реестр управления: интерфейс → ядро (генерируется: `node tools/rebuild/frame_contract.js`, по коду)

Класс — по тому, что обработчик делает (через функции показа до ядра, транзитивно): **только показ**; **меняет игру** (вызывает функции ядра, которые пишут игровое состояние по реестру, или пишет его сам); **настройки / данные карты** (входы, данные карты, хранилище браузера). Прямая запись в игру — граница нарушена (`rebuild/ui_boundary_known.json`, проверка `frame_contract.js --check`). Проверка: автотест — настоящий клик / клавиша в `tools/page/ui_state_check.js` или `worker_check.js` со сравнением полного состояния.

| файл:строка | элемент | событие / клавиши | класс | команды ядра | прямо пишет в игру | проверка |
|---|---|---|---|---|---|---|
| app.js:222 | window | error | меняет игру | showFatal |  | нет автотеста |
| app.js:276 | = fu | error | меняет игру | showFatal |  | нет автотеста |
| app.js:340 | — | requestAnimationFrame | меняет игру | frame |  | нет автотеста |
| app.js:379 | #btnFreshMatch | click | меняет игру | freshMatch, logEvent, warmStart | SERIES | нет автотеста |
| app.js:386 | — | requestAnimationFrame | меняет игру | frame |  | нет автотеста |
| app.js:424 | #btnRestartRound | click | меняет игру | draw, logEvent, resetRound |  | нет автотеста |
| demo.js:85 | DV_PANEL_EL | click | меняет игру | dvStart, dvStop |  | нет автотеста |
| demo.js:105 | — | setInterval | меняет игру | dvRender |  | нет автотеста |
| demo.js:106 | #btnDemoView | click | меняет игру | dvToggle |  | нет автотеста |
| fx.js:31 | — | requestAnimationFrame | меняет игру | hudTwStep |  | нет автотеста |
| fx.js:40 | — | requestAnimationFrame | меняет игру | hudTwStep |  | нет автотеста |
| lineup-editor.js:58 | #warn | id === "luName" ? "input" : "c | меняет игру | draw, refreshLineupList |  | нет автотеста |
| lineup-editor.js:93 | btn | click | меняет игру | draw, refreshLineupList |  | нет автотеста |
| lineup-editor.js:96 | row | click | меняет игру | selectLineup |  | нет автотеста |
| lineup-editor.js:98 | btn | click | меняет игру | builtinCopy |  | нет автотеста |
| lineup-editor.js:99 | btn | click | меняет игру | draw, refreshLineupList |  | нет автотеста |
| lineup-editor.js:103 | #luShowBuiltin | change | меняет игру | draw |  | нет автотеста |
| lineup-editor.js:104 | #chkLineups | change | меняет игру | draw, refreshLineupList |  | нет автотеста |
| lineup-editor.js:105 | document | keydown Escape | меняет игру | draw, refreshLineupList |  | нет автотеста |
| lineup-editor.js:106 | cv | mousemove | меняет игру | draw |  | нет автотеста |
| lineup-editor.js:150 | — | setTimeout | меняет игру | applyZoneLayer, draw |  | нет автотеста |
| lineup-editor.js:152 | #chkZoneShape | change | меняет игру | draw |  | нет автотеста |
| lineup-editor.js:155 | #zoneShapeReset | click | меняет игру | applyZoneLayerToData, draw, rebuildAfterZoneShape |  | нет автотеста |
| lineup-editor.js:185 | cv | mousemove | меняет игру | draw | .x, .y | нет автотеста |
| lineup-editor.js:190 | window | mouseup | меняет игру | saveZoneShape |  | нет автотеста |
| lineup-editor.js:208 | #btnZoneNameSave | click | меняет игру | saveZoneNameFromInput |  | нет автотеста |
| lineup-editor.js:209 | #btnZoneNameReset | click | меняет игру | draw |  | нет автотеста |
| lineup-editor.js:210 | #btnZoneNameClose | click | меняет игру | draw |  | нет автотеста |
| lineup-editor.js:211 | #zoneNameInput2 | keydown Enter | меняет игру | saveZoneNameFromInput |  | нет автотеста |
| lineup-editor.js:212 | cv | mousedown | меняет игру | applyNavWarpChange, applyUserZones, lineupClick, openZoneName, saveUserZonesDebounced, zoneShapeMouseDown |  | нет автотеста |
| lineup-editor.js:338 | window | mousemove | меняет игру | applyNavTransform, applyUserZones, applyZoneLayer, saveUserZonesDebounced, scheduleNavRebuild |  | нет автотеста |
| lineup-editor.js:372 | window | mouseup | меняет игру | applyZoneLayer, rebuildNav |  | нет автотеста |
| lineup-editor.js:383 | cv | wheel | меняет игру | applyNavTransform, applyUserZones, applyZoneLayer, saveUserZonesDebounced, scheduleNavRebuild |  | нет автотеста |
| lineup-editor.js:415 | #warn | change | меняет игру | applyNavTransform, rebuildNav |  | нет автотеста |
| lineup-editor.js:423 | btnNavReset | click | меняет игру | applyNavTransform, rebuildNav |  | нет автотеста |
| look-debug.js:89 | cv | mousedown | меняет игру | draw |  | нет автотеста |
| look-debug.js:99 | window | keydown Escape | меняет игру | draw |  | нет автотеста |
| look-debug.js:100 | #chkVis | change | меняет игру | draw |  | нет автотеста |
| map-cover.js:59 | b | click | меняет игру | medCApply |  | нет автотеста |
| map-cover.js:60 | #medCH | change | меняет игру | medCApply |  | нет автотеста |
| map-cover.js:61 | #medCAuto | click | меняет игру | medCAuto |  | нет автотеста |
| map-cover.js:62 | #medCDel | click | меняет игру | medCDelete |  | нет автотеста |
| map-cover.js:209 | #chkWallbang | change | меняет игру | draw |  | нет автотеста |
| map-heights.js:151 | cv | mousemove | меняет игру | hgtTipText |  | нет автотеста |
| map-heights.js:210 | b | click | меняет игру | medHApply |  | нет автотеста |
| map-heights.js:211 | b | click | меняет игру | medHApply |  | нет автотеста |
| map-heights.js:212 | #medHLv | change | меняет игру | medHApply |  | нет автотеста |
| map-heights.js:213 | #medHAuto | click | меняет игру | medHAutoSel |  | нет автотеста |
| map-wallbang.js:77 | b | click | меняет игру | medBApply |  | нет автотеста |
| map-wallbang.js:78 | #medBMat | change | меняет игру | medBApply |  | нет автотеста |
| map-wallbang.js:79 | #medBT | change | меняет игру | medBApply |  | нет автотеста |
| map-wallbang.js:80 | #medBAuto | click | меняет игру | medBAuto |  | нет автотеста |
| map-wallbang.js:81 | #medBDel | click | меняет игру | medBDelete |  | нет автотеста |
| map-walls.js:69 | — | setTimeout | меняет игру | mapEdSaveNow |  | нет автотеста |
| map-walls.js:236 | #medWDel | click | меняет игру | medWDelete |  | нет автотеста |
| map-walls.js:344 | window | keydown KeyZ z я | меняет игру | mapEdUndo |  | нет автотеста |
| map-walls.js:354 | #mapEdUndo | click | меняет игру | mapEdUndo |  | нет автотеста |
| map-walls.js:355 | #mapEdReset | click | меняет игру | mapEdResetToCode |  | нет автотеста |
| nav-zones.js:116 | — | setTimeout | меняет игру | rebuildNav |  | нет автотеста |
| nav-zones.js:184 | #btnNavWarpUndo | click | меняет игру | applyNavWarpChange |  | нет автотеста |
| nav-zones.js:189 | #btnNavWarpClear | click | меняет игру | applyNavWarpChange |  | нет автотеста |
| nav-zones.js:235 | #btnZoneFinish | click | меняет игру | finishZoneDraw |  | нет автотеста |
| nav-zones.js:236 | #btnZoneDelete | click | меняет игру | applyUserZones, saveUserZonesDebounced |  | нет автотеста |
| nav-zones.js:270 | el | change | меняет игру | applyZoneLayer |  | нет автотеста |
| nav-zones.js:275 | #btnZlReset | click | меняет игру | applyZoneLayer |  | нет автотеста |
| observer.js:346 | #btnWarmSkip | click | меняет игру | warmEnd |  | нет автотеста |
| observer.js:350 | #chkWarm | change | меняет игру | warmEnd |  | нет автотеста |
| observer.js:351 | #selSeries | change | меняет игру |  | SERIES | нет автотеста |
| replay-play.js:346 | #btnRpLast | click | меняет игру | rpPlay |  | нет автотеста |
| replay-play.js:347 | — | setTimeout | меняет игру | rpGoto |  | нет автотеста |
| sandbox.js:58 | el | click | меняет игру | draw, sbRemove, sbRender | ._sbOff, ._sbWalk | нет автотеста |
| sandbox.js:126 | cv | mousedown | меняет игру | draw, logEvent, sbRender, sbRevive | ._sbGo | нет автотеста |
| sandbox.js:134 | window | mousemove | меняет игру | draw, sbPlace |  | нет автотеста |
| sandbox.js:142 | #btnSandbox | click | меняет игру | sbToggle |  | нет автотеста |
| sandbox.js:143 | — | setInterval | меняет игру | sbRender |  | нет автотеста |
| scoreboard.js:244 | cv | mouseup | меняет игру | playersUpdate |  | нет автотеста |
| src/marks.js:279 | #btnBack10 | click | меняет игру | mkBack10 |  | нет автотеста |
| src/marks.js:283 | #mkGo | click | меняет игру | mkSubmit |  | нет автотеста |
| src/marks.js:286 | mkEl(id) | keydown Enter | меняет игру | mkSubmit |  | нет автотеста |
| src/marks.js:288 | #mkItems | click | меняет игру | mkJump |  | нет автотеста |
| timeout.js:241 | #btnToTake | click | меняет игру |  | TO_FORCE | нет автотеста |
| timeout.js:243 | #btnRpGo | click | меняет игру | rpJump |  | нет автотеста |
| timeout.js:244 | #btnToGo | click | меняет игру | rpJump |  | нет автотеста |
| view3d-frame.js:289 | #btn3d | click | меняет игру | d3Toggle |  | нет автотеста |
| view3d-frame.js:295 | #cv3 | pointermove | меняет игру |  | .x, .y | нет автотеста |
| view3d-frame.js:302 | #cv3 | pointerup | меняет игру | playersUpdate |  | нет автотеста |
| app.js:193 | #sndVol | input | настройки / данные карты |  |  | нет автотеста |
| app.js:195 | #btnSnd | click | настройки / данные карты |  |  | нет автотеста |
| app.js:275 | e =  | message | настройки / данные карты |  |  | нет автотеста |
| app.js:287 | L | message | настройки / данные карты |  |  | нет автотеста |
| app.js:377 | #hlP | input | настройки / данные карты |  |  | нет автотеста |
| killfeed.js:107 | #econ | pointerdown | настройки / данные карты |  |  | нет автотеста |
| killfeed.js:109 | #econ | keydown Enter   | настройки / данные карты |  |  | нет автотеста |
| lineup-editor.js:112 | window | mouseup | настройки / данные карты |  |  | нет автотеста |
| observer.js:356 | #btnObsMap | click | настройки / данные карты |  |  | нет автотеста |
| replay-play.js:344 | #chkRp | change | настройки / данные карты |  |  | нет автотеста |
| replay-play.js:345 | #selRp | change | настройки / данные карты |  |  | нет автотеста |
| app.js:187 | document | pt | только показ |  |  | нет автотеста |
| app.js:202 | — | setTimeout | только показ |  |  | нет автотеста |
| app.js:380 | — | setInterval | только показ |  |  | нет автотеста |
| app.js:391 | d | toggle | только показ |  |  | нет автотеста |
| app.js:392 | document | mousedown | только показ |  |  | нет автотеста |
| app.js:393 | document | keydown Escape | только показ |  |  | нет автотеста |
| app.js:395 | #btnPause | click | только показ |  |  | нет автотеста |
| app.js:401 | #btnExportProject | click | только показ |  |  | нет автотеста |
| fx.js:16 | window | resize | только показ |  |  | нет автотеста |
| killfeed.js:77 | — | setTimeout | только показ |  |  | нет автотеста |
| lineup-editor.js:64 | #warn | keydown | только показ |  |  | нет автотеста |
| lineup-editor.js:91 | #luBuiltinDet | toggle | только показ |  |  | нет автотеста |
| lineup-editor.js:200 | — | setTimeout | только показ |  |  | нет автотеста |
| look-debug.js:106 | #chkLookDbg | change | только показ |  |  | нет автотеста |
| map-cover.js:58 | b | click | только показ |  |  | нет автотеста |
| map-cover.js:196 | cv | mousemove | только показ |  |  | нет автотеста |
| map-cover.js:208 | cv | mouseleave | только показ |  |  | нет автотеста |
| map-heights.js:162 | cv | mouseleave | только показ |  |  | нет автотеста |
| map-heights.js:163 | #chkHeights | change | только показ |  |  | нет автотеста |
| map-heights.js:209 | b | click | только показ |  |  | нет автотеста |
| map-heights.js:330 | cv | mousemove | только показ |  |  | нет автотеста |
| map-heights.js:342 | cv | mouseleave | только показ |  |  | нет автотеста |
| map-heights.js:343 | #chkCover | change | только показ |  |  | нет автотеста |
| map-wallbang.js:76 | b | click | только показ |  |  | нет автотеста |
| map-walls.js:135 | b | click | только показ |  |  | нет автотеста |
| map-walls.js:234 | b | click | только показ |  |  | нет автотеста |
| map-walls.js:338 | cv | mousedown | только показ |  |  | нет автотеста |
| map-walls.js:342 | window | mousemove | только показ |  |  | нет автотеста |
| map-walls.js:343 | window | mouseup | только показ |  |  | нет автотеста |
| map-walls.js:351 | #chkMapEdit | change | только показ |  |  | нет автотеста |
| nav-zones.js:5 | img | load | только показ |  |  | нет автотеста |
| nav-zones.js:6 | img | error | только показ |  |  | нет автотеста |
| nav-zones.js:18 | window | resize | только показ |  |  | нет автотеста |
| nav-zones.js:80 | #cv | mousemove | только показ |  |  | нет автотеста |
| nav-zones.js:220 | #zoneKindSelect | change | только показ |  |  | нет автотеста |
| nav-zones.js:292 | #chkZoneEdit | change | только показ |  |  | нет автотеста |
| nav-zones.js:293 | #chkZoneAlign | change | только показ |  |  | нет автотеста |
| nav-zones.js:294 | #chkAlign | change | только показ |  |  | нет автотеста |
| nav-zones.js:295 | #chkNavWarp | change | только показ |  |  | нет автотеста |
| nav-zones.js:300 | #cv | contextmenu | только показ |  |  | нет автотеста |
| observer.js:353 | #btnObs | click | только показ |  |  | нет автотеста |
| observer.js:358 | cv | mousedown | только показ |  |  | нет автотеста |
| observer.js:358 | cv | wheel | только показ |  |  | нет автотеста |
| observer.js:366 | el | pointerdown | только показ |  |  | нет автотеста |
| observer.js:368 | cv | mousedown | только показ |  |  | нет автотеста |
| observer.js:369 | cv | mouseup | только показ |  |  | нет автотеста |
| observer.js:374 | window | keydown o O щ Щ | только показ |  |  | нет автотеста |
| replay-play.js:338 | — | setTimeout | только показ |  |  | нет автотеста |
| replay.js:232 | RP_EL.skip | click | только показ |  |  | нет автотеста |
| replay.js:233 | window | keydown Escape Space | только показ |  |  | нет автотеста |
| sandbox.js:141 | window | mouseup | только показ |  |  | нет автотеста |
| scoreboard.js:237 | el | pointerdown | только показ |  |  | нет автотеста |
| scoreboard.js:238 | el | keydown Enter   | только показ |  |  | нет автотеста |
| scoreboard.js:243 | cv | mousedown | только показ |  |  | нет автотеста |
| src/marks.js:94 | s | load | только показ |  |  | нет автотеста |
| src/marks.js:94 | s | error | только показ |  |  | нет автотеста |
| src/marks.js:109 | — | setTimeout | только показ |  |  | нет автотеста |
| src/marks.js:195 | — | setTimeout | только показ |  |  | нет автотеста |
| src/marks.js:277 | #mkToast | ev | только показ |  |  | нет автотеста |
| src/marks.js:278 | #btnMark | click | только показ |  |  | нет автотеста |
| src/marks.js:280 | #btnMarks | click | только показ |  |  | нет автотеста |
| src/marks.js:281 | #mkLX | click | только показ |  |  | нет автотеста |
| src/marks.js:282 | #mkX | click | только показ |  |  | нет автотеста |
| src/marks.js:282 | #mkCancel | click | только показ |  |  | нет автотеста |
| src/marks.js:284 | #mkFile | click | только показ |  |  | нет автотеста |
| src/marks.js:285 | #mkText | input | только показ |  |  | нет автотеста |
| src/marks.js:287 | #mkCopy | click | только показ |  |  | нет автотеста |
| src/marks.js:296 | cv | mousedown | только показ |  |  | нет автотеста |
| src/marks.js:304 | window | keydown m M ь Ь | только показ |  |  | нет автотеста |
| src/marks.js:308 | #btnRestartRound | click | только показ |  |  | нет автотеста |
| src/marks.js:309 | #btnFreshMatch | click | только показ |  |  | нет автотеста |
| team.js:8 | chkTeamDbg | change | только показ |  |  | нет автотеста |
| timeout.js:30 | TS.el.skip | click | только показ |  |  | нет автотеста |
| timeout.js:240 | #btnToLast | click | только показ |  |  | нет автотеста |
| view3d-frame.js:292 | #cv3 | contextmenu | только показ |  |  | нет автотеста |
| view3d-frame.js:293 | #cv3 | wheel | только показ |  |  | нет автотеста |
| view3d-frame.js:294 | #cv3 | pointerdown | только показ |  |  | нет автотеста |
| view3d-frame.js:308 | el | click | только показ |  |  | нет автотеста |
| voice-console.js:20 | window | keydown Backquote | только показ |  |  | нет автотеста |

Итого: обработчиков 176, с автотестом 0. Прямых записей показа в игру (функции и обработчики): 89.
