# Подготовка Р3 от Codex (перенесена файлами, ветки не сливались — решение владельца 25.11)

Источник — ветка `codex/preparation-r3-r4`, коммит 5ac2210 (база подготовки — `v599a` d756b49). Перенесено только нужное для Р3:
`state_registry.csv` + `STATE_REGISTRY.md` (реестр состояния, начальное заполнение), `MATCH_ISOLATION.md` (Т-2), `R3_PREPARATION.md`
(границы каналов Р3.2). Материалы Р4 и документации остаются в ветке Codex.

Файлы — как у Codex, не правятся: это исходные данные. Действующий реестр — машинная часть `rebuild/gen/state.json` (строится из кода,
`tools/rebuild/state_gen.js`) + смысловая разметка `rebuild/state_classes.json`. Сверка с кодом v599a 25.11 —
`rebuild/evidence/R3/r3_prep_registry_check.json` (3009 адресов, устаревших 0). Порядок работ — `rebuild/R3_ORDER.md`.
