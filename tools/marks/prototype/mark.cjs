'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { need, obj, str, uint, digest, gzip, json, read, nameOk, assetPath, verified } = require('./io.cjs');
const { decode, coordinates, positions } = require('./mkpack.cjs');
const { verifyDiagnostics } = require('./diagnostics.cjs');

const FORMAT = 'sim-cs2/mark';
const VERSION = 2;
const ROLES = ['moment', 'before'];
const BOUND_FIELDS = {
  gameVersion: str, buildHash: digest, legacySourceHash: v => typeof v === 'string' && /^[a-f0-9]{16}$/.test(v),
  map: v => typeof v === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(v),
  mapHash: digest, dmath: str, seed: v => Number.isSafeInteger(v) || str(v),
  match: uint, round: uint, tick: uint, tickHz: v => uint(v) && v > 0,
  settingsHash: digest, memoryHash: digest, environmentId: str
};
const REPLAY_FIELDS = ['gameVersion', 'buildHash', 'map', 'mapHash', 'dmath', 'seed', 'tickHz', 'settingsHash', 'memoryHash', 'environmentId'];

function fields(value, rules, label) {
  need(obj(value), 'Некорректный объект: ' + label);
  for (const [key, valid] of Object.entries(rules)) {
    need(value[key] == null || valid(value[key]), 'Некорректное поле: ' + label + '.' + key);
  }
}

function agree(left, right, fields, label) {
  for (const key of fields) {
    need(left[key] == null || right[key] == null || left[key] === right[key], label + ': ' + key);
  }
}

function checkImage(bytes, codec) {
  const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  need((codec === 'png' && png) || (codec === 'jpeg' && jpeg), 'Тип изображения не соответствует вложению');
}

function compareTarget(mark, expected, notes) {
  if (expected === undefined) return 'target-not-provided';
  fields(expected, { ...BOUND_FIELDS, snapshotCodec: str, snapshotVersion: uint, registry: str }, 'expect');
  const keys = [...Object.keys(BOUND_FIELDS), 'snapshotCodec', 'snapshotVersion', 'registry'];
  need(Object.keys(expected).length && Object.keys(expected).every(key => keys.includes(key) && expected[key] != null),
    'В expect нужны известные поля с конкретными значениями');

  const snapshots = ROLES.map(role => mark.snapshots?.[role]).filter(Boolean);
  const snapshot = snapshots[0];
  const actual = { ...mark.identity, snapshotCodec: snapshot?.codec, snapshotVersion: snapshot?.version, registry: snapshot?.registry };
  for (const key of Object.keys(expected)) {
    if (['snapshotCodec', 'snapshotVersion', 'registry'].includes(key)) {
      const refKey = { snapshotCodec: 'codec', snapshotVersion: 'version', registry: 'registry' }[key];
      for (const ref of snapshots) agree(expected, { [key]: ref[refKey] }, [key], 'Несовпадение с целевой средой (' + ref.file + ')');
    }
    agree(expected, actual, [key], 'Несовпадение с целевой средой');
    if (actual[key] == null) notes.add('Нельзя сверить поле с целевой средой: ' + key);
  }
  const required = [...REPLAY_FIELDS, 'snapshotCodec', 'snapshotVersion'];
  if (snapshot?.codec !== 'mkpack') required.push('registry');
  const allMatched = required.every(key => expected[key] != null && expected[key] === actual[key]);
  return allMatched && snapshots.every(ref => ref.codec === 'mkpack' && ref.version === 1) ? 'metadata-match' : 'unverified';
}

async function inspect(mark, dir, expected, select) {
  need(obj(mark) && mark.format === FORMAT && mark.version === VERSION,
    'Неизвестная схема отметки: ' + (mark?.format ?? 'нет формата') + ' / ' + (mark?.version ?? 'нет версии'));
  fields(mark.identity, BOUND_FIELDS, 'identity');
  fields(mark.owner ?? {}, { text: str, expected: str, item: v => str(v) || uint(v), bot: str }, 'owner');
  fields(mark.source ?? {}, { kind: str, label: str, reference: str, scenarioNote: str, legacyRefs: obj }, 'source');
  fields(mark.environment ?? {}, { ua: str, brands: str, platform: str }, 'environment');
  const { identity } = mark;
  const notes = new Set();
  for (const key of REPLAY_FIELDS.concat(['match', 'round', 'tick'])) {
    if (identity[key] == null) notes.add('Отсутствует identity.' + key);
  }
  for (const key of ['text', 'expected', 'item']) {
    if (mark.owner?.[key] == null) notes.add('Отсутствует owner.' + key);
  }

  const assets = [];
  const names = new Set(['mark.json', 'mark.md', 'decoded']);
  function addAsset(ref) {
    need(obj(ref) && nameOk(ref.file) && str(ref.codec) && uint(ref.version) && ref.version > 0 &&
      uint(ref.bytes) && ref.bytes > 0 && digest(ref.sha256), 'Некорректный дескриптор вложения');
    const name = ref.file.toLowerCase();
    need(!names.has(name), 'Имя вложения занято: ' + ref.file);
    names.add(name);
    assets.push(ref);
    return ref;
  }
  function load(ref) {
    addAsset(ref);
    return verified(read(assetPath(dir, ref.file)), ref);
  }

  const decodedSnapshots = {};
  const snapshotIdentities = {};
  const snapshotPositions = {};
  need(mark.snapshots == null || (obj(mark.snapshots) && Object.keys(mark.snapshots).every(role => ROLES.includes(role))),
    'Некорректные роли снимков');
  for (const role of ROLES) {
    const ref = mark.snapshots?.[role];
    if (ref == null) {
      notes.add('Отсутствует снимок: ' + role);
      continue;
    }
    fields(ref, { tick: uint, registry: str }, 'snapshot.' + role);
    const bytes = load(ref);
    fields(ref.identity ?? {}, BOUND_FIELDS, 'snapshot.' + role + '.identity');
    agree(identity, ref.identity ?? {}, Object.keys(BOUND_FIELDS).filter(key => key !== 'tick' && (role === 'moment' || key !== 'round')),
      'Идентичность снимка расходится с отметкой');
    const targetTick = identity.tick;
    agree(ref, ref.identity ?? {}, ['tick'], 'Тик снимка расходится с его метаданными');
    const boundTick = ref.tick ?? ref.identity?.tick;
    if (role === 'moment' && boundTick != null && targetTick != null) need(boundTick === targetTick, 'Тик снимка момента расходится с отметкой');
    if (role === 'before' && boundTick != null && targetTick != null) need(boundTick < targetTick, 'Снимок «до» должен предшествовать моменту');
    snapshotIdentities[role] = { ...ref.identity, tick: boundTick };
    if (ref.codec === 'mkpack' && ref.version === 1) {
      const state = decode(json(bytes));
      const meta = coordinates(state);
      for (const key of ['match', 'round', 'tick']) if (meta[key] == null) notes.add('В mkPack отсутствует ' + key + ' (' + role + ')');
      agree({ ...ref.identity, tick: boundTick }, meta, ['match', 'round', 'tick', 'tickHz'], 'Внутренние метаданные снимка расходятся с дескриптором');
      agree(identity, meta, role === 'moment' ? ['match', 'round', 'tick', 'tickHz'] : ['match', 'tickHz'], 'Внутренние метаданные снимка расходятся с отметкой');
      if (role === 'before' && meta.tick != null && targetTick != null) need(meta.tick < targetTick, 'Снимок «до» должен предшествовать моменту');
      decodedSnapshots[role] = { ...meta, compressed: gzip(bytes) };
      snapshotIdentities[role] = { ...snapshotIdentities[role], ...meta };
      snapshotPositions[role] = positions(state);
    } else {
      notes.add('Нет декодера снимка ' + role + ': ' + ref.codec + '/' + ref.version);
    }
    if (snapshotIdentities[role].tick == null) notes.add('Отсутствует тик снимка: ' + role);
  }
  if (snapshotIdentities.before && snapshotIdentities.moment) {
    const { before, moment } = snapshotIdentities;
    agree(before, moment, Object.keys(BOUND_FIELDS).filter(key => key !== 'tick' && key !== 'round'),
      'Снимки относятся к разным входам матча');
    if (before.tick != null && moment.tick != null) need(before.tick < moment.tick, 'Снимок «до» должен предшествовать моменту');
    if (before.round != null && moment.round != null) need(before.round <= moment.round, 'Раунд снимка «до» следует за раундом отметки');
  }

  const summary = mark.summary;
  if (summary == null) {
    notes.add('Отсутствует сводка наблюдений в момент отметки');
  } else {
    need(obj(summary) && str(summary.codec) && obj(summary.data), 'Некорректная сводка');
    if (summary.codec === 'legacy-mark-state') {
      fields(summary.data, { match: uint, round: uint, tick: uint, bots: Array.isArray }, 'summary.data');
      agree(identity, summary.data, ['match', 'round', 'tick'], 'Координаты сводки расходятся с отметкой');
    } else {
      notes.add('Сводка сохранена как данные источника: ' + summary.codec);
    }
  }
  if (mark.trace == null) notes.add('Отсутствует причинный след Р3');
  else {
    need(obj(mark.trace) && uint(mark.trace.fromTick) && uint(mark.trace.toTick) && mark.trace.fromTick <= mark.trace.toTick,
      'Некорректное окно причинного следа');
    if (identity.tick != null) need(mark.trace.fromTick <= identity.tick && mark.trace.toTick >= identity.tick, 'Окно следа не содержит тик отметки');
    load(mark.trace.asset);
    notes.add('След Р3 сохранён как непрозрачное вложение: нет адаптера ' + mark.trace.asset.codec + '/' + mark.trace.asset.version);
  }

  if (mark.image == null) notes.add('Отсутствует кадр');
  else {
    const bytes = load(mark.image);
    need(mark.image.version === 1, 'Неизвестная версия изображения');
    checkImage(bytes, mark.image.codec);
  }
  if (mark.source?.asset != null) {
    const bytes = load(mark.source.asset);
    if (mark.source.asset.codec === 'legacy-json' && mark.source.asset.version === 1) json(bytes);
  }

  let diagnostics;
  if (mark.diagnostics == null) notes.add('Отсутствует журнал диагностических событий');
  else {
    diagnostics = await verifyDiagnostics(mark.diagnostics, dir, identity.match, addAsset, select);
    if (!diagnostics.reconciled) notes.add('Диагностический итог не подтверждён полным журналом и сверкой');
    if (diagnostics.missingFacts > 0) notes.add('У части диагностических событий отсутствуют факты');
  }
  const compatibility = compareTarget(mark, expected, notes);
  return { mark, assets, decodedSnapshots, snapshotPositions, diagnostics, compatibility, notes: [...notes] };
}

function location(input) {
  const file = fs.statSync(input).isDirectory() ? path.join(input, 'mark.json') : input;
  return { file, dir: path.dirname(file), value: json(read(file)) };
}

module.exports = { FORMAT, VERSION, inspect, location, checkImage };
