# Источники для дизайна страницы (присланы владельцем, 12.10)

Перед любой правкой оформления (табло, панели, эффекты, меню) — сверяться с этими репозиториями.

- https://github.com/leonxlnx/taste-skill — правила «без шаблонности» (skills/taste-skill/SKILL.md)
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill — база стилей, шрифтов, палитр + поиск (`src/ui-ux-pro-max/scripts/search.py`)
- https://github.com/VoltAgent/awesome-claude-design — каталог дизайн-систем
- https://github.com/rohitg00/awesome-claude-design — DESIGN.md по семьям (data-dense: datadog, posthog…)
- https://github.com/kylezantos/design-motion-principles — движение (Emil Kowalski, Jakub Krehel, Jhey Tompkins)

## Что из них применяем к HUD (табло, панели игроков, карточка)
- Плотность «кокпит» (taste-skill, VISUAL_DENSITY 8–10): плотные отступы, без карточек-коробок, данные разделяют линии 1 px,
  все числа — моноширинным шрифтом с табличными цифрами.
- Иерархия весом и цветом, а не размером; без «кричащих» крупных жирных надписей (taste 9.B).
- Один радиус на всю страницу (taste 4.4): HUD — острые углы, 0 px.
- Один акцент (taste 4.2): зелёный страницы — только служебные плашки; цвета команд — данные (чья сторона), не украшение.
  Не чистый чёрный, не перенасыщенные цвета, без свечений (taste 9.A).
- Шрифт с кириллицей (ui-ux-pro-max, google-fonts.csv: Subsets): Roboto Condensed для подписей, IBM Plex Mono для чисел.
- Движение (design-motion-principles): только в ответ на действие; продуктовый интерфейс — до 300 мс, лучше ~180 мс,
  ease-out на появление; уважать prefers-reduced-motion.

## Пример нового вида (21.10, владелец: «пиздато выглядит»)
Сайты-источники: https://www.aisdkagents.com/ , https://ui.watermelon.sh/ , https://styles.refero.design/ (стиль Linear),
https://skiper-ui.com/ (палитра ⌘K), https://21st.dev/ (блик на главной кнопке), https://uiverse.io/ (тумблеры).
Слой — `src/design/redesign_overlay.html` (только добавлен поверх, ничего не удалено), сборка примера — `python3 src/design/mkdemo.py --map mirage`.
Страница-пример: https://claude.ai/artifact/Rur5f4n7FLHcPFvWwVCV3n (кнопка «показать старый» — сравнение на месте).
Что взято: zinc-фон с точечной сеткой, один акцент — песок Mirage, стекло + линия 1 px + радиус 12 px у плавающих панелей,
сегментированная группа матча, тумблеры в меню, ⌘K-палитра, блик на главной кнопке; цвета команд прежние.
Расходится с правилами 12.10 (острые углы, без свечений) — в main не переносилось, ждёт решения владельца.
