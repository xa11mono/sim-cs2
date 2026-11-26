import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { openMapPack } from './load.mjs';
import { enableBinaryGeometry } from './geometry-adapter.mjs';

const [corePath, packPath, evidencePath, ...args] = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith("--ticks="));
const tickLimit = limitArg ? Number(limitArg.slice(8)) : null;
const matches = args.filter(arg => arg !== limitArg);
if (tickLimit !== null) assert(Number.isInteger(tickLimit) && tickLimit > 0 && tickLimit < 400000);
if (!corePath || !packPath || !evidencePath) {
  throw new Error('Usage: node tools/map-pack/fingerprint.mjs CORE.js MAP.simmap OUTPUT.json [--ticks=N] [MATCH ...]');
}
const core = readFileSync(corePath, 'utf8');
const pack = openMapPack(readFileSync(packPath));
const matchMap = /\bvar MAP = \{[\s\S]*?\};\r?\n/;
assert.match(core, matchMap, 'Expected a fresh tools/node/core_build.py build');
const packedCore = enableBinaryGeometry(core.replace(matchMap, 'var MAP = __packedMap;\n'));
let fingerprint = readFileSync(new URL('../measure/fingerprint.js', import.meta.url), 'utf8');
if (tickLimit) {
  assert(fingerprint.includes('t < 400000;'));
  fingerprint = fingerprint.replace('t < 400000;', 't < ' + tickLimit + ';');
}
fingerprint += '\nFP.complete = matchNum !== M0; JSON.stringify(FP)';
const results = [];
for (const match of matches.length ? matches : [3, 7, 11, 13, 17, 19, 23, 29]) {
  assert(/^[1-9]\d*$/.test(String(match)));
  const run = (code, map) => {
    const engine = new Function('__packedMap', code + '\nreturn globalThis.__ev;')(map);
    try {
      return JSON.parse(engine(fingerprint.replaceAll('__M__', match)));
    } finally {
      delete globalThis.__ev;
    }
  };
  const baseline = run(core);
  const packaged = run(packedCore, pack.createMatchMap());
  assert(baseline.ticks > 0 && baseline.ticks < 400000);
  if (!tickLimit) assert(baseline.complete && baseline.rounds.length > 0, 'Expected a complete match');
  assert.deepEqual(packaged, baseline, 'Fingerprint mismatch for match ' + match);
  results.push({ match: Number(match), ticks: packaged.ticks, hash: packaged.hash, rounds: packaged.rounds.length });
  writeFileSync(evidencePath, JSON.stringify({ node: process.version, completeMatches: tickLimit === null, tickLimit, matches: results }, null, 2) + '\n');
  console.log(corePath, 'match', match, 'identical, ticks', packaged.ticks);
}
