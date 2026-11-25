// (Р1.2) Проверка типов смысла — только для tsc (node tools/sim.js typecheck), в сборку не входит. Каждая строка с @ts-expect-error
// обязана давать ошибку: если метки перестанут различаться (Px = GameUnits, прямая = путь), tsc сообщит «неиспользованная @ts-expect-error».
declare const px: Px, gu: GameUnits, path: PathLen, line: StraightDist, sec: Seconds, tk: Ticks, ang: Angle, bot: BotId, zone: ZoneId, task: TaskKind;
declare function needPath(d: PathLen): void;
declare function needTicks(t: Ticks): void;
declare function needPx(v: Px): void;

needPath(path);
needTicks(tk);
needPx(px);
// @ts-expect-error прямая — не путь (AGENTS.md §7 «путь, а не прямая»)
needPath(line);
// @ts-expect-error секунды — не тики (С-12)
needTicks(sec);
// @ts-expect-error единицы игры — не px радара (С-1)
needPx(gu);
// @ts-expect-error голое число — не px: единицу надо назвать
needPx(3);
// @ts-expect-error угол — не px
needPx(ang);
const n: number = px + gu + path + line + sec + tk + ang;   // чтение как числа — можно: метка не меняет значение
const s: string = bot + zone + task;
// @ts-expect-error игрок — не зона
const z: ZoneId = bot;
const p3: P3 = { x: px, y: px, z: gu };
// @ts-expect-error z точки — единицы игры, не px
const bad: P3 = { x: px, y: px, z: px };
const p2: P2 = p3;   // точка с высотой годится там, где нужна плоскость
void n; void s; void z; void bad; void p2;

export {};   // модуль: имена проверки не попадают в общее пространство .ts игры
