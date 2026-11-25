// (Р1.2, 25.11) Типы смысла игры — только описание, без поведения: в сборку не входит (src/game его не включает), tsc видит его как
// глобальные объявления (файл без import / export) для всех .ts. Основание — аудит смыслов
// docs/reports/audit_2026-11-24/stage2b/SEMANTIC_AUDIT.md (С-1 единицы, С-3 углы, С-6 / С-7 прямая и путь, С-12 тики и секунды) и
// stage3/FINAL_ARCHITECTURE.md (Ф-2 «нет типов смысла», Ф-5 «тег как уровень»). Значения не меняются: тип — метка поверх number / string,
// которой в выполняемом коде нет. Числа (масштаб, частота) здесь не задаются — они остаются в игре и наборе карты.

// метка типа: number & { __unit: "Px" } не путается с number & { __unit: "GameUnits" }; в выполняемом коде её нет
type Brand<T, U extends string> = T & { readonly __unit: U };

// --- длины (С-1: две системы единиц)
/** пиксели радара: x, y, расстояния на плоскости. Масштаб к единицам игры — MAP.pxUnits (набор карты), в игре — PX_UNITS */
type Px = Brand<number, "Px">;
/** единицы игры CS2: z, высоты, урон по расстоянию, физика гранат */
type GameUnits = Brand<number, "GameUnits">;
/** длина пути по навигации (polyLen(pathPts(…)), 100), px радара — «успею / ближе / дошёл» (AGENTS.md §7, С-6) */
type PathLen = Brand<number, "PathLen">;
/** прямая на плоскости (Math.hypot), px радара — только видимость, звук, радиус, дальность оружия, геометрия (AGENTS.md §7) */
type StraightDist = Brand<number, "StraightDist">;

// --- время (С-12: смешения не найдено; константы времени — через TICK_HZ, 540)
/** секунды */
type Seconds = Brand<number, "Seconds">;
/** тики симуляции (номер или число тиков; частота — TICK_HZ, 540) */
type Ticks = Brand<number, "Ticks">;

// --- точки
/** точка на плоскости, px радара */
interface P2 { x: Px; y: Px }
/** точка с высотой: x, y — px радара, z — единицы игры */
interface P3 extends P2 { z: GameUnits }

// --- углы (С-3)
/** угол, радианы. Не приведён к [−π, π]: `facing` накапливает повороты (замер — от −14 до +16 рад, У-6); тип только описывает,
 *  приведение — изменение поведения (BEHAVIOR_BACKLOG.md У-6, после Р8) */
type Angle = Brand<number, "Angle">;

// --- имена
/** игрок: сторона + номер (makeTeam, 070: "CT0"…"CT4", "T0"…"T4") */
type BotId = Brand<string, "BotId">;
/** зона набора карты (MAP.zones, data/maps/<карта>/): имя зоны */
type ZoneId = Brand<string, "ZoneId">;
/** вид задачи — сейчас имя тега (post.tag, _task.tag; свойства — TASK_PROP / taskProp, 110). В Р3 станет записью одной таблицы
 *  TaskKind{level, props} (FINAL_ARCHITECTURE.md, «Арбитраж»; П-05) */
type TaskKind = Brand<string, "TaskKind">;
