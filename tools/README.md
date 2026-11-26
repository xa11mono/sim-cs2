# Инструменты (`tools/`)

Разложены по группам 15.11 (перестройка, фаза 0). В корне — общие модули: `mapdir.py` (папки карт, `tool(имя)` — путь к скрипту
в его группе), `demos.py` (чтение демок), `health.py` (здоровье кода). Строка у скрипта — из его шапки. Модули групп видят друг друга
(строка `sys.path[:0] = …` в начале скрипта).

## `map/` — набор карты: сборка `map_build.py`, данные карты из демок (`*_bake.py`), проверки глазами (`*_shot.js`)

- `alone_bake.py` — Смерть до планта: был ли свой ближе 350 ед. карты (как метрика «смерть до планта: рядом был свой») — по 92 демкам
- `awp_bake.py` — В142 (13.11.2026): как часто у стороны есть AWP — по демкам про, по стороне и типу закупа → <карта>/pro.json, поле awpBy (игра: MAP.pro.awpBy,
- `boosts_bake.py` — (v575, В144, владелец 14.11: «почему подсадки нет? мало, но должно быть») Подсадки про: <pro_dir>/boosts.json → pro.json, поле boosts.
- `climbs_bake.py` — Подъёмы из демок (v372): где про забираются на уступ, который навмеш даёт только спрыгнуть (ящики, выступы — прыжок
- `contact_bake.py` — Что делает про в первом контакте, один или с тиммейтом (v250, пункт 1 разбора).
- `corners_shot.js` — Снимок радара с показом углов в заданный момент (для отчёта «до / после»).
- `cover_bake.py` — Высота укрытий: walls.json + navmesh.json набора карты → cover.json набора (data/maps/<карта>/).
- `cover_shot.js` — Картинки слоя «укрытия» для владельца (docs/tasks/img/cover/).
- `defpos_bake.py` — (v443) где стоят T в фазе дефолта — из демок про: data/maps/<карта>/defaultpos.json → MAP.defaultpos.
- `demos_bake.py` — Всё из демок про для набора карты (v318): шаг demos в tools/map_build.py.
- `duel_bake.py` — Как быстро убивают (v251): по 92 демкам Ancient, до планта.
- `gaps_bake.py` — Прыжки через щель из демок (v546, владелец 10.11, Mirage A: «залезает на первый ящик, на второй и прыгает на верхний этаж — так
- `heights_bake.py` — Высоты и этажи карты: navmesh.json набора (+ радары) → heights.json набора (data/maps/<карта>/).
- `heights_shot.js` — Картинки слоя «высоты» для владельца (docs/tasks/img/heights/).
- `jumps_bake.py` — Места прыжка-чека про (v334, М58): <pro_dir>/jumps.json → pro.json, поле jumps.
- `lane_look_bake.py` — Взгляд про на местах полос дефолта T (v224): для каждого места spots в setups.json → t[].default.lanes
- `los_eval.js` — Видимость пар точек той же функцией, что в игре (hasLOS → visLine, 3D по высотам карты; дым не учитывается).
- `map_build.py` — Сборка набора карты из исходных файлов (v318, этап 2 из 3 подготовки к 7 картам).
- `map_pull.py` — Забрать правку карты владельца из базы страницы в код.
- `map_shot.js` — (v318) Несколько раундов на карте и снимок всей карты на 35-й секунде каждого раунда — проверка нового набора карты глазами.
- `nade_lanes_bake.py` — Откуда про кидают гранаты и куда они падают (v373): все броски из демок карты — пары «место бросающего → место разрыва»
- `nadeplan_bake.py` — (v428) Доли гранат про по моменту раунда и зоне карты — для командного плана гранат (engine/nades/plan.js).
- `nav36.py` — Разбор навмеша CS2 (.nav, версии 30–36) — перенос на Python из awpy.
- `peek_bake.py` — Как про выглядывают и перестреливаются (v250, пик по данным). Один код для демок и для ботов.
- `plants_bake.py` — Места планта про (v381, М135, владелец 16.10: «бомба ставится на укрытии»): <pro_dir>/plants.json → pro.json, поле plants.
- `player_positions_bake.py` — Кто из про где стоит и с чем (v246, пункт 4 владельца).
- `positions_bake.py` — Позиции и Setup'ы для Ancient из демок про → src/data/positions.json, src/data/setups.json.
- `positions_shot.py` — Картинки для проверки глазами: позиции и Setup'ы на радаре.
- `postplant_bake.py` — Пост-плант T из демок про: где T стоят после планта на каждом сайте и куда смотрят.
- `progrid_bake.py` — Сетки «где стоят и куда смотрят про» для игры (v318: --map, формат v166 — MAP.pro.prior / look / spots).
- `roles_bake.py` — Роли наших игроков на карте — по демкам этой карты (v321, М21): <pro_dir>/player_roles.json → tactics.json, playerRoles.
- `sounds_bake.py` — Звуки страницы (v329, М46; v331 — новый пак): data/sounds/src/*.wav → data/sounds/sounds.json (MP3 моно 22 кГц, base64).
- `spawns_bake.py` — Точки спавна из демок (v321, М19): где стоят игроки в конце freeze time → map.json набора, поле spawnSpots.
- `tactics_bake.py` — Тактики про по демкам карты (v254, 11.10; v318 — --map и тактики для игры): из чего составлены выходы T и
- `trade_bake.py` — Размены у про (v248, пункт 1 разбора): по player_death 92 демок Ancient.
- `tzone_bake.py` — Дефолт T по зонам (v225, правки владельца 2 и 7) — из 88 демок Ancient (раунды с плантом, до планта):
- `vis_bake.py` — Встречи «видят друг друга» у про и у ботов (v251): одна и та же проверка видимости из игры (hasLOS, 3D; дым не учитывается).
- `vis_shot.js` — Картинки проверки «кто кого видит» (docs/tasks/img/vis/): известные места Ancient.
- `wallbang_bake.py` — Прострелы Ancient: правила CS2 + разметка карты → src/data/wallbang.json.
- `wallbang_shot.js` — Картинки слоя «прострелы» для владельца (docs/tasks/img/wallbang/).
- `zone_props_bake.py` — Свойства зон для тактик на любой карте (v561, этап 1 docs/tasks/PLAN_TACTICS_V2.md; что и зачем — docs/reports/MAP_ZONE_PROPS.md).
- `zones_bake.py` — Зоны карты — нарезка навмеша по подписям радара (v318): navmesh.json + callouts рецепта → zones.json набора.

## `ct/` — расстановки CT: позиции и углы ролей, покрытие входов T (задел фазы 4)

- `ct_cmp.py` — Защита сайта CT и экономика — про против ботов (v252, замер). Один классификатор для демок и ботов.
- `ct_cover.js` — Расстановки CT: какие входы T закрыты взглядом — у про (демки) и у наших расстановок (владелец 15.11: «точки в паре, чтобы смотрели все
- `ct_cover_pro.py` — Расстановки CT у про — кто где стоит и куда смотрит к AT-й секунде раунда (владелец 15.11: «точки в паре, чтобы смотрели все зоны,
- `ct_look_bake.py` — Куда смотрят CT, стоя на точке (v228, правка владельца 6 / В17): для каждой CT-точки positions.json — направления,
- `ct_look_check.js` — (v421) Проверка взглядов расстановок CT набора карты (MAP.tactics.ctSetups) — той же логикой, что в игре (ct-setup.js:
- `ct_lookpt_add.py` — (v417, М153) Добавить в расстановки CT набора карты (tactics.json → ctSetups[].roles[].lookPt) точку, куда смотрят про — то же, что
- `ct_setup_bake.py` — Доли расстановок CT по закупу — из демок про (v561, этап 6 docs/tasks/PLAN_TACTICS_V2.md; владелец 11.11: «доли расстановок — по закупу, из демок»).
- `ct_setup_pos_bake.py` — Места ролей расстановок CT — из демок про (В142, 14.11.2026; владелец: «пока не дойдёшь до похожих цифр — не заканчивать»).
- `ct_setup_shot.py` — Картинки расстановок CT для владельца (15.11): радар, где стоят CT-боты на 20-й секунде и куда смотрят (черта), входы T (зелёный — его
- `ct_setup_spots_bake.py` — Места ролей расстановок CT — точками из демок про (владелец 15.11: «по демкам, где обычно стоят; точки в паре, чтобы смотрели все зоны,
- `ct_tpath_add.py` — В142 (13.11.2026, владелец «да»): места CT на пути T — в расстановки. tools/map/tactics_bake.py (v319) не берёт в роли CT позиции на пути T
- `defA_pro.py` — Дефолт A у про (владелец 15.11: «дефолт A полностью: под разные расстановки — стак, один, двое на A; по демкам, куда летят гранаты,

## `pro/` — разбор демок про и сравнение с ботами: сэмплы, лайнапы, тактики, экономика, выгрузка событий на ПК

- `analyze.py` — 
- `bomb_dmg.py` — Урон взрыва бомбы у про (v271): по каждому взрыву — HP игроков до и через 1,5–2,5 с после, расстояние до бомбы.
- `buy_pro.py` — Что покупают про (v271): оружие в руках за первые 30 с раунда по 92 демкам Ancient.
- `check_demo_events.py` — Этап 4 аудита: проверка выгрузки демок для разбора перестрелок и флешек (до любых выводов по ним).
- `cluster.py` — Лайнапы про: <pro_dir>/pro_nades.csv (tools/pro/lineups.py) → <pro_dir>/pro_lineups.json (у Ancient pro_dir — data/pro).
- `demo_events_pc.py` — (Б4) Выгрузка из демок про всех выстрелов со скоростью и попаданий — на ПК владельца (демки только там). Игру не меняет.
- `demo_events_request.json` — 
- `eco_est.py` — Оценка денег команды по раундам — одинаково для демок про и записей ботов (v252, 11.10).
- `eco_play.py` — Как T играют раунд по типу закупа (v556, В76): 92 демки Ancient. Тип — по оружию T в первые 30 с (ct_cmp.rtype; эко с одной
- `lineups.py` — Гранаты про из демок → <pro_dir>/pro_nades.csv (+ nade_ctx.json); у Ancient pro_dir — data/pro.
- `nade_walls_pro.py` — Сквозь какую толщину стены кидают про (v373): от места бросающего (за время полёта до разрыва) до точки разрыва — самый длинный
- `nades_pro.py` — Сколько гранат про бросают за раунд (v357): по демкам карты, на команду, по стороне и типу закупа.
- `onset.py` — p,q: (N,2) arrays -> bool visible
- `parse_demos.py` — 
- `pro.py` — Сэмплы про из демок: где стоят и куда смотрят → <pro_dir>/pro_samples.csv.gz (v318: --map, раунды — tools/demos.py).
- `pro_tactics.py` — Тактики T, расстановки CT, клатчи, пост-плант — по демкам про (v561, 11.11.2026; определения — docs/PRO_PLAY.md §6з).
- `regions.py` — 
- `roles.py` — 
- `route_nades.py` — Г1 (21.10): гранаты по маршрутам выхода T — эталон из демок про и та же таблица у ботов.
- `timeout_demos.py` — (v460) Тайм-ауты в демках про: в демках нет события паузы, но пауза удлиняет закупку — промежуток «конец раунда → конец
- `tvd.py` — key zones

## `marks/` — отметки владельца и снимки раундов: открыть снимок, история до отметки, раскадровка, повтор; снимки для ПК

- `clutch_replay_shot.js` — (v459) Проверка повтора клатча глазами: матч перематывается до нужного раунда, раунд проигрывается тиками с записью для повтора
- `mark_frames.js` — (v407б, владелец 22.10: «при отметке — скриншоты последних секунд со всеми галочками») раскадровка отметки: по снимку «до»
- `mark_open.js` — Открыть отметку владельца из её снимка (без перепроигрывания матча).
- `mark_story.js` — (v401, владелец 22.10) Разбор отметки по истории: что было до момента, что перебило, почему взгляд и веса зон такие.
- `replay_owner.js` — Повтор матча так, как он шёл у владельца в браузере (v254, 11.10).
- `snap_round.js` — (v462) Снимок игры на закупке раунда — для мгновенного перехода (кнопки «Инструменты»): матч считается тиками до закупки раунда,
- `timeout_shot.js` — (v460) Проверка показа тактической паузы глазами: матч перематывается тиками до закупки раунда <раунд> (пауза перед ним —

## `logs/` — журналы раунда для разбора: знание, ретейк, войс, команда

- `know_log.js` — Лог знания ботов о врагах (09_knowledge.js) по тикам одного тестового раунда.
- `know_log.py` — Читаемая таблица из лога знания ботов (tools/logs/know_log.js).
- `retake_log.js` — Ретейк CT (08_retake.js, шаг 8) на одном тестовом раунде с плантом.
- `retake_log.py` — Лог ретейка CT по результату tools/logs/retake_log.js и вердикт.
- `script_log.js` — Исполнитель сценариев (12_script_runner.js, шаг 7) на одном тестовом раунде T-execute.
- `script_log.py` — Читает вывод tools/logs/script_log.js: лог шагов по времени, разрывы в мире, итог проверки.
- `team_log.js` — Войс команды (12_team.js) на одном тестовом раунде.
- `team_log.py` — Читаемый отчёт по войсу (tools/logs/team_log.js): фразы, дубли, «знание только из войса».

## `motion/` — форма движения и взгляда (В147): мерка, сравнение с про, страница сравнения

- `jumps_pro.py` — Прыжки про в демках карты: сколько, где (бой / перемещение), куда (вперёд, назад, вбок) и стрейф в воздухе. Прыжок — по высоте: за ~0,25 с
- `motion_bots_cloud.js.txt` — 
- `motion_compare_page.py` — В147, шаг 3: страница «демка рядом с ботом» — глазами сравнить форму движения точки и конуса (владелец: «визуально точь-в-точь»).
- `motion_compare_tpl.html` — 
- `motion_ctx.py` — В140: в каких ситуациях про качаются A ↔ D и как делают контрстрейф (выгрузка каждого тика, <демка>_motion.csv.gz).
- `motion_pro.py` — В140: модель движения про по выгрузке каждого тика (<демка>_motion.csv.gz, tools/pro/demo_events_pc.py, режим motion). Считает:
- `motion_shape.py` — В147 (14.11.2026, владелец: «проценты близко — разница в ВИЗУАЛЕ»): форма движения точки и конуса — одна мерка для про и ботов.
- `movement_cmp.py` — Движение про и ботов одной меркой (снимки раз в 16 тиков = 0,25 с, живые, от конца закупки до конца раунда): доля времени стоит / шагом /

## `page/` — страница: шрифты внутри, снимки вида; одноразовая нарезка игры на модули (v377)

- `broadcast_shot.js` — (DESIGN.md, 30.10) Снимки трансляции по моментам матча — проверка вида глазами (Better Design, раздел 8: «проверять отрисованное»).
- `embed_fonts.py` — Шрифты страницы — внутри HTML (v430). Без Google Fonts: страница выглядит одинаково и в артефакте, и открытая
- `split_game.py` — (v377, одноразовый) Разрезать монолит src/game.html на модули src/game/NNN_имя.(html|js).

## `measure/` — замеры и прогоны на ПК: сторож `remote_run.py`, отпечаток, покрытие, `check.py`, аудит

55 файлов (+ подпапки). `alone.py`, `anomaly.py`, `bg.sh`, `buy_cmp.py`, `check.py`, `code_cov.js`, `combine.py`, `compare_runs.py`, `contact.py`, `crowd.py`, `ct_react.js`, `death_company.py`, `duel.py`, `duels.py`, `exec_sync.js`, `exec_sync_report.py`, `extra.py`, `fingerprint.js`, `fingerprint.sh`, `fire.js`, `frame_prof.js`, `frame_rep.py`, `front_bake.py`, `look.py`, `lookdet.py`, `measure.py`, `mech.py`, `metrics.py`, `movement.py`, `nades.py`, `noise.py`, `owner_pack.py`, `peek.py`, `plan_bake.py`, `plant_outcomes.py`, `pos.py`, `pos_repeat.py`, `pro.json`, `pro_checks.py`, `pro_spots_ct.json` …

## `nades/` — гранаты: подбор бросков `guess_bake.py`, разбег, полёты

19 файлов (+ подпапки). `aim_scatter_pro.py`, `check.js`, `draw_time_pro.py`, `flight_shot.js`, `guess_bake.py`, `lineup_flights.js`, `lineup_levels_pro.py`, `lineups_fit.js`, `lineups_rec.py`, `luaim_bake.js`, `match_nade_acc.py`, `pos_scatter_pro.py`, `report.py`, `runup_bake.js`, `smoke_long.js`, `smoke_on_fire_pro.py`, `smoke_time.js`, `throws.py`, `world.js`

## `map3d/` — 3D-геометрия карты

18 файлов (+ подпапки). `columns.py`, `known_strings.json`, `kv3.py`, `layer_pics.py`, `layers.py`, `los_check.py`, `los_columns.py`, `los_pics.py`, `map3d.js`, `map3d_check.js`, `raycast.py`, `route.py`, `vpk.py`, `vpk_entities.py`, `vpk_physics.py`, `wallbang_demo.py`, `zones_game.py`, `zones_owner.py`

## `shadow/` — демки «рядом с ботом»: планы, роли, сравнения раундов

31 файлов (+ подпапки). `bake_demorounds.py`, `compare.py`, `export_round.py`, `find_rounds.py`, `know_cmp.py`, `lurk_cmp.py`, `plans_bots_v570b16_mir.json`, `plans_bots_v578a_mir.json`, `plans_bots_v579a2_16.json`, `plans_bots_v579a2_mir.json`, `plans_bots_v579a_16.json`, `plans_bots_v579a_mir.json`, `plans_bots_v580a2_16.json`, `plans_bots_v580a3_16.json`, `plans_bots_v580a4_16.json`, `plans_bots_v580a_16.json`, `plans_mirage.json`, `roles_cmp.py`, `roles_pro_mirage.json`, `roles_pro_rounds_mirage.json`, `round_furia-vs-falcons-m1-mirage_26.json`, `round_furia-vs-vitality-m1-mirage_17.json`, `round_plan.py`, `round_spirit-vs-mouz-m2-mirage_18.json`, `rounds_mirage.json`, `see_pro.js`, `see_pro_mirage.json`, `shadow.js`, `shadow_spirit-vs-mouz-m2-mirage_18.json`, `shape_pro_ancient.json`, `shape_pro_mirage.json`

## `diag/` — разовые разборы

7 файлов (+ подпапки). `audit.js`, `eh.js`, `eh2.js`, `layout.js`, `mf.js`, `pp.js`, `shot.js`

## `tests/` — тесты механик

13 файлов (+ подпапки). `exu_reassign_test.js`, `face_shooter_mark.js`, `look_reasons_mark.js`, `nade_launch_state_test.js`, `nade_physics_test.js`, `nade_solve_perf.js`, `nade_task_mark.js`, `post_timeline_mark.js`, `recall_posts_mark.js`, `replay_mark.js`, `replay_rewind.js`, `runup_test.js`, `smoke_spam_mark.js`

## `rebuild/` — инструменты перестройки (`bal_fold.js`)

1 файлов (+ подпапки). `bal_fold.js`

## Инструменты перестройки (перенесено дословно из `tools/README.md`, 26.11, Р4.6)

| задача | инструмент | как |
|---|---|---|
| игра не изменилась (бит в бит) | `tools/measure/fingerprint.sh`, `tools/measure/fingerprint.js` | `bash tools/measure/fingerprint.sh sim.html <папка>` до и после → `diff -r` пусто |
| собрать игру | `src/build.py` (тестовая `sim.html`), `src/mkpub.py` (страница) | `python3 src/build.py --map mirage <out.html>` |
| мёртвый код | `tools/measure/code_cov.js` | `node tools/measure/code_cov.js sim.html out.json <раундов>` — функции и число вызовов (медленно: ~1 ч на 20 раундов) |
| кто меняет поле | `tools/measure/engine/walk_watch.js` (сейчас — путь `path`) | расширить на остальные поля (фаза 2) |
| проблемы в матче | `engine/debug/problem-watch.js` (`PROB`: застрял, перенос, перетягивание), сторож замера `rec2.js` | в каждой записи матча (`watch`) |
| сравнить прогон с базой | `tools/measure/check.py --base=…`, `tools/measure/noise.py`, `tools/measure/replay_cmp.py` | `CLAUDE.md` §8 |
| разбор взгляда | `LOOKDBG`, `lookDbgPanel` (610), `_ldArb` | галочка «разбор взгляда» на странице |
| журнал решений | `engine/debug/trace.js` (`dlog`) | последние 15 с решений бота |
| отметки владельца | `tools/marks/mark_open.js`, `tools/marks/mark_story.js`, `tools/marks/mark_frames.js`, `tools/marks/replay_owner.js` | `docs/tasks/02-mark-moment.md` |
| прогоны на ПК | `tools/measure/request.json` в ветке `measure/v580a` → `pc-results/<N>` | `CLAUDE.md` §8 |
| форма движения / взгляда | `tools/motion/motion_shape.py`, `tools/measure/motion/` | В147 |
| покрытие входов T расстановками CT | `tools/ct/ct_cover_pro.py`, `tools/ct/ct_cover.js`, `tools/ct/ct_setup_shot.py` | задел фазы 4 |
| отпечаток на ПК (с 15.11; облако матчи не гоняет) | `"fp"` в `tools/measure/request.json` (`remote_run.py`) | `{"par": 8, "fp": [{"label": "v582a_fp_mir", "ref": "<коммит>", "map": "mirage"}]}` в ветке `measure/…` → `pc-results/<N>/<метка>/fp_<m>.json.gz`; сравнить метки — `diff` распакованных |
| мёртвый код на ПК (с 15.11) | `"cov"` в `request.json` → `code_cov.js` по матчу на процесс | `{"cov": [{"label": "…_cov_mir", "ref": "<коммит>", "map": "mirage"}]}` → `cov_<m>.json`: функция, сколько раз вызвана; мёртвая — 0 во всех матчах обеих карт (+ ручная проверка: показ, кнопки, редакторы headless не вызываются) |
| счётчики прогона «было / стало» (с 15.11) | `tools/measure/counters.py` | `python3 tools/measure/counters.py <метка> --base=<метка> [--md=файл]` → застревания, переносы, перетягивание, опасность, смерти к 20 с, длина раунда, планты, раунды T, гранаты, фраги; 🔴 / 🟢 — сдвиг больше шума 8 матчей, ⚪ — шум |
| сравнить отпечатки (с 15.11) | `tools/measure/fp_cmp.py` | `python3 tools/measure/fp_cmp.py <база> <метка>` — по содержимому, первый расходящийся раунд |
| проверки по отметкам «да / нет» (с 15.11) | `tools/marks/scenarios.js`, список `rebuild/scenarios.json` | `node tools/marks/scenarios.js [--map=mirage]` — снимок отметки (`tools/marks/snaps/<id>.json`) + вопрос словами владельца + проверка в игре → таблица да / нет, ✗ — не совпало с ожидаемым |
| живая карта «кто пишет поля» (с 15.11) | `tools/rebuild/fw_map.js` → `rebuild/gen/fields_live.md` | `node tools/rebuild/fw_map.js <страница той же сборки> <папка fw_*.json.gz> […]` — по записям ловца `field_watch.js` с ПК (`"fields": true`), безымянные кадры стека → имя функции по строке страницы |
| проверка владения полей (с 15.11) | `rebuild/owners.json` (хозяева и `enforce`), `tools/rebuild/gen_maps.js --check`, вызывается из `src/build.py` | до переноса канала — предупреждения; `enforce: true` — сборка падает; нет node / acorn — пропуск с надписью |
| граф зависимостей и запрет «симуляция не трогает показ» (с 15.11) | `tools/rebuild/gen_maps.js` → `rebuild/gen/deps.md`; в `--check` (сборка) — предупреждения | разрешённые отметки показа — `_show_marks` в `rebuild/owners.json` |
