#!/usr/bin/env python3
"""Диагностика загрузки и кадров (аудит v598). Только читает готовые страницы; рабочий код не меняет.

Что делает:
 1) делает из готовой страницы измерительную копию (вставка performance.mark в известные точки: начало скрипта,
    литерал MAP, SND_DATA, отметки, rebuildNav на загрузке, freshMatch, warmStart, конец скрипта) — данные и логика те же;
 2) поднимает локальный HTTP-сервер (Cache-Control: max-age), чтобы отделить холодную загрузку от повторной;
 3) в Chromium (Playwright) снимает: навигационные метки, метки фаз, первый кадр, long tasks, память (JS heap, DOM),
    CPU-профиль старта (атрибуция по функциям: zInflate, m3Load, rebuildNav, freshMatch …), FPS 2D в живом матче и 3D;
 4) пишет сырые прогоны в JSON.

Запуск:
  python docs/audit/architecture/instruments/load_probe.py --map ancient --runs 3
  python docs/audit/architecture/instruments/load_probe.py --map mirage --runs 3 --headed
  (--no-3d — не мерить 3D; --fps-ms — окно замера кадров)
"""
import argparse, http.server, json, os, re, socketserver, statistics, threading, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
PROBE_DIR = os.path.join(ROOT, '.tmp', 'probe')
RESULT_DIR = os.path.abspath(os.path.join(HERE, '..', 'results'))

INIT = r"""
(() => {
  if (window.__T && window.__T.m) { return; }
  window.__T = function (n) { (window.__T.m = window.__T.m || {})[n] = performance.now(); };
  window.__T.m = {};
  window.__long = [];
  try {
    new PerformanceObserver(function (l) {
      for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime * 10) / 10, Math.round(e.duration * 10) / 10]);
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
  const raf = window.requestAnimationFrame.bind(window);
  window.__frames = [];
  window.requestAnimationFrame = function (cb) {
    return raf(function (ts) {
      if (window.__frames.length < 300000) window.__frames.push(Math.round(ts * 10) / 10);
      return cb(ts);
    });
  };
})();
"""


# ---------- измерительная копия страницы ----------
def brace_end(s, at):
    i = s.index('{', at)
    depth = 0
    q = None
    j = i
    while j < len(s):
        c = s[j]
        if q:
            if c == '\\':
                j += 2
                continue
            if c == q:
                q = None
        elif c in '"\'':
            q = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return j + 1
        j += 1
    raise ValueError('нет конца объекта')


def instrument(html):
    m = max(re.finditer(r'<script>([\s\S]*?)</script>', html), key=lambda x: len(x.group(1)))
    ins = [(m.start() + len('<script>'), "__T('s0');")]
    at = html.index('var MAP=')
    ins.append((at, "__T('map0');"))
    ins.append((brace_end(html, at), ";__T('map1');"))
    at = html.find('var SND_DATA=')
    if at >= 0:
        ins.append((at, "__T('snd0');"))
        ins.append((brace_end(html, at), ";__T('snd1');"))
    at = html.find('var __SNAP=')
    w = html.find('var WARM=', at)
    if at >= 0 and w > at:
        ins.append((at, "__T('mk0');"))
        ins.append((w, "__T('mk1');"))
    # первый rebuildNav() на загрузке — тот, после которого определяется makeHeap (050_nav_rebuild_paths.js)
    at = html.find('rebuildNav();function makeHeap()')
    if at >= 0:
        shift = 0
        if at > ins[0][0]:
            # позиции ins уже собраны по исходной строке — вставка здесь не сдвигает предыдущие
            shift = 0
        ins.append((at, "__T('nav0');"))
        ins.append((at + len('rebuildNav();'), "__T('nav1');"))
    at = html.find('freshMatch(n);')
    if at >= 0:
        ins.append((at, "__T('fm0');"))
        ins.append((at + len('freshMatch(n);'), "__T('fm1');"))
    at = html.find('warmStart(1);')
    if at >= 0:
        ins.append((at, "__T('w0');"))
        ins.append((at + len('warmStart(1);'), "__T('w1');"))
    ins.append((m.end() - len('</script>'), "__T('s1');"))
    for pos, txt in sorted(ins, reverse=True):
        html = html[:pos] + txt + html[pos:]
    return html


def prepare(mapname, src):
    os.makedirs(PROBE_DIR, exist_ok=True)
    html = open(os.path.join(ROOT, src), encoding='utf-8').read()
    out = os.path.join(PROBE_DIR, mapname + '-instr.html')
    open(out, 'w', encoding='utf-8').write(instrument(html))
    return out


# ---------- HTTP ----------
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'public, max-age=3600')
        super().end_headers()


def serve(port):
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', port), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


# ---------- снятие ----------
def collect(page, cdp):
    nav = page.evaluate("""() => {
        const n = performance.getEntriesByType('navigation')[0] || {};
        const p = {}; performance.getEntriesByType('paint').forEach(e => p[e.name] = Math.round(e.startTime * 10) / 10);
        return { nextHop: n.nextHopProtocol, transfer: n.transferSize, encoded: n.encodedBodySize, decoded: n.decodedBodySize,
                 responseEnd: n.responseEnd, domInteractive: n.domInteractive, dcl: n.domContentLoadedEventEnd,
                 load: n.loadEventEnd, duration: n.duration, paints: p,
                 marks: (window.__T && window.__T.m) || {}, frames: (window.__frames || []).slice(0, 3),
                 frameCount: (window.__frames || []).length };
    }""")
    mem = page.evaluate("""() => performance.memory ? { used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize, limit: performance.memory.jsHeapSizeLimit } : null""")
    heap = cdp.send('Runtime.getHeapUsage')
    dom = cdp.send('Memory.getDOMCounters')
    return {'nav': nav, 'memory': mem, 'heap': {'used': heap['usedSize'], 'total': heap['totalSize']},
            'dom': dom}


def profile_summary(cdp):
    prof = cdp.send('Profiler.stop')['profile']
    nodes = {n['id']: n for n in prof['nodes']}
    per = {}
    total = 0
    for sid, dt in zip(prof['samples'], prof['timeDeltas']):
        n = nodes.get(sid)
        if not n:
            continue
        name = n['callFrame']['functionName'] or '(anonymous)'
        per[name] = per.get(name, 0) + dt
        total += dt
    top = sorted(per.items(), key=lambda kv: -kv[1])[:70]
    return {'total_us': total, 'top': [{'fn': k, 'ms': round(v / 1000, 1), 'pct': round(100 * v / total, 1)} for k, v in top]}


def sample_frames(page, ms):
    page.evaluate("() => { window.__sT = performance.now(); window.__sI = (window.__frames || []).length; }")
    page.wait_for_timeout(ms)
    data = page.evaluate("""() => {
        const t0 = window.__sT, i0 = window.__sI || 0;
        const raw = (window.__frames || []).slice(i0).filter(t => t >= t0); const f = [...new Set(raw)];
        const long = (window.__long || []).filter(e => e[0] >= t0);
        return { frames: f, long };
    }""")
    f = data['frames']
    d = [round(f[i] - f[i - 1], 1) for i in range(1, len(f))]
    if not d:
        return {'frames': len(f), 'fps': None}
    d.sort()
    pct = lambda q: d[min(len(d) - 1, int(len(d) * q))]
    span = f[-1] - f[0]
    return {'frames': len(f), 'span_ms': round(span, 1), 'fps': round(1000 * (len(f) - 1) / span, 1) if span > 0 else None,
            'frame_ms': {'mean': round(statistics.mean(d), 2), 'p50': pct(0.5), 'p95': pct(0.95), 'max': d[-1]},
            'long': {'n': len(data['long']), 'total_ms': round(sum(e[1] for e in data['long']), 1),
                     'max_ms': max([e[1] for e in data['long']] or [0])}}


READY = """() => (window.__T && window.__T.m && window.__T.m.w1) ||
        (() => { const b = document.getElementById('btnWarmSkip');
                 return !!b && getComputedStyle(b).display !== 'none'; })()"""


def run_load(browser, url, do_profile=True, wait_extra=800, fps_ms=8000):
    ctx = browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
    ctx.add_init_script(INIT)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append('console:' + m.type + ':' + m.text[:200]) if m.type == 'error' else None)
    cdp = ctx.new_cdp_session(page)
    cdp.send('Profiler.enable')
    cdp.send('Profiler.setSamplingInterval', {'interval': 200})
    cdp.send('Runtime.enable')
    if do_profile:
        cdp.send('Profiler.start')
    t_wall = time.time()
    page.goto(url, wait_until='commit', timeout=180000)
    try:
        page.wait_for_function(READY, timeout=180000, polling=50)
    except Exception as e:
        errors.append('wait_ready:' + type(e).__name__)
    ready_wall = time.time() - t_wall
    page.wait_for_timeout(wait_extra)
    data = collect(page, cdp)
    data['ready_wall_s'] = round(ready_wall, 2)
    if do_profile:
        data['profile'] = profile_summary(cdp)
    data['errors'] = errors[:6]
    # живая симуляция: закончить разминку («Начать матч») и мерить кадры в матче
    try:
        page.evaluate("() => { const b = document.getElementById('btnWarmSkip'); if (b) b.click(); }")
        page.wait_for_timeout(5000)
    except Exception as e:
        errors.append('live:' + type(e).__name__)
    data['fps_2d'] = sample_frames(page, fps_ms)
    data['memory_after_2d'] = page.evaluate("""() => performance.memory ? { used: performance.memory.usedJSHeapSize } : null""")
    data['heap_after_2d'] = cdp.send('Runtime.getHeapUsage')['usedSize']
    return ctx, page, cdp, data


def run_3d(page, cdp, fps_ms):
    out = {'ok': False}
    try:
        page.evaluate("() => { const b = document.getElementById('btn3d'); if (b) b.click(); }")
        page.wait_for_timeout(3000)
        st = page.evaluate("() => window.__d3stat || null")
        out['ok'] = bool(st)
        out['stat'] = st
        out['fps'] = sample_frames(page, fps_ms)
        out['memory'] = page.evaluate("() => performance.memory ? { used: performance.memory.usedJSHeapSize } : null")
        out['heap'] = cdp.send('Runtime.getHeapUsage')['usedSize']
        out['dom'] = cdp.send('Memory.getDOMCounters')
    except Exception as e:
        out['error'] = type(e).__name__ + ': ' + str(e)[:200]
    return out


def machine():
    import platform, subprocess
    info = {'os': platform.platform(), 'python': platform.python_version()}
    try:
        info['cpu'] = subprocess.run(['powershell', '-NoProfile', '-Command',
                                      '(Get-CimInstance Win32_Processor).Name; (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory'],
                                     capture_output=True, text=True, timeout=30).stdout.strip().splitlines()
    except Exception:
        pass
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--map', required=True)
    ap.add_argument('--src', default=None, help='файл страницы (по умолчанию <map>-radar.html)')
    ap.add_argument('--runs', type=int, default=3)
    ap.add_argument('--headed', action='store_true')
    ap.add_argument('--no-3d', action='store_true')
    ap.add_argument('--no-control', action='store_true')
    ap.add_argument('--fps-ms', type=int, default=8000)
    ap.add_argument('--port', type=int, default=8791)
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    src = a.src or (a.map + '-radar.html')
    instr = prepare(a.map, src)
    srv = serve(a.port)
    base = 'http://127.0.0.1:%d/' % a.port
    url_instr = base + os.path.relpath(instr, ROOT).replace('\\', '/')
    url_orig = base + src
    result = {'map': a.map, 'src': src, 'machine': machine(),
              'conditions': {'headed': a.headed, 'viewport': '1400x900',
                             'http': 'локальный сервер, Cache-Control: max-age=3600',
                             'instrumented': True, 'fps_ms': a.fps_ms, 'runs': a.runs},
              'cold': [], 'warm': [], 'control': None, '3d': None}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not a.headed, args=[
            '--enable-precise-memory-info', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion',
            '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'])
        gpu = browser.new_page()
        gpu.goto('about:blank')
        result['gpu'] = gpu.evaluate("""() => { const c = document.createElement('canvas'), gl = c.getContext('webgl2');
            if (!gl) return 'no webgl2'; const e = gl.getExtension('WEBGL_debug_renderer_info');
            return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); }""")
        gpu.close()
        for i in range(a.runs):
            ctx, page, cdp, d = run_load(browser, url_instr, do_profile=(i < 2), fps_ms=a.fps_ms)
            d['run'] = i + 1
            result['cold'].append(d)
            # повторная загрузка в том же контексте — из кэша
            t_wall = time.time()
            page.goto(url_instr, wait_until='commit', timeout=180000)
            try:
                page.wait_for_function(READY, timeout=180000, polling=50)
            except Exception:
                pass
            warm_wall = time.time() - t_wall
            page.wait_for_timeout(800)
            wd = collect(page, cdp)
            wd['run'] = i + 1
            wd['ready_wall_s'] = round(warm_wall, 2)
            wd['fps_2d'] = sample_frames(page, 3000)
            result['warm'].append(wd)
            if i == a.runs - 1 and not a.no_3d:
                result['3d'] = run_3d(page, cdp, a.fps_ms)
            ctx.close()
        if not a.no_control:
            ctx, page, cdp, d = run_load(browser, url_orig, do_profile=False, fps_ms=3000)
            result['control'] = {'ready_wall_s': d['ready_wall_s'], 'nav': d['nav'], 'errors': d['errors'],
                                 'fps_2d': d['fps_2d'], 'memory': d['memory']}
            ctx.close()
        browser.close()
    os.makedirs(RESULT_DIR, exist_ok=True)
    out = a.out or os.path.join(RESULT_DIR, 'load_raw_%s.json' % a.map)
    json.dump(result, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('json ->', out)

    def med(xs):
        xs = [x for x in xs if x is not None]
        return round(statistics.median(xs), 1) if xs else None
    for tag in ('cold', 'warm'):
        runs = result[tag]
        if not runs:
            continue
        marks = [r['nav']['marks'] for r in runs]
        keys = ['s0', 'map0', 'map1', 'snd0', 'snd1', 'mk0', 'mk1', 'nav0', 'nav1', 'fm0', 'fm1', 'w0', 'w1', 's1']
        print(tag, 'run1 marks:', {k: marks[0].get(k) for k in keys if k in marks[0]})
        print(tag, 'ready wall s:', [r['ready_wall_s'] for r in runs])
        print(tag, 'fps2d:', [r['fps_2d'].get('fps') for r in runs])
    print('gpu:', result['gpu'])
    if result['3d']:
        print('3d:', json.dumps({k: result['3d'].get(k) for k in ('ok', 'stat', 'fps')}, ensure_ascii=False)[:600])


if __name__ == '__main__':
    main()


