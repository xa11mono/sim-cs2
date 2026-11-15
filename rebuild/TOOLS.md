# Инструменты этапа (уже есть в репозитории)

| задача | инструмент | как |
|---|---|---|
| игра не изменилась (бит в бит) | `tools/measure/fingerprint.sh`, `tools/measure/fingerprint.js` | `bash tools/measure/fingerprint.sh sim.html <папка>` до и после → `diff -r` пусто |
| собрать игру | `src/build.py` (тестовая `sim.html`), `src/mkpub.py` (страница) | `python3 src/build.py --map mirage <out.html>` |
| мёртвый код | `tools/measure/code_cov.js` | `node tools/measure/code_cov.js sim.html out.json <раундов>` — функции и число вызовов (медленно: ~1 ч на 20 раундов) |
| кто меняет поле | `tools/measure/engine/walk_watch.js` (сейчас — путь `path`) | расширить на остальные поля (фаза 2) |
| проблемы в матче | `src/game/545_problem_watch.js` (`PROB`: застрял, перенос, перетягивание), сторож замера `rec2.js` | в каждой записи матча (`watch`) |
| сравнить прогон с базой | `tools/measure/check.py --base=…`, `tools/measure/noise.py`, `tools/measure/replay_cmp.py` | `CLAUDE.md` §8 |
| разбор взгляда | `LOOKDBG`, `lookDbgPanel` (610), `_ldArb` | галочка «разбор взгляда» на странице |
| журнал решений | `src/game/645_decision_log.js` (`dlog`) | последние 15 с решений бота |
| отметки владельца | `tools/marks/mark_open.js`, `tools/marks/mark_story.js`, `tools/marks/mark_frames.js`, `tools/marks/replay_owner.js` | `docs/tasks/02-mark-moment.md` |
| прогоны на ПК | `tools/measure/request.json` в ветке `measure/v580a` → `pc-results/<N>` | `CLAUDE.md` §8 |
| форма движения / взгляда | `tools/motion/motion_shape.py`, `tools/measure/motion/` | В147 |
| покрытие входов T расстановками CT | `tools/ct/ct_cover_pro.py`, `tools/ct/ct_cover.js`, `tools/ct/ct_setup_shot.py` | задел фазы 4 |
| отпечаток на ПК (с 15.11; облако матчи не гоняет) | `"fp"` в `tools/measure/request.json` (`remote_run.py`) | `{"par": 8, "fp": [{"label": "v582a_fp_mir", "ref": "<коммит>", "map": "mirage"}]}` в ветке `measure/…` → `pc-results/<N>/<метка>/fp_<m>.json.gz`; сравнить метки — `diff` распакованных |
| мёртвый код на ПК (с 15.11) | `"cov"` в `request.json` → `code_cov.js` по матчу на процесс | `{"cov": [{"label": "…_cov_mir", "ref": "<коммит>", "map": "mirage"}]}` → `cov_<m>.json`: функция, сколько раз вызвана; мёртвая — 0 во всех матчах обеих карт (+ ручная проверка: показ, кнопки, редакторы headless не вызываются) |
| счётчики прогона «было / стало» (с 15.11) | `tools/measure/counters.py` | `python3 tools/measure/counters.py <метка> --base=<метка> [--md=файл]` → застревания, переносы, перетягивание, опасность, смерти к 20 с, длина раунда, планты, раунды T, гранаты, фраги; 🔴 / 🟢 — сдвиг больше шума 8 матчей, ⚪ — шум |
| сравнить отпечатки (с 15.11) | `tools/measure/fp_cmp.py` | `python3 tools/measure/fp_cmp.py <база> <метка>` — по содержимому, первый расходящийся раунд |
