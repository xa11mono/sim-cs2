#!/usr/bin/env python3
"""Точечная проверка (аудит v598): сколько миллисекунд занимает именно вызов rebuildNav на загрузке,
и не попадает ли в метку nav0..nav1 что-то ещё. Только чтение готовой страницы + измерительная копия.
Запуск: python docs/audit/architecture/instruments/nav_timing.py --map ancient
"""
import argparse, http.server, json, os, socketserver, threading
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--map', default='ancient')
    ap.add_argument('--port', type=int, default=8795)
    a = ap.parse_args()
    html = open(os.path.join(ROOT, a.map + '-radar.html'), encoding='utf-8').read()
    old = 'rebuildNav();function makeHeap()'
    assert old in html
    new = ("__T('nav0');(function(){var t=performance.now();rebuildNav();"
           "(window.__T.m.nav_ms=(window.__T.m.nav_ms||0)+(performance.now()-t));})();"
           "__T('nav1');function makeHeap()")
    html = html.replace(old, new, 1)
    os.makedirs(os.path.join(ROOT, '.tmp', 'probe'), exist_ok=True)
    out = os.path.join(ROOT, '.tmp', 'probe', a.map + '-nav.html')
    open(out, 'w', encoding='utf-8').write(html)

    class HH(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *x, **kw):
            super().__init__(*x, directory=ROOT, **kw)

        def log_message(self, *x):
            pass

    srv = socketserver.ThreadingTCPServer(('127.0.0.1', a.port), HH)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:%d/.tmp/probe/%s-nav.html' % (a.port, a.map)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context()
        ctx.add_init_script("window.__T=function(n){(window.__T.m=window.__T.m||{})[n]=performance.now();};window.__T.m={};")
        pg = ctx.new_page()
        pg.goto(url, wait_until='commit', timeout=180000)
        pg.wait_for_function("() => window.__T && window.__T.m && window.__T.m.w1", timeout=180000, polling=50)
        m = pg.evaluate("() => window.__T.m")
        print('nav0..nav1 =', round(m['nav1'] - m['nav0'], 1), 'мс; внутри вызова rebuildNav =', round(m['nav_ms'], 1), 'мс')
        ctx.close(); b.close()


if __name__ == '__main__':
    main()
