'use strict';

const { need, obj, str, uint } = require('./io.cjs');

const types = {
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array
};
if (typeof Float16Array !== 'undefined') types.Float16Array = Float16Array;
const numbers = new Map([['NaN', NaN], ['I', Infinity], ['-I', -Infinity], ['-0', -0]]);
const rows = new Set(['a', 'o', 'm', 's', 't', 'dt', 're']);

function isPacked(value) {
  return obj(value) && (Object.hasOwn(value, 'objs') || Object.hasOwn(value, 'root'));
}

// Same wire representation as src/marks.js mkPack. Allocate shells first so aliases and cycles survive.
function decode(pack) {
  need(obj(pack) && pack.v === 1 && Array.isArray(pack.objs), 'Некорректный или неизвестный mkPack');
  const kinds = pack.objs.map((row, i) => {
    need(obj(row), 'Некорректный объект mkPack #' + i);
    const keys = Object.keys(row);
    const kind = keys.find(key => rows.has(key));
    need(kind && keys.length === (kind === 't' ? 2 : 1), 'Некорректный тип объекта mkPack #' + i);
    return kind;
  });
  const made = pack.objs.map((row, i) => {
    const kind = kinds[i];
    if (kind === 'o') {
      need(obj(row.o), 'Некорректный объект mkPack #' + i);
      return {};
    }
    if (kind === 'dt') {
      // JSON.stringify encodes the timestamp of an invalid Date as null.
      need(row.dt === null || Number.isFinite(row.dt), 'Некорректный Date mkPack #' + i);
      return new Date(row.dt === null ? NaN : row.dt);
    }
    if (kind === 't') {
      need(Object.hasOwn(types, row.t) && Array.isArray(row.d), 'Некорректный typed array mkPack #' + i);
      return new types[row.t](row.d.length);
    }
    need(Array.isArray(row[kind]), 'Некорректные данные mkPack #' + i);
    if (kind === 'a') return new Array(row.a.length);
    if (kind === 'm') return new Map();
    if (kind === 's') return new Set();
    need(row.re.length === 2 && row.re.every(value => typeof value === 'string'), 'Некорректный RegExp mkPack #' + i);
    return new RegExp(...row.re);
  });

  function value(token) {
    if (token === null || ['string', 'boolean'].includes(typeof token) || Number.isFinite(token)) return token;
    need(obj(token) && Object.keys(token).length === 1, 'Некорректное значение mkPack');
    if (Object.hasOwn(token, 'r')) {
      need(uint(token.r) && token.r < made.length, 'Ссылка mkPack вне таблицы: ' + token.r);
      return made[token.r];
    }
    if (token.u === 1) return undefined;
    need(numbers.has(token.n), 'Неизвестное значение mkPack');
    return numbers.get(token.n);
  }

  pack.objs.forEach((row, i) => {
    const dest = made[i];
    switch (kinds[i]) {
      case 'o':
        for (const [key, token] of Object.entries(row.o)) {
          Object.defineProperty(dest, key, { value: value(token), writable: true, enumerable: true, configurable: true });
        }
        break;
      case 'a': row.a.forEach((token, j) => { dest[j] = value(token); }); break;
      case 's': row.s.forEach(token => { dest.add(value(token)); }); break;
      case 'm':
        for (const entry of row.m) {
          need(Array.isArray(entry) && entry.length === 2, 'Некорректная пара Map mkPack');
          dest.set(value(entry[0]), value(entry[1]));
        }
        break;
      case 't':
        row.d.forEach((token, j) => {
          const item = value(token);
          need(typeof item === 'number', 'Нечисловой элемент typed array mkPack');
          dest[j] = item;
          need(Object.is(dest[j], item), 'Значение typed array mkPack вне представимого диапазона');
        });
        break;
    }
  });
  const state = value(pack.root);
  need(obj(state) && Object.getPrototypeOf(state) === Object.prototype, 'Корень снимка mkPack должен быть объектом');
  return state;
}

function coordinates(state) {
  const fields = { match: 'matchNum', round: 'roundNum', tick: 'tick', tickHz: 'TICK_HZ' };
  return Object.fromEntries(Object.entries(fields).filter(([, key]) => Object.hasOwn(state, key))
    .map(([key, field]) => {
      need(uint(state[field]) && (key !== 'tickHz' || state[field] > 0), 'Некорректное поле снимка ' + field);
      return [key, state[field]];
    }));
}

// Displayable facts from the old graph, at the tick of this particular snapshot.
function positions(state) {
  if (!Array.isArray(state.bots)) return undefined;
  return state.bots.filter(bot => obj(bot) && str(bot.id)).map(bot => ({
    id: bot.id,
    ...Object.fromEntries(['x', 'y', 'z', 'hp'].filter(key => Number.isFinite(bot[key])).map(key => [key, bot[key]])),
    alive: typeof bot.alive === 'boolean' ? bot.alive : undefined,
    task: str(bot.post?.tag) ? bot.post.tag : undefined,
    lookReason: str(bot.lookReason) ? bot.lookReason : undefined
  }));
}

module.exports = { isPacked, decode, coordinates, positions };
