// [хозяева: —] (Р5, 26.11, ядро без показа) состояние режимов страницы, которое читает и пишет ядро: демо (DEMOV), песочница (SANDBOX), разминка (WARM)
// и надпись смены сторон RC_HALF (пишет смена сторон, показ забирает). Объявления перенесены дословно из view/demo.js, view/sandbox.js,
// view/warmup.js, view/app.js: ядро обходится без файлов показа (tools/node/core_build.py), функции режимов (dvTick, sbTick, warm*) — в показе;
// в ядре без показа режимы выключены (on: false) — как у страницы при загрузке
var DEMOV = {on: false, i: 0, R: null, t0: 0, BOT: {}, ei: 0, allow: false};
var SANDBOX = {on: false, sel: null, drag: null, place: null, last: 0};
var WARM = {on:false};
var RC_HALF = null;
