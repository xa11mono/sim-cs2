'use strict';

const fs = require('node:fs/promises');

const CAPTURE = 'globalThis.__measureRecord = REC; true';
const LEGACY_END = 'JSON.stringify(REC)';

// Called only on the final plain recorder object after the last check has run.
// Walk one level inside arrays/objects so even the snapshot dictionary is emitted entry by entry.
function* fragments(record) {
  yield '{';
  let first = true;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') continue;
    if (!first) yield ',';
    first = false;
    yield JSON.stringify(key) + ':';
    if (Array.isArray(value)) {
      yield '[';
      for (let i = 0; i < value.length; i++) {
        if (i) yield ',';
        yield JSON.stringify(value[i]) ?? 'null';
      }
      yield ']';
    } else if (value && Object.getPrototypeOf(value) === Object.prototype && typeof value.toJSON !== 'function') {
      yield '{';
      let firstEntry = true;
      for (const entry of Object.keys(value)) {
        const json = JSON.stringify(value[entry]);
        if (json === undefined) continue;
        if (!firstEntry) yield ',';
        firstEntry = false;
        yield JSON.stringify(entry) + ':' + json;
      }
      yield '}';
    } else {
      yield JSON.stringify(value);
    }
  }
  yield '}\n';
}

function captureSource(source) {
  const code = source.trimEnd();
  if (!code.endsWith('\n' + LEGACY_END)) throw new Error('Неизвестный конец шаблона REC');
  return code.slice(0, -LEGACY_END.length) + CAPTURE;
}

async function writeRecord(page, source, file, streaming) {
  const dst = await fs.open(file, 'wx');
  try {
    if (!streaming) {
      const output = await page.evaluate(src => __ev(src), source);
      if (typeof output !== 'string' || !output.startsWith('{')) throw new Error('REC не вернул JSON');
      await dst.writeFile(output + '\n');
      return;
    }
    const evaluated = await page.evaluate(src => __ev(src), captureSource(source));
    if (evaluated !== true) throw new Error('REC не передал объект результата');
    const generator = await page.evaluateHandle(fn => {
      const makeFragments = (0, eval)('(' + fn + ')');
      return makeFragments(globalThis.__measureRecord);
    }, fragments.toString());
    try {
      for (;;) {
        const packet = await generator.evaluate(it => {
          // Serialization transport budget in JS code units. An individual row can exceed it.
          let text = '';
          while (text.length < 64 * 1024) {
            const row = it.next();
            if (row.done) return { text, end: true };
            text += row.value;
          }
          return { text, end: false };
        });
        if (packet.text) await dst.writeFile(packet.text);
        if (packet.end) break;
      }
    } finally {
      await generator.dispose();
    }
  } finally {
    await dst.close();
  }
}

module.exports = { fragments, captureSource, writeRecord };
