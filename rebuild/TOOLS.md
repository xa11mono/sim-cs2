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
| отметки владельца | `tools/mark_open.js`, `tools/mark_story.js`, `tools/mark_frames.js`, `tools/replay_owner.js` | `docs/tasks/02-mark-moment.md` |
| прогоны на ПК | `tools/measure/request.json` в ветке `measure/v580a` → `pc-results/<N>` | `CLAUDE.md` §8 |
| форма движения / взгляда | `tools/motion_shape.py`, `tools/measure/motion/` | В147 |
| покрытие входов T расстановками CT | `tools/ct_cover_pro.py`, `tools/ct_cover.js`, `tools/ct_setup_shot.py` | задел фазы 4 |
| отпечаток на ПК (с 15.11; облако матчи не гоняет) | `"fp"` в `tools/measure/request.json` (`remote_run.py`) | `{"par": 8, "fp": [{"label": "v582a_fp_mir", "ref": "<коммит>", "map": "mirage"}]}` в ветке `measure/…` → `pc-results/<N>/<метка>/fp_<m>.json.gz`; сравнить метки — `diff` распакованных |
