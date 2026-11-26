// (Р5.3, 26.11, опыт) симуляция собранной страницы в Node без браузера: скрипты страницы выполняются в vm с заглушкой окна и документа
// (DOM, холст, звук — пустые объекты; хранилище — пустое, как у нового браузера; таймеры и кадры не запускаются), затем — код в странице
// через __ev (как src/q.js). Цель: Node даёт ту же симуляцию, что браузер (Э2: отпечатки равны).
// Запуск: node tools/node/run_page.js <sim.html> <код.js | @файл>   (код — как для src/q.js, напр. tools/measure/fingerprint.js с __M__)
'use strict';
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
let code = process.argv[3] || '1'; if (code[0] === '@') code = fs.readFileSync(code.slice(1), 'utf8');

// заглушка: любой объект DOM — функция-прокси (свойство → заглушка, вызов → заглушка, число / строка → 0 / '')
function stub(name) {
  const f = function () { return stub(name + '()'); };
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return h => (h === 'number' ? 0 : '');
      if (k === 'valueOf') return () => 0; if (k === 'toString') return () => '';
      if (k === 'length') return 0; if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined;   // не «обещание»
      if (k in t) return t[k];
      return (t[k] = stub(name + '.' + String(k)));
    },
    set(t, k, v) { t[k] = v; return true; },
    has() { return true; }
  });
}
const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear(), key: i => [...m.keys()][i] || null, get length() { return m.size; } }; };
const ctx = {
  console, Math, Date, JSON, Array, Object, String, Number, Boolean, Map, Set, WeakMap, WeakSet, Symbol, Proxy, Reflect, Promise, Error, TypeError, RangeError,
  Float64Array, Float32Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, ArrayBuffer, DataView, BigInt,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, escape, unescape, atob: s => Buffer.from(s, 'base64').toString('binary'),
  btoa: s => Buffer.from(s, 'binary').toString('base64'), structuredClone, TextEncoder, TextDecoder, DecompressionStream: undefined, CompressionStream: undefined,
  performance: { now: () => 0 }, requestAnimationFrame: () => 0, cancelAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout: () => 0, setInterval: () => 0, clearInterval: () => 0,
  localStorage: store(), sessionStorage: store(), indexedDB: undefined, fetch: undefined, Worker: undefined, Image: function () { return stub('Image'); }, Audio: function () { return stub('Audio'); },
  AudioContext: undefined, webkitAudioContext: undefined, navigator: { userAgent: 'node', language: 'ru', hardwareConcurrency: 1 }, location: { href: 'file:///sim.html', search: '', hash: '', protocol: 'file:' },
  document: stub('document'), devicePixelRatio: 1, innerWidth: 1600, innerHeight: 1000, addEventListener: () => {}, removeEventListener: () => {}, getComputedStyle: () => stub('style'),
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }), ResizeObserver: function () { return { observe() {}, disconnect() {} }; }, MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  URL: { createObjectURL: () => '', revokeObjectURL: () => {} }, Blob: function () {}, FontFace: function () { return { load: () => ({ then() {} }) }; }
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.document.fonts = { add() {}, ready: { then() {} } };
vm.createContext(ctx);
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const errs = [];
scripts.forEach((s, i) => { try { vm.runInContext(s, ctx, { filename: 'script' + i + '.js' }); } catch (e) { errs.push('скрипт ' + i + ': ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); } });
if (typeof ctx.__ev !== 'function') { console.error('нет __ev — тестовый вход страницы не загрузился'); errs.forEach(e => console.error(e)); process.exit(1); }
if (errs.length) errs.forEach(e => console.error('(загрузка) ' + e));
const out = ctx.__ev(code);
process.stdout.write(String(out) + '\n');
