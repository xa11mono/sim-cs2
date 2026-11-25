'use strict';

const { obj } = require('./io.cjs');

function text(value) {
  if (value == null || value === '') return 'нет данных';
  return String(value).replace(/[\r\n]+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_[\]|~]/g, '\\$&');
}

function quote(value) {
  return value == null || value === '' ? '> нет данных' :
    String(value).split(/\r?\n/).map(line => '> ' + text(line)).join('\n');
}

function list(value) {
  return Array.isArray(value) ? (value.length ? value.map(text).join(', ') : 'пустой список') : 'нет данных';
}

function bots(state, subject) {
  if (!Array.isArray(state.bots)) return ['Записи по ботам отсутствуют.'];
  if (state.bots.length === 0) return ['В старой сводке пустой список ботов.'];
  const ordered = state.bots.filter(obj).sort((a, b) => Number(b.id === subject) - Number(a.id === subject));
  const lines = ['| Бот | Позиция | HP | Задача | Взгляд и сохранённая подпись | Видел по сводке |',
    '|---|---|---|---|---|---|'];
  for (const bot of ordered) {
    const look = obj(bot.look) ? [bot.look.place, bot.look.x, bot.look.y].filter(v => v != null).map(text).join(' / ') : 'нет данных';
    lines.push('| ' + [
      text(bot.id), [text(bot.place), 'X ' + text(bot.x), 'Y ' + text(bot.y), 'Z ' + text(bot.z)].join(' / '), text(bot.hp),
      text(bot.task), look + ' · ' + text(bot.lookReason), list(bot.sees)
    ].join(' | ') + ' |');
  }
  for (const bot of ordered) {
    const details = [];
    if (bot.role) details.push('Роль — ' + text(bot.role));
    if (bot.nadeTask) details.push('Задача гранаты — ' + text(bot.nadeTask));
    if (bot.why) details.push('Подпись старого интерфейса — ' + text(bot.why));
    if (Array.isArray(bot.log) && bot.log.length) details.push('Сохранённые строки старого журнала', quote(bot.log.join('\n')));
    if (details.length) lines.push('', '### Бот ' + text(bot.id), '', ...details);
  }
  return lines;
}

function report(result) {
  const { mark, decodedSnapshots, snapshotPositions, compatibility, notes, diagnostics } = result;
  const identity = mark.identity;
  const labels = {
    gameVersion: 'Версия игры', buildHash: 'SHA-256 сборки', legacySourceHash: 'Короткий отпечаток исходника',
    map: 'Карта', mapHash: 'SHA-256 карты', dmath: 'Версия dmath', seed: 'Seed', match: 'Матч', round: 'Раунд', tick: 'Тик',
    tickHz: 'Тиков в секунду', settingsHash: 'SHA-256 настроек', memoryHash: 'SHA-256 входной памяти', environmentId: 'Идентификатор среды'
  };
  const lines = [
    '# Отметка sim-cs2', '', 'Схема ' + mark.version + ' · источник ' + text(mark.source?.kind) + ' · ' + text(mark.source?.label), '',
    '## Что указал владелец', '', quote(mark.owner?.text), '', 'Ожидаемое поведение', '', quote(mark.owner?.expected), '',
    'Пункт — ' + text(mark.owner?.item) + ' · выбранный бот — ' + text(mark.owner?.bot), ''
  ];
  if (mark.source?.reference) lines.push('Запись в реестре сценариев', '', quote(mark.source.reference), '');
  if (mark.source?.scenarioNote) lines.push('Примечание из реестра', '', quote(mark.source.scenarioNote), '');
  lines.push('## Идентичность и проверка', '', '| Поле | Сохранено |', '|---|---|');
  for (const [key, label] of Object.entries(labels)) lines.push('| ' + label + ' | ' + text(identity[key]) + ' |');
  if (mark.environment) {
    for (const key of ['ua', 'brands', 'platform']) {
      if (mark.environment[key] != null) lines.push('| Среда / ' + key + ' | ' + text(mark.environment[key]) + ' |');
    }
  }
  const statuses = {
    'target-not-provided': 'целевая среда не задана',
    'unverified': 'совместимость с целевой средой не подтверждена',
    'metadata-match': 'доступные метаданные совместимы с заданным профилем'
  };
  lines.push('', '**Сверка совместимости** — ' + statuses[compatibility] + '. Проверка воспроизведения по тикам не выполнялась.', '',
    '## Сохранённые данные', '');
  for (const [role, title] of [['moment', 'Снимок момента'], ['before', 'Снимок до момента']]) {
    const ref = mark.snapshots?.[role];
    const known = decodedSnapshots[role];
    const at = ref?.tick ?? ref?.identity?.tick ?? known?.tick;
    lines.push('- ' + title + ' — ' + (ref ? text(ref.file) + ', ' + text(ref.codec) + '/' + ref.version + ', тик ' + text(at) +
      (known ? ', матч ' + text(known.match) + ', раунд ' + text(known.round) : '') : 'нет данных'));
  }
  if (mark.image) lines.push('- Кадр — [' + mark.image.file + '](' + mark.image.file + ')');
  if (mark.trace) lines.push('- Окно причинного следа — тики ' + mark.trace.fromTick + '–' + mark.trace.toTick + ', ' + text(mark.trace.asset.file));
  for (const [key, value] of Object.entries(mark.source?.legacyRefs ?? {})) lines.push('- Старый источник ' + text(key) + ' — ' + text(value));
  if (mark.summary?.codec === 'legacy-mark-state') {
    const state = mark.summary.data;
    lines.push('', '## Наблюдения из старой сводки', '',
      'Положение и задачи взяты из старого интерфейса. Полный набор знаний, варианты решения, арбитраж и перезаписи в этой сводке не зафиксированы.',
      '', ...bots(state, mark.owner?.bot));
  } else if (mark.summary?.codec === 'legacy-state-hashes') {
    lines.push('', 'Контрольная отметка Р2.1 содержит хэши полей состояния для проверки воспроизведения.');
  }
  for (const [role, title] of [['moment', 'Снимок момента'], ['before', 'Чекпоинт до отметки']]) {
    const rows = snapshotPositions[role];
    if (!rows?.length || (role === 'moment' && mark.summary?.codec === 'legacy-mark-state')) continue;
    lines.push('', '## ' + title + ' · тик ' + text(decodedSnapshots[role].tick), '',
      '| Бот | X | Y | Z | HP | Жив | Задача | Сохранённая подпись взгляда |', '|---|---|---|---|---|---|---|---|');
    for (const bot of rows) {
      const xyz = ['x', 'y', 'z'].map(key => bot[key]?.toFixed(1));
      const alive = bot.alive == null ? undefined : (bot.alive ? 'да' : 'нет');
      lines.push('| ' + [bot.id, ...xyz, bot.hp, alive, bot.task, bot.lookReason].map(text).join(' | ') + ' |');
    }
  }
  if (diagnostics) {
    lines.push('', '## Диагностический журнал', '', 'Записей — ' + diagnostics.events + ', потеряно — ' + diagnostics.dropped +
      ', записей без фактов — ' + diagnostics.missingFacts + '.',
      'Сверка числителя и знаменателей — ' + (diagnostics.reconciled ? 'совпали' : 'нет полного подтверждения') + '.', '',
      '| Метрика | Вклад | Возможности | Исключено | Цензурировано |', '|---|---|---|---|---|');
    for (const [key, row] of Object.entries(diagnostics.totals)) {
      lines.push('| ' + [text(key), row.counted, row.eligible, row.excluded, row.censored].join(' | ') + ' |');
    }
    const gaps = mark.diagnostics.segments.filter(segment => segment.kind === 'gap');
    for (const gap of gaps) lines.push('', '- Пропущенные seq [' + gap.fromSeq + ', ' + gap.toSeq + ') — ' + text(gap.reason));
  }
  if (notes.length) lines.push('', '## Ограничения данных', '', ...notes.map(note => '- ' + text(note)));
  return lines.join('\n') + '\n';
}

module.exports = { report };
