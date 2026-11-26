'use strict';

const { need, obj, str, uint, streamAsset } = require('./io.cjs');

const outcomes = ['counted', 'eligible', 'excluded', 'censored'];

async function verifyDiagnostics(diag, dir, match, addAsset, select) {
  need(obj(diag) && diag.version === 1, 'Неизвестная версия диагностического журнала');
  need(str(diag.session) && uint(diag.match) && (match == null || diag.match === match), 'Несовместимая сессия или матч диагностики');
  need(uint(diag.fromSeq) && uint(diag.toSeq) && diag.toSeq >= diag.fromSeq && Array.isArray(diag.segments),
    'Некорректный диапазон диагностики');
  need(obj(diag.metrics) && Object.keys(diag.metrics).length > 0, 'Отсутствует реестр метрик');
  const metrics = new Map(Object.entries(diag.metrics).map(([id, def]) => {
    need(str(id) && obj(def) && str(def.revision) && str(def.unit), 'Некорректное определение метрики: ' + id);
    return [id, Object.fromEntries(outcomes.map(outcome => [outcome, 0]))];
  }));

  let seq = diag.fromSeq, dropped = 0, missingFacts = 0, lastRound = -1, lastTick = -1;
  for (const segment of diag.segments) {
    need(obj(segment) && segment.fromSeq === seq && uint(segment.toSeq) && segment.toSeq > seq && segment.toSeq <= diag.toSeq,
      'Разрыв, повтор или неправильный порядок диапазонов диагностики');
    if (segment.kind === 'gap') {
      need(str(segment.reason), 'Отсутствует причина потери событий');
      dropped += segment.toSeq - seq;
      seq = segment.toSeq;
      continue;
    }
    need(segment.kind === 'chunk' && uint(segment.round) && segment.round >= lastRound &&
      uint(segment.fromTick) && uint(segment.toTick) && segment.toTick >= segment.fromTick, 'Некорректные границы чанка');
    const ref = addAsset(segment.asset);
    need(ref.codec === 'jsonl+gzip' && ref.version === 1, 'Неизвестный кодек чанка');
    let firstTick;
    await streamAsset(dir, ref, async row => {
      need(obj(row) && row.seq === seq && seq < segment.toSeq, 'Повтор или пропуск события seq=' + seq);
      need(uint(row.tick) && row.tick >= lastTick && row.tick >= segment.fromTick && row.tick <= segment.toTick,
        'Тик события нарушает порядок или границы чанка, seq=' + seq);
      need(str(row.phase) && str(row.episode) && str(row.reason) && str(row.sourceEvent),
        'У события нет фазы, эпизода, причины или источника, seq=' + seq);
      need(obj(row.facts), 'Не указана доступность фактов, seq=' + seq);
      const factsKnown = row.facts.missing == null && str(row.facts.ref) && ['observation', 'world'].includes(row.facts.domain);
      const factsMissing = str(row.facts.missing) && row.facts.ref == null && row.facts.domain == null;
      need(factsKnown || factsMissing, 'Некорректная ссылка на факты, seq=' + seq);
      const totals = metrics.get(row.metric);
      need(totals && outcomes.includes(row.outcome) && uint(row.delta) && row.delta > 0,
        'Неизвестная метрика, исход или вклад, seq=' + seq);
      for (const key of ['actor', 'target', 'checkpoint']) {
        need(row[key] == null || str(row[key]), 'Некорректное поле ' + key + ', seq=' + seq);
      }
      totals[row.outcome] += row.delta;
      need(uint(totals[row.outcome]), 'Переполнение счётчика, seq=' + seq);
      if (row.facts.missing != null) missingFacts++;
      firstTick ??= row.tick;
      lastTick = row.tick;
      seq++;
      if (select) await select(row, segment.round);
    });
    need(seq === segment.toSeq && firstTick === segment.fromTick && lastTick === segment.toTick, 'Границы чанка не совпали: ' + ref.file);
    lastRound = segment.round;
  }
  need(seq === diag.toSeq, 'Отсутствует конец диагностического диапазона');

  let reconciled = false;
  if (diag.summary != null) {
    need(obj(diag.summary) && Object.keys(diag.summary).length === metrics.size, 'Несовместимый диагностический итог');
    for (const [metric, totals] of metrics) {
      const reported = Object.hasOwn(diag.summary, metric) && diag.summary[metric];
      need(obj(reported) && Object.keys(reported).length === outcomes.length &&
        outcomes.every(key => uint(reported[key])), 'Некорректный диагностический итог: ' + metric);
      // With declared loss, the retained nonnegative counts are only lower bounds.
      need(outcomes.every(key => dropped ? reported[key] >= totals[key] : reported[key] === totals[key]),
        'Диагностический итог расходится с журналом: ' + metric);
    }
    reconciled = dropped === 0;
  }
  return { dropped, missingFacts, reconciled, events: diag.toSeq - diag.fromSeq - dropped, totals: Object.fromEntries(metrics) };
}

module.exports = { verifyDiagnostics };
