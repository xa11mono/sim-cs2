// (Р0.12, 24.11) Проверка прототипа dmath: каждая функция против Rust libm 0.2.16 (tools/dmath/ref, нативно) — бит в бит на
// (1) случайных входах в диапазонах игры, (2) случайных битах по всему диапазону double, (3) граничных значениях (и всех их парах),
// (4) корпусе реальных аргументов из матчей (--corpus=файл, пишет tools/dmath/corpus.js). Плюс: где JS Math этой среды отличается от libm
// (контракт и последние знаки) и скорость dmath против Math.* (нс на вызов).
//   node tools/dmath/check.js [--ref=tools/dmath/ref/target/release/dmath_ref] [--n=200000] [--corpus=…] [--out=отчёт.json]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), D = require('./dmath.js');
const args = process.argv.slice(2), opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const REF = opt('ref', path.join(__dirname, 'ref', 'target', 'release', 'dmath_ref' + (process.platform === 'win32' ? '.exe' : '')));
const N = +opt('n', 200000), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dmath_'));
let seed = 12345 >>> 0; const u = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const F = new Float64Array(1), U = new Uint32Array(F.buffer);
const anyBits = () => { U[1] = (u() * 4294967296) >>> 0; U[0] = (u() * 4294967296) >>> 0; return F[0]; };
const bitsEq = (a, b) => Object.is(a, b) || (a !== a && b !== b);   // NaN: любой NaN — один ответ
const ONE = ['sin', 'cos', 'atan', 'acos', 'exp', 'log', 'sqrt'], TWO = ['atan2', 'pow', 'hypot'];
// граничные значения (ТЗ владельца для Р0.12: ±0, ±∞, NaN, субнормальные, большие аргументы sin / cos, нули и квадранты atan2, особые случаи pow,
// переполнение exp, log(0) и отрицательные)
const EDGE = [0, -0, Infinity, -Infinity, NaN, 5e-324, -5e-324, 2.2250738585072014e-308, 1.7976931348623157e308, -1.7976931348623157e308, 1, -1, 0.5, -0.5, 2, -2, 3,
  Math.PI, -Math.PI, Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 1e-300, 1e300, 1e22, 1.6e6, 1e6 * Math.PI, 2 ** 52, 2 ** 53 + 2, 709.782712893384, 709.79, -745.1332191019411, -745.14,
  -708.4, 1e-8, 0.9999999999999999, 1.0000000000000002, 46.8, -46.8, 1308.17, 0.25, 1.5, -1.5, 100, 0.001];
function ref(fn, inputs) {
  const fi = path.join(TMP, 'in.bin'), fo = path.join(TMP, 'out.bin');
  fs.writeFileSync(fi, Buffer.from(new Float64Array(inputs).buffer));
  const r = cp.spawnSync(REF, [fn, fi, fo]); if (r.status) throw new Error('эталон: ' + r.stderr);
  const b = fs.readFileSync(fo); return new Float64Array(b.buffer, b.byteOffset, b.length / 8);
}
function compare(fn, inputs) {
  const R = ref(fn, inputs), two = TWO.includes(fn), n = two ? inputs.length / 2 : inputs.length, bad = [], jsDiff = [];
  for (let i = 0; i < n; i++) {
    const a = two ? [inputs[2 * i], inputs[2 * i + 1]] : [inputs[i]], d = D[fn](...a), m = Math[fn](...a);
    if (!bitsEq(d, R[i])) bad.push({ args: a, dmath: d, libm: R[i] });
    if (!bitsEq(m, R[i])) jsDiff.push({ args: a, math: m, libm: R[i] });
  }
  return { n, mismatch: bad.length, examples: bad.slice(0, 5), jsMathDiffersFromLibm: jsDiff.length, jsExamples: jsDiff.slice(0, 3) };
}
function randomSet(fn) {
  const v = [];
  for (let i = 0; i < N; i++) {
    switch (fn) {
      case 'sin': case 'cos': v.push(i % 4 === 0 ? (u() - 0.5) * 8 * Math.PI : i % 4 === 1 ? (u() - 0.5) * 32 : i % 4 === 2 ? (u() - 0.5) * 4e6 : anyBits()); break;
      case 'atan': v.push(i % 2 ? (u() - 0.5) * 200 : anyBits()); break;
      case 'acos': v.push(i % 2 ? u() * 2 - 1 : anyBits()); break;
      case 'exp': v.push(i % 2 ? u() * 25 - 20 : u() * 1460 - 750); break;
      case 'log': v.push(i % 2 ? u() * 1e4 + 1e-9 : Math.abs(anyBits())); break;
      case 'sqrt': v.push(Math.abs(anyBits())); break;
      case 'atan2': case 'hypot': if (i % 2) v.push((u() - 0.5) * 6000, (u() - 0.5) * 6000); else v.push(anyBits(), anyBits()); break;
      case 'pow': if (i % 3 === 0) v.push(u() * 10 + 1e-9, (u() - 0.5) * 6); else if (i % 3 === 1) v.push(u() * 1.2, u() * 3); else v.push(anyBits(), anyBits()); break;
    }
  }
  return v;
}
function speed(fn, inputs) {
  const two = TWO.includes(fn), n = two ? inputs.length / 2 : inputs.length, d = D[fn], m = Math[fn];
  const run = f => { let s = 0; const t0 = process.hrtime.bigint(); for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++) s += two ? f(inputs[2 * i], inputs[2 * i + 1]) : f(inputs[i]); return [Number(process.hrtime.bigint() - t0) / (3 * n), s]; };
  run(d); run(m); const [td] = run(d), [tm] = run(m);
  return { dmath_ns: +td.toFixed(1), math_ns: +tm.toFixed(1) };
}
const rep = { env: { node: process.version, v8: process.versions.v8, os: os.platform() }, libm: '0.2.16', n: N, functions: {} };
let corpus = null; if (opt('corpus', '')) corpus = JSON.parse(fs.readFileSync(opt('corpus', ''), 'utf8'));
for (const fn of ONE.concat(TWO)) {
  const two = TWO.includes(fn), edge = two ? EDGE.flatMap(a => EDGE.flatMap(b => [a, b])) : EDGE.slice(), rnd = randomSet(fn);
  const r = { random: compare(fn, rnd), edge: compare(fn, edge), speed: speed(fn, rnd.slice(0, two ? 200000 : 100000)) };
  if (corpus && corpus[fn] && corpus[fn].length) r.corpus = compare(fn, two ? corpus[fn].flat() : corpus[fn]);
  rep.functions[fn] = r;
  console.log(fn.padEnd(6) + ' случайные: ' + r.random.mismatch + '/' + r.random.n + '  граничные: ' + r.edge.mismatch + '/' + r.edge.n +
    (r.corpus ? '  корпус игры: ' + r.corpus.mismatch + '/' + r.corpus.n : '') + '  | Math≠libm: ' + r.random.jsMathDiffersFromLibm + ' / ' + r.edge.jsMathDiffersFromLibm +
    '  | нс: dmath ' + r.speed.dmath_ns + ', Math ' + r.speed.math_ns);
}
fs.rmSync(TMP, { recursive: true, force: true });
if (opt('out', '')) fs.writeFileSync(opt('out', ''), JSON.stringify(rep, null, 1));
