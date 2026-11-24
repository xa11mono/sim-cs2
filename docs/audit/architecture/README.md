# Аудит архитектуры, упаковки и загрузки (v598, 24.11.2026)

**Задача.** Ответить на вопросы владельца об устройстве проекта: почему страницы такие большие и из чего они состоят;
как устроена сборка и что в ней скрыто; где лежат ресурсы карт и как их хранить; сколько стоит загрузка, память и кадр;
какие варианты устройства возможны дальше. **Рабочая игра не менялась**: ни `src/`, ни `data/`, ни `tools/`, ни
поведение ботов — только чтение, измерения и документы.

**Состояние.** Аудит закончен. В папке: 6 отчётов + этот README, 8 инструментов, 10 файлов сырых результатов.
Все числа получены на опубликованных `ancient-radar.html` (15 828 676 Б) и `mirage-radar.html` (9 434 168 Б) этого
состояния (страницы собраны 24.11 в 21:51) и на исходниках `src/`, `data/`. Числа воспроизводятся командами из
раздела «Как воспроизвести». Решения по архитектуре — за владельцем (`RECOMMENDATIONS.md` §4).

## 1. Отчёты: что читать и в каком порядке

| документ | о чём | главное |
|---|---|---|
| [`RECOMMENDATIONS.md`](RECOMMENDATIONS.md) | итог: что сохранить, что менять, что удалить, чего ждать по байтам и времени | вариант B (общий движок + пакеты карт) — ближайший шаг; игра не меняется |
| [`HTML_SIZE_AUDIT.md`](HTML_SIZE_AUDIT.md) | точный состав страниц по областям и по полям `MAP` | 72 % Ancient — геометрия `map3d`; общая часть двух карт — 4,35 МБ |
| [`BUILD_PIPELINE.md`](BUILD_PIPELINE.md) | цепочка «исходники → страница», скрытые зависимости, что мешает TS/Rust | сборка воспроизводима (±подпись версии); порядок задают имена файлов, а не импорты |
| [`RESOURCE_ARCHITECTURE.md`](RESOURCE_ARCHITECTURE.md) | как хранить и грузить ресурсы: движок, данные карт, звуки, фото, шрифты | пакет карты без движка ≈ 8,9 МБ Ancient / 3,3 МБ Mirage вместо 11,4 / 5,0 МБ |
| [`LOADING_PERFORMANCE.md`](LOADING_PERFORMANCE.md) | старт, фазы, профиль CPU, память, FPS, 3D | готовность 1,01 / 0,85 с; дороже всего навмеш и таблица прострелов (0,67 / 0,47 с), а не размер файла |
| [`DEPLOYMENT_OPTIONS.md`](DEPLOYMENT_OPTIONS.md) | варианты A–F: автономный HTML, общий движок, единый вход, TS + Rust Native/WASM, два хоста | A сохранить, B — ближайший, C после B, Rust — точечно и после замеров в игре |

Быстрый вход: `RECOMMENDATIONS.md` §1–2 (что сохранить / что менять) → `HTML_SIZE_AUDIT.md` §1 (откуда байты) →
`LOADING_PERFORMANCE.md` §8 (что реально стоит времени) → `DEPLOYMENT_OPTIONS.md` §0 (сводка A–F).

## 2. Что измерено — коротко

| вопрос | ответ | где |
|---|---|---|
| размер страниц | 15,83 МБ Ancient / 9,43 МБ Mirage; gzip 10,27 / 4,75 МБ, brotli 10,14 / 4,61 МБ | `HTML_SIZE_AUDIT.md` §1 |
| из чего Ancient | `map3d` 9,82 МБ (62 %), звуки 1,71 МБ (11 %), движок 1,98 МБ (12,5 %), карта/тактики ~1,6 МБ | `HTML_SIZE_AUDIT.md` §1–2 |
| общая часть двух страниц | движок 2,04 МБ + звуки 1,71 МБ + CSS и шрифты 0,61 МБ = **4,35 МБ** на каждую карту | `HTML_SIZE_AUDIT.md` §5 |
| цена base64 | текст на 33 % больше сжатого бинарного: `map3d` 9,82 МБ вместо 7,36 МБ; плюс `atob`/`dec` | `HTML_SIZE_AUDIT.md` §3–4 |
| старт | 1,01 с (Ancient) / 0,85 с (Mirage) холодный; 0,82 / 0,57 с повторный (медианы 3 прогонов) | `LOADING_PERFORMANCE.md` §2 |
| на что уходит старт | навмеш 444 / 218 мс + таблица прострелов 226 / 248 мс; литерал `MAP` 4–8 мс | `LOADING_PERFORMANCE.md` §3 |
| память страницы | 136,7 МБ Ancient / 79,8 МБ Mirage; 3D добавляет 100 / 64 МБ | `LOADING_PERFORMANCE.md` §5 |
| кадр | 199–200 FPS в 2D и 3D (потолок монитора 200 Гц), длинных задач нет | `LOADING_PERFORMANCE.md` §6 |
| сборка | воспроизводима: 9 438 322 Б против 9 434 168 Б, разница — подпись версии | `BUILD_PIPELINE.md` §1 |
| бенчмарк ядер | Rust Native 1,57 мс против JS 2,93 мс на 1200 лучей; WASM 1,80 мс, но +188 МБ памяти | `DEPLOYMENT_OPTIONS.md` §D–E |

## 3. Как воспроизвести

Нужны: Python 3.10, Node 24, Playwright с Chromium (для загрузки — **headed**, настоящий GPU), страницы
`ancient-radar.html` и `mirage-radar.html` в корне репозитория. Замеры кадров имеют смысл только на 200-Гц мониторе.

| инструмент | команда | что делает | результат |
|---|---|---|---|
| `html_inventory.js` | `node docs/audit/architecture/instruments/html_inventory.js ancient-radar.html --json docs/audit/architecture/results/html_composition_ancient.json` | состав страницы в байтах по областям и полям `MAP`, zlib-блоки, gzip/brotli | `results/html_composition_*.json` |
| `engine_dupe.js` | `node docs/audit/architecture/instruments/engine_dupe.js ancient-radar.html mirage-radar.html --json docs/audit/architecture/results/engine_dupe.json` | что в двух страницах общее бит в бит, что своё | `results/engine_dupe.json` |
| `map_usage.js` | `node docs/audit/architecture/instruments/map_usage.js mirage-radar.html --json docs/audit/architecture/results/map_usage_mirage.json` | прямые ссылки `MAP.<поле>` в коде игры | `results/map_usage_*.json` |
| `map_keys.js` | `node docs/audit/architecture/instruments/map_keys.js ancient-radar.html` | ключи `MAP` и их размеры (печатает таблицу) | консоль; те же числа — в `html_composition_*` |
| `load_probe.py` | `python docs/audit/architecture/instruments/load_probe.py --map ancient --runs 3 --headed` | измерительная копия страницы (только `performance.mark`), локальный сервер, старт/фазы/профиль/память/FPS 2D и 3D | `results/load_raw_*.json`; копии — `.tmp/probe/` |
| `mem_probe.py` | `python docs/audit/architecture/instruments/mem_probe.py --map ancient --headed` | память по фазам: `performance.measureUserAgentSpecificMemory`, JS-heap, приватная память Chrome | `results/memory_*.json` |
| `summarize.py` | `python docs/audit/architecture/instruments/summarize.py` | медианы по прогонам и сводка из `load_raw_*` + `memory_*` | `results/load_summary.json` |
| `nav_timing.py` | `python docs/audit/architecture/instruments/nav_timing.py --map ancient` | точечно: сколько занимает сам вызов `rebuildNav` (проверка метки 408,8 мс) | консоль |

`load_probe.py` кладёт измерительные копии в `.tmp/probe/`; страницы и игру он не меняет. `summarize.py` запускать
после обоих `load_probe` и обоих `mem_probe`. Бенчмарк ядер (`bench/stage3`) — отдельный набор, его команды —
`bench/stage3/README.md`; в этом аудите он **не повторялся**, взяты готовые результаты.

## 4. Файлы результатов

| файл | откуда | что внутри |
|---|---|---|
| `engine_dupe.json` | `engine_dupe.js` | движок/MAP/звуки/CSS/разметка двух страниц, совпадение и хэши |
| `html_composition_ancient.json`, `..._mirage.json` | `html_inventory.js` | байты по областям, все поля `MAP`, base64-картинки, zlib-блоки `map3d`, gzip/brotli |
| `map_usage_ancient.json`, `..._mirage.json` | `map_usage.js` | поле → число прямых ссылок `MAP.x`, `MAP["x"]`, слово; байты |
| `load_raw_ancient.json`, `..._mirage.json` | `load_probe.py` | 3 холодных + 3 повторных прогона: навигационные метки, фазы, профиль CPU, кадры, память, плюс контрольный прогон без вставок |
| `memory_ancient.json`, `..._mirage.json` | `mem_probe.py` | память по фазам с разбивкой UA-memory по типам |
| `load_summary.json` | `summarize.py` | медианы и диапазоны по обоим файлам выше + память по фазам |

## 5. Полнота и ограничения (честно)

- **Каждое число в отчётах имеет файл-источник**, кроме двух проверок, которые печатают только в консоль:
  `nav_timing.py` (408,8 мс внутри `rebuildNav`) и `map_keys.js` (те же размеры полей есть в `html_composition_*`).
  Контрольный прогон без вставок (1,04 / 0,84 с) лежит внутри `load_raw_*` (поле `control`).
- **Одна машина:** Ryzen 7 7800X3D, 16,75 ГБ, RTX 3070, Windows 10, Chromium 156 headed, 1400×900. Другое железо
  даст другие абсолютные числа (особенно 3D и приватную память Chrome).
- **3 прогона на карту**, взяты медианы; первый прогон каждой карты холоднее (прогрев браузера/ФС) — в отчёте
  показан и он.
- **Повторный запуск — не «нулевой кэш»:** браузер отдаёт полный размер передачи, ускорение даёт кэш кода V8 и ФС,
  а не HTTP-кэш; отдельно HTTP-кэш не измерялся.
- **Компиляция JS не отделена от разбора HTML** (`s0` включает и то, и другое); «parse+compile» в отчёте — верхняя
  граница.
- **FPS 199–200 — потолок монитора 200 Гц**, а не предел игры. 3D в headless (SwiftShader) не показателен; все
  цифры 3D — headed с настоящей видеокартой.
- **Единицы:** «МБ» — десятичные (10^6 Б), как в браузере и в отчётах; проценты — от размера файла.
- **Не проверено:** как выглядит отложенная загрузка шрифтов/фото (это решение владельца, нужны скриншоты до/после);
  память нескольких карт в одном процессе; интеграция с CS2 Manager (контракта нет — `RECOMMENDATIONS.md` §4).

## 6. Связь с другими документами

| документ | отношение |
|---|---|
| [`../SYSTEM_DEPENDENCIES.md`](../SYSTEM_DEPENDENCIES.md) | карта зависимостей систем v586 — **как системы связаны**, а не упаковка; дополняет `BUILD_PIPELINE.md` §8 |
| [`../parts/`](../parts/) | аудит механик v586 (контракт и сгенерированные карты `rebuild/gen`) |
| [`bench/stage3/README.md`](../../../bench/stage3/README.md) | бенчмарк ядер на реальных данных карт, сверка с движком по каждому лучу и броску |
| [`docs/reports/stage3_2026-11-24/`](../../reports/stage3_2026-11-24/) | отчёт этапа 3: рендер, память, потоки, риски, защита от регрессий |
| `rebuild/PLAN.md` | генеральный план перестройки; место каждого изменения — `RECOMMENDATIONS.md` §5 |
| [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) | действующее устройство игры (каналы, хозяева, данные карты) |

## 7. Что не менялось

Аудит **не менял** `src/`, `data/`, `tools/`, страницы не пересобирались, поведение ботов и вид не затрагивались.
Поэтому отпечаток матчей и прогоны не нужны: это чтение и документы. Единственное исключение — `bench/stage3/results/
rust_wasm_ancient.json` перезаписан повторным прогоном того же бенчмарка; числа в `DEPLOYMENT_OPTIONS.md` взяты из
этого файла (1,802 мс на лучах, 24,3 мс на маршрутах, инстанциация 0,43 мс, память 188 МБ).
