# sim-cs2 — симулятор раундов CS2 (Ancient, Mirage)

Радар-симуляция 5×5 с ботами, сверка поведения с демками про.

- `ancient-radar.html`, `mirage-radar.html` — опубликованные сборки (открыть в браузере).
- `src/game/NNN_*.js` — исходник игры по модулям (карта файлов — `CLAUDE.md`, «Где что»); `src/build.py` собирает `sim.html` для
  замеров, `src/mkpub.py --map <карта>` — публикуемую страницу; `src/marks.js` — отметки владельца.
- `data/maps/<карта>/` — всё про карту (навмеш, стены, высоты, зоны, тактики, лайнапы, места про); `data/demos/` — выгрузки демок про.
- `tools/measure/` — замер матчей и сравнение с про (`measure.py`, `check.py`, `situations.py`); `tools/` — разбор демок и сборка карты.
- С чего начать: `CLAUDE.md` (правила), `docs/ROADMAP.md` (где остановились и что дальше), `docs/PROBLEMS.md` (основные проблемы),
  `docs/ARCHITECTURE.md` (устройство), `docs/DECISIONS.md` (журнал, старое — `docs/archive/`), `docs/PRINCIPLES.md` (замечания владельца).
