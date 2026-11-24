# Функция → этап тика (генерируется; коммит 334860d)

Этап — от какого корня `stepTick` (540) функция достижима по графу вызовов (обход в ширину; функция может быть на нескольких этапах).
S1 фриз · S2 песочница/демо · S3 после раунда · S4 `teamBrains` (подэтапы a–l в порядке вызова) · S5 гранаты · S6 цикл по ботам ·
S7 `resolveEngagements` (видимость, взгляд, выстрел) · S8 восприятие → знание · S9 конец раунда и сторож · E — вызывается по событию
(урон, киллфид, взрыв, конец/сброс раунда, бросок, звук). Без этапа — загрузка/редакторы/показ или мёртвый код.

| файл | функция | строки | этапы | вызывающие (до 6) |
|---|---|---|---|---|
| 010 | `zlPt` | 22–22 | — | (top), applyZoneLayer, applyZoneLayerToData, buildSites, zoneMapCentroid |
| 010 | `zlInv` | 30–30 | — | saveZoneShape |
| 010 | `applyZoneLayerToData` | 31–37 | — | (top), applyZoneLayer |
| 010 | `autoPortals` | 41–53 | — | (top) |
| 010 | `saveNavAnchors` | 127–127 | — | applyNavWarpChange |
| 010 | `loadNavAnchors` | 128–135 | — | (top) |
| 010 | `solveLinear` | 141–158 | — | rebuildNavWarp |
| 010 | `tpsRbf` | 159–159 | — | navMapPoint, rebuildNavWarp |
| 010 | `rebuildNavWarp` | 162–198 | — | (top), applyNavWarpChange |
| 010 | `navMapPoint` | 205–234 | — | applyNavTransform, draw, findRawNavVertexNear |
| 010 | `applyNavTransform` | 236–243 | — | (top), rebuildNav |
| 020 | `pointInPoly` | 11–19 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, bzOf, covAt, covList, covWallAt, findZoneMapZoneAt |
| 020 | `navGridBuild` | 23–31 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, levelBlocked, nadeCovered, navAt, navAtLevel, navFloorNear |
| 020 | `navAt` | 32–45 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistEdgeSpot, buildWaypointPath0, d3FloorNear, d3FlyThru, d3Frame, dropOnFloor |
| 020 | `navOnlyZ` | 49–55 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | coverForReload, coverZ, setPostDo |
| 020 | `zoneOf` | 56–74 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, zoneSideMap |
| 020 | `dist2` | 81–81 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | computePortal, zoneDijkstra, zoneSideMap |
| 020 | `zoneEdges` | 82–86 | — | computePortal |
| 020 | `segOverlap` | 97–117 | — | computePortal |
| 020 | `computePortal` | 122–134 | — | rebuildNav |
| 030 | `applyWalls` | 11–28 | — | (top), medWSet |
| 030 | `hgtOwnFromList` | 43–47 | — | (top) |
| 030 | `hgtOwnToList` | 48–51 | — | (top) |
| 030 | `hgtInfo` | 56–61 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), hgtDraw, hgtTipText, visBuild |
| 030 | `covCatOf` | 82–82 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | covList |
| 030 | `covOwnFromList` | 85–95 | — | (top) |
| 030 | `covOwnToList` | 96–104 | — | (top) |
| 030 | `covPts` | 108–108 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | covAt, covList, covWallAt, wbAt, wbList |
| 030 | `covPolyArea` | 109–109 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | covAt, covDraw, covWallAt, medWHit, visBuild, wbAt |
| 030 | `covWallAt` | 111–115 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), covList, wbList |
| 030 | `covList` | 120–149 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), covAt, covDraw, medCSel, visBuild |
| 030 | `covAt` | 151–155 | S4a бомба; S4e мозг T | (top), canPlantAt, covTipText, sitePlantOptions, sitePlantSpot |
| 030 | `covHText` | 156–159 | — | (top), covTipText |
| 030 | `wbOwnFromList` | 177–188 | — | (top) |
| 030 | `wbOwnToList` | 189–195 | — | (top) |
| 030 | `wbAfter` | 202–209 | — | wbChest, wbLegend |
| 030 | `wbChest` | 211–216 | — | (top), wbTipText |
| 030 | `wbList` | 220–254 | — | (top), medBSel, wbAt, wbDraw, wbLegend |
| 030 | `wbAt` | 256–263 | — | (top), wbTipText |
| 035 | `m3` | 15–20 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | bulletClip3, computeZoneDanger, d3Corpse, d3FloorBelow, d3FloorNear, d3Frame |
| 035 | `m3SolidFill` | 25–47 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | m3 |
| 035 | `m3SegPlanes` | 48–54 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | m3Cast |
| 035 | `zInflate` | 61–119 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | m3 |
| 035 | `m3Load` | 121–173 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | m3 |
| 035 | `m3Col` | 174–177 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | m3Cast, nadeCovered |
| 035 | `m3SegTri` | 179–190 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | m3Cast |
| 035 | `m3SegHull` | 191–202 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | m3Cast |
| 035 | `m3Cast` | 207–266 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | bulletClip3, m3Hit, m3Line |
| 035 | `m3Line` | 267–267 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | d3Corpse, d3Frame, d3SpawnCam, stepWall, visMarch |
| 035 | `m3Hit` | 268–268 | — |  |
| 035 | `m3Cell` | 269–269 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | d3FloorBelow, d3FloorNear, d3World, m3FloorKinds, m3Floors, m3Solid |
| 035 | `m3Floors` | 270–273 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | floorCover, laddersBuild, lookPtFloor, m3FloorAt, nadeOnRoof, navGapsAdd |
| 035 | `m3FloorKinds` | 274–277 | — | vtCompute |
| 035 | `m3FloorAt` | 278–281 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | laddersBuild |
| 035 | `m3SolidGrid` | 286–297 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | m3Solid, m3SolidHit |
| 035 | `m3Solid` | 298–301 | S1 фриз; S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | insideSolidWall |
| 035 | `m3SolidHit` | 304–324 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | crossesWall, segCrossesManualWalls |
| 035 | `m3Game` | 326–326 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | d3Corpse, nadeSolve, throwNadeTry |
| 035 | `m3Radar` | 327–327 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | d3World, nadeSolve, nadesTick, throwNadeTry |
| 035 | `m3NadeTrace` | 339–384 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeTraceFn |
| 035 | `m3BevelPush` | 385–385 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | m3NadeTrace, m3TriPlanes |
| 035 | `m3BoxPlanes` | 388–401 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | m3BoxTri, m3NadeTrace |
| 035 | `m3TriPl` | 403–403 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | m3NadeTrace |
| 035 | `m3BoxTri` | 405–405 | — |  |
| 035 | `m3TriPlanes` | 406–423 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | m3BoxTri, m3TriPl |
| 040 | `visInvalidate` | 41–46 | — | (top), applyWalls |
| 040 | `visCoverTop` | 51–56 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | visBuild |
| 040 | `visBuild` | 59–148 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | visReady |
| 040 | `visReady` | 149–149 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | computeZoneDanger, nadeCovered, visFloorAt, visLine, visParts, vtCompute |
| 040 | `visFloorAt` | 155–179 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistEdgeSpot, bulletClip3, computeZoneDanger, defuseSees, detonate, draw |
| 040 | `visWallHit` | 183–206 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | defuseSees, visLine, visParts |
| 040 | `visMarch` | 209–223 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | defuseSees, detonate, fightClearSpot, flashSeen, lookPtFloor, tryShoot |
| 040 | `visLine` | 227–232 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | computeZoneDanger, hasLOS, rebuildNav |
| 040 | `levelBlocked` | 240–255 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | visParts |
| 040 | `visParts` | 261–284 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | assistEdgeSpot, assistPeek, duckDecide, fightCycleTick, fightSeen, fightShoulderPt |
| 040 | `visPartsText` | 285–285 | — | vtPairText |
| 040 | `zoneCentroid` | 287–289 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, computeApproaches, draw, findCover, holdCands, pickSaveSpot |
| 050 | `insideSolidWall` | 13–19 | S1 фриз; S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistEdgeSpot, buildAutoRoamRoute, computeApproaches, escapeWallLine, fightBetter, fightBetterAway |
| 050 | `segCrossesManualWalls` | 20–27 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistEdgeSpot, buildWaypointPath0, fireSafe, pickSpots, rebuildNav, setPostDo |
| 050 | `snapToWalkable` | 30–40 | S1 фриз; S2 режимы; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), buildAutoRoamRoute, buildRoamRoutes, proLineups, resnapSpawns, sbOrderPoint |
| 050 | `rebuildNav` | 42–253 | — | (top), applyNavWarpChange, applyWalls, scheduleNavRebuild |
| 050 | `makeHeap` | 259–277 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | zoneDijkstra, zoneSideMap |
| 050 | `zoneSideMap` | 282–293 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | zoneDijkstra |
| 050 | `navCutTall` | 308–316 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0 |
| 050 | `navGapKey` | 323–323 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, jumpLook, ladderTick, navGapsAdd |
| 050 | `navGapsAdd` | 324–341 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | navCutTall |
| 050 | `navJumpCost` | 347–352 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | zoneDijkstra |
| 050 | `navJumpCost0` | 353–362 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | navJumpCost |
| 050 | `navEdgeDz` | 364–378 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | navCutTall, navJumpCost0, navJumpLinked |
| 050 | `knownPathSpots` | 390–396 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | zoneDijkstra |
| 050 | `knownSegCost` | 398–411 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | zoneDijkstra |
| 050 | `zoneDijkstra` | 413–483 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0 |
| 050 | `triarea2` | 492–492 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | funnel |
| 050 | `vEq` | 493–493 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | funnel |
| 050 | `funnel` | 494–545 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0 |
| 050 | `navClampInto` | 553–560 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, dropOnFloor, laddersBuild, navGapsAdd, setPostDo |
| 050 | `botLane` | 566–566 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNewDestination, bombSightLen, pathLenTo, resolveEngagements, stepTick |
| 050 | `navSegNoDrop` | 577–583 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | laneShift, stepTick |
| 050 | `laneShift` | 584–600 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0 |
| 050 | `buildWaypointPath` | 606–614 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | appearFromCalc, appearPoint, assignNewDestination, bombSightLen, cornerLook0, ctEarlyPeek |
| 050 | `buildWaypointPath0` | 615–713 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath |
| 050 | `ccw` | 715–715 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | segIntersect |
| 050 | `segIntersect` | 716–718 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | crossesWall, routeAim, segCrossesManualWalls, visWallHit |
| 050 | `hasLOS` | 723–725 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillReact, afterTaskPick, aheadCorner, appearFromCalc, appearPoint, assistPeek |
| 050 | `distToSeg` | 727–734 | S4e мозг T; S4f мозг CT | (top), bombFleePoint, findZoneNear, hgtLedgeNear, medWEdgeAt, medWEdgeDist |
| 060 | `zoneMapCentroid` | 12–21 | — | (top), applyZoneLayer, sampleZone |
| 060 | `sampleZone` | 36–53 | — | computeZoneDanger |
| 060 | `computeZoneDanger` | 54–79 | — | (top), applyZoneLayer, visInvalidate |
| 060 | `applyZoneLayer` | 82–98 | — | (top), applyZoneLayer, rebuildAfterZoneShape |
| 060 | `crossesWall` | 102–109 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | escapeWallLine, laneShift, moveSpeedTick, nadeTallWall, nadeThrowSpot, nadeUsePick |
| 060 | `hashRand` | 112–117 | S1 фриз; S2 режимы; S4a бомба; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillReact, airKeysPlan, blindBullet, bombTick, bulletLineHit, buyForPlayer |
| 060 | `saveUserZonesDebounced` | 153–158 | — | (top), finishZoneDraw |
| 060 | `loadUserZones` | 159–166 | — | (top) |
| 060 | `zoneObjAbsPoints` | 185–193 | — | (top), buildSites, draw, findZoneNear, findZoneVertexNear, zoneBakeObjectTransform |
| 060 | `zoneObjCentroid` | 194–199 | — | (top), applyUserZones, buildRoamRoutes, draw |
| 060 | `zoneObjHandlePos` | 200–205 | — | (top) |
| 060 | `zoneBakeObjectTransform` | 206–211 | — | (top) |
| 060 | `applyUserZones` | 222–238 | — | (top), applyZoneLayer, finishZoneDraw |
| 060 | `resnapSpawns` | 243–248 | — | applyUserZones, applyWalls |
| 060 | `spawnPosFor` | 249–254 | S2 режимы; E события | makeTeam, resetRound |
| 070 | `makeTeam` | 76–105 | — | (top) |
| 070 | `buildAutoRoamRoute` | 123–149 | — | buildRoamRoutes |
| 070 | `buildRoamRoutes` | 150–161 | — | (top), applyUserZones |
| 070 | `initRoam` | 162–165 | S2 режимы; E события | (top), resetRound |
| 080 | `pnum` | 49–49 | — | draw, lookDbgDraw, lookDbgPanel, miniDraw, plNum, renderEcon |
| 080 | `nick` | 50–50 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ctBrain, ctRoleNow, ctSeatRoles, d3Tag, dvStart, feedBombKill |
| 080 | `nickify` | 51–51 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | feedEvent, logEvent, showBanner, voiceFeed |
| 090 | `seatPlayers` | 34–51 | S2 режимы; E события | (top), newMatch, swapSides |
| 090 | `isSniper` | 56–62 | S2 режимы; S3 после раунда; S4j подбор; E события | awpAllowed, pickValue, teamAwp |
| 090 | `prof` | 63–63 | S2 режимы; S4a бомба; S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillReact, bombTick, ctBrain, ctEarlyPeek, ctLandPunish, decideAction |
| 090 | `centroidOf` | 65–65 | S4e мозг T | buildSites, draw, sitePlantSpot, tsCam, tsZoneXY |
| 100 | `pathCacheReset` | 8–8 | S6 бот: шаг/физика | navUnlinkBlocked, rebuildNav |
| 100 | `pathQ` | 9–13 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | luBehind, pathLenTo, pathPts |
| 100 | `pathPts` | 16–20 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), bombFleePoint, bombPathLen, buildSites, coverForReload, ctDefuseThreat |
| 100 | `nearP` | 25–25 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillReact, ambushTick, contactMateFight, contactTick, ctEarlyPeek, ctInfoCheck |
| 100 | `polyLen` | 26–26 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), bombFleePoint, bombPathLen, coverForReload, ctDefuseThreat, ctNearSite |
| 100 | `pointAtDist` | 27–35 | S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | coverForReload, pointAtFrac, pointFromEnd |
| 100 | `pointFromEnd` | 36–36 | — | buildSites |
| 100 | `pointAtFrac` | 37–37 | — | buildSites |
| 100 | `walk` | 38–38 | S2 режимы; S4b маршрут; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; E события | (top), bombFleePoint, buildSites, ctBombPos, ctEarlyPeek, egCutPoint |
| 100 | `buildSites` | 40–74 | — | (top), applyUserZones |
| 100 | `onSite` | 77–80 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | canPlantAt, carrierAtSite, knowGraph, lineupTick, tBrain, tSoloThrower |
| 100 | `sitePlantOptions` | 86–121 | S4e мозг T | choosePlant |
| 100 | `choosePlant` | 122–136 | S4e мозг T | tBrain |
| 100 | `canPlantAt` | 144–151 | S4a бомба | plantBlock |
| 100 | `sitePlantPro` | 152–155 | S4a бомба; S4e мозг T; S8 восприятие→знание | canPlantAt, knowPlant, sitePlantOptions, sitePlantSpot |
| 100 | `sitePlantSpot` | 156–169 | S4e мозг T | buildSites, sitePlantOptions |
| 100 | `spotExposure` | 182–204 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | holdSpot, pickSpots, tBrain |
| 100 | `pickSpots` | 205–258 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillReact, ambushTick, assistPeek, bStageFix, computeApproaches, contactTick |
| 100 | `weightedPick` | 262–267 | S4e мозг T; S4f мозг CT | ctBrain, ctClutch, ctSetupRole, tBrain |
| 100 | `groupPost` | 269–273 | S4e мозг T; S4f мозг CT | ctBrain, stagePost, tBrain |
| 110 | `routeZones` | 14–19 | S4e мозг T; S4f мозг CT | startRoute |
| 110 | `routeIn` | 20–20 | S4b маршрут; S4e мозг T; S4f мозг CT | routeTick, startRoute |
| 110 | `routeAim` | 22–35 | S4b маршрут; S4e мозг T; S4f мозг CT | routeSetAim |
| 110 | `routeSetAim` | 37–41 | S4b маршрут; S4e мозг T; S4f мозг CT | routeTick, startRoute |
| 110 | `startRoute` | 42–54 | S4e мозг T; S4f мозг CT | flankPost, lurkerBrain, safeRotate, tBrain |
| 110 | `routeTick` | 55–70 | S4b маршрут | teamBrains |
| 110 | `proSnap` | 75–103 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | setPostDo |
| 110 | `proSpotLook` | 106–122 | S7 бой/взгляд | lookAngleCand |
| 110 | `proLookRay` | 124–132 | S4f мозг CT; S7 бой/взгляд | ctSetupRole, proSpotLook |
| 110 | `wallBoxes` | 135–164 | — | draw |
| 110 | `taskProp` | 230–230 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillReact, ambushTick, contactInfo, contactTick, ctBrain, dangerWalk |
| 110 | `taskKeepUntil` | 264–274 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | moveWalkWhy, tBrain, taskAlive |
| 110 | `taskKeep` | 277–277 | S2 режимы; S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillReact, assistPeek, contactTick, coverForReload, ctBrain, finishPush |
| 110 | `taskTagB` | 278–278 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | clearPostDo, detourStart, setPostDo, taskCanSet |
| 110 | `taskLevel` | 279–279 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | contactInfo, detourStart, setPostDo, taskCanSet, taskDetourKind |
| 110 | `taskAlive` | 280–280 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterTaskPick, contactInfo, contactTick, ctBrain, decideAction, detourOk |
| 110 | `taskCanSet` | 282–293 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistPeek, ctInfoCheck, finishPush, flankAssist, hurtReactTick, infoFallbackTick |
| 110 | `taskSlackSec` | 303–309 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | detourOk, fightPush |
| 110 | `detourOk` | 311–326 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistPeek, contactInfo, flankAssist, hurtReactTick, pickDetour, setPostDo |
| 110 | `taskDetourKind` | 330–333 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | setPostDo, taskCanTry |
| 110 | `taskCanTry` | 335–335 | S4l ситуации | lowHpBack |
| 110 | `detourStart` | 337–340 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistPeek, flankAssist, hurtReactTick, pickDetour, setPostDo |
| 110 | `postKeep` | 342–342 | S3 после раунда; S4e мозг T; S4g эндгейм; S4i смоки/огонь; S4j подбор; S5 гранаты | endgameBrain, runupTick, smokeLineTick, tBrain, updateNadeTask1, weaponPickupTick |
| 110 | `postViewPoint` | 350–362 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | setPostDo |
| 110 | `spreadBlast` | 366–366 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | setPostDo |
| 110 | `postSrc` | 371–371 | S4e мозг T; S4f мозг CT | ctBrain, ctSetupRole, tBrain |
| 110 | `setPostDo` | 372–467 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | setPost |
| 110 | `taskWalkOn` | 476–480 | S4e мозг T; S4f мозг CT | ctInfoCheck, tProbes |
| 110 | `taskDeadline` | 481–484 | S4c контакт | contactTick |
| 110 | `setPost` | 485–492 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillReact, ambushTick, assistPeek, contactTick, coverForReload, ctBrain |
| 110 | `afterTaskPick` | 497–507 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | setPostDo |
| 110 | `clearPostDo` | 509–509 | S3 после раунда; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | clearPost |
| 110 | `clearPost` | 511–513 | S3 после раунда; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | (top), ambEnd, contactTick, ctBrain, ctInfoCheck, endgameBrain |
| 110 | `placeStance` | 517–517 | S2 режимы; S4c контакт; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; E события | duckDecide, fightCycleTick, leaveHold, moveSpeedTick, resetRound, resolveEngagements |
| 110 | `placeResetPost` | 518–518 | S2 режимы; E события | resetRound |
| 110 | `placeResetTask` | 519–519 | S2 режимы; E события | resetRound |
| 110 | `updatePost` | 520–558 | S6 бот: место/ход | stepTick |
| 120 | `bombPathLen` | 11–18 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | bombDamageAt, moveRunWhy |
| 120 | `bombDamageAt` | 19–22 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | bombFleePoint, checkRoundEnd, contactCritical, moveRunWhy, pickSaveSpot, spreadBlast |
| 120 | `bombSightLen` | 34–44 | S4e мозг T | tBrain, tDefuseBaiter |
| 120 | `bombFleePoint` | 45–75 | S4e мозг T | tBrain |
| 120 | `resetBomb` | 77–85 | S2 режимы; E события | (top), resetRound |
| 120 | `dropOnFloor` | 89–93 | S2 режимы; S4a бомба; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | dropBomb, dropWeaponOnDeath |
| 120 | `dropBomb` | 94–99 | S2 режимы; S4a бомба; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage, bombTick |
| 120 | `defuseEta` | 105–112 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | contactCritical, ctBrain, retakeDefGo, taskSlackSec, updateRetake |
| 120 | `defuseSees` | 115–119 | S4a бомба | bombTick |
| 120 | `defuseSound` | 123–130 | S4a бомба | bombTick |
| 120 | `defuseContTick` | 133–139 | S4e мозг T | tBrain |
| 120 | `ctDefuseThreat` | 144–149 | S4a бомба | bombTick |
| 120 | `tDefuseGo` | 155–175 | S4e мозг T | tBrain |
| 120 | `tDefuseBaiter` | 178–183 | S4e мозг T | tDefuseGo |
| 120 | `bombTimeLeftTicks` | 184–184 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | bombBeepTick, bombFleePoint, bombTick, contactCritical, ctBombPos, ctBrain |
| 120 | `plantBlock` | 188–197 | S4a бомба | bombTick, whyText |
| 120 | `bombTick` | 198–333 | S4a бомба | teamBrains |
| 130 | `memSnapshot` | 25–26 | S2 режимы; S4a бомба; S9 конец/сторож; E события | saveOppProfile, swapSides |
| 130 | `memRestore` | 27–28 | S2 режимы; E события | swapSides |
| 130 | `memStart` | 30–33 | S2 режимы; E события | resetMatchMemory, swapSides |
| 130 | `resetMatchMemory` | 34–34 | S2 режимы; E события | newMatch |
| 130 | `oppNorm` | 42–42 | S2 режимы; S4a бомба; S9 конец/сторож; E события | oppFor, saveOppProfile |
| 130 | `oppFor` | 43–43 | S2 режимы; E события | loadOppProfile |
| 130 | `saveOppProfile` | 44–60 | S4a бомба; S9 конец/сторож; E события | endRound |
| 130 | `loadOppProfile` | 61–69 | S2 режимы; E события | (top), memStart |
| 130 | `weightedChoice` | 70–74 | S2 режимы; E события | chooseCtSetup, chooseTactic |
| 130 | `readCT` | 77–82 | S2 режимы; S4a бомба; S9 конец/сторож; E события | chooseTactic, coachPlan |
| 130 | `timeoutsReset` | 95–95 | S2 режимы; E события | newMatch |
| 130 | `timeoutCheck` | 96–118 | S4a бомба; S9 конец/сторож; E события | endRound |
| 130 | `timeoutWant` | 120–133 | S4a бомба; S9 конец/сторож; E события | timeoutCheck |
| 130 | `tacUsesZone` | 134–134 | S2 режимы; S4a бомба; S9 конец/сторож; E события | chooseTactic, coachPlan |
| 130 | `setupUsesZone` | 135–135 | S2 режимы; E события | chooseCtSetup |
| 130 | `tacById` | 136–136 | S4a бомба; S9 конец/сторож; E события | coachPlan |
| 130 | `setupById` | 137–137 | S4a бомба; S9 конец/сторож; E события | coachPlan |
| 130 | `coachPlan` | 139–197 | S4a бомба; S9 конец/сторож; E события | timeoutCheck |
| 130 | `tacTempoNow` | 207–207 | — | renderEcon |
| 130 | `roundTempo` | 211–212 | S2 режимы; S4a бомба; S9 конец/сторож; E события | chooseTactic, coachPlan |
| 130 | `chooseTactic` | 214–330 | S2 режимы; E события | buyPhase |
| 140 | `namedSpot` | 5–10 | S4e мозг T; S4f мозг CT | ctBrain, proRolePost, secondOnSite, tBrain |
| 140 | `entryPts` | 11–11 | S4e мозг T; S4f мозг CT; S8 восприятие→знание | computeApproaches, ctBrain, exuCritical, secondOnSite, smkEvidence0, tBrain |
| 140 | `sightBlockedByAlly` | 16–26 | S4f мозг CT | lookFrom |
| 140 | `outwardLook` | 33–58 | S4f мозг CT | ctSetupRole, lookFrom |
| 140 | `lookFrom` | 60–85 | S4f мозг CT | ctBrain, secondOnSite |
| 140 | `ctShareW` | 93–97 | S2 режимы; E события | chooseCtSetup |
| 140 | `chooseCtSetup` | 99–142 | S2 режимы; E события | chooseTactic |
| 140 | `ctSeatRoles` | 157–182 | S2 режимы; E события | chooseCtSetup |
| 140 | `ctSetupRole` | 185–294 | S4f мозг CT | ctBrain |
| 140 | `ctSideOf` | 299–300 | S4f мозг CT | ctInfoCheck, ctRoleShift, ctSideThreat, ctSpotPick |
| 140 | `ctRolePt` | 301–301 | S4f мозг CT | ctRoleShift, ctSpotPick |
| 140 | `ctSpotPick` | 302–323 | S4f мозг CT | ctSetupRole |
| 140 | `ctProZones` | 325–333 | S4f мозг CT | ctSetupRole |
| 140 | `ctRoleNow` | 339–368 | S4f мозг CT | ctBrain, ctSpotPick |
| 140 | `ctSideThreat` | 372–377 | S4f мозг CT | ctInfoCheck, ctRoleShift |
| 140 | `ctRoleShift` | 385–407 | S4f мозг CT | ctRoleNow |
| 140 | `ROLE_LABEL_CT` | 408–408 | S4f мозг CT | ctRoleNow, ctSetupRole |
| 140 | `rememberRound` | 414–429 | S4a бомба; S9 конец/сторож; E события | endRound |
| 140 | `noteMistake` | 432–435 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath, tryShoot |
| 140 | `aggrNote` | 439–439 | S7 бой/взгляд | resolveEngagements |
| 140 | `aggrRate` | 440–444 | S7 бой/взгляд | decideAction |
| 140 | `habitAdd` | 445–448 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath, teamInfoTick |
| 140 | `habitTop` | 449–453 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knownRole, lookCands0, nadeBrains |
| 150 | `lurkGoNow` | 17–17 | S4e мозг T | lurkerBrain |
| 150 | `lurkerBrain` | 18–110 | S4e мозг T | tBrain |
| 150 | `tDeathAdd` | 122–123 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath |
| 150 | `tDeathsNear` | 124–125 | S4e мозг T | lurkerBrain, tProbes |
| 150 | `tDeathSpots` | 126–126 | S4e мозг T | stagePost, tBrain |
| 150 | `tProbes` | 127–264 | S4e мозг T | tBrain |
| 150 | `probeViewPoint` | 265–284 | S4e мозг T | tProbes |
| 150 | `clearzReset` | 287–287 | S2 режимы; E события | freshMatch, lkpReset |
| 150 | `enemyPositions` | 294–301 | S4i смоки/огонь; S5 гранаты; S7 бой/взгляд | lookCands0, posClearTick, smokeLineWait, tClearCalls |
| 150 | `posClearValid` | 302–302 | S5 гранаты; S7 бой/взгляд | lookCands0, posClearTick, tClearCalls |
| 150 | `posClearTick` | 303–311 | S7 бой/взгляд | lookPlan |
| 150 | `tClearCalls` | 319–344 | S5 гранаты | stepTick |
| 150 | `zoneSeenAll` | 350–354 | S4e мозг T; S4f мозг CT; S5 гранаты | markClear, tClearCalls |
| 150 | `markClear` | 356–366 | S4e мозг T; S4f мозг CT; S5 гранаты | ctEarlyPeek, ctInfoCheck, ctSetupRole, tBrain, tClearCalls, tProbes |
| 150 | `siteAssess` | 374–381 | S4e мозг T; S4f мозг CT | ctBrain, lurkerBrain, tBrain, tPlantChance, tSaveWant |
| 150 | `siteConfirmed` | 387–394 | S4e мозг T; S4f мозг CT | siteAssess |
| 150 | `iglReads` | 397–401 | S4e мозг T | tBrain |
| 150 | `soloMayWalk` | 402–412 | S6 бот: место/ход | moveWalkWhy |
| 160 | `iglTake` | 19–19 | S4e мозг T | tBrain, tIglReplan |
| 160 | `carrierAtSite` | 20–23 | S4e мозг T | tBrain, tIglReplan |
| 160 | `tIglReplan` | 25–140 | S4e мозг T | tBrain |
| 160 | `fl2idx` | 141–141 | S4e мозг T | tBrain |
| 160 | `bStageFix` | 145–155 | S4e мозг T | tBrain |
| 160 | `stagePost` | 157–185 | S4e мозг T | tBrain |
| 160 | `tSiteTaking` | 194–200 | S4e мозг T | tBrain, tIglReplan |
| 160 | `tSetSite` | 201–226 | S4e мозг T | tBrain, tIglReplan |
| 160 | `ppTimeNamed` | 231–264 | S4e мозг T | tBrain |
| 170 | `tFastGo` | 4–9 | S4e мозг T | tBrain |
| 170 | `tBrain` | 11–1076 | S4e мозг T | teamBrains |
| 180 | `pickSaveSpot` | 2–37 | S4f мозг CT | ctBrain |
| 180 | `tSaveRoll` | 46–52 | S4e мозг T | tSaveWant |
| 180 | `tSaveWant` | 55–68 | S4e мозг T | tBrain |
| 180 | `tPlantChance` | 73–82 | S4e мозг T | tBrain |
| 180 | `tSaveHold` | 84–88 | S4e мозг T | tBrain |
| 180 | `pickSaveSpotT` | 89–114 | S4e мозг T | tBrain, tSaveHold |
| 180 | `pathLenTo` | 128–133 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | contactInfo, contactTick, ctBrain, ctInfoCheck, ctRoleNow, egCutPoint |
| 180 | `ctBombPos` | 136–146 | S4f мозг CT | computeApproaches, retakePost, retakeUtil, updateRetake |
| 180 | `computeApproaches` | 147–197 | S4f мозг CT | updateRetake |
| 180 | `gTag` | 201–203 | S4f мозг CT | retakePost |
| 180 | `updateRetake` | 206–330 | S4f мозг CT | ctBrain |
| 180 | `retakeEntryPick` | 333–338 | S4f мозг CT | updateRetake |
| 180 | `retakeUtil` | 341–370 | S4f мозг CT | updateRetake |
| 180 | `retakePost` | 371–432 | S4f мозг CT | ctBrain |
| 180 | `retakeKitFor` | 433–439 | S4f мозг CT | retakePost |
| 180 | `retakeClear` | 440–446 | S4f мозг CT | retakePost |
| 180 | `retakeDefGo` | 447–466 | S4f мозг CT | retakePost |
| 180 | `saveCancelTrades` | 469–473 | S4e мозг T; S4f мозг CT | ctBrain, tBrain |
| 180 | `teamSaving` | 474–474 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath, nadeReact, nadeUseTick |
| 180 | `cl0save` | 475–475 | — | renderEcon |
| 190 | `commSend` | 22–22 | S8 восприятие→знание | teamInfoTick |
| 190 | `resetTeamIntel` | 23–23 | S2 режимы; E события | (top), resetRound |
| 190 | `intelPush` | 25–27 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | commSend, intelDeath, jumpCheckTick, teamHeardToIntel, throwNadeTry |
| 190 | `lkpWord` | 39–39 | — | draw, lookDbgDraw, lookDbgPanel |
| 190 | `lkpReset` | 40–40 | S2 режимы; E события | freshMatch, resetTeamIntel |
| 190 | `lkpSet` | 41–43 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | beliefTick, intelPush |
| 190 | `lkpTick` | 44–65 | S4k LKP | teamBrains |
| 190 | `lkpNear` | 66–68 | S4f мозг CT | ctBrain, ctSetupRole |
| 190 | `teamInfoTick` | 69–95 | S8 восприятие→знание | stepTick |
| 190 | `intelEstimate` | 97–125 | S3 после раунда; S4e мозг T; S4f мозг CT; S4h лайнапы; S4j подбор; S5 гранаты; S7 бой/взгляд | ctBrain, ctEarlyPeek, decideAction, midCoverPick, nadeWorth, tBrain |
| 190 | `intelDeathsNear` | 126–128 | S4e мозг T; S4f мозг CT; S8 восприятие→знание | ctBrain, holdSpot, tBrain, tFallbackTick |
| 190 | `saveZoneNames` | 140–140 | — | (top), saveZoneNameFromInput |
| 190 | `zoneById` | 142–142 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4h лайнапы; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), drawZoneShapeHandles, lookDbgDraw, routeZones, saveZoneShape, zoneShapeMouseDown |
| 190 | `zoneMainName` | 146–146 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | calloutName, timeoutCheck, tsZoneXY, zoneUserName |
| 190 | `normZoneName` | 148–148 | S2 режимы; S4e мозг T; S4f мозг CT; S4h лайнапы; S5 гранаты; S8 восприятие→знание; E события | posPickName, spawnEarlyK, zoneAliases, zonesByName |
| 190 | `zoneAliases` | 149–149 | S2 режимы; S4e мозг T; S4f мозг CT; S4h лайнапы; S5 гранаты; S8 восприятие→знание; E события | zonesByName |
| 190 | `zonesByName` | 151–156 | S2 режимы; S4e мозг T; S4f мозг CT; S4h лайнапы; S5 гранаты; S8 восприятие→знание; E события | ctSeatRoles, posNamesOwn, posPickName, proZoneShare, routeZones, zonePoint |
| 190 | `zonePoint` | 158–163 | S2 режимы; S4e мозг T; S4f мозг CT; S4h лайнапы; S5 гранаты; S8 восприятие→знание; E события | bStageFix, computeApproaches, ctBrain, ctProZones, ctRolePt, ctSetupRole |
| 190 | `zoneUserName` | 164–164 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4h лайнапы; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), ctSetupRole, draw, knowZoneName, ldCandName, lookCands0 |
| 190 | `zoneLabel` | 165–165 | S6 бот: место/ход | roamPtLabel |
| 190 | `zoneIdxOk` | 170–171 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | zoneIdAt |
| 190 | `zoneIdxBuild` | 172–180 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | zoneIdAt |
| 190 | `zoneIdAt` | 181–184 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), ctBrain, ctProZones, ctSeatRoles, ctSetupRole, inWater |
| 190 | `calloutName` | 188–200 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), afterKillReact, afterTaskPick, ambushTick, awpSmokeTick, bombFleePoint |
| 190 | `voiceLog` | 201–201 | S2 режимы; S4a бомба; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ambushStartBack, ambushTick, assistPeek, awpSmokeTick, bombPassTick, bombTick |
| 190 | `aliveCount` | 202–202 | S2 режимы; S4a бомба; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | bombTick, choosePlant, contactTick, ctBrain, ctClutch, ctEarlyPeek |
| 190 | `tSideZone` | 207–211 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath |
| 190 | `rmemRecent` | 212–212 | S2 режимы; S4a бомба; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S9 конец/сторож; E события | chooseCtSetup, coachPlan, ctBrain, ctEarlyPeek, nadeBrains, prePeekDecide |
| 190 | `knownRole` | 214–219 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath |
| 190 | `intelDeath` | 220–388 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage |
| 190 | `intelCallLog` | 390–395 | S2 режимы; S4a бомба; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ctBrain, voiceLog |
| 190 | `tradeStart` | 398–398 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath |
| 190 | `tradeAlertSet` | 399–399 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath |
| 190 | `tradeGoing` | 400–400 | S4e мозг T; S6 бот: место/ход; S7 бой/взгляд | lookUrgent, moveWalkWhy, tBrain, tProbes |
| 190 | `tradeAlert` | 401–401 | S4c контакт; S7 бой/взгляд | contactInfo, decideAction |
| 190 | `tradeEnd` | 402–402 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | resetBomb, saveCancelTrades, taskKeepUntil |
| 190 | `zoneIndexReset` | 405–405 | — | (top), zoneShapeMouseDown |
| 190 | `zoneNameCacheReset` | 406–406 | S2 режимы; S4e мозг T; S4f мозг CT; E события | beliefBuild, rebuildAfterZoneShape |
| 190 | `rmemSet` | 407–407 | S2 режимы; E события | memRestore, memStart |
| 200 | `beliefBuild` | 17–39 | S2 режимы; S4e мозг T; S4f мозг CT; E события | (top), applyZoneLayer, beliefReset, bombFleePoint, outwardLook |
| 200 | `bzDist` | 40–50 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ctSiteD, enemySpawnDist, infoNext, outwardLook, reachFrom, spotExposure |
| 200 | `bzOf` | 51–63 | S2 режимы; S3 после раунда; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ambGoalSite, beliefBuild, beliefMassNear, beliefReset, beliefTick, cornerLook0 |
| 200 | `beliefReset` | 65–79 | S2 режимы; E события | (top), applyZoneLayer, freshMatch, resetRound |
| 200 | `reachFrom` | 99–103 | S2 режимы; S8 восприятие→знание; E события | reachReset, reachStep |
| 200 | `reachMin` | 104–108 | S2 режимы; S8 восприятие→знание; E события | reachReset, reachStep |
| 200 | `reachReset` | 109–117 | S2 режимы; E события | beliefReset |
| 200 | `reachOpen` | 120–125 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | beliefObserve, beliefTick |
| 200 | `reachPossible` | 126–126 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ctEarlyPeek, ctInfoCheck, dangerWalk, infoNext, knifeEnemyDist, lookCands0 |
| 200 | `reachStep` | 127–136 | S8 восприятие→знание | beliefTick |
| 200 | `reachStepOne` | 138–168 | S8 восприятие→знание | reachStep |
| 200 | `beliefMassNear` | 169–174 | S3 после раунда; S4e мозг T; S4f мозг CT; S4h лайнапы; S4j подбор; S4k LKP; S5 гранаты; S7 бой/взгляд | intelEstimate, lkpNear, lkpTick |
| 210 | `noticeShooter` | 51–59 | S4c контакт; S7 бой/взгляд | contactInfo, lookKnowCands |
| 210 | `ignoredShooter` | 62–62 | S4c контакт; S7 бой/взгляд | contactInfo, lookCands0, lookKnowCands |
| 210 | `hearReal` | 64–75 | S2 режимы; S4a бомба; S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | blindBullet, bombTick, defuseContTick, defuseSound, dvHearShot, dvTick |
| 210 | `knowGraph` | 79–105 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knifeEnemyDist, knowApply, knowBuild, knowCall, knowEnemySpots, knowLook |
| 210 | `navZoneBuild` | 112–126 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | zoneIdAt3 |
| 210 | `zoneIdAt3` | 127–135 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | calloutName, contactInfo, knowZoneAt, routeIn, timeoutCheck |
| 210 | `knowZoneAt` | 136–141 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowClearZone, knowCompat, knowHearing, knowKill, knowLook, knowPlantShift |
| 210 | `knowNearestSite` | 142–146 | S8 восприятие→знание | knowHearing, knowVision, teamNotice |
| 210 | `knowZoneName` | 147–147 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowApply, knowKill, knowLook, knowTrace, knowVision, knowWindowsTick |
| 210 | `knowValue` | 149–158 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowBuild, knowPlant |
| 210 | `knowEnemySpots` | 162–170 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ambushTick, ctBrain, knowCorpseOnly, knownPathSpots, tBrain |
| 210 | `knowBuild` | 173–215 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowKill, knowNewBelief, knowVision |
| 210 | `knowWindows` | 217–226 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowBuild |
| 210 | `knowNorm` | 227–236 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowAge, knowApply, knowClearZone, knowLook, knowPlant, knowPlantShift |
| 210 | `knowHyp` | 237–237 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowAge, knowApply, knowRetakeDrift, knowTrim, knowWindowsTick |
| 210 | `knowTrace` | 238–243 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowApply, knowKill, knowLook, knowRoundStart, knowVision, knowWindowsTick |
| 210 | `knowNewBelief` | 244–248 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowKill, knowRoundStart |
| 210 | `knowSpotBase` | 254–263 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowRoundStart |
| 210 | `knowSpotReach` | 264–264 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | beliefKnowQ, knowSiteShift, selfExitFlash, selfPlantSmoke |
| 210 | `knowRoundStart` | 267–278 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowTick, teamAgent |
| 210 | `knowVision` | 281–306 | S8 восприятие→знание | knowTick |
| 210 | `knowHearing` | 309–323 | S8 восприятие→знание | knowTick |
| 210 | `knowSources` | 325–337 | S8 восприятие→знание | teamNotice |
| 220 | `knowCall` | 3–21 | S8 восприятие→знание | teamChannel |
| 220 | `knowClearZone` | 23–34 | S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты | lkpTick, markClear |
| 220 | `knowApply` | 36–84 | S8 восприятие→знание | knowCall, knowHearing |
| 220 | `knowCompat` | 85–95 | S8 восприятие→знание | knowApply |
| 220 | `knowTrim` | 96–104 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowApply, knowPlantShift, knowSiteShift |
| 220 | `knowWindowsTick` | 106–133 | S8 восприятие→знание | knowTick |
| 220 | `knowLook` | 135–162 | S8 восприятие→знание | knowTick |
| 220 | `knowPlant` | 164–189 | S8 восприятие→знание | knowTick |
| 220 | `knowPlantShift` | 196–209 | S8 восприятие→знание | knowBombSeen, knowCall, knowPlant |
| 220 | `knowShiftPut` | 211–217 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowPlantShift, knowSiteShift |
| 220 | `knowSiteShift` | 221–234 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowKill |
| 220 | `knowBombSeen` | 236–241 | S8 восприятие→знание | knowTick |
| 220 | `knowKill` | 243–272 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | feedKill |
| 220 | `setupRegions` | 280–290 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowSetupRead, setupRegionAt |
| 220 | `setupRegionAt` | 291–294 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowSetupRead, knownRole |
| 220 | `knowSetupRead` | 295–307 | S4e мозг T | tBrain |
| 220 | `knowTick` | 308–324 | S8 восприятие→знание | stepTick |
| 220 | `knowAgeP` | 333–338 | S2 режимы; S4c контакт; S4d задержка CT; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowAge, knowMeRevealed, knowPlantShift, knowRetakeDrift, knowSiteShift |
| 220 | `knowAge` | 339–360 | S8 восприятие→знание | knowTick |
| 220 | `knowMeRevealed` | 364–367 | S4c контакт; S4d задержка CT; S4f мозг CT; S5 гранаты | ambushTick, nadeRevealOk |
| 220 | `knowSeenByFoe` | 371–375 | S4c контакт; S4f мозг CT; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | knowSeenByAny, saveShootOk |
| 220 | `knowSeenByAny` | 376–376 | S4c контакт; S4f мозг CT; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | ambSeenBy |
| 220 | `knowCorpseOnly` | 382–389 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | moveWalkWhy, throwNadeDo, updateNadeTask1 |
| 220 | `knowRetakeDrift` | 396–413 | S8 восприятие→знание | knowTick |
| 220 | `teamAgent` | 420–424 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | beliefTick, knowTick, teamAgents, teamChannel |
| 220 | `teamAgents` | 425–425 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | knowClearZone, knowKill |
| 220 | `knowTeamLook` | 426–446 | S8 восприятие→знание | knowTick |
| 220 | `knowHypZoneId` | 449–456 | S8 восприятие→знание | knowHypZone, knowLook, knowTeamLook |
| 220 | `knowHypZone` | 457–461 | S8 восприятие→знание | knowHypSpread |
| 220 | `knowHypSpread` | 464–472 | S8 восприятие→знание | beliefKnowQ |
| 220 | `knowAvoidPeek` | 475–475 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelDeath, shiftHold, taskKeepUntil |
| 220 | `knowAvoidPeekNear` | 476–476 | S6 бот: место/ход; S7 бой/взгляд | decideAction, prePeekDecide |
| 230 | `teamNew` | 42–55 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | teamOf |
| 230 | `teamOf` | 56–62 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | markClear, teamPropose, teamTick |
| 230 | `teamBot` | 63–63 | S2 режимы; S4a бомба; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), ambushStartBack, ambushTick, beliefObserve, buyShowMoney, contactInfo |
| 230 | `teamRand` | 64–64 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | teamPropose |
| 230 | `teamSec` | 65–65 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | teamChannel, teamCovered, teamNotice, teamPropose |
| 230 | `teamSamePlace` | 67–67 | S8 восприятие→знание | teamNotice |
| 230 | `teamNear` | 68–68 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | teamCovered, teamNotice |
| 230 | `teamText` | 71–81 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | teamPropose |
| 230 | `teamCovered` | 84–93 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | teamChannel, teamPropose |
| 230 | `teamPropose` | 96–114 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | nadeOrigin, teamDeath, teamNotice, throwNadeTry |
| 230 | `teamNotice` | 117–166 | S8 восприятие→знание | teamTick |
| 230 | `teamDeath` | 169–183 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | feedKill |
| 230 | `teamHeardDied` | 186–190 | S8 восприятие→знание | teamChannel |
| 230 | `teamChannel` | 191–241 | S8 восприятие→знание | teamTick |
| 230 | `teamHeardToIntel` | 244–254 | S8 восприятие→знание | teamChannel |
| 230 | `teamTick` | 256–265 | S8 восприятие→знание | stepTick |
| 240 | `beliefObserve` | 3–11 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelPush |
| 240 | `pmRegion` | 17–17 | S8 восприятие→знание | pmNote, pmWeight |
| 240 | `pmBook` | 18–18 | S8 восприятие→знание | pmNote, pmWeight |
| 240 | `pmNote` | 19–23 | S8 восприятие→знание | beliefTick |
| 240 | `pmWeight` | 24–27 | S8 восприятие→знание | beliefKnowQ |
| 240 | `beliefKnowQ` | 30–46 | S8 восприятие→знание | beliefTick |
| 240 | `beliefTick` | 47–106 | S8 восприятие→знание | stepTick |
| 240 | `beliefMass` | 108–112 | S4f мозг CT | ctBrain |
| 240 | `beliefCount` | 116–124 | S4e мозг T; S4f мозг CT; S4h лайнапы; S5 гранаты; S8 восприятие→знание | ctBrain, ctClutch, infoFallbackTick, nadeWorth, selfExitFlash, tBrain |
| 250 | `smokeEdge` | 9–21 | S7 бой/взгляд | cornerLook0 |
| 250 | `lookOnMate` | 26–38 | S7 бой/взгляд | lookFilter, openDirLook |
| 250 | `openDirLook` | 46–70 | S7 бой/взгляд | lookFilter |
| 250 | `holdRelevant` | 74–79 | S7 бой/взгляд | lookKnowPt |
| 250 | `aheadCorner` | 84–97 | S6 бот: место/ход | prePeekTick |
| 250 | `pieAllowed` | 98–107 | S6 бот: место/ход | pieBusy |
| 250 | `pieBusy` | 108–112 | S6 бот: место/ход | prePeekTick |
| 250 | `prePeekTick` | 113–132 | S6 бот: место/ход | stepTick |
| 250 | `prePeekDecide` | 134–202 | S6 бот: место/ход | prePeekTick |
| 250 | `exposedShiftTick` | 205–215 | S6 бот: место/ход | stepTick |
| 250 | `appearFrom` | 220–225 | S7 бой/взгляд | lookFilter, lookKnowPt, smoothLookFilter |
| 250 | `appearFromCalc` | 226–242 | S7 бой/взгляд | appearFrom |
| 250 | `flatWallAhead` | 243–252 | S7 бой/взгляд | lookFilter |
| 250 | `openDirNear` | 253–262 | S7 бой/взгляд | lookFilter |
| 250 | `cornerLook` | 267–277 | S7 бой/взгляд | lookAngleCand, lookArbiter, lookAssigned, lookCands0, lookFilter, lookKnowCands |
| 250 | `cornerLook0` | 278–317 | S7 бой/взгляд | cornerLook |
| 250 | `openLook` | 318–333 | S7 бой/взгляд | lookFilter |
| 260 | `beliefAsBot` | 11–11 | S7 бой/взгляд | lookCands |
| 260 | `beliefZoneKnown` | 12–17 | S4c контакт; S4e мозг T; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | ctInfoCheck, ctSideThreat, dangerWalk, infoNext, isRearZone, lookCands0 |
| 260 | `beliefZoneKnownB` | 21–25 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | beliefZoneKnown, bombFleePoint, contactInfo, enemyBeyondSmoke, nadeSelfWhyNot, openDirLook |
| 260 | `freshThreatNear` | 27–31 | S7 бой/взгляд | isRearZone, lookCands0 |
| 260 | `enemySpawnDist` | 91–95 | S4f мозг CT; S7 бой/взгляд; S8 восприятие→знание | enemywardLook, infoFallbackTick, isRearZone, tFallbackTick |
| 260 | `uncheckedW` | 96–102 | S6 бот: место/ход; S7 бой/взгляд | dangerWalk, lookCands0 |
| 260 | `mateWatches` | 114–116 | S4e мозг T; S7 бой/взгляд | isRearZone, lookCands0, ppCheckStep |
| 260 | `isRearZone` | 117–136 | S7 бой/взгляд | lookCands0, openDirLook |
| 260 | `enemywardLook` | 142–156 | S4f мозг CT; S7 бой/взгляд | lookCands0, proRolePost |
| 260 | `appearPoint` | 161–172 | S7 бой/взгляд | lookCands0 |
| 260 | `proLookAt` | 174–186 | S7 бой/взгляд | lookCands0 |
| 260 | `_angOff` | 187–187 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ambPassing, cornerLook, flankSpot, holdSpot, jumpCheckTick, knifeDefuseTick |
| 260 | `bzPortalPt` | 189–196 | S4c контакт; S4e мозг T; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | bzPortals |
| 260 | `bzPortals` | 197–203 | S4c контакт; S4e мозг T; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | bzWalk, enemywardLook, portalWatched, threatEntrances |
| 260 | `portalWatched` | 205–215 | S7 бой/взгляд; S8 восприятие→знание | beliefTick, lookPlan |
| 260 | `bzWalk` | 222–234 | S4c контакт; S4e мозг T; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | nbrThreat |
| 260 | `nbrThreat` | 239–248 | S4c контакт; S4e мозг T; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | lookCands0, threatEntrances |
| 260 | `openToward` | 251–260 | S7 бой/взгляд | lookCands0, lookKnowPt |
| 270 | `lookHeading` | 3–9 | S7 бой/взгляд | lookAngleCand, lookCands0, lookRearThreat, openDirLook, smoothLookFilter |
| 270 | `lookCands` | 11–13 | S7 бой/взгляд | lookPlan, smoothLookFilter |
| 270 | `lookCands0` | 14–199 | S7 бой/взгляд | lookCands |
| 270 | `lookPtFloor` | 207–212 | S7 бой/взгляд | lookMateAhead, lookOnMate |
| 270 | `mateOnLevel` | 215–215 | S7 бой/взгляд | lookMateAhead, lookOnMate |
| 270 | `lookMateAhead` | 216–223 | S7 бой/взгляд | lookCands0 |
| 270 | `knownWayLook` | 224–249 | S7 бой/взгляд | lookCands0 |
| 270 | `lookPlan` | 252–300 | S7 бой/взгляд | lookTick |
| 270 | `lookUrgent` | 316–335 | S7 бой/взгляд | lookFilter |
| 270 | `slHold` | 339–347 | S7 бой/взгляд | smoothLookFilter |
| 270 | `slKey` | 354–354 | S7 бой/взгляд | slNew, smoothLookFilter |
| 270 | `slSub` | 355–355 | S7 бой/взгляд | smoothLookFilter |
| 270 | `slVal` | 356–356 | S7 бой/взгляд | smoothLookFilter |
| 270 | `slNew` | 357–357 | S7 бой/взгляд | smoothLookFilter |
| 270 | `lookRearThreat` | 361–368 | S7 бой/взгляд | smoothLookFilter |
| 270 | `smoothLookFilter` | 369–456 | S7 бой/взгляд | lookFilter |
| 270 | `lookDbgId` | 461–461 | — | lookDbgBot |
| 270 | `lookContactFresh` | 481–487 | S7 бой/взгляд | lookCands0, lookKnowCands |
| 270 | `lookKnowPath` | 493–501 | S7 бой/взгляд | lookKnowCands, lookKnowPt |
| 270 | `lookMovePt` | 503–513 | S7 бой/взгляд | lookKnowPt |
| 270 | `lookKnowPt` | 514–549 | S7 бой/взгляд | lookCands0, lookKnowCands |
| 270 | `lookKnowCands` | 551–592 | S7 бой/взгляд | lookArbiter |
| 270 | `lookAssigned` | 597–603 | S7 бой/взгляд | lookAngleCand |
| 270 | `lookAngleCand` | 604–629 | S7 бой/взгляд | lookArbiter |
| 270 | `lookArbiter` | 630–645 | S7 бой/взгляд | lookTick |
| 270 | `landLook` | 652–652 | S6 бот: место/ход; S6 бот: шаг/физика | jumpCheckTick, ladderTick |
| 270 | `jumpLook` | 653–678 | S7 бой/взгляд | lookArbiter |
| 270 | `lookVisible` | 682–685 | S7 бой/взгляд | lookFilter, smoothLookFilter |
| 270 | `lookWallClose` | 689–689 | S7 бой/взгляд | lookFilter, lookKnowPt |
| 270 | `lookFilter` | 690–719 | S7 бой/взгляд | lookTick |
| 270 | `threatEntrances` | 724–739 | S4c контакт; S4e мозг T; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | coverThreats, ctClutch, holdGroup, holdSpot, lookRearThreat, lowHpBack |
| 275 | `lookFace` | 9–9 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | dvPlace, stepTick, throwNadeTry, warmTurn |
| 275 | `lookTurnBy` | 10–10 | — | stepTick, warmTurn |
| 275 | `lookReset` | 11–11 | S2 режимы; E события | resetRound |
| 275 | `lookTick` | 17–92 | S7 бой/взгляд | resolveEngagements |
| 275 | `lookTrack` | 96–100 | S7 бой/взгляд | lookTick |
| 275 | `handQ` | 108–113 | S6 бот: место/ход; S6 бот: шаг/физика; S7 бой/взгляд | handTurn, landLook |
| 275 | `handTurn` | 114–150 | S7 бой/взгляд | handTurn, lookTick |
| 275 | `freezePick` | 156–156 | S1 фриз | buyShowStart, freezeLookTick |
| 275 | `freezeLookTick` | 157–176 | S1 фриз | stepTick |
| 280 | `posWeaponClass` | 11–17 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | posPref, proSnap, wpnKillDist |
| 280 | `wpnKillDist` | 29–30 | S4c контакт; S4e мозг T; S4f мозг CT | contactTick, wpnRangeFit |
| 280 | `wpnRangeFit` | 33–36 | S4e мозг T; S4f мозг CT | holdSpot, posPickName |
| 280 | `posTable` | 37–47 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | posPref, proSnap |
| 280 | `posAt` | 49–56 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | holdSpot, posPairLift, posTick, proSnap |
| 280 | `posPairLift` | 60–71 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | posPref |
| 280 | `posPref` | 72–82 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | holdSpot, posPickName, proSnap |
| 280 | `posHalf` | 83–83 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | posPref, posRoundEnd |
| 280 | `posTick` | 85–93 | S8 восприятие→знание | stepTick |
| 280 | `posRoundEnd` | 95–104 | S4a бомба; S9 конец/сторож; E события | endRound |
| 280 | `posOwnZones` | 112–118 | S4f мозг CT | ctBrain, posNamesOwn, posPickName |
| 280 | `posSideOf` | 123–135 | S2 режимы; S4f мозг CT; S4h лайнапы; S5 гранаты; E события | npZoneAt, npZoneOf, posNamesOwn |
| 280 | `posNamesOwn` | 139–145 | S4f мозг CT | ctBrain, ctSetupRole |
| 280 | `spawnEarlyK` | 152–162 | S4f мозг CT | ctEarlyPeek, posPickName |
| 280 | `posPickName` | 163–186 | S4f мозг CT | ctBrain, ctSetupRole, secondOnSite |
| 280 | `holdCands` | 217–240 | S4e мозг T; S4f мозг CT | holdSpot |
| 280 | `holdSpot` | 242–299 | S4e мозг T; S4f мозг CT | holdGroup |
| 280 | `ppProZone` | 309–314 | S4e мозг T; S8 восприятие→знание | knowPlantShift, ppProGroup |
| 280 | `ppCheckStep` | 320–343 | S4e мозг T | ppProGroup |
| 280 | `ppProGroup` | 344–380 | S4e мозг T | tBrain |
| 280 | `holdGroup` | 381–413 | S4e мозг T; S4f мозг CT | ctClutch, tBrain |
| 290 | `smkKey` | 18–18 | S8 восприятие→знание | smokeHeTick, smokeSpamTick |
| 290 | `smkActive` | 19–19 | S8 восприятие→знание | smokeHeTick, smokeSpamTick |
| 290 | `smokeEnemyPossible` | 24–33 | S8 восприятие→знание | smkEvidence, smokeSpamTick |
| 290 | `smkEvidence` | 34–37 | S8 восприятие→знание | smokeHeTick, smokeSpamTick |
| 290 | `smkEvidence0` | 38–63 | S8 восприятие→знание | smkEvidence |
| 290 | `smokeHoleFlight` | 67–72 | S8 восприятие→знание | blindBullet, smokeSpamTick |
| 290 | `blindBullet` | 74–87 | S8 восприятие→знание | smokeSpamTick |
| 290 | `smokeSpamTick` | 88–178 | S8 восприятие→знание | stepTick |
| 290 | `smokeHeTick` | 183–200 | S8 восприятие→знание | stepTick |
| 290 | `smokeShiftOnDetonate` | 202–216 | S5 гранаты; E события | detonate |
| 300 | `pRole` | 18–18 | S4h лайнапы | nadeRoleCost |
| 300 | `nadeRoleCost` | 20–23 | S4h лайнапы | lineupTick |
| 300 | `tFallbackTick` | 25–57 | S8 восприятие→знание | infoFallbackTick |
| 300 | `rebalTarget` | 63–63 | S8 восприятие→знание | rebalLookOf, rebalSpot |
| 300 | `rebalLookOf` | 64–70 | S8 восприятие→знание | siteRebalanceTick |
| 300 | `rebalSpot` | 71–93 | S8 восприятие→знание | siteRebalanceTick |
| 300 | `siteRebalanceTick` | 94–134 | S8 восприятие→знание | infoFallbackTick |
| 300 | `infoFallbackTick` | 135–181 | S8 восприятие→знание | stepTick |
| 310 | `ppLayer` | 12–17 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | pickSpots, proAt, proLookAt, proZoneShare |
| 310 | `ppGrid` | 18–25 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | proAt, proZoneShare |
| 310 | `proAt` | 27–32 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | holdSpot, pickSpots |
| 310 | `ppZoneCells` | 34–46 | S4f мозг CT | proZoneShare |
| 310 | `proZoneShare` | 48–53 | S4f мозг CT | proPick |
| 310 | `proPick` | 56–63 | S4f мозг CT | posPickName, proRolePost |
| 310 | `proRolePost` | 69–83 | S4f мозг CT | ctBrain |
| 320 | `proLineups` | 10–29 | S1 фриз; S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | allLineups, nadeAskFlash, npHasExecSmoke, proCovers, teamNadePlan |
| 320 | `proRollGroup` | 34–45 | S4h лайнапы | lineupTick |
| 320 | `proGroupDone` | 47–50 | S4h лайнапы | lineupTick |
| 320 | `proCovers` | 54–69 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | builtinAllowed |
| 320 | `flankPost` | 73–107 | S4f мозг CT | ctBrain |
| 320 | `secondOnSite` | 111–128 | S4f мозг CT | ctBrain |
| 320 | `ctEarlyPeek` | 132–212 | S4f мозг CT | ctBrain |
| 320 | `ctClutch` | 220–285 | S4f мозг CT | ctBrain |
| 320 | `midCoverPick` | 287–303 | S4f мозг CT | midCoverPost |
| 320 | `midCoverPost` | 304–328 | S4f мозг CT | ctBrain |
| 320 | `anchorPosOf` | 329–333 | S4f мозг CT | ctBrain |
| 320 | `infoBehind` | 346–352 | S4f мозг CT | ctInfoCheck |
| 320 | `infoPoint` | 356–356 | S4f мозг CT | ctInfoCheck, infoNext |
| 320 | `infoGo` | 357–357 | S4f мозг CT | ctInfoCheck |
| 320 | `infoNext` | 360–373 | S4f мозг CT | ctInfoCheck |
| 320 | `ctInfoCheck` | 374–444 | S4f мозг CT | ctBrain |
| 330 | `egWaitPartner` | 9–26 | S4g эндгейм | endgameBrain |
| 330 | `egCutPoint` | 29–39 | S4g эндгейм | endgameBrain |
| 330 | `endgameBrain` | 41–199 | S4g эндгейм | teamBrains |
| 330 | `segPtDist` | 205–208 | S4i смоки/огонь | lineupHit, smokeEdgeTick, smokeLineWait, zoneShapeMouseDown |
| 330 | `smokePushReason` | 209–230 | S4i смоки/огонь | smokeEdgeTick |
| 330 | `sigFoeDead` | 234–234 | S4i смоки/огонь; S8 восприятие→знание | enemyBeyondSmoke, smkEvidence0 |
| 330 | `enemyBeyondSmoke` | 235–247 | S4i смоки/огонь; S8 восприятие→знание | smkEvidence0, smokeEdgeTick |
| 330 | `smokeEdgeTick` | 248–297 | S4i смоки/огонь | teamBrains |
| 330 | `ctLandPunish` | 303–320 | S4f мозг CT | ctBrain |
| 340 | `ctPlantGuessOnly` | 3–7 | S4f мозг CT | ctBrain |
| 340 | `ctSiteD` | 14–14 | S4c контакт; S4f мозг CT | ambGoalSite, ctHeardToward |
| 340 | `ctHeardToward` | 15–22 | S4f мозг CT | ctBrain, ctUnknownT |
| 340 | `ctUnknownT` | 24–29 | S4f мозг CT | ctBrain |
| 340 | `ctNearSite` | 30–30 | S4d задержка CT; S4f мозг CT; S5 гранаты | ctBrain, nadeRevealOk |
| 340 | `ctBrain` | 32–746 | S4f мозг CT | teamBrains |
| 350 | `contactInfo` | 20–73 | S4c контакт | contactTick |
| 350 | `contactCritical` | 74–82 | S4c контакт | contactTick, hurtReactTick |
| 350 | `spotTaken` | 91–97 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistEdgeSpot, assistPeek, contactTick, ctSetupRole, hurtReactTick, intelDeath |
| 350 | `contactMateFight` | 100–105 | S4c контакт; S4d задержка CT | contactTick, ctDelayNade |
| 350 | `contactTick` | 106–252 | S4c контакт | teamBrains |
| 350 | `delaySafe` | 264–270 | S4d задержка CT; S5 гранаты | ctDelayNade, updateNadeTask1 |
| 350 | `flashSafeFor` | 271–274 | S4d задержка CT | ctDelayNade |
| 350 | `delayCanThrow` | 275–275 | S4d задержка CT | delayTarget |
| 350 | `delayTarget` | 276–308 | S4d задержка CT | ctDelayNade |
| 350 | `ctDelayNade` | 309–333 | S4d задержка CT | teamBrains |
| 350 | `hurtReactTick` | 343–380 | S4c контакт | teamBrains |
| 350 | `teamBrains` | 381–394 | — | stepTick |
| 360 | `recordNadeLand` | 22–30 | S5 гранаты; E события | detonate |
| 360 | `enemyNadeSpots` | 31–31 | S4f мозг CT | ctBrain |
| 360 | `emptyNades` | 36–36 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), applyDamage, buyForPlayer, buyNades, resetNades, startHalf |
| 360 | `nadePrice` | 47–47 | S2 режимы; E события | buyForPlayer, buyFullKit, buyNades, buyShowMoney, teamNadePlan |
| 360 | `buyNades` | 60–90 | S2 режимы; E события | buyForPlayer |
| 360 | `segHitsCircle` | 93–98 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | areaSegHits, oneWaySees, smkEvidence0, smokeBulletHole, smokeShiftOnDetonate, smokeSpamTick |
| 360 | `areaHas` | 104–104 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | draw, fireTouches |
| 360 | `areaSegHits` | 105–105 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | smokeBlocks, smokeHoleParts |
| 360 | `smokeBlocks` | 107–113 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assistEdgeSpot, assistPeek, bulletLineHit, ctDelayNade, fightClearSpot, flashSeen |
| 360 | `smokeBulletHole` | 120–128 | S8 восприятие→знание | smokeHoleFlight |
| 360 | `smokeHolePass` | 130–143 | S7 бой/взгляд | smokeHoleParts |
| 360 | `smokeHoleParts` | 145–152 | S7 бой/взгляд | resolveEngagements |
| 360 | `smokeRadiusNow` | 155–162 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | d3Frame, detonate, draw, miniDraw, nadesTick, oneWaySees |
| 360 | `hasVision` | 163–163 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ctBombPos, ctBrain, ctInfoCheck, detonate, flashSeen, heDodgeTick |
| 360 | `oneWaySees` | 167–184 | S7 бой/взгляд | resolveEngagements |
| 360 | `nadeLandSet` | 191–191 | S2 режимы; E события | freshMatch, memRestore, memStart |
| 360 | `nadeWorldSet` | 192–192 | — | rpWorldDraw |
| 365 | `npZoneAt` | 17–21 | S2 режимы; S4h лайнапы; S5 гранаты; E события | lineupTick, luSpotFor, npPeekReady, teamNadePlan |
| 365 | `npZoneOf` | 24–43 | S2 режимы; S4f мозг CT; E события | ctEarlyPeek, npBought, teamNadePlan |
| 365 | `npMomentOfLineup` | 45–48 | S1 фриз; S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | lineupTick, proLineups |
| 365 | `npRoleZones` | 51–58 | S2 режимы; E события | teamNadePlan |
| 365 | `npMomentNow` | 60–65 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNadeDo, fireSmokeTick, nadeAskFlash, throwNadeTry |
| 365 | `npPick` | 67–72 | S2 режимы; E события | teamNadePlan |
| 365 | `teamNadePlan` | 76–131 | S2 режимы; E события | buyForPlayer, buyFullKit, buyNades |
| 365 | `npHasExecSmoke` | 134–134 | S5 гранаты | nadeBrains |
| 365 | `npPlanned` | 135–135 | S4h лайнапы | proRollGroup |
| 365 | `npOwner` | 136–136 | S4h лайнапы; S5 гранаты | lineupTick, luSpotFor |
| 365 | `npFoeMaybe` | 139–143 | S4h лайнапы | lineupTick |
| 365 | `npPeekReady` | 149–155 | S4h лайнапы | lineupTick |
| 365 | `npRoundStart` | 157–157 | S2 режимы; E события | buyPhase |
| 365 | `npBought` | 159–164 | S2 режимы; E события | buyForPlayer, buyFullKit, buyNades |
| 365 | `npCanUse` | 167–174 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNadeDo, fireSmokeTick, lineupTick, luSpotFor, nadeAskFlash, nadeBrains |
| 365 | `npLuOpen` | 179–185 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | npCanUse |
| 365 | `npWhyNot` | 187–187 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNadeDo |
| 365 | `npUse` | 189–199 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | throwNadeTry |
| 365 | `nadeAskFlash` | 211–244 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание | contactTick, ctEarlyPeek, nadeReact, prePeekDecide, smokeHeTick |
| 366 | `exuCur` | 20–24 | S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | exuEv, exuGate, exuHoldEta, exuScan, exuTaskGone, exuThrown |
| 366 | `exuEv` | 25–29 | S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | exuFail, exuLanded, exuReassign, exuScan, exuThrown, exuTick |
| 366 | `exuCritical` | 31–34 | S4e мозг T | exuScan |
| 366 | `exuIsExec` | 37–37 | S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | exuBackup, exuScan, exuThrown |
| 366 | `exuScan` | 39–59 | S4e мозг T | exuTick |
| 366 | `exuTaskGone` | 61–65 | S5 гранаты | updateNadeTasks |
| 366 | `exuThrown` | 67–72 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | throwNadeTry |
| 366 | `exuLanded` | 74–84 | S5 гранаты; E события | detonate, nadesTick |
| 366 | `exuFail` | 85–89 | S4e мозг T; S5 гранаты; E события | exuLanded, exuTick |
| 366 | `exuBackup` | 91–112 | S4e мозг T | exuReassign, exuScan |
| 366 | `exuNoBackupWhy` | 114–119 | S4e мозг T | exuTick |
| 366 | `exuReassign` | 120–142 | S4e мозг T | exuTick |
| 366 | `exuTick` | 144–163 | S4e мозг T | tBrain |
| 366 | `exuGate` | 166–176 | S4e мозг T | tBrain |
| 366 | `exuHoldEta` | 179–185 | S4e мозг T | tBrain, tFastGo |
| 366 | `smokeLinePending` | 192–199 | S4i смоки/огонь | smokeLineTick |
| 366 | `smokeLineWait` | 200–210 | S4i смоки/огонь | smokeLineTick |
| 366 | `smokeLineTick` | 211–238 | S4i смоки/огонь | teamBrains |
| 366 | `fireSmokeTick` | 243–262 | S4i смоки/огонь | teamBrains |
| 366 | `fireOnSegF` | 263–264 | S4i смоки/огонь | fireSmokeTick |
| 370 | `fireDamageFor` | 1–1 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание | fireCommit |
| 370 | `fireGoneRepath` | 9–19 | S5 гранаты | nadesTick |
| 370 | `fireRepath` | 20–31 | S5 гранаты; E события | detonate |
| 370 | `fireCommit` | 33–48 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание | escapeWallLine, fireSafe, moveSpeedTick, stepBlocked, stepTick |
| 370 | `navArea` | 53–53 | S4a бомба; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | defuseSees, ladderTick, navDropTo, navFollowFloor, navJumpLinked, navLinked2 |
| 370 | `navAtLevel` | 55–63 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | contactTick, heightBlocked, hurtReactTick, levelBlocked, navFollowFloor, throwNadeTry |
| 370 | `navLinked2` | 64–69 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | heightBlocked, offNavStep |
| 370 | `navJumpLinked` | 72–84 | S6 бот: шаг/физика | ladderTick |
| 370 | `navLinked` | 85–85 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | heightBlocked, navLinked2, navOnFloor |
| 370 | `climbPhase` | 89–94 | S6 бот: шаг/физика; S7 бой/взгляд | draw, jumpLook, ladderTick |
| 370 | `jumpFaceWait` | 99–111 | S6 бот: шаг/физика | ladderTick |
| 370 | `laddersBuild` | 122–178 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ladderFor, navCutTall |
| 370 | `ladderFor` | 180–187 | S6 бот: шаг/физика | ladderTick |
| 370 | `navDropTo` | 188–192 | S6 бот: шаг/физика | ladderTick |
| 370 | `ladderTick` | 194–277 | S6 бот: шаг/физика | ladderTick, stepTick |
| 370 | `navPlane` | 281–291 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, navEdgeDz, navFloorZ |
| 370 | `navFloorZ` | 292–292 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, d3FloorNear, lookMovePt, navFollowFloor, navGapsAdd, navOnlyZ |
| 370 | `navStepDz` | 294–294 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, heightBlocked, navEdgeDz, navFollowFloor |
| 370 | `navFloorNear` | 297–307 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, dropOnFloor, escapeWallLine, navNearLevel, navOnFloor, navSegOnLevel |
| 370 | `navNearLevel` | 315–315 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | fightCycleTick, navFloorDist, navOnFloor, offNavStep, strafeKeysTick |
| 370 | `navSegOnLevel` | 319–325 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | laneShift, stepTick |
| 370 | `navNearestZ` | 327–337 | S1 фриз; S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | buildWaypointPath0, zoneIdAt3 |
| 370 | `navOnFloor` | 341–353 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | offNavStep, stepTick |
| 370 | `navNearestFall` | 360–372 | S6 бот: шаг/физика | navFollowFloor |
| 370 | `navFollowFloor` | 377–427 | S6 бот: шаг/физика | stepTick |
| 370 | `navFloorDist` | 430–430 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | offNavStep |
| 370 | `navStepAlongPath` | 432–436 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | offNavStep |
| 370 | `offNavStep` | 437–453 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | probStallWhy, stepBlocked |
| 370 | `navOwnArea` | 456–456 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | heightBlocked, lookKnowPath, navUnlinkBlocked |
| 370 | `heightBlocked` | 457–480 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож | navUnlinkBlocked, probStallWhy, stepBlocked |
| 370 | `floorCover` | 494–501 | S2 режимы; S6 бот: место/ход; E события | floorViewTick |
| 370 | `floorViewTick` | 503–510 | S2 режимы; S6 бот: место/ход; E события | resetRound, sbPlace, stepTick |
| 370 | `navUnlinkBlocked` | 516–528 | S6 бот: шаг/физика | stepTick |
| 370 | `stepWall` | 534–541 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание | stepBlocked |
| 370 | `stepBlocked` | 542–549 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание | fightCycleTick, fightPathFree, fightStrafe, stepTick, strafeKeysTick, updateReload |
| 370 | `fireSafe` | 551–559 | S6 бот: место/ход; S6 бот: шаг/физика | assignNewDestination, updatePost |
| 370 | `fireRadiusNow` | 567–567 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | d3Frame, draw, fireTouches, rpSample |
| 370 | `fireTouches` | 568–568 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | fireOnSegF, fireSmokeTick, inFire, nadesTick |
| 370 | `fireOnSeg` | 570–571 | — | stepTick |
| 370 | `inFire` | 572–575 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | contactTick, escapeWallLine, fightCycleTick, fireCommit, fireOnSeg, fireRepath |
| 370 | `laddersReset` | 577–577 | — | rebuildNav |
| 380 | `nadeTraceFn` | 13–13 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeSolve, nadesTick, throwNadeTry |
| 380 | `nadeSolve` | 22–47 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeGuess, nadeLands, nadeRunPlan, throwNadeTry |
| 380 | `nadeQuant` | 54–54 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeSolve, throwNadeTry |
| 380 | `nadeUtilMul0` | 56–56 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | throwNadeTry |
| 380 | `nadeAimLimit` | 57–61 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeAskFlash, nadeLands, nadeRunPlan, nadeSolve, throwNadeTry |
| 380 | `luAimFor` | 75–80 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeGuess |
| 380 | `nadeBetter` | 82–87 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeGuess |
| 380 | `nadeGuessKey` | 88–88 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeGuess, nadePrecalcTick |
| 380 | `nadeGuess` | 90–103 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadePrecalcTick, throwNadeTry |
| 380 | `nadePrecalcTick` | 112–122 | S1 фриз | stepTick |
| 380 | `nadeBudgetLeft` | 128–128 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeRunPlan, throwNadeTry |
| 380 | `nadeLandFloors` | 135–146 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeSolve |
| 380 | `nadeAimFloors` | 148–152 | S1 фриз; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeSolve |
| 380 | `nadeLands` | 154–157 | S5 гранаты | nadeThrowSpot |
| 380 | `nadeLaneIdx` | 164–169 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeLaneFroms, nadeUsePick |
| 380 | `nadeLaneFroms` | 171–176 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeTallWall, nadeThrowSpot, nadeUsePick |
| 380 | `nadeTallWall` | 179–190 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | throwNadeTry |
| 380 | `nadeCovered` | 192–205 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeTallWall |
| 380 | `nadeReady` | 209–209 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | nadeUseTick, runupTick, throwNadeDo, throwNadeTry, updateNadeTask1 |
| 380 | `throwNadeDo` | 217–225 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | throwNade |
| 380 | `throwNade` | 227–231 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | ctEarlyPeek, nadeAskFlash, nadeBrains, nadeReact, runupTick, updateNadeTask1 |
| 380 | `throwNadeTry` | 232–338 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | throwNadeDo |
| 380 | `smokeCovered` | 339–346 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNadeDo, awpSmokeTick, ctDelayNade, exuTick, lineupTick, nadeBrains |
| 380 | `nadeNoteFail` | 351–355 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | throwNadeTry |
| 380 | `nadeFailedHere` | 356–359 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNadeDo |
| 380 | `nadeSelfWhyNot` | 365–377 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNadeDo |
| 380 | `assignNadeDo` | 378–401 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNade |
| 380 | `nadeRevealOk` | 406–414 | S4d задержка CT; S5 гранаты | ctDelayNade, nadeBrains |
| 380 | `nadeOwnerOf` | 417–417 | S4c контакт; S4e мозг T | contactTick, tProbes |
| 380 | `nadeOwnerOk` | 418–422 | S5 гранаты | updateNadeTask1 |
| 380 | `assignNade` | 424–428 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | awpSmokeTick, contactTick, ctDelayNade, exuReassign, fireSmokeTick, intelDeath |
| 380 | `nadeQueueNext` | 430–440 | S5 гранаты | nadeQueueNext, updateNadeTask1 |
| 380 | `nadeVelTrack` | 445–450 | S5 гранаты | updateNadeTasks |
| 380 | `nadeBotVel` | 451–451 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | runupTick, throwNadeTry, updateNadeTask1 |
| 380 | `updateNadeTasks` | 455–462 | S5 гранаты | stepTick |
| 380 | `runupFor` | 474–474 | S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание; E события | runupTick, throwNadeTry, updateNadeTask1 |
| 380 | `nadeRunPlan` | 482–499 | S5 гранаты | updateNadeTask1 |
| 380 | `runupStart` | 504–516 | S5 гранаты | runupTick |
| 380 | `runupTick` | 517–549 | S5 гранаты | updateNadeTask1 |
| 380 | `updateNadeTask1` | 550–651 | S5 гранаты | updateNadeTasks |
| 380 | `nadeThrowSpot` | 657–673 | S5 гранаты | updateNadeTask1 |
| 390 | `saveLineups` | 6–6 | — | (top), builtinCopy, lineupClick, refreshLineupList |
| 390 | `builtinAllowed` | 10–18 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNadeDo, drawLineups |
| 390 | `allLineups` | 19–19 | S1 фриз; S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | builtinAllowed, drawLineups, lineupTick, nadePrecalcTick, sitePlantOptions |
| 390 | `preExecWalk` | 32–36 | S4h лайнапы | lineupTick |
| 390 | `preExecNow` | 37–41 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4h лайнапы; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | lineupTick, nadeBrains, npMomentNow |
| 390 | `tCrossSmoke` | 48–69 | S4h лайнапы | lineupTick |
| 390 | `tSoloThrower` | 73–91 | S4h лайнапы | lineupTick |
| 390 | `lineupTick` | 93–270 | S4h лайнапы | teamBrains |
| 390 | `luOpenToFoe` | 273–278 | S4h лайнапы | lineupTick |
| 390 | `luBehind` | 291–300 | S4c контакт; S4e мозг T; S4f мозг CT; S4h лайнапы; S5 гранаты; S6 бот: место/ход; S8 восприятие→знание | exuBackup, exuNoBackupWhy, lineupTick, luSpotFor, nadeAskFlash, nadeThrowSpot |
| 390 | `luSpotFor` | 301–310 | S4h лайнапы; S5 гранаты | lineupTick, updateNadeTask1 |
| 390 | `builtinLineups` | 315–333 | S2 режимы; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4i смоки/огонь; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | builtinCopy, drawLineups, proCovers, refreshLineupList |
| 400 | `nadeOnRoof` | 8–16 | S5 гранаты | nadesTick |
| 400 | `nadeOrigin` | 20–36 | S5 гранаты; E события | detonate, nadesTick |
| 400 | `detonate` | 37–107 | S5 гранаты; E события | nadesTick |
| 400 | `armorSoak` | 124–132 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage |
| 400 | `applyDamage` | 134–175 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ambushTick, bulletLineHit, checkRoundEnd, detonate, dvTick, knifeDefuseTick |
| 400 | `flashDirK` | 181–191 | S4d задержка CT; S5 гранаты; E события | detonate, flashSafeFor |
| 400 | `flashSeen` | 192–204 | S4d задержка CT; S5 гранаты; E события | flashDirK |
| 400 | `nadesTick` | 205–240 | S5 гранаты | stepTick |
| 410 | `antiEco` | 4–12 | S2 режимы; S3 после раунда; S4c контакт; S4e мозг T; S4f мозг CT; S4j подбор; S5 гранаты; S7 бой/взгляд; S8 восприятие→знание; E события | roundGoal |
| 410 | `buyReadSee` | 15–34 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelPush |
| 410 | `nadeCombos` | 35–75 | S5 гранаты | nadeBrains |
| 410 | `nadeWorth` | 93–100 | S4h лайнапы; S5 гранаты | lineupTick, selfExitFlash |
| 410 | `selfHyps` | 101–105 | S5 гранаты | selfExitFlash, selfPlantSmoke |
| 410 | `selfPlantSmoke` | 109–124 | S5 гранаты | selfNadeTick |
| 410 | `selfExitFlash` | 125–157 | S5 гранаты | selfNadeTick |
| 410 | `selfNadeTick` | 158–166 | S5 гранаты | nadeBrains |
| 410 | `heDodgeTick` | 181–199 | S5 гранаты | nadeReact |
| 410 | `nadeReact` | 200–272 | S5 гранаты | nadeBrains |
| 410 | `nadeFlagsReset` | 285–285 | S2 режимы; E события | resetNades |
| 410 | `comboCdReset` | 286–286 | S2 режимы; E события | resetNades |
| 410 | `nadeReactReset` | 287–287 | S2 режимы; E события | freshMatch |
| 420 | `nadeUsePick` | 2–8 | S5 гранаты | nadeUseTick |
| 420 | `nadeUseTick` | 9–66 | S5 гранаты | nadeBrains |
| 420 | `nadeBrains` | 67–238 | S5 гранаты | stepTick |
| 420 | `retakeCutUseful` | 241–247 | S4f мозг CT; S5 гранаты | nadeBrains, retakeUtil |
| 420 | `nadeCancel` | 250–250 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage, tSetSite |
| 420 | `resetNades` | 251–255 | S2 режимы; E события | resetRound |
| 430 | `inFov` | 7–14 | S4c контакт; S4e мозг T; S4f мозг CT; S4k LKP; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; E события | beliefTick, knowBombSeen, knowLook, knowSeenByFoe, knowTeamLook, lkpTick |
| 430 | `roamPtLabel` | 18–18 | S6 бот: место/ход | updateRoamer |
| 430 | `updateRoamer` | 19–73 | S6 бот: место/ход | stepTick |
| 435 | `showEv` | 8–8 | S2 режимы; S3 после раунда; S4a бомба; S4c контакт; S4f мозг CT; S4j подбор; S5 гранаты; S6 бот: место/ход; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | bombBeepTick, buyPhase, checkRoundEnd, endRound, feedKill, roundClutchResult |
| 435 | `soundEv` | 9–9 | S3 после раунда; S4a бомба; S4c контакт; S4f мозг CT; S4j подбор; S5 гранаты; S6 бот: место/ход; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | blindBullet, bombBeepTick, bombTick, checkRoundEnd, detonate, itemPickupTick |
| 435 | `voiceKind` | 27–35 | S2 режимы; S4a бомба; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | voiceLog |
| 435 | `voiceFeed` | 37–45 | S2 режимы; S4a бомба; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | intelCallLog, teamChannel |
| 435 | `logEvent` | 47–55 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4d задержка CT; S4e мозг T; S4f мозг CT; S4g эндгейм; S4h лайнапы; S4i смоки/огонь; S4j подбор; S4k LKP; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | (top), afterKillReact, afterTaskPick, applyDamage, awpSwap, bombFleePoint |
| 435 | `killAssist` | 65–72 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | feedKill |
| 435 | `feedKill` | 73–88 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage |
| 435 | `feedBombKill` | 92–96 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage |
| 435 | `feedEvent` | 97–101 | S4a бомба; S9 конец/сторож; E события | bombTick, checkRoundEnd, roundClutchResult |
| 435 | `checkClutch` | 104–116 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | feedKill |
| 435 | `roundClutchResult` | 119–127 | S4a бомба; S9 конец/сторож; E события | endRound |
| 435 | `bombBeepTick` | 133–142 | S5 гранаты | stepTick |
| 440 | `renderVoice` | 6–14 | — | showSync, warmEnd |
| 440 | `toggleConsole` | 15–19 | — | (top) |
| 440 | `logRender` | 26–31 | — | showSync |
| 450 | `tracerClass` | 13–21 | S7 бой/взгляд; S8 восприятие→знание | blindBullet, tryShoot |
| 450 | `bulletVictim` | 31–43 | S7 бой/взгляд; S8 восприятие→знание | bulletLineHit, tryShoot |
| 450 | `bulletLineHit` | 47–55 | S7 бой/взгляд; S8 восприятие→знание | blindBullet, tryShoot |
| 450 | `bulletClip3` | 61–67 | S7 бой/взгляд; S8 восприятие→знание | blindBullet, smokeHoleFlight, smokeSpamTick, tryShoot |
| 450 | `rayClipWalls` | 68–78 | S2 режимы; S3 после раунда; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | bulletClip3, lookCands0, openDirNear, openLook, proSnap, rebalTarget |
| 450 | `dropWeaponOnDeath` | 90–98 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage |
| 450 | `itemPickupTick` | 101–126 | S3 после раунда; S4j подбор | stepTick, teamBrains |
| 450 | `knifeEnemyDist` | 141–151 | S6 бот: место/ход | knifeTick |
| 450 | `knifeDefuseTick` | 156–169 | S6 бот: место/ход | knifeTick |
| 450 | `knifeTick` | 170–184 | S6 бот: место/ход | stepTick |
| 450 | `weaponSpeedMul` | 185–191 | S4c контакт; S4e мозг T; S4h лайнапы; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание | bombFleePoint, duelEval, exuReassign, fightCycleTick, fightStrafe, fireCommit |
| 450 | `weaponValue` | 192–192 | S3 после раунда; S4f мозг CT; S4j подбор | ctBrain, pickValue |
| 450 | `pickValue` | 196–206 | S3 после раунда; S4j подбор | weaponPickupTick |
| 450 | `awpAllowed` | 209–212 | S3 после раунда; S4j подбор | weaponPickupTick |
| 450 | `pickDetour` | 217–225 | S3 после раунда; S4j подбор | weaponPickupTick |
| 450 | `weaponPickupTick` | 226–326 | S3 после раунда; S4j подбор | stepTick, teamBrains |
| 460 | `hearPos` | 6–13 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | dvHearShot, emitSound, moveSoundEmit, tryShoot |
| 460 | `inWater` | 15–19 | S6 бот: шаг/физика | stepTick |
| 460 | `emitSound` | 21–32 | S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание; E события | reloadHeard, updatePost |
| 460 | `reloadHeard` | 35–43 | S6 бот: место/ход; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | fightCycleTick, updateReload |
| 460 | `reloadPeek` | 46–64 | S4l ситуации | teamBrains |
| 460 | `bombPassTick` | 69–90 | S4l ситуации | teamBrains |
| 460 | `finishPush` | 92–120 | S4l ситуации | teamBrains |
| 460 | `smokeFadeTick` | 122–142 | S4l ситуации | teamBrains |
| 460 | `awpSmokeTick` | 145–163 | S4l ситуации | teamBrains |
| 460 | `onBlind` | 169–201 | S5 гранаты; E события | detonate |
| 460 | `pistolSwap` | 203–214 | S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | tryShoot, updateReload |
| 460 | `pistolBack` | 215–222 | S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | updateReload |
| 470 | `peekQ` | 9–13 | S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика | airKeysPlan, fightCycleTick, fightStrafe, jumpCheckTick, strafeKeysTick |
| 470 | `fightPathFree` | 22–26 | S6 бот: перестрелка | fightBetter, fightBetterAway, fightClearSpot, fightCover |
| 470 | `fightMateAt` | 33–33 | S6 бот: перестрелка | fightClearSpot, fightCover |
| 470 | `fightCover` | 34–53 | S6 бот: перестрелка | fightCycleTick |
| 470 | `fightSeen` | 54–54 | S6 бот: перестрелка | fightCover |
| 470 | `fightBetter` | 56–64 | S6 бот: перестрелка | fightCycleTick |
| 470 | `fightBetterAway` | 67–75 | S6 бот: перестрелка | fightCycleTick |
| 470 | `fightClearSpot` | 78–92 | S6 бот: перестрелка | fightCycleTick |
| 470 | `fightShoulderPt` | 94–99 | S6 бот: перестрелка | fightCycleTick |
| 470 | `csDecel` | 113–113 | S6 бот: перестрелка; S6 бот: шаг/физика | csTicksTo, fightCycleTick, fightStrafe, strafeKeysTick |
| 470 | `csTicksTo` | 114–114 | S6 бот: перестрелка | fightStrafe |
| 470 | `fcSwingGo` | 117–119 | S6 бот: перестрелка | stepTick |
| 470 | `fightStrafe` | 120–160 | S6 бот: перестрелка | fightCycleTick |
| 470 | `fightRand` | 161–161 | S6 бот: перестрелка | fightCycleTick, fightStrafe |
| 470 | `duelHits` | 167–167 | S4c контакт; S6 бот: перестрелка | contactTick, duelEval, duelOdds, fightCycleTick |
| 470 | `fightPush` | 173–177 | S6 бот: перестрелка | fightCycleTick |
| 470 | `duelTTK` | 184–193 | S4c контакт; S6 бот: перестрелка | duelBalance |
| 470 | `duelBalance` | 202–213 | S4c контакт; S6 бот: перестрелка | duelEval, duelOdds |
| 470 | `duelOdds` | 217–223 | S4c контакт; S6 бот: перестрелка | contactTick, fightCycleTick |
| 470 | `duelEval` | 224–232 | S6 бот: перестрелка | fightCycleTick |
| 470 | `fcWhy` | 234–234 | S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | fcEnd, fightCycleTick |
| 470 | `fcEnd` | 236–236 | S7 бой/взгляд; S8 восприятие→знание | killMoveCover, resolveEngagements |
| 470 | `fightCycleTick` | 238–382 | S6 бот: перестрелка | stepTick |
| 470 | `pathDanger` | 386–395 | S4f мозг CT | safeRotate |
| 470 | `densify` | 396–396 | S4f мозг CT | safeRotate |
| 470 | `safeRotate` | 397–413 | S4f мозг CT | ctBrain |
| 470 | `ninjaOk` | 417–421 | S4f мозг CT | updateRetake |
| 470 | `exposedTo` | 423–436 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | coverThreats, lowHpBack, updateReload |
| 470 | `spotSeen` | 442–449 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | coverSafe, rlSeen |
| 470 | `coverThreats` | 454–460 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | ambushTick, coverForReload, ctInfoCheck, fightCover, findCover, hurtReactTick |
| 470 | `coverSafe` | 462–462 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | ambushTick, coverPick |
| 470 | `coverPick` | 466–469 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | ambushTick, coverForReload, ctInfoCheck, fightCover, findCover, hurtReactTick |
| 470 | `coverZ` | 470–470 | S4c контакт; S4f мозг CT; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: перестрелка; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; E события | ambushTick, coverForReload, ctInfoCheck, fightCover, findCover, hurtReactTick |
| 470 | `rlSeen` | 471–471 | S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | coverForReload |
| 470 | `coverForReload` | 473–493 | S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | updateReload |
| 470 | `lowHpBack` | 504–585 | S4l ситуации | teamBrains |
| 470 | `STEP_HEAR_R` | 595–595 | S6 бот: место/ход | dangerWalk, moveWalkWhy |
| 470 | `dangerWalk` | 596–657 | S6 бот: место/ход | moveWalkWhy |
| 480 | `flankSpot` | 12–39 | S4g эндгейм; S4l ситуации | endgameBrain, flankAssist |
| 480 | `flankClaim` | 43–48 | S4g эндгейм; S4l ситуации | endgameBrain, flankAssist |
| 480 | `flankAssist` | 49–83 | S4l ситуации | assistPeek |
| 480 | `assistEdgeSpot` | 85–95 | S4c контакт; S4l ситуации | assistPeek, contactTick |
| 480 | `assistPeek` | 96–137 | S4l ситуации | teamBrains |
| 480 | `rlFracOf` | 139–139 | S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | updateReload |
| 480 | `updateReload` | 140–178 | S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание | stepTick, tryShoot |
| 480 | `sprayPat` | 184–190 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 480 | `ambSeenBy` | 204–204 | S4c контакт; S4f мозг CT; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | ambushHoldFire, ambushTick |
| 480 | `ambAt` | 207–207 | S4c контакт; S4f мозг CT | ambushTick |
| 480 | `ambGoalSite` | 209–209 | S4c контакт; S4f мозг CT | ambushTick |
| 480 | `ambFoes` | 210–218 | S4c контакт; S4f мозг CT | ambushTick |
| 480 | `ambPassing` | 221–228 | S4c контакт; S4f мозг CT; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | ambushHoldFire, ambushTick |
| 480 | `ambOn` | 229–229 | S4c контакт; S4f мозг CT; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | ambushHoldFire, ambushTick |
| 480 | `ambushHoldFire` | 231–237 | S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | stepTick, tryShoot |
| 480 | `ambEnd` | 238–238 | S4c контакт; S4f мозг CT | ambushTick |
| 480 | `ambushStartBack` | 242–248 | S4f мозг CT | ctInfoCheck |
| 480 | `ambushTick` | 249–344 | S4c контакт; S4f мозг CT | ambushStartBack, contactTick |
| 490 | `aimSigma` | 13–20 | S4c контакт; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | awpNoscope, duelTTK, fireVAcc, tryShoot |
| 490 | `shotSpread` | 22–23 | S4c контакт; S6 бот: перестрелка; S7 бой/взгляд; S8 восприятие→знание | awpNoscope, duelTTK, fireVAcc, tryShoot |
| 490 | `fireVAcc` | 25–31 | S6 бот: перестрелка | fightStrafe |
| 490 | `awpNoscope` | 37–45 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 490 | `fireReady` | 48–48 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 490 | `saveShootOk` | 54–63 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 490 | `tryShoot` | 66–381 | S7 бой/взгляд; S8 восприятие→знание | resolveEngagements, smokeSpamTick, warmTick |
| 490 | `duelContext` | 388–408 | S7 бой/взгляд | decideAction |
| 495 | `hlHot` | 12–12 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | afterKillMove, contactTick, hlAim, hlContact, hlKill, hlReact |
| 495 | `hlContact` | 14–18 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 495 | `hlKill` | 20–24 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage |
| 495 | `hlReact` | 26–26 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 495 | `hlAim` | 27–27 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 495 | `hlScope` | 28–28 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 500 | `fightStateDo` | 4–4 | S3 после раунда; S4c контакт; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; E события | fightState |
| 500 | `fightState` | 6–9 | S3 после раунда; S4c контакт; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; E события | leaveHold, resolveEngagements, weaponPickupTick |
| 500 | `fightReset` | 13–13 | S2 режимы; E события | resetRound, sbRevive |
| 500 | `fightHoldOff` | 14–14 | S3 после раунда; S4j подбор; S6 бот: место/ход | moveSpeedTick, weaponPickupTick |
| 500 | `decideAction` | 15–172 | S7 бой/взгляд | resolveEngagements |
| 500 | `leaveHold` | 185–185 | S4c контакт; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; E события | afterKillReact, assistPeek, flankAssist, hurtReactTick, killMoveCover, lowHpBack |
| 500 | `postKillDecide` | 188–228 | S7 бой/взгляд; S8 восприятие→знание | afterKillReact |
| 500 | `afterKillMove` | 229–235 | S7 бой/взгляд; S8 восприятие→знание | tryShoot |
| 500 | `killMoveCover` | 240–252 | S7 бой/взгляд; S8 восприятие→знание | afterKillMove |
| 500 | `afterKillReact` | 253–317 | S7 бой/взгляд; S8 восприятие→знание | afterKillMove |
| 500 | `shiftHold` | 320–339 | S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; E события | afterKillReact, exposedShiftTick, smokeShiftOnDetonate |
| 500 | `findCover` | 342–361 | S5 гранаты; S6 бот: шаг/физика; S7 бой/взгляд; E события | assignNewDestination, onBlind, resolveEngagements |
| 500 | `seenRecently` | 362–362 | S7 бой/взгляд | resolveEngagements |
| 510 | `duckDecide` | 5–9 | S7 бой/взгляд | resolveEngagements |
| 510 | `resolveEngagements` | 11–196 | S7 бой/взгляд | stepTick |
| 510 | `escapeWallLine` | 198–213 | S6 бот: шаг/физика | stepTick |
| 510 | `assignNewDestination` | 214–247 | S6 бот: шаг/физика | stepTick |
| 520 | `regRounds` | 13–13 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | endRound, lastOfHalfNow, matchOverWith, otIndex, posHalf, roundResetsGear |
| 520 | `otIndex` | 14–14 | S2 режимы; S4a бомба; S4e мозг T; S4f мозг CT; S9 конец/сторож; E события | endRound, matchOverWith, matchWinTarget |
| 520 | `matchWinTarget` | 15–15 | S2 режимы; S4a бомба; S4e мозг T; S4f мозг CT; S9 конец/сторож; E события | decideRoundType0, matchOverWith |
| 520 | `lastOfHalfNow` | 16–16 | S2 режимы; E события | decideRoundType, decideRoundType0 |
| 520 | `payRoundEconomy` | 39–59 | S4a бомба; S9 конец/сторож; E события | endRound |
| 520 | `sideOk` | 61–61 | S2 режимы; E события | bestPrimary |
| 520 | `rifleFor` | 62–67 | S2 режимы; S4e мозг T; E события | buyForPlayer, buyFullKit, fullNeed, teamDrops |
| 520 | `smgFor` | 70–75 | S2 режимы; E события | buyForPlayer |
| 520 | `proPistol` | 81–85 | S2 режимы; E события | buyForPlayer |
| 520 | `pHash` | 86–86 | S2 режимы; S4e мозг T; E события | buyForPlayer, proPistol, rifleFor, smgFor |
| 520 | `fullNeedU` | 88–88 | S2 режимы; S4e мозг T; E события | decideRoundType0, tSaveWant |
| 520 | `fullNeed` | 89–97 | S2 режимы; S4e мозг T; E события | buyForPlayer, buyFullKit, buyNades, decideRoundType0, fullNeedU, teamAwp |
| 520 | `nextLossIncome` | 98–98 | S2 режимы; S4e мозг T; E события | buyForPlayer, buyFullKit, buyNades, decideRoundType0, tSaveWant |
| 520 | `ecoKnowReset` | 106–106 | S2 режимы; E события | startHalf |
| 520 | `ecoKnowRow` | 107–107 | S2 режимы; S4a бомба; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ecoKnowKill, ecoKnowSeeTick, enemyEcoGuess, payRoundEconomy |
| 520 | `ecoKnowSeeTick` | 108–112 | S8 восприятие→знание | stepTick |
| 520 | `ecoKnowKill` | 113–113 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage |
| 520 | `enemyEcoGuess` | 114–121 | S2 режимы; E события | decideRoundType |
| 520 | `heroOf` | 128–128 | S2 режимы; S3 после раунда; S4c контакт; S4e мозг T; S4f мозг CT; S4j подбор; S5 гранаты; S7 бой/взгляд; S8 восприятие→знание; E события | contactTick, roundGoal |
| 520 | `roundGoal` | 129–137 | S2 режимы; S3 после раунда; S4c контакт; S4e мозг T; S4f мозг CT; S4j подбор; S5 гранаты; S7 бой/взгляд; S8 восприятие→знание; E события | afterKillReact, chooseCtSetup, contactTick, ctEarlyPeek, decideAction, nadeCombos |
| 520 | `decideRoundType` | 138–151 | S2 режимы; E события | buyPhase |
| 520 | `decideRoundType0` | 153–196 | S2 режимы; E события | decideRoundType |
| 520 | `canSell` | 203–208 | S2 режимы; S3 после раунда; S4j подбор; E события | sellItem |
| 520 | `sellItem` | 209–215 | S2 режимы; S3 после раунда; S4j подбор; E события | buyItem, weaponPickupTick |
| 520 | `buyItem` | 216–228 | S2 режимы; E события | buyForPlayer, buyFullKit |
| 520 | `armorHpOf` | 233–233 | S2 режимы; S4e мозг T; E события | buyArmor, buyFullKit, fullNeed |
| 520 | `buyArmor` | 234–238 | S2 режимы; E события | buyForPlayer, buyFullKit |
| 520 | `helmetWanted` | 242–248 | S2 режимы; E события | buyForPlayer |
| 520 | `buyFullKit` | 253–307 | S2 режимы; E события | buyForPlayer |
| 520 | `bestPrimary` | 309–320 | S2 режимы; E события | buyForPlayer, buyFullKit |
| 520 | `buyForPlayer` | 323–384 | S2 режимы; E события | buyPhase |
| 520 | `awpSwap` | 391–400 | S2 режимы; E события | buyPhase |
| 520 | `teamDrops` | 401–416 | S2 режимы; E события | buyPhase |
| 520 | `teamAwp` | 425–438 | S2 режимы; E события | buyPhase |
| 530 | `buyPhase` | 1–22 | S2 режимы; E события | (top), resetRound |
| 530 | `startHalf` | 24–32 | S2 режимы; E события | newMatch, resetRound |
| 530 | `roundResetsGear` | 38–38 | S2 режимы; S4e мозг T; S4f мозг CT; E события | resetRound, saveWorth |
| 530 | `matchOverWith` | 40–45 | S4a бомба; S4e мозг T; S4f мозг CT; S9 конец/сторож; E события | endRound, saveWorth, timeoutCheck |
| 530 | `saveWorth` | 48–51 | S4e мозг T; S4f мозг CT | ctBrain, tSaveWant |
| 530 | `sideSwapNow` | 52–56 | S2 режимы; S4a бомба; S9 конец/сторож; E события | endRound, resetRound, timeoutCheck |
| 530 | `swapSides` | 57–76 | S2 режимы; E события | resetRound |
| 530 | `freshMatch` | 80–104 | S2 режимы; E события | (top), dvStart, rpGoto, warmEnd, warmStart |
| 530 | `newMatch` | 105–115 | S2 режимы; E события | freshMatch, stepTick |
| 530 | `checkRoundEnd` | 117–140 | S9 конец/сторож | stepTick |
| 530 | `endRound` | 141–169 | S4a бомба; S9 конец/сторож; E события | bombTick, checkRoundEnd |
| 530 | `resetRound` | 171–228 | S2 режимы; E события | (top), newMatch, sbToggle, stepTick |
| 530 | `roundSetState` | 230–230 | — | (top), stepTick |
| 530 | `roundSetStart` | 231–231 | — | (top) |
| 530 | `simTimeSet` | 232–232 | — | stepTick |
| 530 | `freezeFxReset` | 233–233 | — | stepTick |
| 535 | `moveWaitPop` | 21–21 | S2 режимы; S4c контакт; S4e мозг T; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | ctEarlyPeek, intelDeath, nadeAskFlash, nadeReact, saveCancelTrades, throwNadeTry |
| 535 | `movePath` | 22–22 | S2 режимы; S3 после раунда; S4a бомба; S4b маршрут; S4c контакт; S4e мозг T; S4f мозг CT; S4g эндгейм; S4i смоки/огонь; S4j подбор; S4l ситуации; S5 гранаты; S6 бот: место/ход; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | assignNewDestination, bombTick, buildRoamRoutes, clearPostDo, escapeWallLine, fireGoneRepath |
| 535 | `moveSpeed` | 23–23 | S2 режимы; S6 бот: перестрелка; E события | dvPlace, fightStrafe, resetRound, sbPlace, warmTick |
| 535 | `moveWalk` | 24–24 | S2 режимы; S6 бот: перестрелка; E события | fightCycleTick, fightStrafe, resetRound |
| 535 | `moveWalkWhy` | 25–76 | S6 бот: место/ход | moveWalkTick |
| 535 | `moveRunWhy` | 78–99 | S6 бот: место/ход | moveWalkTick |
| 535 | `moveWalkTick` | 101–110 | S6 бот: место/ход | stepTick |
| 535 | `moveSpeedTick` | 113–191 | S6 бот: место/ход | stepTick |
| 540 | `clockPause` | 11–11 | S2 режимы; E события | (top), dvStart, dvTick, freshMatch, rpGoto, rpJump |
| 540 | `clockSet` | 12–12 | S2 режимы; E события | freshMatch, rpWorldDraw, warmTick |
| 540 | `clockAcc` | 13–13 | — | frameBody, rpWorldDraw |
| 540 | `clockFrameDt` | 14–14 | — | frameBody |
| 540 | `moveSoundEmit` | 25–41 | S2 режимы; S4c контакт; S4f мозг CT; S5 гранаты; S6 бот: место/ход; S6 бот: шаг/физика; S7 бой/взгляд; S8 восприятие→знание; S9 конец/сторож; E события | applyDamage, landSound, stepTick |
| 540 | `defuseWalk` | 45–51 | S6 бот: место/ход | moveWalkWhy |
| 540 | `navSnap` | 55–67 | S6 бот: шаг/физика | stepTick |
| 540 | `landSound` | 73–80 | S6 бот: место/ход; S6 бот: шаг/физика | boostEnd, jumpCheckTick, ladderTick, navFollowFloor |
| 540 | `boostLift` | 96–96 | S7 бой/взгляд; S8 восприятие→знание | resolveEngagements, tryShoot |
| 540 | `boostEnd` | 97–101 | S6 бот: место/ход | boostEnd, jumpCheckTick |
| 540 | `airKeysPlan` | 119–126 | S6 бот: место/ход | jumpCheckTick |
| 540 | `airKey` | 127–127 | — |  |
| 540 | `pathTurnAhead` | 128–133 | S6 бот: место/ход | jumpCheckTick |
| 540 | `pathAheadDir` | 138–147 | — | stepTick |
| 540 | `jumpCheckTick` | 148–216 | S6 бот: место/ход | stepTick |
| 540 | `keysRand` | 229–229 | S6 бот: шаг/физика; S7 бой/взгляд | duckDecide, strafeKeysTick |
| 540 | `strafeKeysTick` | 230–270 | S6 бот: шаг/физика | stepTick |
| 540 | `stepTick` | 276–715 | — | dvStart, frameBody, rpGoto |
| 545 | `probReset` | 20–20 | S9 конец/сторож | probTick |
| 545 | `probEvent` | 21–25 | S9 конец/сторож | probTick |
| 545 | `probStallWhy` | 26–38 | S9 конец/сторож | probTick |
| 545 | `probTick` | 39–88 | S9 конец/сторож | stepTick |
| 677 | `sbTick` | 14–22 | S2 режимы | stepTick |
| 677 | `sbOrderPoint` | 26–32 | — | (top) |
| 677 | `sbPlace` | 34–40 | — | (top), sbRevive |
| 677 | `sbRevive` | 41–46 | — | (top) |
| 677 | `sbRemove` | 47–47 | — | sbPanel |
| 677 | `sbEsc` | 49–49 | S2 режимы | dvRender, sbLogic, sbRender |
| 677 | `sbPanel` | 50–71 | — | sbRender |
| 677 | `sbLogic` | 73–90 | — | sbRender |
| 677 | `sbRender` | 91–105 | — | (top), sbPanel, sbToggle |
| 677 | `sbToggle` | 106–119 | — | (top) |
| 677 | `sbPick` | 121–125 | — | (top) |
| 678 | `dvRounds` | 11–11 | S2 режимы | (top), dvRender, dvStart |
| 678 | `dvAt` | 12–15 | S2 режимы | dvDiff, dvDraw, dvPlace |
| 678 | `dvStart` | 17–35 | S2 режимы | dvPanel |
| 678 | `dvStop` | 36–36 | S2 режимы | dvPanel, dvToggle |
| 678 | `dvTick` | 38–50 | S2 режимы | stepTick |
| 678 | `dvPlace` | 51–53 | S2 режимы | dvStart, dvTick |
| 678 | `dvHearShot` | 55–58 | S2 режимы | dvTick |
| 678 | `dvDiff` | 60–65 | S2 режимы | dvDraw, dvRender |
| 678 | `dvDraw` | 67–80 | — | draw |
| 678 | `dvPanel` | 82–88 | S2 режимы | dvRender |
| 678 | `dvRender` | 89–103 | S2 режимы | (top), dvStart, dvStop, dvTick, dvToggle |
| 678 | `dvToggle` | 104–104 | — | (top) |
