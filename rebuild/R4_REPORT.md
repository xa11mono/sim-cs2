# Отчёт этапа Р4 — структура без числовых префиксов (26.11.2026; принят по Э1, кроме слияния документов Р4.6 — вопрос 15)

Ветки: `v619a` Р4.1 · `v620a` Р4.2а · `v621a` Р4.2б · `v622a` Р4.3 · `v623a` / `v624a` / `v625a` / `v626a` Р4.4 · `v627a` Р4.6 шаг 1.

| шаг | что | проверка |
|---|---|---|
| Р4.1 | порядок загрузки — список `rebuild/files.json` (`src/gamesrc.py` `order()`, `tools/rebuild/game_src.js`) | сборка та же; файл не из списка — сборка стоит |
| Р4.2а | описание файла в списке: `id`, `part` (page / math / infra / decide / engine / watch / show), `sys`, `dir`, `mode`; инструменты (gen_maps, truth_reads, dmath, state_classes, mapset, mod_build, bal_fold) — через помощники, не через номер в имени | сборка, карты устройства, реестр состояния (классы), хэш гранат — те же |
| Р4.2б | 91 файл `src/game/NNN_*` → `engine/<система>/…`, `view/…` (`tools/rebuild/r4_rename.py`, карта `rebuild/r4_map.json` по Codex; отступления: `lineup-editor.js`, `look-debug.js`); таблица `rebuild/R4_RENAME.md` | сборка та же, кроме сгенерированных имён `__mi_*`, путей модулей, версии подбора гранат (подбор тот же), `MK_BUILD`; локатор 0; Э1 329 = 16/16 |
| Р4.3 | артефакт сборки — `dist/sim.html` | инструменты по умолчанию — оттуда |
| Р4.4 | брейны: `brain-t` → + `brain-t-phases`, `brain-t-postplant`; `brain-ct` → + `brain-ct-players`; `look` → + `look-arbiter`; `paths` → + `path-search`; `view3d` → + `view3d-frame`; `replay` → + `replay-play` (`tools/rebuild/split_file.py`, склейка байт в байт); `stepTick` → `stepBot`; `draw` → 8 частей | склейка — байт в байт; `stepBot` — локатор 0; `draw` — кадр холста попиксельно тот же (`tools/page/frame_hash.js`, `evidence/R4/draw_split_frames.json`); Э1 330 = 16/16 |
| Р4.5 | файл игры с числовым префиксом — ошибка сборки | проба |
| Р4.6 | шаг 1: `tools/rebuild/doc_links.js` (в `sim.js check`) — 0 битых ссылок в действующих документах (было 129); «Где что» — в `docs/ARCHITECTURE.md` (AGENTS 63 → 48,7 КБ); `rebuild/R4_6_DOCS.md` | слияние дублей правил / планов / устройства — вопрос 15 |

Не сделано: деление модулей esbuild `throw.js` (677 строк), `fight.js` (657) — меняет модульную сборку, отдельно; комментарии «(110)» в коде игры —
по таблице `R4_RENAME.md` (замена неоднозначна); `tools/dmath/check.js` в облаке не работает и до Р4 (нет эталонной сборки Rust).
