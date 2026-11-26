#!/usr/bin/env python3
"""(Прогон 335, 26.11) Короткие воспроизводимые проверки сторожа раннера (procguard.Pool + tools/measure/progress.js) на настоящем src/q.js и
странице игры; каждая — несколько матчей по 1–3 тыс. тиков. Игру не меняет.
  python3 tools/measure/progress_check.py <sim.html> [--only=имя,…]
Проверки:
  neutral   — отпечаток коротких матчей с модулем продвижения и без него равен (обёртка stepTick только читает tick), накладные расходы
  crash     — у идущего матча убита страница (процесс отрисовки), родитель жив: снятие сразу («страница упала»), повтор, результат годен
  hang      — матч сделал тики и встал в бесконечном цикле (CPU занят, тиков нет): снятие по порогу, повтор негоден → «результата нет»
  memlimit  — дерево матча больше лимита: снятие memlimit, без повтора
  slot      — par 2, один из трёх матчей падает: слот освобождается, следующий стартует, параллельность снова 2
  resume    — прогон снят сигналом посреди матчей: готовые сохранены, новый пул с resume берёт их, недостающие доигрывает
  recover   — нехватка памяти (критический порог поднят) снимает новый матч и снижает par; порог вернулся — par снова заданный"""
import os, sys, json, time, signal, subprocess, tempfile, threading, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); import procguard
SIM = os.path.abspath(sys.argv[1]); ONLY = next((a.split('=', 1)[1].split(',') for a in sys.argv[2:] if a.startswith('--only=')), None)
BDIR = os.environ.get('PLAYWRIGHT_BROWSERS_PATH') or '/opt/pw-browsers'
TMP = os.environ.get('PGCHECK_TMP') or tempfile.mkdtemp(prefix='pgcheck_'); FAIL = []
def code(m, ticks, tail=''):   # короткий матч: тики, затем хэш состояния ботов (как отпечаток), tail — что сделать после
    return ('freshMatch(%d); for(var t = 0; t < %d; t++) stepTick(); %s var h = 2166136261 >>> 0; bots.forEach(function(b){ [b.x, b.y, b.facing, b.hp].forEach(function(v){'
            ' var s = String(v); for(var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; }); }); JSON.stringify({tick: tick, h: h})') % (m, ticks, tail)
def task(name, m, ticks, tail='', save=False):
    d = os.path.join(TMP, name); os.makedirs(d, exist_ok=True); cf = os.path.join(d, 'code.js'); open(cf, 'w').write(code(m, ticks, tail))
    out, err, guard = [os.path.join(d, f) for f in ('out.json', 'err.txt', 'guard.json')]
    def valid(p):
        try: return json.load(open(p))['tick'] >= ticks
        except Exception: return False
    t = {'name': name, 'cmd': ['node', os.path.join(ROOT, 'src', 'q.js'), SIM, '@' + cf], 'cwd': ROOT, 'engine': 'chromium', 'out': out, 'err': err,
         'guard': guard, 'valid': valid, 'est_key': 'chromium:test'}
    if save: t['save'] = {'dir': os.path.join(TMP, 'done', name), 'meta': {'m': m, 'ticks': ticks}, 'files': [out, err, guard]}
    return t
LOG = []
def pool(par, **cfg):
    res = cfg.pop('resume', False); c = dict(hang_floor_s=20, hang_k=4, poll_s=1, tree_s=2, log_s=5); c.update(cfg)
    return procguard.Pool(par, c, BDIR, lambda s: (LOG.append(s), print('    | ' + s[:200])), resume=res)
def G(t):
    try: return json.load(open(t['guard']))
    except Exception: return {}
def ok(c, msg):
    print(('  ✓ ' if c else '  ✗ ') + msg)
    if not c: FAIL.append(msg)
def renderer_of(r):   # процесс отрисовки страницы в дереве матча
    P = procguard.procs()
    for q in procguard.tree(r['p'].pid, P):
        try:
            if b'--type=renderer' in open('/proc/%d/cmdline' % q, 'rb').read(): return q
        except OSError: pass
def when(p, cond, then, timeout=300):   # поток: дождаться условия по пулу и сделать действие
    def run():
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                if cond(p): then(p); return
            except Exception as e: print('    поток проверки:', e)
            time.sleep(0.5)
    threading.Thread(target=run, daemon=True).start()
def ran(name): return name if not ONLY or name in ONLY else None

if ran('neutral'):
    print('neutral: отпечаток с модулем продвижения = без него')
    res = {}
    for on in (False, True):
        p = pool(2, progress=on); ts = [task('n%d_%d' % (on, m), m, 2600) for m in (3, 7)]
        for t in ts: p.add(t)
        t0 = time.time(); p.wait_all(); res[on] = ([open(t['out']).read().strip() for t in ts], time.time() - t0, [G(t).get('progress_reports') for t in ts])
    ok(res[False][0] == res[True][0] and all(res[False][0]), 'отпечатки равны: %s' % res[True][0])
    ok(all((n or 0) >= 4 for n in res[True][2]), 'отчёты о тиках пришли (2600 тиков — 4 отчёта): %s' % res[True][2])
    print('    время: без модуля %.1f с, с модулем %.1f с' % (res[False][1], res[True][1]))
if ran('crash'):
    print('crash: страница убита, родитель (node q.js) жив')
    p = pool(1); t = task('crash', 3, 3000); p.add(t); st = {}
    def kill(p):
        r = p.run[0]; q = renderer_of(r); st['t'] = time.monotonic(); st['tick'] = r['tick']; os.kill(q, 9); print('    убит процесс отрисовки', q, 'на тике', r['tick'])
    when(p, lambda p: p.run and p.run[0]['pn'] >= 2 and not p.run[0]['t'].get('attempt'), kill)
    p.wait_all()
    a = [x for x in p.attempts if x['task'] == 'crash']
    g0 = json.load(open(os.path.join(TMP, 'crash', 'guard.json'))) if False else None
    ok(len(a) == 2 and ((a[0]['stopped'] or '').startswith('страница упала') or not a[0]['ok']), 'первая попытка — сбой (%s)' % (a[0]['stopped'] or 'q.js вышел сам с ошибкой' if a else None))
    ok(a and a[0]['end'] - st.get('t', 0) < 5, 'снят за %.1f с после падения' % (a[0]['end'] - st.get('t', 0) if a else -1))
    ok(len(a) == 2 and a[1]['ok'], 'повтор годен')
if ran('zombie'):
    print('zombie (как 335): процесс отрисовки замер (SIGSTOP) — события падения нет, q.js ждёт, CPU не растёт')
    p = pool(1); t = task('zombie', 3, 3000); p.add(t); st = {}
    def freeze(p):
        r = p.run[0]; q = renderer_of(r); st['t'] = time.monotonic(); st['q'] = q; os.kill(q, signal.SIGSTOP); print('    заморожен процесс отрисовки', q, 'на тике', r['tick'])
    when(p, lambda p: p.run and p.run[0]['pn'] >= 2 and not p.run[0]['t'].get('attempt'), freeze)
    p.wait_all()
    a = [x for x in p.attempts if x['task'] == 'zombie']
    ok(a and (a[0]['stopped'] or '').startswith('зависание'), 'снят как зависание: %s' % (a[0]['stopped'] if a else None))
    ok(a and a[0]['end'] - st.get('t', 0) < 20 + 8, 'снят через %.0f с (порог 20 с в проверке)' % (a[0]['end'] - st.get('t', 0) if a else -1))
    ok(len(a) == 2 and a[1]['ok'], 'повтор годен')
if ran('hang'):
    print('hang: тики, затем бесконечный цикл')
    p = pool(1, retries=1); t = task('hang', 3, 1300, 'while(true){}'); p.add(t); t0 = time.time(); p.wait_all()
    a = [x for x in p.attempts if x['task'] == 'hang']
    ok(a and (a[0]['stopped'] or '').startswith('зависание'), 'снят как зависание: %s' % (a[0]['stopped'] if a else None))
    ok(len(a) == 2 and not a[1]['ok'] and any('результата нет' in s for s in LOG), 'повтор тоже завис — «результата нет», без бесконечных повторов')
if ran('memlimit'):
    print('memlimit: лимит дерева 300 МБ')
    p = pool(1, match_mem_mb=300); t = task('mem', 3, 3000); p.add(t); p.wait_all()
    a = [x for x in p.attempts if x['task'] == 'mem']
    ok(len(a) == 1 and (a[0]['stopped'] or '').startswith('memlimit'), 'снят memlimit, без повтора: %s' % (a[0]['stopped'] if a else None))
if ran('slot'):
    print('slot: par 2, три матча, первый падает')
    p = pool(2); ts = [task('s%d' % i, m, 2000) for i, m in enumerate((3, 7, 11))]
    for t in ts: p.add(t)
    when(p, lambda p: any(r['t']['name'] == 's0' and r['pn'] >= 1 and not r['t'].get('attempt') for r in p.run),
         lambda p: os.kill(renderer_of([r for r in p.run if r['t']['name'] == 's0'][0]), 9))
    p.wait_all(); A = p.attempts
    s0 = [x for x in A if x['task'] == 's0']; s2 = [x for x in A if x['task'] == 's2']
    ok(s0 and s2 and s2[0]['start'] < s0[0]['end'] + 5, 'после падения s0 сразу стартовал следующий (s2 через %.1f с)' % (s2[0]['start'] - s0[0]['end'] if s0 and s2 else -1))
    ok(all(G(t).get('ok') for t in ts), 'все три годны (s0 — повтором)')
    ok(max(x['par_seen_max'] for x in A) == 2, 'параллельность 2 держалась')
if ran('resume'):
    print('resume: снятие сигналом посреди прогона, затем продолжение')
    spec = os.path.join(TMP, 'resume.py'); open(spec, 'w').write(
        'import sys, json; sys.path.insert(0, %r); sys.argv = [%r, %r]; __file__ = sys.argv[0]\nexec(open(%r).read().split("\\nif ran(")[0])\n'
        'p = pool(2, resume=True)\nfor i, (m, n) in enumerate(((3, 1300), (7, 1300), (11, 6000), (13, 6000))): p.add(task("r%%d" %% i, m, n, save=True))\n'
        'p.wait_all()\n' % (HERE, __file__, SIM, os.path.abspath(__file__)))
    env = dict(os.environ, PGCHECK_TMP=TMP)
    pr = subprocess.Popen([sys.executable, spec], env=env); t0 = time.time()
    while time.time() - t0 < 240 and len([d for d in ('r0', 'r1') if os.path.exists(os.path.join(TMP, 'done', d, 'meta.json'))]) < 2: time.sleep(1)
    time.sleep(3); pr.send_signal(signal.SIGTERM); pr.wait(60)
    saved = sorted(d for d in os.listdir(os.path.join(TMP, 'done')) if os.path.exists(os.path.join(TMP, 'done', d, 'meta.json')))
    ok(saved == ['r0', 'r1'], 'после снятия сохранены готовые: %s' % saved)
    LOG.clear(); p = pool(2, resume=True); ts = [task('r%d' % i, m, n, save=True) for i, (m, n) in enumerate(((3, 1300), (7, 1300), (11, 6000), (13, 6000)))]
    for t in ts: p.add(t)
    p.wait_all()
    ok(sum('взят сохранённый результат' in s for s in LOG) == 2, 'продолжение взяло 2 сохранённых, доиграло 2')
    ok(all(G(t).get('ok') for t in ts), 'все 4 годны')
if ran('recover'):
    print('recover: нехватка памяти → par вниз; память вернулась → par снова 3')
    p = pool(3, recover_s=3, critical_polls=2); ts = [task('c%d' % i, m, 2600) for i, m in enumerate((3, 7, 11, 13, 17, 19))]
    for t in ts: p.add(t)
    real = p.critical
    when(p, lambda p: len(p.run) == 3 and all(r['pn'] >= 1 for r in p.run), lambda p: setattr(p, 'critical', 10 ** 7))
    when(p, lambda p: p.cap < 3, lambda p: setattr(p, 'critical', real))
    p.wait_all()
    caps = [c[1] for c in p.cap_log]
    ok(caps and min(caps) < 3 and 3 in caps[caps.index(min(caps)):], 'par: %s' % caps)
    ok(all(G(t).get('ok') for t in ts), 'все 6 годны (снятый при нехватке — повтором)')
shutil.rmtree(TMP, ignore_errors=True)
print('итог: ' + ('всё прошло' if not FAIL else 'НЕ ПРОШЛО: ' + '; '.join(FAIL))); sys.exit(1 if FAIL else 0)
