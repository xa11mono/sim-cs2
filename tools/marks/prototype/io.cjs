'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createGunzip, gunzipSync } = require('node:zlib');
const { Transform, Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const JSON_LIMIT = 128 * 1024 * 1024;
const LINE_LIMIT = 1024 * 1024;
const utf8 = new TextDecoder('utf-8', { fatal: true });

function need(condition, message) {
  if (!condition) throw new Error(message);
}

const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const str = value => typeof value === 'string' && value.length > 0;
const uint = value => Number.isSafeInteger(value) && value >= 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gzip = bytes => bytes[0] === 0x1f && bytes[1] === 0x8b;
const stringify = value => JSON.stringify(value, null, 2) + '\n';

function json(bytes) {
  const raw = gzip(bytes) ? gunzipSync(bytes, { maxOutputLength: JSON_LIMIT }) : bytes;
  return JSON.parse(utf8.decode(raw));
}

function read(file) {
  need(fs.statSync(file).size <= JSON_LIMIT, 'Файл превышает лимит размера JSON/вложения');
  return fs.readFileSync(file);
}

function nameOk(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) &&
    !name.endsWith('.') && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name);
}

function assetPath(dir, name) {
  need(nameOk(name), 'Недопустимое имя вложения: ' + name);
  const file = path.join(dir, name);
  need(fs.lstatSync(file).isFile(), 'Вложение должно быть обычным файлом: ' + name);
  return file;
}

function packed(file, bytes, codec, version, extra = {}) {
  return { file, codec, version, bytes: bytes.length, sha256: hash(bytes), ...extra };
}

function verified(bytes, ref) {
  need(bytes.length === ref.bytes && hash(bytes) === ref.sha256, 'Размер или SHA-256 не совпал: ' + ref.file);
  return bytes;
}

function freshDir(dir, write) {
  fs.mkdirSync(dir);
  return Promise.resolve().then(write).catch(error => {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  });
}

// Flow control comes from pipeline. Retain at most one partial JSONL line.
async function streamAsset(dir, ref, onRow) {
  const sum = createHash('sha256');
  let size = 0;
  const source = fs.createReadStream(assetPath(dir, ref.file));
  const tally = new Transform({
    transform(bytes, _, done) {
      size += bytes.length;
      if (size > ref.bytes) return done(new Error('Лишние байты: ' + ref.file));
      sum.update(bytes);
      done(null, bytes);
    }
  });
  let pending = Buffer.alloc(0);
  const output = new Writable({
    write(bytes, _, done) {
      handle(bytes).then(() => done(), done);
    },
    final(done) {
      done(pending.length ? new Error('Последняя запись JSONL без LF') : undefined);
    }
  });
  async function handle(bytes) {
    const block = pending.length ? Buffer.concat([pending, bytes]) : bytes;
    let start = 0;
    let end;
    while ((end = block.indexOf(10, start)) !== -1) {
      need(end - start <= LINE_LIMIT, 'Слишком длинная строка JSONL');
      await onRow(JSON.parse(utf8.decode(block.subarray(start, end))));
      start = end + 1;
    }
    pending = block.subarray(start);
    need(pending.length <= LINE_LIMIT, 'Слишком длинная строка JSONL');
  }
  await pipeline(source, tally, createGunzip(), output);
  need(size === ref.bytes && sum.digest('hex') === ref.sha256, 'Размер или SHA-256 не совпал: ' + ref.file);
}

module.exports = { need, obj, str, uint, digest, gzip, json, read, stringify, nameOk, assetPath, packed, verified, freshDir, streamAsset };
