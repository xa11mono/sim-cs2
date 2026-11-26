#!/usr/bin/env python3
"""(Р2.6, 25.11) Защита ПК владельца от исчерпания памяти при прогонах. Игру не меняет: только решает, когда запускать матч, и снимает
зависшие / раздувшиеся матчи. Без внешних пакетов (ctypes / /proc).

Повод: прогон 323 (три движка, par 8) — на ПК десятки процессов Nightly (Firefox Playwright), память 99 %, ПК пришлось перезагрузить.
Что было в раннере до этого: ни лимита памяти, ни лимита времени на матч; браузер закрывался только при успехе (src/q.js без finally);
дочерние процессы браузера после смерти node никто не добивал; новый матч запускался без взгляда на свободную память.

Что делает пул (Pool):
  * допуск учитывает прогноз оставшегося роста идущих матчей, прогноз нового матча и запас памяти. Непроверенную пару
    движок/карта сначала калибрует один матч. При длительном отсутствии памяти допуск завершается явной ошибкой.
  * свободной памяти меньше критической — снять самый новый матч (причина lowmem), уменьшить параллельность, переиграть его один раз в конце;
  * лимит памяти на матч (всё дерево процессов: node + браузер + его дети) и лимит времени — снять (memlimit / timeout);
  * Windows: родительский Job Object ограничивает суммарный commit пула, отдельный Job Object — commit дерева матча.
    Node и браузер начинают работу после назначения обоих Job Objects. Закрытие удаляет их дерево.
  * после конца матча — добить оставшихся потомков (процессы из папки браузеров, замеченные в его дереве);
  * в начале и в конце — уборка процессов из папки браузеров Playwright, появившихся за время прогона;
  * при нехватке памяти сначала только не запускает новые матчи; снимает работающий (самый новый) лишь если свободной памяти меньше
    критической несколько опросов подряд — он переигрывается в конце по одному;
  * готовый матч сохраняется отдельно вне рабочей папки (~/simcs2_done/<метка>/m<N>/ + meta.json); "resume": true в задании — взять готовые
    матчи прерванного прогона, если совпало всё, от чего зависит результат (коммит игры, карта, движок, Playwright, код замера и q.js);
  * журнал памяти: строка в run.log раз в 30 с (свободно, по матчам МБ и число процессов) и ~/simcs2_guard_state.json — последнее
    состояние переживает перезагрузку, следующий прогон печатает его в run.log; на матч — guard_<m>.json (пик, процессы, время, код, причина).
Числа по умолчанию — проектные (не из демок: это защита ПК, а не поведение игры); меняются в задании: "guard": {...}."""
import os, sys, time, json, subprocess, tempfile, threading

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

def _windows_memory():
    s = _MSX()
    s.dwLength = ctypes.sizeof(s)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(s)):
        raise ctypes.WinError()
    return s


def mem_mb():
    """(всего, свободно) физической памяти, МБ."""
    if WIN:
        s = _windows_memory()
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
        h = None
        try:
            h = _k.CreateJobObjectW(None, None)
            if not h: raise OSError(ctypes.get_last_error())
            self._set_limit(h, limit_mb)
            self.h = h
        except Exception as ex:
            if h:
                _k.CloseHandle(h)
            self.err = 'job: %r' % (ex,)
    @staticmethod
    def _set_limit(handle, limit_mb):
        e = _EXT()
        e.Basic.LimitFlags = 0x2000 | (0x200 if limit_mb else 0)   # KILL_ON_JOB_CLOSE | JOB_MEMORY
        e.JobMemoryLimit = int(limit_mb or 0) * MB
        if not _k.SetInformationJobObject(handle, 9, ctypes.byref(e), ctypes.sizeof(e)):
            raise OSError(ctypes.get_last_error())

    def grow(self, limit_mb):
        try:
            self._set_limit(self.h, limit_mb)
            return True
        except OSError as ex:
            self.err = 'grow: %r' % (ex,)
            return False

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
# Windows: внешний Job Object ограничивает суммарный commit всех матчей, внутренний — каждого дерева.
# Допуск прогнозирует RAM по своим данным на пару движок/карта. Вне Windows остаётся опрос и запас.
STATE = os.path.join(os.path.expanduser('~'), 'simcs2_guard_state.json')   # последнее состояние памяти: переживает перезагрузку ПК
DONE = os.path.join(os.path.expanduser('~'), 'simcs2_done')                # готовые матчи вне рабочей папки (её чистит checkout)

def read_json(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def atomic_write(path, data):
    fd, temp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)))
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.remove(temp)


def interval_stats(intervals, start, end):
    intervals = [(max(a, start), min(b, end)) for a, b in intervals if a < b and a < end and b > start]
    edges = sorted([(a, 1) for a, _ in intervals] + [(b, -1) for _, b in intervals])
    active = peak = 0
    for _, delta in edges:
        active += delta
        peak = max(peak, active)
    wall = max(0, end - start)
    busy = sum(b - a for a, b in intervals)
    return {'wall_s': wall, 'worker_s': busy, 'par_max': peak, 'par_avg': busy / wall if wall else None}


class Pool:
    """Задача: dict(name, cmd, cwd, env, engine, out / err / guard — пути файлов или None,
       save — {"dir", "meta", "files"} для продолжения прерванного прогона, valid(out) → bool — результат годен к сохранению)."""
    def __init__(self, par, cfg=None, bdir=None, log=print, resume=False):
        c = dict(DEF); c.update(cfg or {}); self.c = c; self.log = log; self.bdir = bdir; self.resume = resume
        tot, av = mem_mb(); self.total = tot
        self.reserve = c['reserve_mb'] or max(3072, tot * 20 // 100)
        self.critical = c['critical_mb'] or max(1536, tot * 8 // 100)
        self.par = max(1, int(par)); self.cap = self.par; self.low = 0; self.t_cap = time.monotonic(); self.cap_log = []
        self.q, self.run, self.retry = [], [], []
        self.peaks, self.calibrated = {}, set()
        self.seen_all = set()
        self.protected = WIN and c['job']
        self.group = None
        self.group_limit = 0
        self.attempts = []
        self._spans = []
        self.before = browser_pids(bdir) if bdir else set()
        if self.before:   # (26.11) осиротевшие браузеры прошлого (отменённого) прогона: из папки Playwright, родителя нет — снять; с живым родителем — не трогать
            P0 = procs(); orph = [q for q in self.before if q in P0 and (P0[q][0] not in P0 or P0[q][0] <= 1)]
            if orph: self.log('guard: старт — осиротевшие процессы браузера прошлого прогона: %d, снимаю' % len(orph)); kill_pids(sorted(orph)); self.before -= set(orph)
        if os.path.exists(STATE):   # прошлый прогон не дошёл до конца (перезагрузка, снятие): последнее, что он видел
            try: self.log('guard: прошлый прогон оборвался; последнее состояние: ' + open(STATE, encoding='utf-8').read())
            except OSError: pass
        self.log('guard: память %d МБ, свободно %d; запас %d, критично %d; на матч ≤ %d МБ, ≤ %g мин; par ≤ %d; объект задания: %s; продолжение: %s'
                 % (tot, av, self.reserve, self.critical, c['match_mem_mb'], c['match_timeout_min'], self.par,
                    'да' if (WIN and c['job']) else 'нет', 'да' if resume else 'нет'))

    def add(self, t):
        if not self.restore(t):
            self.q.append(t)

    def restore(self, t, archive=None):
        """Возвращает guard только после проверки результата и совместимости."""
        sv = t.get('save')
        if not self.resume or not sv:
            return None
        if archive is None:
            try:
                meta = read_json(os.path.join(sv['dir'], 'meta.json'))
                if meta != sv['meta']:
                    self.log('guard: %s — сохранённый результат несовместим' % t['name'])
                    return None
                blobs = {}
                for path in sv['files']:
                    src = os.path.join(sv['dir'], os.path.basename(path))
                    if os.path.isfile(src):
                        with open(src, 'rb') as handle:
                            blobs[path] = handle.read()
            except (OSError, ValueError):
                return None
        else:
            blobs = archive
        try:
            guard = json.loads(blobs[t['guard']])
            if not isinstance(guard, dict) or guard.get('ok') is not True or guard.get('stopped') or guard.get('rc') != 0:
                return None
            with tempfile.TemporaryDirectory() as temp:
                trial = os.path.join(temp, 'result.json')
                with open(trial, 'wb') as handle:
                    handle.write(blobs[t['out']])
                if not t['valid'](trial):
                    return None
        except (KeyError, OSError, ValueError):
            return None
        for path, data in blobs.items():
            atomic_write(path, data)
        self._learn(t, guard.get('peak_mb'), complete=True)
        self.log('guard: %s — взят сохранённый результат' % t['name'])
        if archive is not None:
            self._save(t)
        return guard

    def _save(self, t):
        sv = t['save']
        os.makedirs(sv['dir'], exist_ok=True)
        marker = os.path.join(sv['dir'], 'meta.json')
        # При остановке между заменами каталог остаётся без маркера готовности.
        if os.path.exists(marker):
            os.remove(marker)
        for f in sv['files']:
            if os.path.isfile(f):
                with open(f, 'rb') as handle:
                    atomic_write(os.path.join(sv['dir'], os.path.basename(f)), handle.read())
        atomic_write(marker, json.dumps(sv['meta'], ensure_ascii=False).encode('utf-8'))

    def _learn(self, t, peak, complete=False):
        if isinstance(peak, int) and not isinstance(peak, bool) and peak > 0:
            key = self._key(t)
            self.peaks[key] = max(self.peaks.get(key, 0), peak)
            if complete:
                self.calibrated.add(key)

    @staticmethod
    def _key(t):   # ключ оценки пика: est_key задания («движок:карта» — матчи Ancient и Mirage разного размера) или движок
        return t.get('est_key') or t.get('engine', 'chromium')
    def _est(self, key):
        # пик: наибольший замеченный у матчей с этим ключом (и у идущих — растут), пока замеров нет — est_mb движка
        live = max([r['peak'] for r in self.run if self._key(r['t']) == key] or [0])
        configured = self.c['est_mb']
        floor = configured.get(key, configured.get(key.split(':')[0], DEF['est_mb'].get(key.split(':')[0], 1500)))
        return max(self.peaks.get(key, 0), live, floor)
    def _need(self):
        # сколько ещё памяти возьмут идущие матчи до своего пика (матч без замера — весь пик)
        return sum(max(0, self._est(self._key(r['t'])) - (r.get('now') or 0)) for r in self.run)
    def _cap_set(self, v, why):
        v = max(1, min(self.par, v))
        if v != self.cap: self.cap_log.append([time.time(), v, why]); self.log('guard: параллельность %d → %d (%s)' % (self.cap, v, why))
        self.cap = v; self.t_cap = time.monotonic()

    def _can_start(self, t, available):
        key = self._key(t)
        estimate = self._est(key)
        if self.run and (t.get('retried') or any(r['t'].get('retried') for r in self.run)):
            return False
        # Без законченного измерения одной пары разрешён один калибровочный матч этой пары.
        if key not in self.calibrated and any(self._key(r['t']) == key for r in self.run):
            return False
        if available - self._need() - estimate < self.reserve:
            return False
        if self.group:
            return sum(self._est(self._key(r['t'])) for r in self.run) + estimate <= self.group_limit
        return True

    def _increase_group_if_possible(self, available):
        if self.group and available - self.reserve > self.group_limit:
            # Use only currently available memory, without adding a sampled
            # or historical peak from processes that may already have shrunk.
            budget = min(available, _windows_memory().ullAvailPageFile // MB) - self.reserve
            if budget > self.group_limit and self.group.grow(budget):
                self.log('guard: общий лимит commit %d → %d МБ' % (self.group_limit, budget))
                self.group_limit = budget

    def _ensure_group(self, available, t):
        if not self.protected or self.group:
            return True
        self.group_limit = min(available, _windows_memory().ullAvailPageFile // MB) - self.reserve
        if self.group_limit < self._est(self._key(t)):
            return False
        group = Job(self.group_limit)
        if not group.h:
            raise RuntimeError('Не создан общий Job Object: ' + str(group.err))
        self.group = group
        return True

    @staticmethod
    def _watch_exit(r):
        def wait():
            r['p'].wait()
            r['end'] = time.monotonic()
            r['t_end'] = time.time()
        threading.Thread(target=wait, daemon=True).start()

    def _start(self, t):
        fo = fe = p = job = None
        try:
            fo = open(t['out'], 'w', encoding='utf-8') if t.get('out') else None
            fe = open(t['err'], 'w', encoding='utf-8') if t.get('err') else None
            cmd = t['cmd']
            if self.protected:
                # До сигнала bootstrap только читает pipe. Node и браузер уже наследуют оба ограничения.
                gate = "import sys, subprocess; sys.exit(subprocess.call(sys.argv[1:]) if sys.stdin.buffer.read(1)==b'1' else 125)"
                cmd = [sys.executable, '-c', gate, *cmd]
            p = subprocess.Popen(cmd, cwd=t.get('cwd'), env=t.get('env'), stdout=fo, stderr=fe,
                                 stdin=subprocess.PIPE if self.protected else None)
            if self.protected:
                job = Job(self.c['match_mem_mb'])
                if not self.group.assign(p) or not job.assign(p):
                    raise RuntimeError('Job Object не назначен для %s: %s / %s' % (t['name'], self.group.err, job.err))
            r = {'t': t, 'p': p, 'fo': fo, 'fe': fe, 'job': job, 't0': time.time(), 'start': time.monotonic(),
                 'peak': 0, 'nproc': 0, 'nproc_max': 0, 'seen': set(), 'why': None,
                 'group_limit_mb': self.group_limit if self.protected else None}
            if self.protected:
                p.stdin.write(b'1')
                p.stdin.close()
            self.run.append(r)
            self._spans.append(r)
            self._watch_exit(r)
            self.log('start %s (идёт %d, свободно %d МБ)' % (t['name'], len(self.run), mem_mb()[1]))
        except BaseException:
            if p is not None:
                if p.stdin and not p.stdin.closed:
                    p.stdin.close()
                if p.poll() is None:
                    p.kill()
                p.wait()
            if job:
                job.close(True)
            for f in (fo, fe):
                if f:
                    f.close()
            raise

    def _stop(self, r, why):
        r['why'] = r['why'] or why
        if r['job']:
            r['peak'] = max(r['peak'], r['job'].peak_mb() or 0)
            r['job'].close(True)
        else:
            kill_tree(r['p'].pid)
        self._kill_left(r)

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
        t = r['t']; eng = t.get('engine', 'chromium')
        end = r.get('end', time.monotonic())
        dur = end - r['start']
        stats = interval_stats([(max(r['start'], x['start']), min(end, x.get('end', end)))
                                for x in self._spans], start=r['start'], end=end)
        ok = rc == 0 and not r['why'] and (not t.get('valid') or not t.get('out') or t['valid'](t['out']))
        self._learn(t, r['peak'], complete=ok)
        av = mem_mb()[1]
        g = {'name': t['name'], 'engine': eng, 'rc': rc, 'ok': ok, 'secs': dur, 't_start': r['t0'], 't_end': r.get('t_end', time.time()), 'peak_mb': r['peak'], 'procs_max': r['nproc_max'],
             'stopped': r['why'], 'orphans_killed': left, 'job': bool(r['job']), 'par_cap': self.cap, 'running_with': len(self.run),
             'mem_total_mb': self.total, 'mem_avail_mb_after': av, 'retry': bool(t.get('retried')),
             'par_req': self.par, 'par_seen_max': stats['par_max'], 'par_seen_avg': stats['par_avg'],
             'group_limit_mb': r['group_limit_mb']}
        self.attempts.append(dict(g, start=r['start'], end=end, task=t['name']))
        if t.get('guard'):
            with open(t['guard'], 'w', encoding='utf-8') as f: json.dump(g, f, ensure_ascii=False)
        if t.get('err') and (r['why'] or not ok):
            with open(t['err'], 'a', encoding='utf-8') as f: f.write('\n[guard] %s\n' % json.dumps(g, ensure_ascii=False))
        if ok and t.get('save'): self._save(t)
        self.log('end %s: код %s, %.0f с, пик %s МБ, процессов до %d%s%s' % (t['name'], rc, dur, r['peak'], r['nproc_max'],
                 ', СНЯТ: ' + r['why'] if r['why'] else ('' if ok else ', РЕЗУЛЬТАТ НЕГОДЕН'), ', добито осиротевших: %d' % left if left else ''))
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
              'running': [{'name': r['t']['name'], 'mb': r.get('now'), 'procs': r['nproc'], 'secs': round(time.monotonic() - r['start'])} for r in self.run]}
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
        last_tree = last_log = float('-inf')
        stalled_at = None
        done = False
        try:
            while self.q or self.run or self.retry:
                for r in [r for r in self.run if 't_end' in r]:
                    self.run.remove(r)
                    self._finish(r)
                if not self.run and self.group:
                    self.group.close(True)
                    self.group = None
                if not self.q and not self.run and self.retry:
                    self.log('guard: переигровка снятых по памяти: %d (по одному)' % len(self.retry))
                    self.q, self.retry = self.retry, []
                if not self.q and not self.run:
                    break
                now = time.monotonic()
                tot, av = mem_mb()
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
                    if not r['why'] and now - r['start'] > self.c['match_timeout_min'] * 60: self._stop(r, 'timeout %g мин' % self.c['match_timeout_min'])
                # нехватка памяти: 1) новые матчи не стартуют (допуск ниже); 2) лишь если свободно меньше критического несколько опросов
                # подряд — снять самый новый матч (переиграется в конце по одному) и уменьшить параллельность
                self.low = self.low + 1 if av < self.critical else 0
                if self.low >= self.c['critical_polls'] and self.run:
                    cand = [r for r in self.run if not r['why']]
                    if cand:
                        r = max(cand, key=lambda r: r['t0']); self._stop(r, 'lowmem (свободно %d МБ)' % av)
                        self._cap_set(min(self.cap, len(self.run) - 1), 'мало памяти: свободно %d МБ' % av); self.low = 0
                if now - last_log >= self.c['log_s'] and self.run:
                    last_log = now; st = self._state(av, tot)
                    self.log('mem: свободно %d / %d МБ; par ≤ %d; очередь %d; идёт %d: %s' % (av, tot, self.cap, len(self.q), len(self.run),
                             ', '.join('%s %s МБ / %d проц.' % (x['name'], x['mb'], x['procs']) for x in st['running'])))
                # После опроса процессов память могла измениться. Перед допуском берём свежее значение.
                _, av = mem_mb()
                if self.q:
                    self._increase_group_if_possible(av)
                if (self.cap < self.par and self.low == 0 and now - self.t_cap >= self.c['recover_s']
                        and self.q and not self.q[0].get('retried') and self._can_start(self.q[0], av)):
                    self._cap_set(self.cap + 1, 'память позволяет: свободно %d МБ, прогноз идущих +%d' % (av, self._need()))
                while self.q and len(self.run) < self.cap:
                    next_task = self.q[0]
                    if not self._can_start(next_task, av) or not self._ensure_group(av, next_task):
                        break
                    self._start(self.q.pop(0))
                    av = mem_mb()[1]
                if self.q and not self.run:
                    stalled_at = now if stalled_at is None else stalled_at
                    if now - stalled_at >= self.c['match_timeout_min'] * 60:
                        raise RuntimeError('Не хватает памяти для %s: свободно %d, прогноз %d, запас %d МБ'
                                           % (self.q[0]['name'], av, self._est(self._key(self.q[0])), self.reserve))
                else:
                    stalled_at = None
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
            if self.group:
                self.group.close(True)
                self.group = None
            self._spans.clear()
            self._sweep('конец')
            if done:
                try: os.remove(STATE)
                except OSError: pass
