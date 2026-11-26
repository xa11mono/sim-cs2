#!/usr/bin/env python3
"""(Р2.6, 25.11) Защита ПК владельца от исчерпания памяти при прогонах. Игру не меняет: только решает, когда запускать матч, и снимает
зависшие / раздувшиеся матчи. Без внешних пакетов (ctypes / /proc).

Повод: прогон 323 (три движка, par 8) — на ПК десятки процессов Nightly (Firefox Playwright), память 99 %, ПК пришлось перезагрузить.
Что было в раннере до этого: ни лимита памяти, ни лимита времени на матч; браузер закрывался только при успехе (src/q.js без finally);
дочерние процессы браузера после смерти node никто не добивал; новый матч запускался без взгляда на свободную память.

Что делает пул (Pool):
  * новый матч — только если свободной памяти хватает: свободно − оценка матча (пик уже сыгранных матчей этого движка) ≥ запас;
    один матч идёт всегда (иначе прогон встал бы);
  * свободной памяти меньше критической — снять самый новый матч (причина lowmem), уменьшить параллельность, переиграть его один раз в конце;
  * лимит памяти на матч (всё дерево процессов: node + браузер + его дети) и лимит времени — снять (memlimit / timeout);
  * Windows: каждый матч — в своём объекте задания (Job Object) с KILL_ON_JOB_CLOSE и лимитом памяти задания: ОС сама не даст матчу
    съесть больше лимита, а закрытие задания убивает всё дерево, даже осиротевшее; пик памяти задания — точный (PeakJobMemoryUsed);
  * после конца матча — добить оставшихся потомков (процессы из папки браузеров, замеченные в его дереве);
  * в начале и в конце — уборка процессов из папки браузеров Playwright, появившихся за время прогона;
  * при нехватке памяти сначала только не запускает новые матчи; снимает работающий (самый новый) лишь если свободной памяти меньше
    критической несколько опросов подряд — он переигрывается в конце по одному;
  * готовый матч сохраняется отдельно вне рабочей папки (~/simcs2_done/<метка>/m<N>/ + meta.json); "resume": true в задании — взять готовые
    матчи прерванного прогона, если совпало всё, от чего зависит результат (коммит игры, карта, движок, Playwright, код замера и q.js);
  * журнал памяти: строка в run.log раз в 30 с (свободно, по матчам МБ и число процессов) и ~/simcs2_guard_state.json — последнее
    состояние переживает перезагрузку, следующий прогон печатает его в run.log; на матч — guard_<m>.json (пик, процессы, время, код, причина).
Числа по умолчанию — проектные (не из демок: это защита ПК, а не поведение игры); меняются в задании: "guard": {...}."""
import os, sys, time, json, subprocess, shutil

WIN = os.name == 'nt'
MB = 1024 * 1024

# ---------------- память системы ----------------
if WIN:
    import ctypes
    from ctypes import wintypes as W
    class _MSX(ctypes.Structure):
        _fields_ = [('dwLength', W.DWORD), ('dwMemoryLoad', W.DWORD), ('ullTotalPhys', ctypes.c_ulonglong), ('ullAvailPhys', ctypes.c_ulonglong),
                    ('ullTotalPageFile', ctypes.c_ulonglong), ('ullAvailPageFile', ctypes.c_ulonglong), ('ullTotalVirtual', ctypes.c_ulonglong),
                    ('ullAvailVirtual', ctypes.c_ulonglong), ('ullAvailExtendedVirtual', ctypes.c_ulonglong)]

def mem_mb():
    """(всего, свободно) физической памяти, МБ."""
    if WIN:
        s = _MSX(); s.dwLength = ctypes.sizeof(_MSX); ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(s))
        return s.ullTotalPhys // MB, s.ullAvailPhys // MB
    d = {}
    for line in open('/proc/meminfo'):
        k, v = line.split(':', 1); d[k] = int(v.split()[0]) // 1024
    return d['MemTotal'], d.get('MemAvailable', d['MemFree'])

# ---------------- список процессов: pid → (ppid, МБ, путь) ----------------
def procs():
    out = {}
    if WIN:
        ps = ("Get-CimInstance Win32_Process | ForEach-Object { '{0}|{1}|{2}|{3}|{4}' -f $_.ProcessId,$_.ParentProcessId,"
              "$_.WorkingSetSize,$_.PrivatePageCount,$_.ExecutablePath }")
        try:
            r = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', ps], capture_output=True, text=True, timeout=60,
                               encoding='utf-8', errors='replace', creationflags=0x08000000)   # CREATE_NO_WINDOW
        except Exception: return out
        for line in r.stdout.splitlines():
            p = line.strip().split('|', 4)
            if len(p) < 5 or not p[0].isdigit(): continue
            ws = int(p[2] or 0); pr = int(p[3] or 0)
            out[int(p[0])] = (int(p[1] or 0), max(ws, pr) // MB, p[4])
        return out
    for d in os.listdir('/proc'):
        if not d.isdigit(): continue
        try:
            st = open('/proc/%s/stat' % d).read(); ppid = int(st[st.rindex(')') + 2:].split()[1])
            rss = 0
            for line in open('/proc/%s/status' % d):
                if line.startswith('VmRSS:'): rss = int(line.split()[1]) // 1024; break
            try: exe = os.readlink('/proc/%s/exe' % d)
            except OSError: exe = ''
            out[int(d)] = (ppid, rss, exe)
        except (OSError, ValueError): continue
    return out

def tree(pid, P):
    """pid и все его потомки по снимку P."""
    kids = {}
    for q, (pp, _, _) in P.items(): kids.setdefault(pp, []).append(q)
    res, st = [], [pid]
    while st:
        q = st.pop()
        if q in P and q not in res: res.append(q); st.extend(kids.get(q, []))
    return res

def kill_pids(pids):
    for q in pids:
        try:
            if WIN: subprocess.run(['taskkill', '/PID', str(q), '/T', '/F'], capture_output=True, creationflags=0x08000000)
            else: os.kill(q, 9)
        except Exception: pass

def kill_tree(pid):
    if WIN: kill_pids([pid]); return     # taskkill /T — всё дерево
    P = procs(); kill_pids(list(reversed(tree(pid, P))))

def in_dir(path, d):
    return bool(path) and bool(d) and os.path.normcase(os.path.abspath(path)).startswith(os.path.normcase(os.path.abspath(d)) + os.sep)

def browser_pids(bdir, P=None):
    P = procs() if P is None else P
    return {q for q, (_, _, exe) in P.items() if in_dir(exe, bdir)}

# ---------------- Windows: объект задания на матч ----------------
if WIN:
    class _BASIC(ctypes.Structure):
        _fields_ = [('PerProcessUserTimeLimit', ctypes.c_int64), ('PerJobUserTimeLimit', ctypes.c_int64), ('LimitFlags', W.DWORD),
                    ('MinimumWorkingSetSize', ctypes.c_size_t), ('MaximumWorkingSetSize', ctypes.c_size_t), ('ActiveProcessLimit', W.DWORD),
                    ('Affinity', ctypes.c_size_t), ('PriorityClass', W.DWORD), ('SchedulingClass', W.DWORD)]
    class _IO(ctypes.Structure):
        _fields_ = [(n, ctypes.c_ulonglong) for n in ('r', 'w', 'o', 'rb', 'wb', 'ob')]
    class _EXT(ctypes.Structure):
        _fields_ = [('Basic', _BASIC), ('Io', _IO), ('ProcessMemoryLimit', ctypes.c_size_t), ('JobMemoryLimit', ctypes.c_size_t),
                    ('PeakProcessMemoryUsed', ctypes.c_size_t), ('PeakJobMemoryUsed', ctypes.c_size_t)]
    _k = ctypes.WinDLL('kernel32', use_last_error=True)
    _k.CreateJobObjectW.restype = W.HANDLE; _k.CreateJobObjectW.argtypes = [ctypes.c_void_p, W.LPCWSTR]
    _k.SetInformationJobObject.argtypes = [W.HANDLE, ctypes.c_int, ctypes.c_void_p, W.DWORD]
    _k.QueryInformationJobObject.argtypes = [W.HANDLE, ctypes.c_int, ctypes.c_void_p, W.DWORD, ctypes.c_void_p]
    _k.AssignProcessToJobObject.argtypes = [W.HANDLE, W.HANDLE]
    _k.TerminateJobObject.argtypes = [W.HANDLE, W.UINT]
    _k.CloseHandle.argtypes = [W.HANDLE]

class Job:
    """Windows: KILL_ON_JOB_CLOSE + лимит памяти задания (всё дерево). Не Windows / не вышло — пустышка (работает только опрос)."""
    def __init__(self, limit_mb):
        self.h = None; self.err = None
        if not WIN: return
        try:
            h = _k.CreateJobObjectW(None, None)
            if not h: raise OSError(ctypes.get_last_error())
            e = _EXT(); e.Basic.LimitFlags = 0x2000 | (0x200 if limit_mb else 0)   # KILL_ON_JOB_CLOSE | JOB_MEMORY
            e.JobMemoryLimit = int(limit_mb or 0) * MB
            if not _k.SetInformationJobObject(h, 9, ctypes.byref(e), ctypes.sizeof(e)): raise OSError(ctypes.get_last_error())
            self.h = h
        except Exception as ex: self.err = 'job: %r' % (ex,)
    def assign(self, popen):
        if not self.h: return False
        if not _k.AssignProcessToJobObject(self.h, int(popen._handle)): self.err = 'assign: %d' % ctypes.get_last_error(); return False
        return True
    def peak_mb(self):
        if not self.h: return None
        e = _EXT()
        if not _k.QueryInformationJobObject(self.h, 9, ctypes.byref(e), ctypes.sizeof(e), None): return None
        return e.PeakJobMemoryUsed // MB
    def close(self, kill=True):
        if not self.h: return
        if kill: _k.TerminateJobObject(self.h, 1)
        _k.CloseHandle(self.h); self.h = None

# ---------------- пул ----------------
DEF = {'reserve_mb': None, 'critical_mb': None, 'critical_polls': 3, 'match_mem_mb': 6144, 'match_timeout_min': 90, 'poll_s': 2, 'tree_s': 10,
       'est_mb': {'chromium': 1000, 'webkit': 1500, 'firefox': 2000, 'node': 800}, 'job': True, 'log_s': 30, 'recover_s': 60}
# (26.11, прогоны 329–332: par 8 падал до 4, а после повтора снятых — до 1 навсегда, и в следующих фазах тоже) адаптивная параллельность:
#  * допуск — по прогнозу: свободно − (сколько ещё вырастут идущие матчи до пика своего движка) − пик нового ≥ запас; пик движка — наибольший
#    замеченный у его матчей (est_mb — только пока замеров нет): матч Chromium растёт с ~0,6 до ~2 ГБ, по одной «свободно сейчас» допускалось 8;
#  * снижение cap при нехватке (снятие самого нового) — как было; восстановление — по одному шагу за recover_s, пока нет нехватки и прогноз
#    допускает ещё матч, до заданного par;
#  * повтор снятых по памяти — по одному (матч идёт один), но cap не трогает; конец фазы (wait_all) возвращает cap к par;
#  * фактическая параллельность: у матча — сколько шло одновременно (средняя по времени и наибольшая), у пула — история cap (cap_log)
STATE = os.path.join(os.path.expanduser('~'), 'simcs2_guard_state.json')   # последнее состояние памяти: переживает перезагрузку ПК
DONE = os.path.join(os.path.expanduser('~'), 'simcs2_done')                # готовые матчи вне рабочей папки (её чистит checkout)

class Pool:
    """Задача: dict(name, cmd, cwd, env, engine, out / err / guard — пути файлов или None,
       save — {"dir", "meta", "files"} для продолжения прерванного прогона, valid(out) → bool — результат годен к сохранению)."""
    def __init__(self, par, cfg=None, bdir=None, log=print, resume=False):
        c = dict(DEF); c.update(cfg or {}); self.c = c; self.log = log; self.bdir = bdir; self.resume = resume
        tot, av = mem_mb(); self.total = tot
        self.reserve = c['reserve_mb'] or max(3072, tot * 20 // 100)
        self.critical = c['critical_mb'] or max(1536, tot * 8 // 100)
        self.par = max(1, int(par)); self.cap = self.par; self.low = 0; self.t_cap = time.time(); self.cap_log = []
        self.q, self.run, self.retry, self.peak_by_eng, self.seen_all, self.nojob = [], [], [], {}, set(), set()
        self.before = browser_pids(bdir) if bdir else set()
        if os.path.exists(STATE):   # прошлый прогон не дошёл до конца (перезагрузка, снятие): последнее, что он видел
            try: self.log('guard: прошлый прогон оборвался; последнее состояние: ' + open(STATE, encoding='utf-8').read())
            except OSError: pass
        self.log('guard: память %d МБ, свободно %d; запас %d, критично %d; на матч ≤ %d МБ, ≤ %g мин; par ≤ %d; объект задания: %s; продолжение: %s'
                 % (tot, av, self.reserve, self.critical, c['match_mem_mb'], c['match_timeout_min'], self.par,
                    'да' if (WIN and c['job']) else 'нет', 'да' if resume else 'нет'))

    def add(self, t):
        sv = t.get('save')
        if self.resume and sv and self._restore(t): return
        self.q.append(t)

    # ---- продолжение: готовый матч берётся, только если совпало всё, от чего зависит результат (meta) ----
    def _restore(self, t):
        sv = t['save']; mf = os.path.join(sv['dir'], 'meta.json')
        try: meta = json.load(open(mf, encoding='utf-8'))
        except (OSError, ValueError): return False
        if meta != sv['meta']: self.log('guard: %s — сохранённый результат несовместим (другие сборка / движок / код замера), играю заново' % t['name']); return False
        for f in sv['files']:
            src = os.path.join(sv['dir'], os.path.basename(f))
            if os.path.exists(src): shutil.copyfile(src, f)
        if t.get('valid') and t.get('out') and not t['valid'](t['out']): return False
        self.log('guard: %s — взят готовый из прерванного прогона (%s)' % (t['name'], sv['dir'])); return True

    def _save(self, t):
        sv = t['save']; os.makedirs(sv['dir'], exist_ok=True)
        for f in sv['files']:
            if os.path.exists(f): shutil.copyfile(f, os.path.join(sv['dir'], os.path.basename(f)))
        with open(os.path.join(sv['dir'], 'meta.json'), 'w', encoding='utf-8') as f: json.dump(sv['meta'], f, ensure_ascii=False)

    @staticmethod
    def _key(t):   # ключ оценки пика: est_key задания («движок:карта» — матчи Ancient и Mirage разного размера) или движок
        return t.get('est_key') or t.get('engine', 'chromium')
    def _est(self, key):
        # пик: наибольший замеченный у матчей с этим ключом (и у идущих — растут), пока замеров нет — est_mb движка
        live = max([r['peak'] for r in self.run if self._key(r['t']) == key] or [0])
        return max(self.peak_by_eng.get(key, 0), live, self.c['est_mb'].get(key.split(':')[0], 1500))
    def _need(self):
        # сколько ещё памяти возьмут идущие матчи до своего пика (матч без замера — весь пик)
        return sum(max(0, self._est(self._key(r['t'])) - (r.get('now') or 0)) for r in self.run)
    def _cap_set(self, v, why):
        v = max(1, min(self.par, v))
        if v != self.cap: self.cap_log.append([round(time.time(), 1), v, why]); self.log('guard: параллельность %d → %d (%s)' % (self.cap, v, why))
        self.cap = v; self.t_cap = time.time()

    def _start(self, t):
        fo = open(t['out'], 'w', encoding='utf-8') if t.get('out') else None
        fe = open(t['err'], 'w', encoding='utf-8') if t.get('err') else None
        p = subprocess.Popen(t['cmd'], cwd=t.get('cwd'), env=t.get('env'), stdout=fo, stderr=fe)
        eng = t.get('engine', 'chromium')
        job = Job(self.c['match_mem_mb']) if (WIN and self.c['job'] and eng not in self.nojob) else None
        if job and not job.assign(p): self.log('guard: %s — объект задания не назначен (%s), только опрос' % (t['name'], job.err)); job.close(False); job = None
        r = {'t': t, 'p': p, 'fo': fo, 'fe': fe, 'job': job, 't0': time.time(), 'peak': 0, 'nproc': 0, 'nproc_max': 0, 'seen': set(), 'why': None,
             'conc_s': 0.0, 'conc_max': 0}
        self.run.append(r); self.log('start %s (идёт %d, свободно %d МБ)' % (t['name'], len(self.run), mem_mb()[1]))

    def _stop(self, r, why):
        r['why'] = r['why'] or why
        if r['job']: r['job'].close(True)
        kill_tree(r['p'].pid); self._kill_left(r)

    def _kill_left(self, r):
        """Потомки матча, замеченные опросом и ещё живые: только процессы из папки браузеров Playwright (номер мог достаться чужому
        процессу — сверка пути; личные браузеры владельца лежат не там). Без папки браузеров — ничего (остаётся объект задания)."""
        if not r['seen'] or not self.bdir: return 0
        P = procs(); left = [q for q in r['seen'] if q in P and in_dir(P[q][2], self.bdir)]
        kill_pids(left); return len(left)

    def _finish(self, r):
        rc = r['p'].returncode
        if r['job']:
            pk = r['job'].peak_mb()
            if pk: r['peak'] = max(r['peak'], pk)
            r['job'].close(True)          # KILL_ON_JOB_CLOSE: всё, что осталось от матча, снимается здесь
        left = self._kill_left(r)
        for f in (r['fo'], r['fe']):
            if f: f.close()
        t = r['t']; eng = t.get('engine', 'chromium'); dur = time.time() - r['t0']
        ok = rc == 0 and not r['why'] and (not t.get('valid') or not t.get('out') or t['valid'](t['out']))
        if ok and r['peak']: k = self._key(t); self.peak_by_eng[k] = max(self.peak_by_eng.get(k, 0), r['peak'])
        av = mem_mb()[1]
        g = {'name': t['name'], 'engine': eng, 'rc': rc, 'ok': ok, 'secs': round(dur, 1), 't_start': round(r['t0'], 1), 't_end': round(time.time(), 1), 'peak_mb': r['peak'], 'procs_max': r['nproc_max'],
             'stopped': r['why'], 'orphans_killed': left, 'job': bool(r['job']), 'par_cap': self.cap, 'running_with': len(self.run),
             'mem_total_mb': self.total, 'mem_avail_mb_after': av, 'retry': bool(t.get('retried')),
             'par_req': self.par, 'par_seen_max': r['conc_max'], 'par_seen_avg': round(r['conc_s'] / dur, 2) if dur > 0 else None}
        if t.get('guard'):
            with open(t['guard'], 'w', encoding='utf-8') as f: json.dump(g, f, ensure_ascii=False)
        if t.get('err') and (r['why'] or not ok):
            with open(t['err'], 'a', encoding='utf-8') as f: f.write('\n[guard] %s\n' % json.dumps(g, ensure_ascii=False))
        if ok and t.get('save'): self._save(t)
        self.log('end %s: код %s, %.0f с, пик %s МБ, процессов до %d%s%s' % (t['name'], rc, dur, r['peak'], r['nproc_max'],
                 ', СНЯТ: ' + r['why'] if r['why'] else ('' if ok else ', РЕЗУЛЬТАТ НЕГОДЕН'), ', добито осиротевших: %d' % left if left else ''))
        # Windows: браузер не смог работать внутри объекта задания (быстрый отказ без снятия) — этот движок дальше без объекта
        # (остаётся опрос дерева и лимиты), матч повторяется один раз
        if r['job'] is not None and not ok and not r['why'] and dur < 30 and not t.get('jobretry'):
            self.nojob.add(eng); t2 = dict(t); t2['jobretry'] = True; self.q.insert(0, t2)
            self.log('guard: %s — быстрый отказ внутри объекта задания, %s дальше без него' % (t['name'], eng))
        if r['why'] and r['why'].startswith('lowmem') and not t.get('retried'):
            t = dict(t); t['retried'] = True; self.retry.append(t)

    def _sweep(self, where):
        """Процессы из папки браузеров Playwright, появившиеся за прогон, которые были в дереве наших матчей или осиротели (родителя
        нет / init). Процесс с живым чужим родителем (другой Playwright) не трогается; личные браузеры лежат не в этой папке."""
        if not self.bdir: return
        P = procs(); live = set()
        for r in self.run: live.update(tree(r['p'].pid, P))
        bad = [q for q in browser_pids(self.bdir, P) - self.before - live
               if q in self.seen_all or P[q][0] not in P or P[q][0] <= 1]
        if bad: self.log('guard: %s — осиротевшие процессы браузера: %d, снимаю' % (where, len(bad))); kill_pids(sorted(bad))

    def _state(self, av, tot):
        st = {'time': time.strftime('%Y-%m-%d %H:%M:%S'), 'avail_mb': av, 'total_mb': tot, 'cap': self.cap, 'queued': len(self.q),
              'running': [{'name': r['t']['name'], 'mb': r.get('now'), 'procs': r['nproc'], 'secs': round(time.time() - r['t0'])} for r in self.run]}
        try:
            with open(STATE, 'w', encoding='utf-8') as f: json.dump(st, f, ensure_ascii=False)
        except OSError: pass
        return st

    def wait_all(self):
        import signal
        def _bye(*a): raise SystemExit('сигнал %s' % (a[0] if a else '?'))   # снятие задания: finally ниже убирает все деревья
        for sg in ('SIGTERM', 'SIGBREAK', 'SIGHUP'):
            if hasattr(signal, sg):
                try: signal.signal(getattr(signal, sg), _bye)
                except (ValueError, OSError): pass
        self._sweep('начало')
        last_tree = last_log = 0; done = False
        try:
            while self.q or self.run or self.retry:
                if not self.q and not self.run and self.retry:   # по одному (retried — идёт один), cap не трогается
                    self.log('guard: переигровка снятых по памяти: %d (по одному)' % len(self.retry)); self.q, self.retry = self.retry, []
                for r in [r for r in self.run if r['p'].poll() is not None]:
                    self.run.remove(r); self._finish(r)
                now = time.time(); tot, av = mem_mb()
                dt = now - getattr(self, '_t_loop', now); self._t_loop = now
                for r in self.run: r['conc_s'] += len(self.run) * dt; r['conc_max'] = max(r['conc_max'], len(self.run))
                if self.run and (now - last_tree >= self.c['tree_s'] or av < self.reserve):
                    last_tree = now; P = procs()
                    for r in self.run:
                        ids = tree(r['p'].pid, P); r['seen'].update(ids); self.seen_all.update(ids); r['nproc'] = len(ids); r['nproc_max'] = max(r['nproc_max'], len(ids))
                        r['now'] = sum(P[q][1] for q in ids); r['peak'] = max(r['peak'], r['now'])
                        if r['job']:
                            pk = r['job'].peak_mb()
                            if pk: r['peak'] = max(r['peak'], pk)
                        if not r['why'] and r['now'] > self.c['match_mem_mb']: self._stop(r, 'memlimit %d МБ' % r['now'])
                for r in self.run:
                    if not r['why'] and now - r['t0'] > self.c['match_timeout_min'] * 60: self._stop(r, 'timeout %g мин' % self.c['match_timeout_min'])
                # нехватка памяти: 1) новые матчи не стартуют (допуск ниже); 2) лишь если свободно меньше критического несколько опросов
                # подряд — снять самый новый матч (переиграется в конце по одному) и уменьшить параллельность
                self.low = self.low + 1 if av < self.critical else 0
                if self.low >= self.c['critical_polls'] and len(self.run) > 1:
                    cand = [r for r in self.run if not r['why']]
                    if cand:
                        r = max(cand, key=lambda r: r['t0']); self._stop(r, 'lowmem (свободно %d МБ)' % av)
                        self._cap_set(len(self.run) - 1, 'мало памяти: свободно %d МБ' % av); self.low = 0
                if now - last_log >= self.c['log_s'] and self.run:
                    last_log = now; st = self._state(av, tot)
                    self.log('mem: свободно %d / %d МБ; par ≤ %d; очередь %d; идёт %d: %s' % (av, tot, self.cap, len(self.q), len(self.run),
                             ', '.join('%s %s МБ / %d проц.' % (x['name'], x['mb'], x['procs']) for x in st['running'])))
                # допуск (адаптивная параллельность): следующий матч — только если после него останется запас памяти
                # восстановление: нет нехватки recover_s с прошлой смены и прогноз допускает ещё матч — cap + 1 (до par)
                if self.cap < self.par and self.low == 0 and now - self.t_cap >= self.c['recover_s'] and self.q and \
                   av - self._need() - self._est(self._key(self.q[0])) >= self.reserve:
                    self._cap_set(self.cap + 1, 'память позволяет: свободно %d МБ, прогноз идущих +%d' % (av, self._need()))
                while self.q and len(self.run) < self.cap:
                    eng = self.q[0].get('engine', 'chromium')
                    if self.run and (self.q[0].get('retried') or any(x['t'].get('retried') for x in self.run)): break   # повтор — один
                    if self.run and av - self._need() - self._est(self._key(self.q[0])) < self.reserve: break
                    self._start(self.q.pop(0)); av = mem_mb()[1]
                time.sleep(self.c['poll_s'])
            done = True
            if self.cap != self.par: self._cap_set(self.par, 'конец фазы: следующая начинает с заданного par')   # защита — допуском
            self.low = 0
        finally:
            if not done:   # состояние до остановки: какие матчи шли, сколько памяти и процессов
                st = self._state(*mem_mb()[::-1]); st['aborted'] = repr(sys.exc_info()[1])
                self.log('guard: прогон прерван: ' + json.dumps(st, ensure_ascii=False))
                try:
                    with open(STATE, 'w', encoding='utf-8') as f: json.dump(st, f, ensure_ascii=False)
                except OSError: pass
            for r in list(self.run):
                self._stop(r, 'раннер завершается')
                try: r['p'].wait(timeout=30)
                except Exception: pass
                self.run.remove(r); self._finish(r)
            self._sweep('конец')
            if done:
                try: os.remove(STATE)
                except OSError: pass
