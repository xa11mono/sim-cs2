#!/usr/bin/env python3
"""Диагностика памяти (аудит v598): ОЗУ процессов Chromium + JS heap по фазам загрузки/игры/3D.
Только читает готовые страницы; рабочий код не меняет.

Запуск: python docs/audit/architecture/instruments/mem_probe.py --map ancient --headed
Меряет: базовую память браузера, после готовности (разминка), после 10 с матча, после включения 3D.
RSS — сумма WorkingSet64 всех процессов chrome (наш браузер — единственный); JS heap — performance.memory и CDP.
"""
import argparse, http.server, json, os, socketserver, subprocess, threading, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
RESULT_DIR = os.path.abspath(os.path.join(HERE, '..', 'results'))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'public, max-age=3600')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()


def serve(port):
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', port), Handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def rss_mb():
    try:
        out = subprocess.run(['powershell', '-NoProfile', '-Command',
                              '$p=Get-Process chrome -ErrorAction SilentlyContinue; if($p){\"\"+[math]::Round(($p|Measure-Object WorkingSet64 -Sum).Sum/1MB,1)+\" \"+[math]::Round(($p|Measure-Object PrivateMemorySize64 -Sum).Sum/1MB,1)}else{\"0 0\"}'],
                             capture_output=True, text=True, timeout=30).stdout.strip()
        parts = out.split(); return {'ws_mb': float(parts[0]), 'priv_mb': float(parts[1])} if len(parts) == 2 else None
    except Exception:
        return None


def snap(page, cdp, label):
    m = page.evaluate("""() => performance.memory ? { used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize } : null""")
    heap = cdp.send('Runtime.getHeapUsage')
    dom = cdp.send('Memory.getDOMCounters')
    ua = page.evaluate("""async () => {
        try {
            const m = await performance.measureUserAgentSpecificMemory();
            return { bytes: m.bytes, breakdown: m.breakdown.map(b => ({ bytes: b.bytes, types: b.types,
                     url: b.url ? b.url.slice(0, 60) : null })) };
        } catch (e) { return { error: String(e) }; }
    }""")
    s = {'label': label, 'rss_mb': rss_mb(), 'ua_memory': ua,
         'js_heap_used_mb': round(m['used'] / 1048576, 1) if m else None,
         'js_heap_total_mb': round(m['total'] / 1048576, 1) if m else None,
         'cdp_heap_used_mb': round(heap['usedSize'] / 1048576, 1), 'cdp_heap_total_mb': round(heap['totalSize'] / 1048576, 1),
         'dom_nodes': dom['nodes'], 'dom_documents': dom['documents']}
    print('  ', {k: (v if k != 'ua_memory' or 'error' in v else {'bytes_mb': round(v['bytes'] / 1048576, 1)}) for k, v in s.items()})
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--map', required=True)
    ap.add_argument('--headed', action='store_true')
    ap.add_argument('--port', type=int, default=8793)
    a = ap.parse_args()
    serve(a.port)
    url = 'http://127.0.0.1:%d/%s-radar.html' % (a.port, a.map)
    out = {'map': a.map, 'phases': [], 'conditions': {'headed': a.headed, 'rss': 'сумма WorkingSet64 процессов chrome'}}
    with sync_playwright() as p:
        s = {'label': 'браузер запущен (about:blank)', 'rss_mb': rss_mb(), 'js_heap_used_mb': None}
        out['phases'].append(s)
        print(s)
        browser = p.chromium.launch(headless=not a.headed, args=['--enable-precise-memory-info'])
        s = {'label': 'до открытия страницы', 'rss_mb': rss_mb()}
        out['phases'].append(s)
        print(s)
        ctx = browser.new_context(viewport={'width': 1400, 'height': 900})
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        cdp.send('Runtime.enable')
        page.goto(url, wait_until='commit', timeout=180000)
        page.wait_for_function("() => { const b = document.getElementById('btnWarmSkip'); return !!b && getComputedStyle(b).display !== 'none'; }",
                               timeout=180000, polling=50)
        page.wait_for_timeout(2000)
        out['phases'].append(snap(page, cdp, 'готово (разминка идёт)'))
        page.evaluate("() => { const b = document.getElementById('btnWarmSkip'); if (b) b.click(); }")
        page.wait_for_timeout(10000)
        out['phases'].append(snap(page, cdp, 'матч идёт 10 с'))
        page.evaluate("() => { const b = document.getElementById('btn3d'); if (b) b.click(); }")
        page.wait_for_timeout(5000)
        out['phases'].append(snap(page, cdp, '3D включён 5 с'))
        page.evaluate("() => { const b = document.getElementById('btn3d'); if (b) b.click(); }")
        page.wait_for_timeout(3000)
        out['phases'].append(snap(page, cdp, '3D выключен 3 с'))
        ctx.close()
        browser.close()
        time.sleep(2)
        out['phases'].append({'label': 'браузер закрыт', 'rss_mb': rss_mb()})
        print(out['phases'][-1])
    os.makedirs(RESULT_DIR, exist_ok=True)
    f = os.path.join(RESULT_DIR, 'memory_%s.json' % a.map)
    json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('json ->', f)


if __name__ == '__main__':
    main()

