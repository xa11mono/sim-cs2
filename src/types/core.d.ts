// (Р1.3, 25.11) Что модули .ts берут у остальной игры — только описание (сборке не нужно: esbuild связывает имена сам, mod_build.js).
// Каждое имя здесь обязано быть объявлено в игре на верхнем уровне (проверяет tools/rebuild/typecheck.js: имя есть в склейке src/game).
// Тип — по коду объявления (файл:строка рядом). Поля бота — только те, что читают / пишут файлы .ts; растёт по мере перевода модулей.

/** игрок (makeTeam, 070) — поля, которые трогает turn.ts */
interface Bot {
  id: BotId;
  alive: boolean;
  x: Px;
  y: Px;
  /** взгляд, рад; undefined — после lookReset (530) до первого поворота. Не приведён к [−π, π] (У-6) — поэтому number, а не Angle:
   *  повороты прибавляются (`facing += d`), метка Angle потребовала бы приведения типа в каждой записи — это Р3 вместе с каналом */
  facing: number | undefined;
  /** взгляд на начало тика — для сглаживания рисования (620) */
  pfacing?: number;
  _faceWhy?: string;
  /** враг виден в этом тике (510:13, 41–42) и ближайший из видимых */
  _sawEnemy?: boolean;
  _nearestEnemyBot?: Bot | null;
  lookReason?: string | null;
  _lookLvl?: number;
  lookTarget?: P2 | null;
  /** до какого тика стоит на броске гранаты (380:312) */
  throwUntil?: number;
  /** цель взгляда прошлого тика (275) */
  _lkW?: { x: Px; y: Px; w: number; t: number };
  /** рывок руки (275 handTurn) */
  _hand?: Hand | null;
  _aimFix?: boolean;
  _aimTrk?: boolean;
  /** взгляд во фризе (275 freezeLookTick) */
  _fz?: { round: number; until: number; target: number };
  /** разбор взгляда (LOOKDBG, 270 / 610) */
  _ld?: LookDebug;
  _ldArb?: unknown[] | null;
}
interface HandSeg { t0: number; T: number; A: number; s?: number }
interface Hand { t0: number; T: number; segs: HandSeg[]; end: number; gap: number; f?: boolean }
interface LookDebug { tick: number; reason: string | null; raw: { x: number; y: number } | null; steps: unknown[]; final?: { x: number; y: number } | null; reasonFinal?: string | null }

/** квартили [q25, q50, q75] по корзине угла (MAP.turnmodel, tools/measure/motion/pro_turn_model.py) */
type Quartiles = readonly number[];
interface TurnModelBin { pk?: Quartiles; T?: Quartiles; ratio?: Quartiles; gap?: Quartiles; corr?: number }
interface TurnModelSub { pb?: number; bdeg?: Quartiles; bgap?: Quartiles; p?: number; at?: Quartiles; share?: Quartiles }
interface TurnModel { bins: number[]; model: { [ctxBin: string]: TurnModelBin | undefined }; sub?: { [ctxBin: string]: TurnModelSub | undefined } }
/** набор карты (010:5, data/maps/<карта>/) — поля, которые читают файлы .ts */
interface MapPack { turnmodel?: TurnModel }

declare var MAP: MapPack;                          // 010:5
declare var bots: Bot[];                           // 070:74
declare var tick: Ticks;                           // 540:4
declare var TICK_HZ: number;                       // 540:2 — тиков в секунду
declare var roundNum: number;                      // 520:2
declare var BZ: { ids: unknown[] };                // 200:16 — зоны карты команды (только длина списка)
declare var LOOK_REPLAN: { [team: string]: boolean };   // 270:315 {CT, T}
declare var LOOK_LEVEL: { [level: string]: number };    // 270:468
declare var LOOKDBG: { on: boolean };              // 270:460
declare var AIM_LAG: number;                       // 490:12 — с
declare function lookPlan(team: string): void;                                     // 270:252
declare function lookArbiter(b: Bot): P2 | null;                                   // 270 — прежний ответ «точка»
/** ответ арбитра взгляда (270, Р3.2 взгляд ш.1): точка, уровень LOOK_LEVEL, причина, заявки (null — заявок не было: «враг виден») */
interface LookAnswer { pt: P2 | null; lvl: number; kind: string | null; C: unknown[] | null }
declare function lookApply(b: Bot, R: LookAnswer): P2 | null;                       // 270 — запись причины и уровня (одно место)
declare function lookFilter(b: Bot, look: P2 | null, LD: LookDebug | null): { look: P2 | null; urgent: number };   // 270:690; urgent — lookUrgent (270:316): 0 / 1 / 2
declare function botPrevFace(b: Bot, a: number | undefined): number | undefined;                      // tick-step — хозяин pfacing (Р3.2, 27.11)
declare function _angOff(a: number, ref: number): number;                          // 260:187 — |разность углов|, приведённая
declare function hashRand(seed: number): number;                                   // 060:112 — [0, 1)
