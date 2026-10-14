# Mirage — исходные данные (от владельца, 14.10)
- `de_mirage.txt` — координаты радара (pos_x -3230, pos_y 1713, scale 5).
- `de_mirage.nav` — навмеш CS2, версия 36. Формат — по разбору awpy: https://github.com/pnxenopoulos/awpy, `crates/awpy/src/nav.rs`.
- `de_mirage_radar.png` — радар 1024×1024 (из `de_mirage_radar_psd.vtex_c`: формат BGRA8888, данные с байта 2048, сжатие LZ4 block).
- `demos/` — 86 про-матчей, тот же формат экспорта, что `data/demos` (Ancient).
