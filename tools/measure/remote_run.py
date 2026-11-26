#!/usr/bin/env python3
"""Прогоны замера на ПК владельца (исполнитель GitHub, .github/workflows/measure.yml). Игру не меняет.
Задание — tools/measure/request.json в ветке measure/<что-угодно> (v459: можно и "shots" — снимки повтора клатча):
  {"par": 6, "jobs": [{"label": "b1fix_anc", "ref": "b1-walk-who", "map": "ancient", "matches": [3,7,11,13,17,19,23,29]}, ...]}
ref — ветка или коммит, чью игру играть; инструменты замера (сторож, раннер) берутся из текущей ветки measure/…
Для каждого задания: сборка игры ref во временную папку → walk_run.py (сторож ходьбы + обычный сторож) → tools/measure/runs/<label>/.
Папку runs исполнитель выкладывает артефактом. Запуск руками: python tools/measure/remote_run.py [путь к request.json]"""
import sys, os, json, subprocess, shutil, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
PY = sys.executable
sys.path.insert(0, HERE); import procguard   # (Р2.6) защита памяти ПК

# вне папки репо: открытый Get-Content -Wait держит файл, и GitHub не мог почистить папку перед следующим заданием
LOG = os.path.join(os.path.expanduser('~'), 'simcs2_run.log')   # смотреть на ПК: Get-Content $HOME\simcs2_run.log -Wait -Encoding UTF8
def log(line):
    print(line, flush=True)
    with open(LOG, 'a', encoding='utf-8') as f: f.write(line + '\n')
def sh(args, **kw):
    log('> ' + ' '.join(str(a) for a in args))
    p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', **kw)
    for line in p.stdout: log(line.rstrip())
    if p.wait(): raise subprocess.CalledProcessError(p.returncode, args)

PW_VER = '1.63.0'   # (Р0.1, 24.11) = облако: Chromium 158.0.8127.36 (rebuild/ENVIRONMENT.md); другая версия браузера — другой Math, матчи расходятся
def ensure_playwright():
    # playwright — вне папки репо, чтобы чистка рабочей папки исполнителем его не стирала
    home = os.path.join(os.path.expanduser('~'), '.simcs2_node')
    pj = os.path.join(home, 'node_modules', 'playwright', 'package.json')
    have = json.load(open(pj, encoding='utf-8')).get('version') if os.path.exists(pj) else None
    if have != PW_VER:
        os.makedirs(home, exist_ok=True)
        npm = shutil.which('npm') or shutil.which('npm.cmd')
        sh([npm, 'install', '--prefix', home, 'playwright@' + PW_VER])
        npx = os.path.join(home, 'node_modules', '.bin', 'playwright.cmd' if os.name == 'nt' else 'playwright')
        sh([npx, 'install', 'chromium'], cwd=home)
    os.environ['NODE_PATH'] = os.path.join(home, 'node_modules')
    # (v459) браузер — тоже в своей папке: исполнитель как служба Windows (учётная запись SYSTEM) не видит браузер из профиля
    # пользователя («Executable doesn't exist … systemprofile … headless_shell.exe» — ни один матч не начинался). Нет — поставить
    os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.join(home, 'ms-playwright')
    exe = subprocess.run(['node', '-e', "process.stdout.write(require('playwright').chromium.executablePath())"],
                         capture_output=True, text=True, cwd=home).stdout.strip()
    if not exe or not os.path.exists(exe):
        npx = os.path.join(home, 'node_modules', '.bin', 'playwright.cmd' if os.name == 'nt' else 'playwright')
        sh([npx, 'install', 'chromium'], cwd=home)
    log('playwright ' + PW_VER + ', браузеры: ' + os.environ['PLAYWRIGHT_BROWSERS_PATH'])

BUILT, REFS = {}, {}


def resolve_ref(ref):
    if ref not in REFS:
        # Полный SHA уже может быть в checkout. Имена веток фиксируются одним fetch за запрос.
        sha = None
        if len(ref) == 40 and all(c in '0123456789abcdef' for c in ref):
            found = subprocess.run(['git', 'rev-parse', '--verify', ref + '^{commit}'], cwd=ROOT,
                                   capture_output=True, text=True)
            if found.returncode == 0:
                sha = found.stdout.strip()
        if sha is None:
            sh(['git', 'fetch', '--quiet', 'origin', ref], cwd=ROOT)
            sha = subprocess.check_output(['git', 'rev-parse', '--verify', 'FETCH_HEAD^{commit}'], cwd=ROOT, text=True).strip()
        REFS[ref] = REFS[sha] = sha
    return REFS[ref]


def build(ref, mapname, out, core=False):
    sha = resolve_ref(ref)
    key = (sha, mapname, core)
    cached = BUILT.get(key)
    if cached and os.path.isfile(cached):
        if os.path.abspath(cached) != os.path.abspath(out):
            shutil.copyfile(cached, out)
        return sha
    tmp = tempfile.mkdtemp(prefix='simbuild_')
    try:
        sh(['git', '-c', 'core.autocrlf=false', 'worktree', 'add', '--quiet', '--detach', '--force', tmp, sha], cwd=ROOT)
        builder = ('tools', 'node', 'core_build.py') if core else ('src', 'build.py')
        sh([PY, os.path.join(tmp, *builder), '--map', mapname, out], cwd=tmp)
    finally:
        subprocess.run(['git', 'worktree', 'remove', '--force', tmp], cwd=ROOT)
    BUILT[key] = out
    return sha


def versions(engines):
    """Один запуск проверки среды, по одному запуску каждого используемого браузера."""
    script = """
    const p = require('playwright');
    const result = {
      node: process.version, node_v8: process.versions.v8, arch: process.arch, platform: process.platform,
      playwright: require('playwright/package.json').version, browsers: {}
    };
    (async () => {
      for (const engine of process.argv.slice(1)) {
        const browser = await p[engine].launch();
        try {
          const page = await browser.newPage();
          const ua = await page.evaluate(() => navigator.userAgent);
          const row = result.browsers[engine] = {version: browser.version(), ua};
          if (engine === 'chromium') {
            const session = await browser.newBrowserCDPSession();
            row.v8 = (await session.send('Browser.getVersion')).jsVersion;
          }
        } finally {
          await browser.close();
        }
      }
      console.log(JSON.stringify(result));
    })().catch(error => { console.error(error); process.exitCode = 1; });
    """
    v = subprocess.run(['node', '-e', script, *sorted(engines - {'node'})], cwd=ROOT,
                       check=True, capture_output=True, text=True, timeout=120)
    result = json.loads(v.stdout)
    chromium = result['browsers'].get('chromium')
    if chromium:
        result.update(chromium=chromium['version'], chromium_ua=chromium['ua'], chromium_v8=chromium['v8'])
    return result


def main():
    BUILT.clear(); REFS.clear()
    open(LOG, 'w', encoding='utf-8').close()
    req = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'request.json'), encoding='utf-8'))
    ensure_playwright()
    # (Р0.1, 24.11) среда рядом с каждым результатом: runs/<label>/env.json (Playwright, Chromium, Node, ОС)
    for k, v in req.items():
        if k == 'fp': continue  # проверка среды общая для всех фаз отпечатков
        for j in (v if isinstance(v, list) else []):
            if isinstance(j, dict) and j.get('label'):
                d = os.path.join(ROOT, 'tools', 'measure', 'runs', j['label']); os.makedirs(d, exist_ok=True)
                sh(['node', os.path.join(HERE, 'env.js'), os.path.join(d, 'env.json')], cwd=os.path.join(os.path.expanduser('~'), '.simcs2_node'))
    par = int(req.get('par', 6)); sims = os.path.join(ROOT, 'tools', 'measure', 'runs', '_sims'); os.makedirs(sims, exist_ok=True)
    # сначала собрать все версии, потом все матчи одной очередью (освободилось место — сразу следующий матч любой версии)
    jobargs = []; mset = None
    # (v459) снимки экрана: {"shots": [{"label", "ref", "map", "match", "round", "step"?, "n"?}]} — tools/marks/clutch_replay_shot.js
    for j in req.get('shots', []):
        sim = os.path.join(sims, j['label'] + '.html'); build(j['ref'], j.get('map', 'ancient'), sim)
        out = os.path.join(ROOT, 'tools', 'measure', 'runs', j['label']); os.makedirs(out, exist_ok=True)
        scr = {'timeout': 'timeout_shot.js', 'snap': 'snap_round.js'}.get(j.get('kind'), 'clutch_replay_shot.js')
        if scr == 'snap_round.js':
            sh(['node', os.path.join(ROOT, 'tools', 'marks', scr), sim, str(j['match']), str(j['round']), out, str(j.get('ticks', 3000))], cwd=ROOT); continue
        sh(['node', os.path.join(ROOT, 'tools', 'marks', scr), sim, str(j['match']), str(j['round']), out,
            str(j.get('step', 900)), str(j.get('n', 26)), '1600', '900', j.get('mode', 'both')], cwd=ROOT)
    # (15.11, перестройка) покрытие кода: {"cov": [{"label", "ref", "map", "matches"?, "rounds"?}]} — code_cov.js по матчу на процесс →
    # runs/<label>/cov_<m>.json (функция и сколько раз вызвана); мёртвые — не вызванные ни в одном матче (сводит облако)
    covs = []
    for j in req.get('cov', []):
        sim = os.path.join(sims, j['label'] + '.html'); build(j['ref'], j.get('map', 'ancient'), sim)
        out = os.path.join(ROOT, 'tools', 'measure', 'runs', j['label']); os.makedirs(out, exist_ok=True)
        for m in j.get('matches', [3, 7, 11, 13, 17, 19, 23, 29]):
            covs.append(['node', os.path.join(HERE, 'code_cov.js'), sim, os.path.join(out, 'cov_%d.json' % m), str(j.get('rounds', 99)), str(m)])
    fp = req.get('fp', [])
    engines = {j.get('engine', 'chromium') for j in fp}
    if engines - fingerprint_jobs.ENGINES:
        raise ValueError('Unknown fingerprint engine: ' + ', '.join(sorted(engines - fingerprint_jobs.ENGINES)))
    need = sorted(engines - {'chromium', 'node'})
    if need:
        home = os.path.join(os.path.expanduser('~'), '.simcs2_node')
        npx = os.path.join(home, 'node_modules', '.bin', 'playwright.cmd' if os.name == 'nt' else 'playwright')
        sh([npx, 'install'] + need, cwd=home)
    actual = versions(engines) if fp else None
    archive = None
    if fp and req.get('resume') and req.get('resume_from'):
        archive = fingerprint_jobs.PublishedRun(req['resume_from'], resolve_ref, ROOT)
    pool = procguard.Pool(par, req.get('guard'), os.environ.get('PLAYWRIGHT_BROWSERS_PATH'), log, resume=bool(req.get('resume')))
    fingerprint_jobs.run(fp, pool, ROOT, HERE, sims, resolve_ref, build, actual, archive)
    for c in covs:
        pool.add({'name': 'cov ' + os.path.basename(c[4]) + ' ' + c[-1], 'cmd': c, 'cwd': ROOT, 'engine': 'chromium'})
    # (26.11) запись матча со сторожами (как engine/walk_run.py: audit/watch.js + ходьба, знание, стрельба) — через сторож памяти procguard:
    # {"rec": [{"label", "ref", "map", "matches"?, "ticks"?}]} → runs/<label>/rec_<m>.json (счётчики W.n, в т. ч. stall.*, stall.ep, danger.flashKnown)
    if req.get('rec'):
        tpl = open(os.path.join(HERE, 'rec2.js'), encoding='utf-8').read(); E = os.path.join(HERE, 'engine')
        watch = '\n'.join(open(f, encoding='utf-8').read() for f in (os.path.join(HERE, 'audit', 'watch.js'), os.path.join(E, 'walk_watch.js'), os.path.join(E, 'know_watch.js'), os.path.join(E, 'g_watch.js')))
        A = "if(typeof WATCH!=='undefined') WATCH.tick();"; B = "if(typeof WATCH!=='undefined') REC.watch=WATCH.report();"
        tpl = tpl.replace(A, A + " WALK.tick(); KNOWW.tick(); GWATCH.tick();").replace(B, B + " REC.walk=WALK.report(); REC.know=KNOWW.report(); REC.gw=GWATCH.report();")
        def rec_ok(path):
            try: return 'watch' in json.load(open(path, encoding='utf-8'))
            except Exception: return False
        for j in req['rec']:
            sim = os.path.join(sims, j['label'] + '.html'); build(j['ref'], j.get('map', 'ancient'), sim)
            out = os.path.join(ROOT, 'tools', 'measure', 'runs', j['label']); os.makedirs(out, exist_ok=True)
            for m in j.get('matches', [3, 7, 11, 13, 17, 19, 23, 29]):
                js = os.path.join(out, '_rec_%d.js' % m); open(js, 'w', encoding='utf-8').write(tpl.replace('__M__', str(m)).replace('__T__', str(j.get('ticks', 200000))).replace('/*@@WATCH@@*/', watch))
                pool.add({'name': 'rec %s m%d' % (j['label'], m), 'cmd': ['node', os.path.join(ROOT, 'src', 'q.js'), sim, '@' + js], 'cwd': ROOT, 'engine': 'chromium',
                          'est_key': 'chromium:' + j.get('map', 'ancient'), 'out': os.path.join(out, 'rec_%d.json' % m), 'err': os.path.join(out, 'err_%d.txt' % m),
                          'guard': os.path.join(out, 'guard_%d.json' % m), 'valid': rec_ok})
    if pool.q or pool.run or pool.retry: pool.wait_all()
    # ---- (Р0.6, Р0.11, Р0.13, Р0.14, 24.11) задания перестройки: каждое пишет в runs/<label>/; ошибка задания не валит остальные ----
    R0 = os.path.join(ROOT, 'tools', 'measure')
    def r0out(j): d = os.path.join(R0, 'runs', j['label']); os.makedirs(d, exist_ok=True); return d
    def r0sh(args, out, name, **kw):   # шаг с записью кода выхода и хвоста вывода в <name>.txt (публикуется)
        p = subprocess.run(args, cwd=kw.get('cwd', ROOT), capture_output=True, text=True, env=kw.get('env'))
        open(os.path.join(out, name + '.txt'), 'w', encoding='utf-8').write('код %s\n%s\n%s' % (p.returncode, p.stdout[-6000:], p.stderr[-6000:]))
        log('%s: код %s' % (name, p.returncode)); return p.returncode
    # Р0.13 Rust нативно и WASM на этой машине: {"rust": [{"label"}]} — набор Rust ставится в свою папку ~/.simcs2_rust (как Playwright —
    # в ~/.simcs2_node), PATH системы не трогается; хост x86_64-pc-windows-gnu — свой компоновщик, без Visual Studio
    for j in req.get('rust', []):
        out = r0out(j); home = os.path.join(os.path.expanduser('~'), '.simcs2_rust'); env = dict(os.environ)
        env['RUSTUP_HOME'] = os.path.join(home, 'rustup'); env['CARGO_HOME'] = os.path.join(home, 'cargo')
        bindir = os.path.join(env['CARGO_HOME'], 'bin'); env['PATH'] = bindir + os.pathsep + env.get('PATH', '')
        cargo = os.path.join(bindir, 'cargo.exe' if os.name == 'nt' else 'cargo')
        if not os.path.exists(cargo):
            if os.name == 'nt':
                init = os.path.join(home, 'rustup-init.exe'); os.makedirs(home, exist_ok=True)
                import urllib.request; urllib.request.urlretrieve('https://win.rustup.rs/x86_64', init)
                r0sh([init, '-y', '--no-modify-path', '--profile', 'minimal', '--default-host', 'x86_64-pc-windows-gnu', '--default-toolchain', 'stable'], out, 'rustup_install', env=env)
            else: cargo = shutil.which('cargo') or cargo
        r0sh([os.path.join(bindir, 'rustup.exe' if os.name == 'nt' else 'rustup'), 'target', 'add', 'wasm32-unknown-unknown'], out, 'rustup_wasm', env=env)
        r0sh([cargo, '--version'], out, 'cargo_version', env=env)
        r0sh([os.path.join(bindir, 'rustc.exe' if os.name == 'nt' else 'rustc'), '-Vv'], out, 'rustc_version', env=env)
        ref = os.path.join(ROOT, 'tools', 'dmath', 'ref')
        if r0sh([cargo, 'build', '--release', '--manifest-path', os.path.join(ref, 'Cargo.toml')], out, 'build_dmath_ref', env=env) == 0:
            exe = os.path.join(ref, 'target', 'release', 'dmath_ref.exe' if os.name == 'nt' else 'dmath_ref')
            r0sh(['node', os.path.join(ROOT, 'tools', 'dmath', 'check.js'), '--ref=' + exe, '--n=50000', '--out=' + os.path.join(out, 'dmath_check.json')], out, 'dmath_check', env=env)
        bench = os.path.join(ROOT, 'docs', 'reports', 'audit_2026-11-24', 'stage4', 'bench'); prec = os.path.join(bench, 'prec')
        ok_w = r0sh([cargo, 'build', '--release', '--manifest-path', os.path.join(prec, 'Cargo.toml'), '--target', 'wasm32-unknown-unknown', '--lib'], out, 'build_wasm', env=env) == 0
        ok_n = r0sh([cargo, 'build', '--release', '--manifest-path', os.path.join(prec, 'Cargo.toml')], out, 'build_native', env=env) == 0
        if ok_w and ok_n:
            r0sh([os.path.join(prec, 'target', 'release', 'dump.exe' if os.name == 'nt' else 'dump'), '200000'], out, 'native_dump', cwd=prec, env=env)
            r0sh(['node', os.path.join(bench, 'node_cmp.js')], out, 'native_vs_wasm', cwd=bench, env=env)
            if os.path.exists(os.path.join(bench, 'node_result.json')): shutil.copy(os.path.join(bench, 'node_result.json'), os.path.join(out, 'math_native_wasm.json'))
        nap = os.path.join(bench, 'nap')   # Cargo.lock закрепляет libloading 0.8.8 (windows-targets: готовые библиотеки импорта, без dlltool)
        r0sh([cargo, 'tree', '--manifest-path', os.path.join(nap, 'Cargo.toml'), '-e', 'normal'], out, 'napi_tree', env=env)
        if r0sh([cargo, 'build', '--release', '--manifest-path', os.path.join(nap, 'Cargo.toml')], out, 'build_napi', env=env) == 0:
            lib = os.path.join(nap, 'target', 'release', 'nap.dll' if os.name == 'nt' else 'libnap.so')
            if os.path.exists(lib): shutil.copy(lib, os.path.join(nap, 'nap.node')); r0sh(['node', os.path.join(bench, 'napi_bench.js')], out, 'napi_bench', cwd=bench, env=env)
            if os.path.exists(os.path.join(bench, 'napi_result.json')): shutil.copy(os.path.join(bench, 'napi_result.json'), os.path.join(out, 'call_cost.json'))
    # Р0.11 база скорости: {"prof": [{"label","ref","map","match"?,"ticks"?,"repeat"?,"frame_sec"?}]} — по одному, без других нагрузок
    for j in req.get('prof', []):
        out = r0out(j); sim = os.path.join(sims, j['label'] + '.html'); build(j['ref'], j.get('map', 'ancient'), sim)
        for r in range(int(j.get('repeat', 3))):
            r0sh(['node', os.path.join(R0, 'tick_prof.js'), sim, str(j.get('match', 3)), str(j.get('ticks', 20000)), os.path.join(out, 'tick_%d.json' % r)], out, 'tick_%d' % r)
            r0sh(['node', os.path.join(R0, 'frame_prof.js'), sim, str(j.get('frame_sec', 20)), os.path.join(out, 'frame_%d.json' % r), str(j.get('match', 3))], out, 'frame_%d' % r)
        mem = os.path.join(ROOT, 'docs', 'reports', 'audit_2026-11-24', 'stage3', 'bench', 'mem.js')
        if os.path.exists(mem): r0sh(['node', mem, sim], out, 'memory')
    # Р0.14 браузеры: {"xb": [{"label","ref","map","match"?,"ticks"?,"engines"?}]} — Playwright ставит Firefox и WebKit в ту же папку браузеров
    for j in req.get('xb', []):
        out = r0out(j); sim = os.path.join(sims, j['label'] + '.html'); build(j['ref'], j.get('map', 'ancient'), sim)
        home = os.path.join(os.path.expanduser('~'), '.simcs2_node'); npx = os.path.join(home, 'node_modules', '.bin', 'playwright.cmd' if os.name == 'nt' else 'playwright')
        engines = j.get('engines', ['chromium', 'firefox', 'webkit'])
        r0sh([npx, 'install'] + [e for e in engines if e != 'chromium'], out, 'install', cwd=home)
        for e in engines: r0sh(['node', os.path.join(R0, 'xb_smoke.js'), sim, e, os.path.join(out, 'xb_%s.json' % e), str(j.get('match', 3)), str(j.get('ticks', 2000))], out, 'xb_' + e)
    # Р0.6 инварианты: {"inv": [{"label","ref","map","matches"?,"ticks"?,"special"?}]}
    # Р2.2 / Р2.6 dmath в движках: {"dmath": [{"label","engines"?}]} → runs/<label>/page_<движок>.json (хэши dmath страницы и Node этой машины)
    for j in req.get('dmath', []):
        out = r0out(j); home = os.path.join(os.path.expanduser('~'), '.simcs2_node'); npx = os.path.join(home, 'node_modules', '.bin', 'playwright.cmd' if os.name == 'nt' else 'playwright')
        engines = j.get('engines', ['chromium', 'firefox', 'webkit']); r0sh([npx, 'install'] + [e for e in engines if e != 'chromium'], out, 'install', cwd=home)
        for e in engines: r0sh(['node', os.path.join(ROOT, 'tools', 'dmath', 'page_check.js'), os.path.join(ROOT, 'tools', 'dmath', 'corpus_sample.json.gz'), '--out=' + os.path.join(out, 'page_%s.json' % e)],
                               out, 'page_' + e, env=dict(os.environ, SIM_BROWSER=e))
    # Р2.6 локатор между движками / сборками: {"div": [{"label","ref","map","match"?,"ticks"?,"every"?,"a":"firefox","b":"webkit","ref_b"?,
    # "math"?,"sort"?}]} → runs/<label>/div.json (+ div.txt); ref_b — вторая сборка (иначе обе стороны — одна сборка ref)
    if req.get('div'):
        home = os.path.join(os.path.expanduser('~'), '.simcs2_node'); npx = os.path.join(home, 'node_modules', '.bin', 'playwright.cmd' if os.name == 'nt' else 'playwright')
        r0sh([npx, 'install', 'firefox', 'webkit'], r0out(req['div'][0]), 'install', cwd=home)
        r0sh([shutil.which('npm') or shutil.which('npm.cmd') or 'npm', 'install', '--prefix', os.path.join(ROOT, 'tools', 'rebuild')], r0out(req['div'][0]), 'npm_rebuild')
    for j in req.get('div', []):
        out = r0out(j); sim = os.path.join(sims, j['label'] + '.html'); build(j['ref'], j.get('map', 'ancient'), sim); simb = sim
        if j.get('ref_b'): simb = os.path.join(sims, j['label'] + '_b.html'); build(j['ref_b'], j.get('map', 'ancient'), simb)
        r0sh(['node', os.path.join(R0, 'diverge.js'), sim, simb, '--match=%d' % j.get('match', 3), '--ticks=%d' % j.get('ticks', 20000), '--every=%d' % j.get('every', 64),
              '--browser-a=' + j.get('a', 'chromium'), '--browser-b=' + j.get('b', 'chromium'), '--out=' + os.path.join(out, 'div.json')]
             + (['--math'] if j.get('math') else []) + (['--sort'] if j.get('sort') else []), out, 'div')
    if req.get('inv'):   # локатору (I-22 / I-23 / I-30) нужен acorn — пакеты сборки (tools/rebuild/package.json) в рабочей папке исполнителя
        r0sh([shutil.which('npm') or shutil.which('npm.cmd') or 'npm', 'install', '--prefix', os.path.join(ROOT, 'tools', 'rebuild')], r0out(req['inv'][0]), 'npm_rebuild')
    for j in req.get('inv', []):
        out = r0out(j); sim = os.path.join(sims, j['label'] + '.html'); build(j['ref'], j.get('map', 'ancient'), sim)
        for m in j.get('matches', [3, 7, 11, 13, 17, 19, 23, 29]):
            r0sh(['node', os.path.join(R0, 'inv_run.js'), sim, '--match=%d' % m, '--ticks=%d' % j.get('ticks', 20000), '--out=' + os.path.join(out, 'inv_%d.json' % m)], out, 'inv_%d' % m)
        if j.get('special'): r0sh(['node', os.path.join(R0, 'inv_run.js'), sim, '--special', '--out=' + os.path.join(out, 'inv_special.json')], out, 'inv_special')
    for j in req.get('jobs', []):
        sim = os.path.join(sims, j['label'] + '.html')
        build(j['ref'], j.get('map', 'ancient'), sim); jobargs.append('--job=%s,%s' % (j['label'], sim))
        # (05.11) "snaps": true — писать снимки раундов (база для переигровки); "replay": {"from": <метка базы>, "rounds": "eco" | "all" |
        # "ct:eco" | "tac:rush" | "3+7+12"} — играть только выбранные раунды со снимков базы (engine/walk_run.py)
        if j.get('snaps'): jobargs.append('--snaps=%s' % j['label'])
        if j.get('replay'): jobargs.append('--replay=%s:%s:%s' % (j['label'], j['replay']['from'], j['replay'].get('rounds', 'all')))
        m = ','.join(str(x) for x in j.get('matches', [3, 7, 11, 13, 17, 19, 23, 29]))
        assert mset in (None, m), 'у всех заданий — одни и те же матчи'; mset = m
    if jobargs: sh([PY, os.path.join(HERE, 'engine', 'walk_run.py')] + jobargs + ['--matches=' + mset, '--par=%d' % par], cwd=ROOT)
    log('all done')

if __name__ == '__main__':
    main()
