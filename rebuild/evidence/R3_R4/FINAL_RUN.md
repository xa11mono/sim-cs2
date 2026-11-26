# Окончательная приёмка Р3 и Р4

**Приёмка открыта до проверки результатов прогона 335.** База работы — v637a. Изменения v638a в приёмочную сборку не входят. Действует [таблица критериев](../../R3_R4_COMPLETENESS.md).

## Владение состоянием

| Классификация на v637a | Полей | Результат |
|---|---:|---|
| Несколько активных файлов | 49 | Одна пишущая функция на поле, текущие вызовы обращаются к владельцу в прежнем порядке |
| Один активный писатель или файл без `enforce` | 58 | Включена проверка сборкой, физический писатель ровно один |
| Поля под действующим контрактом | 8 | Прежний контракт действует |
| Производное состояние показа | 7 | Прежняя классификация |
| Одноимённое поле другого объекта | 7 | Прежняя классификация |
| Границы раунда или режимы | 1 | Прежняя классификация |

[Итог по каждому полю](ownership_acceptance.csv) · [Исходная сверка v637a](multi_writer_review.csv) · [Реестр владельцев](../../owners.json).

В каждом новом контракте `writer` указывает одну функцию из `ownerFile`. Сборочная проверка считает физические записи и отклоняет обход, в том числе прямую запись с другим именем объекта, вычисляемый ключ из константы, запись во вложенный объект и изменение коллекции. Граница `matchBegin` восстанавливает точный набор ключей снимка до живого тика. При показе повтора принадлежащие каналам поля проходят через их интерфейсы. Одноимённые записи в объектах дыма, карты, интерфейса и других структурах зафиксированы точными местами в [реестре совпадений](../../field_ownership_collisions.json).

[107 полей и отрицательные пробы](ownership-probes.json) · [пробы вложенных записей и дубля](alias-guard-probes.json) · [локатор Ancient и Mirage](ownership_locator.json) · [пробы владельца знания](knowledge_owner_probes.json).

## Данные прогона 334

| Результат | Ancient | Mirage | Использование |
|---|---:|---:|---|
| Отпечатки Chromium со следом | 8 | 8 | Совпали с эталоном Р2, используются для независимого сравнения с 335 |
| Полные записи Р3.6 | 0 | 0 | В 334 отчёт читался после сброса `PROB` при смене матча |
| Пригодные секции `danger` | 6 | 0 | Сверка событий на матчах 3, 7, 11, 13, 17 и 19 |

Для восстановления 334 дополнительных действий на ПК не требуется. Архив проверен по запросу, SHA-256 записей, сторожам, номерам матчей и версии окружения. В 334 шаг публикации завершился кодом 1, точная причина выхода по доступному журналу не установлена. Подтверждён отдельный дефект публикации — `rec` отсутствовал в списке выгрузки. Исправления и проверка границы матча описаны в [разборе 334](ACCEPTANCE.md) и [пробе PROB](rec_boundary.json).

## Прогон 335

[GitHub Actions 335](https://github.com/xa11mono/sim-cs2/actions/runs/45872217107) · [Зафиксированное задание](https://github.com/xa11mono/sim-cs2/blob/35739b6fc96c7a6ad6bcb594bd2ec752774e2566/tools/measure/request.json).

| Проверка | Ancient | Mirage |
|---|---:|---:|
| Э1 со следом выключенным | 8 | 8 |
| Полная запись Р3.6 с отпечатком Э1 при включённом следе | 8 | 8 |

В каждом блоке матчи 3, 7, 11, 13, 17, 19, 23 и 29. Тот же матч одновременно даёт запись причин и отпечаток со следом. `rec2` снимает `PROB` до сброса состояния, а для отпечатка считает тики до штатного перехода. [Короткая проба совпадения с отдельным Э1](rec-fp-probe.json). В задании действуют `resume: true`, `par: 8` и закреплённая среда 334. Нужны только Chromium, типы `fp` и `rec`. Проверка Windows Job Object, Node и метрики производительности Р5 ведутся отдельно.

335 закреплён за `1713806`. После постановки задания в `77046aa` две оставшиеся вложенные записи перенесены в их каналы. Изменения в исходнике игры ограничены тремя точными заменами: `items.js` вызывает `nadeAddToStock(N, G.key)`, `throw.js` выполняет тот же `stock[type]++`, `warmup.js` передаёт готовое значение в `engagementSetTargetTicks`. [Проба](alias-scene-proof.json) подтверждает те же объекты, результат подбора и порядок обновления памяти цели до выстрела. Матчи `freshMatch` идут без разминки.

Проверка опубликованной папки результатов с исходным `request.json` выполняется вместе с восстановленным архивом 334.

```sh
python rebuild/evidence/R3_R4/acceptance_334.py --archive /path/to/recovered-334.zip --ref 1713806fa03aa629a533c5df9074ee311ce6ee53 --verify /path/to/results-335
```

Обязательны совпадение отпечатков с эталоном и между режимами следа, полнота событий и причин, совпадение счётчиков с журналом и совпадение сохранившихся событий `danger` из 334. [Проба проверяющей команды](verifier-probe.json) подтверждает отказ при подмене отпечатка или сохранённого эпизода.

## Если результаты 335 остались только на ПК

Если публикация завершилась ошибкой, сохранить файлы до следующего задания. Запустить в PowerShell на ПК с раннером.

```powershell
$root = 'C:\actions-runner\_work\sim-cs2\sim-cs2'
$measure = Join-Path $root 'tools\measure'
$request = Join-Path $measure 'request.json'
$job = Get-Content -LiteralPath $request -Raw -Encoding UTF8 | ConvertFrom-Json
$expected = @('r34_off_anc','r34_off_mir','r34_rec_anc','r34_rec_mir')
if (Compare-Object $expected @((@($job.fp) + @($job.rec)).label)) { throw 'В рабочем каталоге находится другое задание' }
$stage = Join-Path $env:TEMP ('simcs2-335-' + [guid]::NewGuid().ToString('N'))
$zip = Join-Path $env:USERPROFILE ('simcs2-335-r34-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
New-Item -ItemType Directory -Path $stage -ErrorAction Stop | Out-Null
Copy-Item -LiteralPath $request -Destination $stage -ErrorAction Stop
foreach ($label in $expected) {
  $source = Join-Path (Join-Path $measure 'runs') $label
  if (!(Test-Path -LiteralPath $source -PathType Container)) { continue }
  $dest = New-Item -ItemType Directory -Path (Join-Path $stage $label) -ErrorAction Stop
  Get-ChildItem -LiteralPath $source -File | Where-Object { $_.Name -match '^(env|versions|(?:rec|fp|guard)_\d+)\.json$' } | Copy-Item -Destination $dest.FullName -ErrorAction Stop
}
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -ErrorAction Stop
Get-Item -LiteralPath $zip | Select-Object FullName, Length
```

Прикрепить ZIP **к сообщению в этом чате**.
