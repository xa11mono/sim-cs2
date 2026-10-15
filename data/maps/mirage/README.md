# Mirage — исходные данные (от владельца, 14.10)
- `de_mirage.txt` — координаты радара (pos_x -3230, pos_y 1713, scale 5).
- `de_mirage.nav` — навмеш CS2, версия 36. Формат — по разбору awpy: https://github.com/pnxenopoulos/awpy, `crates/awpy/src/nav.rs`.
- `de_mirage_radar.png` — радар 1024×1024 (из `de_mirage_radar_psd.vtex_c`: формат BGRA8888, данные с байта 2048, сжатие LZ4 block).
- `demos/` — 86 про-матчей, тот же формат экспорта, что `data/demos` (Ancient).
- `de_mirage_simpleradar.dds` — радар Simple Radar с подписями позиций (от владельца, 15.10; https://readtldr.gg/simpleradar):
  названия зон и «крыто сверху» (штриховка).

Набор карты (`map.json`, `radar.png`, `navmesh.json`, `walls.json`, `heights.json`, `cover.json`, `zones.json`, `wallbang.json`,
`pro.json`, `lineups.json`, `tactics.json`) собирает `python3 tools/map_build.py mirage` по рецепту `_build.json`; промежуточное
из демок — `pro/` (сэмплы `pro_samples.csv.gz` в git не кладутся — пересобираются за ~1,5 мин); спорные зоны — `_zones_report.json`.
