# Архитектура sim-cs2 — единая система документов

С 24.11.2026 документы перестройки от Claude и DeepSeek сведены в одну систему. Исходные отчёты сохранены без изменений.

## Уровни (старший — первый)

| уровень | что | где |
|---|---|---|
| 1. План и ход работ | генеральный план Р0–Р8, журнал, среда, отложенные игровые недостатки | `rebuild/MASTER_PLAN.md`, `rebuild/JOURNAL.md`, `rebuild/ENVIRONMENT.md`, `rebuild/BEHAVIOR_BACKLOG.md` |
| 2. Действующие решения | реестр архитектурных решений АР-01…АР-27 и отклонённые предложения | [`DECISIONS.md`](DECISIONS.md) |
| 3. Текущее устройство игры | как устроен код сейчас (меняется вместе с кодом) | `docs/ARCHITECTURE.md`; карты устройства — `rebuild/gen/` (генерирует `tools/rebuild/gen_maps.js`) |
| 4. Исходные отчёты | доказательства и рассуждения; не правятся, только дополняются | ниже |

При расхождении действует старший уровень. Исправление вывода исходного отчёта — новой записью в реестре решений со ссылкой на разбор.

## Указатель по темам

| тема | решение | Claude (`docs/reports/audit_2026-11-24/`) | DeepSeek (`docs/audit/architecture/`) |
|---|---|---|---|
| стратегия перехода | АР-01, АР-21 | `stage3/MIGRATION_ROADMAP.md` §1, `stage4/ROADMAP_CHANGES.md` | `RECOMMENDATIONS.md` §5 |
| языки и стек | АР-02, АР-03, АР-04, АР-20 | `stage3/TECHNOLOGY_DECISION.md`, `stage4/ARCHITECTURE_ADDENDUM.md` §1, §3 | `DEPLOYMENT_OPTIONS.md` D, E |
| математика и детерминизм | АР-05, АР-06, АР-07 | `stage4/DEEPSEEK_REVIEW.md` §2.4, `stage4/evidence/math_*` | — (не рассматривалось) |
| устройство кода, хозяева, контракты | АР-14, АР-15 | `stage3/FINAL_ARCHITECTURE.md`, `stage3/MIGRATION_MATRIX.md`, `SYSTEM_DEPENDENCIES.md` | `BUILD_PIPELINE.md` §5, §8 |
| сборка и артефакты | АР-11, АР-17 | `stage4/ARCHITECTURE_ADDENDUM.md` §7, `stage4/STRUCTURE_MAP.md` | `BUILD_PIPELINE.md`, `RECOMMENDATIONS.md` §2.6, §6 |
| ресурсы, пакеты карт, размер страниц | АР-09, АР-10, АР-18 | `stage4/ARCHITECTURE_ADDENDUM.md` §5, §6 | `HTML_SIZE_AUDIT.md`, `RESOURCE_ARCHITECTURE.md` |
| загрузка, кадры, память, скорость | АР-22 | `stage3/PERFORMANCE_PLAN.md`, `FREEZE_AUDIT.md`, `stage3/evidence/` | `LOADING_PERFORMANCE.md`, `results/` |
| симуляция и показ, Node, Rust Native в веб-интерфейсе | АР-08, АР-19 | `stage4/ARCHITECTURE_ADDENDUM.md` §4, §12 | `DEPLOYMENT_OPTIONS.md` |
| кросс-браузерность | АР-24…АР-27 | `rebuild/ENVIRONMENT.md` §4, `stage4/bench/make_probe.js` | — |
| защита от регрессий, тесты | АР-06 | `stage3/REGRESSION_PROTECTION.md`, `TEST_COVERAGE_PLAN.md` | — |
| отметки, причинный дебаг | АР-12, АР-13 | `stage4/ARCHITECTURE_ADDENDUM.md` §8, §9 | `BUILD_PIPELINE.md` §5.7 |
| агенты, Graphify, Ponytail | АР-16 | `stage4/ARCHITECTURE_ADDENDUM.md` §10, §11 | `RECOMMENDATIONS.md` §6.1 |
| механики и находки | АР-21 | `MECHANICS_INVENTORY.md`, `SYSTEMIC_ERRORS_AUDIT.md`, `stage2b/` | — |
| проверка DeepSeek | — | `stage4/DEEPSEEK_REVIEW.md` | весь набор |

## Исходные отчёты

| набор | что | где |
|---|---|---|
| Claude, этап 1 (24.11) | механики, системные ошибки, фризы, тесты, план переделки | `docs/reports/audit_2026-11-24/` (корень) |
| Claude, этап 2B | неизвестные дефекты, жизненные циклы, порядок исполнения | `docs/reports/audit_2026-11-24/stage2b/` |
| Claude, этап 3 | стек, архитектура, матрица, скорость, регрессии, дорожная карта | `docs/reports/audit_2026-11-24/stage3/` |
| Claude, этап 4 | проверка DeepSeek, дополнение, изменения дорожной карты, структура | `docs/reports/audit_2026-11-24/stage4/` |
| DeepSeek, v598 (24.11) | сборка, ресурсы, загрузка, варианты развёртывания | `docs/audit/architecture/` — копия архива без изменений (без `__pycache__`); остальная часть ветки v598 (`bench/stage3`, `docs/reports/audit_2026-11-24/stage3/`, `docs/reports/audit_2026-11-24/SYSTEM_DEPENDENCIES.md`, docs/audit/parts/ — нет в этой ветке) — в ветке v598, которую владелец хранит отдельно; ссылки на неё из отчётов DeepSeek ведут туда |
| перестройка 15–17.11 | план фаз 0–4, правила, журнал фаз | `rebuild/PLAN.md`, `rebuild/RULES.md`, `rebuild/PROGRESS.md` |

Когда ветка v598 будет выложена: её `docs/audit/architecture/` должен совпасть с копией здесь (проверка — `diff -r`); остальные её
документы добавляются в таблицу выше как исходные, их выводы — в реестр решений после проверки.
