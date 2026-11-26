'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { need, obj, str, uint, read, json, gzip, packed, stringify, freshDir } = require('./io.cjs');
const { isPacked, decode, coordinates } = require('./mkpack.cjs');
const { FORMAT, VERSION, inspect, checkImage } = require('./mark.cjs');
const { report } = require('./report.cjs');

const present = value => Object.fromEntries(Object.entries(value).filter(([, v]) => v != null && v !== ''));

async function convert(input, out, options = {}) {
  const bytes = read(input);
  const source = json(bytes);
  let doc = source, kind;
  if (options.scenario != null) {
    need(Array.isArray(source), 'Для --scenario нужен массив сценариев');
    const entries = source.filter(row => row?.id === options.scenario);
    need(entries.length === 1 && typeof entries[0].mark === 'string', 'Сценарий не найден или неоднозначен');
    doc = entries[0];
    kind = 'scenario';
  } else if (isPacked(source)) {
    kind = 'standalone-mkpack';
  } else {
    need(obj(doc) && !Object.hasOwn(doc, 'format') && (Object.hasOwn(doc, 'tick') || str(doc.text)) &&
      ['match', 'round', 'text', 'snapAsset', 'preTick', 'env'].some(key => Object.hasOwn(doc, key)), 'Неизвестный формат старой отметки');
    const hashEvidence = obj(doc.state) && str(doc.env?.src) && uint(doc.preTick) && !Object.hasOwn(doc, 'text') &&
      Object.keys(doc.state).length > 0 && Object.values(doc.state).every(hash => uint(hash) && hash <= 0xffffffff);
    kind = hashEvidence ? 'r2-replay-evidence' : 'browser-mark';
  }
  const raw = kind === 'standalone-mkpack';
  need(raw ? ['before', 'moment'].includes(options.role) && !options.snapshot && !options.pre : options.role == null,
    'Для отдельного mkPack укажите только --role=before или --role=moment; для документа используйте --snapshot/--pre');
  const mark = { format: FORMAT, version: VERSION, identity: {}, source: { kind, label: path.basename(input) }, snapshots: {} };
  const attachments = new Map();
  function add(name, buffer, codec, extra) {
    attachments.set(name, buffer);
    return packed(name, buffer, codec, 1, extra);
  }

  if (!raw) {
    mark.identity = present({
      map: doc.map, seed: doc.seed, match: doc.match, round: doc.round, tick: doc.tick, gameVersion: doc.env?.build,
      legacySourceHash: doc.env?.src
    });
    // (Р5.7, 26.11) выгрузка из страницы (mark-export) несёт и хэши сборки, карты, dmath
    if (obj(doc.identity)) mark.identity = { ...mark.identity, ...present({ buildHash: doc.identity.buildHash, mapHash: doc.identity.mapHash, dmath: doc.identity.dmath }) };
    if (kind === 'scenario') {
      // The registry stores this as one human-authored string. Keep it verbatim.
      mark.source.reference = doc.mark;
      if (str(doc.note)) mark.source.scenarioNote = doc.note;
      const place = /^m[0-9]+ \([^,]+, матч ([0-9]+), раунд ([0-9]+)(?:,|\))/.exec(doc.mark);
      if (place) {
        mark.identity = { match: Number(place[1]), round: Number(place[2]), ...mark.identity };
      }
    } else {
      mark.owner = present({ text: doc.text, expected: doc.want, item: doc.principle, bot: doc.bot });
    }
    if (obj(doc.env)) mark.environment = doc.env;
    if (doc.state != null) {
      mark.summary = { codec: kind === 'r2-replay-evidence' ? 'legacy-state-hashes' : 'legacy-mark-state', data: doc.state };
      if (mark.summary.codec === 'legacy-mark-state') {
        mark.identity = { ...present({ match: doc.state.match, round: doc.state.round, tick: doc.state.tick }), ...mark.identity };
      }
    }
    mark.source.legacyRefs = present({
      snapAsset: doc.snapAsset, preSnapAsset: doc.preSnapAsset, preTick: doc.preTick, frameAsset: doc.frameAsset,
      screenAsset: doc.screenAsset, legacySettingsFingerprint: doc.fp, scenarioBefore: doc.pre, scenarioMoment: doc.snap
    });
    mark.source.asset = add('legacy-source.json' + (gzip(bytes) ? '.gz' : ''), bytes, 'legacy-json');
  }

  function snapshot(role, buffer) {
    const state = coordinates(decode(json(buffer)));
    const ref = add('snapshot-' + role + '.json' + (gzip(buffer) ? '.gz' : ''), buffer, 'mkpack', { tick: state.tick });
    mark.snapshots[role] = ref;
    if (role === 'moment') {
      // Keep explicit document coordinates, then check them against the graph during inspect().
      mark.identity = { ...state, ...mark.identity };
      if (mark.summary?.codec === 'legacy-mark-state') {
        for (const key of ['match', 'round', 'tick']) {
          if (mark.summary.data[key] != null && state[key] != null) {
            need(mark.summary.data[key] === state[key], 'Сводка и снимок расходятся: ' + key);
          }
        }
      }
    }
    if (state.tick == null && role === 'before' && doc.preTick != null) ref.tick = doc.preTick;
    if (role === 'before') {
      need(doc.preTick == null || state.tick == null || state.tick === doc.preTick, 'Тик чекпоинта не соответствует preTick старой отметки');
    }
  }
  if (raw) snapshot(options.role, bytes);
  if (options.snapshot) snapshot('moment', read(options.snapshot));
  if (options.pre) snapshot('before', read(options.pre));
  // (Р5.7, 26.11) причинный след решений (Р3.3) за окно до момента — вложение со своими границами (поле trace схемы v2)
  if (options.trace) {
    const buffer = read(options.trace), tr = json(buffer);
    need(uint(tr.fromTick) && uint(tr.toTick) && tr.fromTick <= tr.toTick, 'След: нужны fromTick <= toTick');
    mark.trace = { fromTick: tr.fromTick, toTick: tr.toTick, asset: add('trace.json', buffer, 'sim-cs2/dlog') };
  }
  if (options.image) {
    const buffer = read(options.image);
    const codec = buffer[0] === 0x89 ? 'png' : 'jpeg';
    checkImage(buffer, codec);
    mark.image = add(codec === 'png' ? 'mark.png' : 'mark.jpg', buffer, codec);
  }

  return freshDir(out, async () => {
    for (const [name, buffer] of attachments) fs.writeFileSync(path.join(out, name), buffer, { flag: 'wx' });
    const result = await inspect(mark, out);
    fs.writeFileSync(path.join(out, 'mark.json'), stringify(mark), { flag: 'wx' });
    fs.writeFileSync(path.join(out, 'mark.md'), report(result), { flag: 'wx' });
    return result;
  });
}

module.exports = { convert };
