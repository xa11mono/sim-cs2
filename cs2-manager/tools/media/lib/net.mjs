// Сетевой слой медиатеки: честный User-Agent, пауза между запросами к одному хосту,
// классификация отказов. Никаких обходов: при отказе источник помечается и пропускается.
import net from 'node:net';
import tls from 'node:tls';

export const UA = 'CS2Manager-MediaAutofill/2.0 (personal offline game; contact: local user)';

// Виды отказа — от кого пришёл запрет.
export const BLOCK = {
  SANDBOX: 'sandbox',        // исходящий шлюз среды выполнения (allowlist), до сайта запрос не дошёл
  CHALLENGE: 'challenge',    // антибот-защита сайта (Cloudflare и т.п.) — не обходим
  FORBIDDEN: 'forbidden',    // сайт/CDN ответил 401/403/451
  RATE: 'rate',              // 429 — источник просит подождать
  NETWORK: 'network',        // DNS, таймаут, разрыв
  HTTP: 'http'               // прочие коды
};

export class SourceError extends Error {
  constructor(kind, message, info = {}) { super(message); this.kind = kind; Object.assign(this, info); }
}

const SANDBOX_RE = /no rule or allowlist entry allows host|host_not_allowed/i;
const CHALLENGE_RE = /cf-chl|challenge-platform|Just a moment\.\.\.|Attention Required|cf_captcha|captcha/i;

export function classify(status, headers, body) {
  const deny = headers?.get?.('x-deny-reason') || '';
  if (SANDBOX_RE.test(deny) || SANDBOX_RE.test(body || '')) return BLOCK.SANDBOX;
  if (CHALLENGE_RE.test(body || '') || headers?.get?.('cf-mitigated') === 'challenge') return BLOCK.CHALLENGE;
  if (status === 429) return BLOCK.RATE;
  if (status === 401 || status === 403 || status === 451) return BLOCK.FORBIDDEN;
  return BLOCK.HTTP;
}

export function createNet({ delay = 2000, fetchImpl = globalThis.fetch, log = () => {} } = {}) {
  const last = new Map(), probed = new Map();
  const wait = async host => {
    const t = last.get(host) || 0, now = Date.now();
    if (now - t < delay) await new Promise(r => setTimeout(r, delay - (now - t)));
    last.set(host, Date.now());
  };
  async function request(url, { accept, binary = false, referer, auth } = {}) {
    const u = new URL(url);
    await wait(u.host);
    const headers = { 'User-Agent': UA, 'Accept': accept || (binary ? 'image/*' : 'application/json') };
    if (referer) headers.Referer = referer;
    if (auth) headers.Authorization = 'Bearer ' + auth; // токен только из переменной окружения, в файлы не пишется
    let r;
    try { r = await fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(20000) }); }
    catch (e) {
      // За прокси среды fetch видит только «fetch failed»; один раз спрашиваем шлюз, чтобы назвать точную причину.
      if (process.env.HTTPS_PROXY && u.protocol === 'https:') {
        if (!probed.has(u.host)) probed.set(u.host, await probeHost(u.host));
        const p = probed.get(u.host);
        if (p.kind === BLOCK.SANDBOX) throw new SourceError(BLOCK.SANDBOX, `${u.host}: запрет шлюза среды — ${p.detail}`, { host: u.host, status: p.status });
      }
      throw new SourceError(BLOCK.NETWORK, `${u.host}: ${e.cause?.code || e.message}`, { host: u.host });
    }
    if (!r.ok) {
      const body = (await r.text().catch(() => '')).slice(0, 2000);
      const kind = classify(r.status, r.headers, body);
      throw new SourceError(kind, `${u.host}: HTTP ${r.status}${kind === BLOCK.SANDBOX ? ' (запрет шлюза среды)' : kind === BLOCK.CHALLENGE ? ' (антибот-проверка, не обходим)' : ''}`, { host: u.host, status: r.status, body: body.slice(0, 200) });
    }
    if (binary) return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '', finalUrl: r.url || url };
    const txt = await r.text();
    if (CHALLENGE_RE.test(txt.slice(0, 4000)) && !/^\s*[[{]/.test(txt)) throw new SourceError(BLOCK.CHALLENGE, `${u.host}: страница антибот-проверки (не обходим)`, { host: u.host, status: r.status });
    try { return JSON.parse(txt); } catch { return txt; }
  }
  return { request, json: (url, o) => request(url, o), binary: (url, o) => request(url, { ...o, binary: true }) };
}

// Диагностика одного хоста. Если задан HTTPS_PROXY (облачная песочница), читаем ответ шлюза на CONNECT:
// так видно точную причину запрета. Без прокси — обычный TLS-коннект и HEAD-запрос.
export async function probeHost(host, { timeout = 10000 } = {}) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) {
    const p = new URL(proxy);
    return new Promise(resolve => {
      const s = net.connect(+p.port || 80, p.hostname); let data = '';
      const done = res => { s.destroy(); resolve({ host, via: 'proxy', ...res }); };
      s.setTimeout(timeout, () => done({ ok: false, kind: BLOCK.NETWORK, detail: 'таймаут прокси' }));
      s.on('error', e => done({ ok: false, kind: BLOCK.NETWORK, detail: e.message }));
      s.on('connect', () => {
        let req = `CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n`;
        if (p.username) req += `Proxy-Authorization: Basic ${Buffer.from(decodeURIComponent(p.username) + ':' + decodeURIComponent(p.password)).toString('base64')}\r\n`;
        s.write(req + '\r\n');
      });
      s.on('data', c => {
        data += c.toString();
        const head = data.split('\r\n')[0];
        if (/^HTTP\/1\.\d 200/.test(head)) return done({ ok: true, kind: null, detail: 'туннель открыт' });
        if (data.includes('\r\n\r\n')) {
          const [h, body] = data.split('\r\n\r\n');
          const len = +(h.match(/content-length:\s*(\d+)/i) || [])[1] || 0;
          if (body.length >= len) {
            const deny = (h.match(/x-deny-reason:\s*(.+)/i) || [])[1] || '';
            done({ ok: false, kind: SANDBOX_RE.test(deny + body) ? BLOCK.SANDBOX : BLOCK.FORBIDDEN, status: +(head.split(' ')[1]), detail: (deny ? `x-deny-reason: ${deny}; ` : '') + body.trim() });
          }
        }
      });
      s.on('end', () => done({ ok: false, kind: BLOCK.NETWORK, detail: data.trim() || 'соединение закрыто' }));
    });
  }
  return new Promise(resolve => {
    const s = tls.connect({ host, port: 443, servername: host, timeout }, () => { s.destroy(); resolve({ host, via: 'direct', ok: true, kind: null, detail: 'TLS ok' }); });
    s.on('error', e => resolve({ host, via: 'direct', ok: false, kind: BLOCK.NETWORK, detail: e.code || e.message }));
    s.on('timeout', () => { s.destroy(); resolve({ host, via: 'direct', ok: false, kind: BLOCK.NETWORK, detail: 'таймаут' }); });
  });
}
