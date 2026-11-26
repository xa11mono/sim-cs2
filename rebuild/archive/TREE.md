# Дерево проекта после фазы 0 (15.11.2026, ветка v582a)

```
sim-cs2/
├── 00_PLAN.md            план: ПЛАН (открытое) + ДОРОЖНАЯ КАРТА; сделанное — docs/archive/00_PLAN_done_до_15.11.md
├── CHANGELOG.md          версии, правила, страницы
├── CLAUDE.md             правила работы
├── DESIGN.md             оформление страницы
├── README.md
├── ancient-radar.html    собранные страницы (владелец 15.11: оставить в репозитории)
├── mirage-radar.html
├── rebuild/              перестройка: README, PLAN, RULES, PROGRESS (журнал), FACTS, TOOLS, OPEN_QUESTIONS,
│                         TREE (этот файл), bal_removed.md (убранные BAL), deleted_phase0.txt (что удалено)
├── src/                  игра
│   ├── game/NNN_*.js     исходник по модулям (склейка — gamesrc.py)
│   ├── build.py          тестовая сборка sim.html     mkpub.py — страница      mapset.py — набор карты в сборку
│   ├── marks.js          отметки владельца            q.js — выполнить код в игре без экрана
│   └── data/ fonts/
├── data/
│   ├── maps/<карта>/     всё про карту (навмеш, 3D, стены, зоны, тактики, лайнапы, подбор бросков…)
│   ├── demos/            демки про          pro/ — выжимки демок          sounds/
├── docs/
│   ├── ARCHITECTURE.md   устройство (без истории)      PRINCIPLES.md, PRO_PLAY.md, PRO_DECISIONS.md, DECISIONS.md,
│   │                     BRAIN.md, ECONOMY.md, DESIGN_SOURCES.md
│   ├── tasks/            02-mark-moment.md (правила — `docs/rules/`), ответы и вопросы владельца, действующие задания (18)
│   ├── reports/          отчёты, на которые ссылаются код и доки (≈ 70 файлов)
│   ├── diagrams/         3 схемы
│   └── archive/          история (не открывать без нужды)
└── tools/                оглавление — tools/README.md
    ├── mapdir.py demos.py health.py     общие модули
    ├── map/      набор карты: map_build.py, *_bake.py (данные карты из демок), *_shot.js (проверка глазами)
    ├── ct/       расстановки CT (задел фазы 4)
    ├── pro/      разбор демок про и сравнение с ботами
    ├── marks/    отметки и снимки: mark_open.js, mark_story.js, mark_frames.js, replay_owner.js, snap_round.js
    ├── logs/     журналы раунда        motion/ — форма движения (В147)        page/ — шрифты, снимки вида
    ├── measure/  замеры и ПК: remote_run.py (сторож), fingerprint.*, code_cov.js, check.py, pc_fetch.sh, audit/, engine/
    ├── nades/    гранаты (guess_bake.py — подбор бросков)    map3d/  shadow/  diag/  tests/  rebuild/
```

| | было (15.11 утро) | стало |
|---|---|---|
| файлов в git | 4 157 | 3 450 |
| `docs/` | 327 файлов, 37 МБ | 124 файла, 11 МБ |
| `tools/` (без results) | 402, в корне 114 | 342 по 14 папкам, в корне 4 + оглавление |
| `tools/measure/results` | 528 файлов, 42 МБ | 81 файл, 6,8 МБ |
| `00_PLAN.md` | 1 114 строк | ≈ 560 строк |
