# Тестовая матрица (что чем проверено)

Сборка: `python3 src/build.py --map mirage <файл>`. Снимки отметок — база страницы Mirage (https://claude.ai/artifact/EBaRN7xYH1QXzC1iiTNZ4x,
коллекция `marks`, поля `snapAsset` / `preSnapAsset`; скачать — Artifact read с `path` = id ассета). Матчи на 8 сидах — только на ПК
владельца (`tools/measure/request.json` → ветка `measure/<имя>`).

## Проверки

| Проверка | Команда | Что доказывает |
|---|---|---|
| Отпечаток «игра не изменилась» | `bash tools/measure/fingerprint.sh sim.html <папка>`; `diff -r база правка` | бит в бит по 8 матчам Mirage (3,7,11,13,17,19,23,29) |
| Повтор после перемотки | `node src/q.js sim.html @tools/tests/replay_rewind.js` | `ok:true`: фраги до начала записи не попадают в новую запись; мультикилл без кадров не показывается; в полной записи 2к — клипом |
| Повтор на отметке п.18 | `node tools/mark_open.js sim.html <снимок 1f3ae65d…> "$(cat tools/tests/replay_mark.js)"` | что попадает в очередь показа конца раунда 4 и как показывается |
| Прострел дыма п.15 | `node tools/mark_open.js sim.html <preSnap de6d54de…> "var SPAM_N=1300; $(cat tools/tests/smoke_spam_mark.js)"` | кто и с какого тика простреливает дым |
| Здоровье кода | `python3 tools/health.py sim.html` | счётчики устройства |

## Результаты

| Дата | Версия | Проверка | База (v469, f7d72a0) | Правка | Вывод |
|---|---|---|---|---|---|
