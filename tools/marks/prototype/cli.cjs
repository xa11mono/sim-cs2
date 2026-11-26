#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { gunzipSync } = require('node:zlib');
const { need, json, read, stringify, assetPath, freshDir } = require('./io.cjs');
const { inspect, location } = require('./mark.cjs');
const { convert } = require('./legacy.cjs');
const { report } = require('./report.cjs');

const HELP = `node tools/marks/prototype/cli.cjs <команда>

  open <папка|mark.json>
  check <папка|mark.json> [--expect=target.json] [--require-compatible]
  unpack <папка|mark.json> <новая папка>
  convert <старый JSON|JSON.gz> <новая папка> [--snapshot=файл] [--pre=файл] [--image=файл]
          [--scenario=id]                         выбрать запись из rebuild/scenarios.json
          [--role=moment|before]                  указать роль отдельного mkPack
  events <папка|mark.json> [--metric=id] [--episode=id] [--round=номер]

open печатает Markdown, check печатает JSON. Подробности в HANDOFF.md.`;

const string = { type: 'string' };
const optionSets = {
  open: {}, unpack: {},
  check: { expect: string, 'require-compatible': { type: 'boolean' } },
  convert: { snapshot: string, pre: string, image: string, scenario: string, role: string },
  events: { metric: string, episode: string, round: string }
};
const inspections = result => ({
  schema: result.mark.version, integrity: 'verified', compatibility: result.compatibility, replay: 'not-run',
  identity: result.mark.identity, snapshots: result.decodedSnapshots, diagnostics: result.diagnostics, notes: result.notes
});

function stdout(text) {
  return new Promise((resolve, reject) => process.stdout.write(text, error => error ? reject(error) : resolve()));
}

async function main(command, args) {
  if (command == null || command === 'help' || command === '--help' || args.includes('--help')) return stdout(HELP + '\n');
  need(Object.hasOwn(optionSets, command), 'Неизвестная команда. Используйте help.');
  const { values, positionals } = parseArgs({ args, options: optionSets[command], allowPositionals: true });
  const twoPaths = command === 'convert' || command === 'unpack';
  need(positionals.length === (twoPaths ? 2 : 1), 'Неверное число аргументов. Используйте help.');
  const [input, output] = positionals;
  if (command === 'convert') {
    const result = await convert(input, output, values);
    return stdout(stringify(inspections(result)));
  }

  const { value, dir } = location(input);
  const expected = values.expect == null ? undefined : json(read(values.expect));
  if (values['require-compatible']) need(values.expect != null, 'Для --require-compatible нужен --expect');
  const result = await inspect(value, dir, expected);
  if (command === 'open') return stdout(report(result));
  if (command === 'check') {
    if (values['require-compatible'] && result.compatibility !== 'metadata-match') process.exitCode = 1;
    return stdout(stringify(inspections(result)));
  }
  if (command === 'events') {
    need(result.diagnostics, 'Журнал событий отсутствует');
    if (!result.diagnostics.reconciled) console.error('Выводятся сохранённые события. Полнота журнала и итог не подтверждены.');
    const round = values.round == null ? undefined : Number(values.round);
    need(round == null || (/^[0-9]+$/.test(values.round) && Number.isSafeInteger(round)), 'Некорректный номер раунда');
    const { session, match } = value.diagnostics;
    return inspect(value, dir, undefined, (row, rowRound) => {
      if ((round == null || rowRound === round) && (!values.metric || row.metric === values.metric) &&
          (!values.episode || row.episode === values.episode)) {
        return stdout(JSON.stringify({ ...row, session, match, round: rowRound }) + '\n');
      }
    });
  }

  return freshDir(output, async () => {
    for (const ref of result.assets) {
      fs.copyFileSync(assetPath(dir, ref.file), path.join(output, ref.file), fs.constants.COPYFILE_EXCL);
    }
    const copied = await inspect(value, output);
    const compressed = Object.entries(copied.decodedSnapshots).filter(([, snapshot]) => snapshot.compressed);
    if (compressed.length) {
      const decoded = path.join(output, 'decoded');
      fs.mkdirSync(decoded);
      for (const [role] of compressed) {
        const bytes = read(assetPath(output, value.snapshots[role].file));
        fs.writeFileSync(path.join(decoded, role + '.mkpack.json'), gunzipSync(bytes), { flag: 'wx' });
      }
    }
    fs.writeFileSync(path.join(output, 'mark.json'), stringify(value), { flag: 'wx' });
    fs.writeFileSync(path.join(output, 'mark.md'), report(copied), { flag: 'wx' });
  });
}

const [command, ...args] = process.argv.slice(2);
main(command, args).catch(error => {
  console.error('Ошибка отметки — ' + error.message);
  process.exitCode = 1;
});
