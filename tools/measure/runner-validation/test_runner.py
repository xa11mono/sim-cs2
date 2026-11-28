"""Local scheduler tests. No workflow dispatch or full simulations.

Run with --archive after fetching the pinned 332 refs to exercise the actual archive.
"""
import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
MEASURE = HERE.parent
ROOT = MEASURE.parent.parent
sys.path.insert(0, str(MEASURE))
import fingerprint_jobs as fp
import procguard as guard
import remote_run

USE_ARCHIVE = '--archive' in sys.argv
if USE_ARCHIVE:
    sys.argv.remove('--archive')


class FakeHost:
    """Deterministic process table, clock and Windows admission/gate contract."""
    def __init__(self, folder, total=16000, base=2000, protected=False, max_commit=None, job_usage=True):
        self.folder, self.total, self.base = folder, total, base
        self.protected, self.max_commit = protected, max_commit or total
        self.job_usage = job_usage
        self.age = 100
        self.next_pid = 1
        self.children = {}
        self.history, self.job_limits, self.samples, self.jobs, self.timed = [], [], [], [], []
        self.denied = 0
        self.epoch = lambda: 1700000000 + self.age

    def used(self, child):
        if child.returncode is not None or child.started is None:
            return 0
        peak = int(child.env.get('PEAK', '0'))
        return peak if self.age - child.started >= int(child.env.get('GROW', '0')) else peak // 8

    def memory(self):
        avail = self.total - self.base - sum(self.used(p) for p in self.children.values())
        self.samples.append(avail); self.timed.append((self.age, avail))
        return self.total, avail

    def processes(self):
        return {p.pid: (0, self.used(p), '') for p in self.children.values() if p.returncode is None}

    def exit(self, process, rc):
        process.returncode = rc
        if hasattr(process, 'row'):
            process.row['end'] = self.age
            process.row['t_end'] = self.epoch()

    def advance(self, duration):
        self.age += duration
        for job in self.jobs:
            committed = 0
            for p in self.children.values():
                if job in p.jobs:
                    want = self.used(p)
                    # (28.11) лимит 0 — как у procguard.Job на Windows (_set_limit: флаг JOB_MEMORY только при limit_mb > 0): без лимита
                    # commit; так создаётся общий объект Chromium / Node после ПК 335 (dgroup = Job(0))
                    if job.limit and committed + want > job.limit:
                        self.denied += 1
                        self.exit(p, 1)
                    else:
                        committed += want
        for process in self.children.values():
            if process.returncode is not None or process.started is None:
                continue
            if self.age - process.started >= int(process.env.get('DURATION', '8')):
                if process.out:
                    m = int(process.env.get('MATCH', '1'))
                    json.dump({'match': m, 'hash': m, 'ticks': 100 * m, 'rounds': [[1]]}, process.out)
                self.exit(process, 0)

    def popen(self, cmd, env, stdout, stdin, **kwargs):
        pid = self.next_pid
        self.next_pid += 1
        p = SimpleNamespace(pid=pid, returncode=None, out=stdout, env=env, jobs=[], started=None)
        self.children[pid] = p

        def release():
            if self.protected:
                case = (cmd[1] == '-c' and 'sys.stdin' in cmd[2] and len(p.jobs) == 2)
                if not case:
                    raise AssertionError('bootstrap released without both jobs')
            p.started = self.age
            self.history.append((self.age, env.get('TAG', ''), env.get('MATCH'), len(self.processes())))

        p.poll = lambda: p.returncode
        p.wait = lambda timeout=None: p.returncode
        p.kill = lambda: self.exit(p, 1)
        if stdin is None:
            release()
            p.stdin = None
        else:
            class Pipe(io.BytesIO):
                def write(self, data):
                    if data == b'1':
                        release()
                    return super().write(data)
            p.stdin = Pipe()
        return p

    def job(self, limit):
        host = self
        self.job_limits.append(limit)

        class Job:
            h, err = 1, None

            def assign(self, proc):
                proc.jobs.append(self)
                return True

            def grow(self, limit):
                self.limit = limit
                return True

            def peak_mb(self):
                return 0

            def current_mb(self):
                return sum(host.used(p) for p in host.children.values() if self in p.jobs) if host.job_usage else None

            def close(self, kill):
                if kill:
                    for child in host.children.values():
                        if self in child.jobs and child.returncode is None:
                            host.exit(child, 1)
                self.h = None
        job = Job()
        job.limit = limit
        self.jobs.append(job)
        return job

    def clock(self):
        return SimpleNamespace(time=self.epoch, monotonic=lambda: self.age, sleep=self.advance, strftime=time.strftime)

    @contextlib.contextmanager
    def install(self):
        with contextlib.ExitStack() as stack:
            replacements = {'mem_mb': self.memory, 'procs': self.processes, 'time': self.clock(), 'WIN': self.protected,
                            'kill_tree': lambda pid: self.exit(self.children[pid], 1),
                            'subprocess': SimpleNamespace(Popen=self.popen, PIPE=subprocess.PIPE),
                            'STATE': str(self.folder / 'state.json'), 'DONE': str(self.folder / 'cache'), 'Job': self.job,
                            '_windows_memory': lambda: SimpleNamespace(ullAvailPageFile=self.max_commit * guard.MB)}
            for name, value in replacements.items():
                stack.enter_context(patch.object(guard, name, value, create=True))
            stack.enter_context(patch.object(guard.Pool, '_watch_exit', staticmethod(lambda r: setattr(r['p'], 'row', r))))
            stack.enter_context(patch.object(fp, 'time', self.clock()))
            stack.enter_context(patch('signal.signal'))
            yield self


def task(label, key, peak, match, **env):
    return dict(name='%s m%d' % (label, match), cmd=['node', 'fake.js'], est_key=key, engine=key.split(':')[0],
                env=dict(PEAK=str(peak), MATCH=str(match), TAG=label, **env))


CFG = dict(reserve_mb=3000, critical_mb=1500, critical_polls=2, match_mem_mb=6144,
           poll_s=1, tree_s=1, recover_s=2, log_s=10000, match_timeout_min=2)


class Sandbox(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(prefix='runner-validation-')
        self.addCleanup(tmp.cleanup)
        self.folder = Path(tmp.name)

    def pool(self, par=8, **cfg):
        return guard.Pool(par, dict(CFG, **cfg), log=lambda _: None, resume=True)


class Tests(Sandbox):
    def test_per_pair_and_cold_start(self):
        with FakeHost(self.folder).install() as host:
            pool = self.pool(est_mb={'chromium': 1000, 'chromium:ancient': 2200, 'node:mirage': 1200})
            self.assertEqual([pool._est(k) for k in ('chromium:ancient', 'chromium:mirage', 'node:ancient', 'node:mirage')],
                             [2200, 1000, 800, 1200])
            for i in range(8):
                pool.add(task('anc', 'firefox:ancient', 2200, i + 1, GROW='3'))
            pool.wait_all()
            self.assertEqual(host.history[0][3], 1)
            self.assertGreater(host.history[1][0], host.history[0][0])
            self.assertEqual(max(a['par_seen_max'] for a in pool.attempts), 5)
            self.assertGreaterEqual(min(host.samples), 3000)
            self.assertTrue(all(a['ok'] for a in pool.attempts))

    def test_dynamic_admission_replays_334_ancient_memory_sample(self):
        # The last public memory sample before cancel: 15,977 MiB total,
        # 6,008 available, two live trees at 1,972 and 1,018 MiB, peak
        # of the preceding m19 at 2,208 MiB.
        available = 6008
        with FakeHost(self.folder, total=15977, protected=True).install():
            pool = self.pool(reserve_mb=None)
            for engine in ('chromium', 'node', 'firefox', 'webkit'):
                with self.subTest(engine=engine):
                    key = engine + ':ancient'
                    existing = task('sample', key, 2208, 19)
                    pool._learn(existing, 2208, complete=True)
                    pool.run = [{'t': existing, 'peak': 2208, 'now': n} for n in (1972, 1018)]
                    # Synthetic Windows commit limit, with 2,990 MiB charged
                    # for the two sampled trees. The Actions notices lack it.
                    pool.group = SimpleNamespace(current_mb=lambda: 2990)
                    pool.group_limit = 6165
                    ok, info = pool._admit(task('next', key, 0, 23), available)
                    self.assertEqual(ok, engine in guard.DYNAMIC_ENGINES, info)
                    if ok:
                        # (28.11) после ПК 335 Chromium / Node — в общем объекте без лимита commit (dgroup = Job(0)): лимит общего
                        # commit строгих движков их не останавливает (прежний отказ при свободной RAM ронял страницы); защита —
                        # допуск по фактической памяти (need 0), лимит дерева и снятие при нехватке RAM (test_simultaneous_growth_…)
                        self.assertEqual(info['need'], 0)
                        self.assertNotIn('commit_used', info)
                        pool.group_limit = 4000
                        again, info = pool._admit(task('next', key, 0, 23), available)
                        self.assertTrue(again, info)

    def test_dynamic_launches_multiple_trees_before_first_match_finishes(self):
        for engine in ('chromium', 'node'):
            with self.subTest(engine=engine), FakeHost(self.folder, protected=True).install() as host:
                pool = self.pool()
                for i in range(8):
                    pool.add(task('cold', engine + ':mirage', 800, i + 1, GROW='2'))
                pool.wait_all()
                self.assertEqual(max(a['par_seen_max'] for a in pool.attempts), 8)
                self.assertTrue(all(a['ok'] for a in pool.attempts))
                self.assertEqual(host.denied, 0)

    def test_unknown_group_usage_falls_back_to_peak_budget(self):
        # (28.11) общий потолок commit после ПК 335 — только у строгих движков (Firefox / WebKit); Chromium / Node — без него
        # (test_dynamic_engines_share_unlimited_group). Проверка механизма потолка сохранена — на Firefox.
        with FakeHost(self.folder, total=12000, max_commit=7800, protected=True, job_usage=False).install():
            pool = self.pool(est_mb={'firefox:mirage': 1500})
            pool._learn(task('old', 'firefox:mirage', 1500, 0), 1500, complete=True)
            for i in range(4):
                pool.add(task('fallback', 'firefox:mirage', 1500, i + 1))
            pool.wait_all()
            self.assertEqual(max(a['par_seen_max'] for a in pool.attempts), 3)

    def test_recovery_and_retries_do_not_leak_into_next_phase(self):
        with FakeHost(self.folder, total=14000).install():
            pool = self.pool(est_mb={'chromium': 1400, 'chromium:mirage': 400})
            key = 'chromium:ancient'
            pool._learn(task('old', key, 1400, 0), 1400, complete=True)
            for i in range(12):
                pool.add(task('large', key, 1800, i + 1, GROW='3'))
            pool.wait_all()
            retries = [a for a in pool.attempts if a['retry']]
            self.assertTrue(retries)
            self.assertTrue(all(a['ok'] and a['par_seen_max'] == 1 for a in retries))
            self.assertTrue(any('мало памяти' in why for _, _, why in pool.cap_log))
            self.assertTrue(any('память позволяет' in why for _, _, why in pool.cap_log))
            self.assertEqual(pool.cap, 8)
            offset = len(pool.attempts)
            for i in range(9):
                pool.add(task('small', 'chromium:mirage', 400, i + 1))
            pool.wait_all()
            self.assertEqual(max(a['par_seen_max'] for a in pool.attempts[offset:]), 8)

    def test_windows_assigns_both_jobs_before_launch_and_caps_the_group(self):
        # (28.11) общий потолок commit после ПК 335 — только у строгих движков (Firefox / WebKit); Chromium / Node — без него
        # (test_dynamic_engines_share_unlimited_group). Проверка механизма потолка сохранена — на Firefox.
        with FakeHost(self.folder, total=12000, max_commit=7800, protected=True).install() as host:
            pool = self.pool(est_mb={'firefox:mirage': 1500})
            pool._learn(task('old', 'firefox:mirage', 1500, 0), 1500, complete=True)
            for i in range(4):
                pool.add(task('protected', 'firefox:mirage', 1500, i + 1))
            pool.wait_all()
            self.assertEqual(host.job_limits[0], 4800)
            self.assertEqual(max(a['par_seen_max'] for a in pool.attempts), 3)
            self.assertTrue(all(a['group_limit_mb'] == 4800 for a in pool.attempts))
            self.assertGreater(8 * CFG['match_mem_mb'], host.job_limits[0])

    def test_simultaneous_growth_hits_aggregate_ceiling_in_fake_os(self):
        # (28.11) одновременный рост недооценённых деревьев Chromium / Node (каждое ниже лимита дерева). Дизайн после ПК 335: потолка
        # commit у них нет, защита — снятие самого нового при свободной памяти ниже критической critical_polls опросов подряд и его
        # повтор отдельно. Ожидание: все матчи готовы, ни один не потерян; снятий — не больше одного на рост; свободная память ниже
        # критической — не дольше времени обнаружения (critical_polls опросов) — провал ниже — только в пределах опросов.
        with FakeHost(self.folder, total=12000, max_commit=7800, protected=True).install() as host:
            pool = self.pool(est_mb={'node:mirage': 1000})
            pool._learn(task('underestimated', 'node:mirage', 1000, 0), 1000, complete=True)
            for i in range(4):
                pool.add(task('burst', 'node:mirage', 2200, i + 1, GROW='3'))
            pool.wait_all()
            self.assertEqual(host.denied, 0)
            self.assertEqual(max(a['par_seen_max'] for a in pool.attempts), 4)
            done = {a['name'] for a in pool.attempts if a['ok']}
            self.assertEqual(len(done), 4)
            retries = [a for a in pool.attempts if a['retry']]
            self.assertLessEqual(len(retries), 1)
            self.assertTrue(all(a['par_seen_max'] == 1 and a['ok'] for a in retries))
            # время (часы модели) ниже критической: обнаружение — critical_polls опросов, снятие — на следующем опросе
            start, worst = None, 0
            for age, v in host.timed:
                if v < CFG['critical_mb']: start = age if start is None else start; worst = max(worst, age - start)
                else: start = None
            self.assertLessEqual(worst, (CFG['critical_polls'] + 1) * CFG['poll_s'])
            self.assertGreater(min(host.samples), 0)

    def test_dynamic_engines_share_unlimited_group(self):
        # (28.11) решение ПК 335: Chromium / Node — в общем объекте без лимита commit (Job(0): только снятие всего при закрытии),
        # каждое дерево — в своём объекте с лимитом match_mem_mb
        with FakeHost(self.folder, total=16000, protected=True).install() as host:
            pool = self.pool(est_mb={'chromium:mirage': 1000})
            pool._learn(task('old', 'chromium:mirage', 1000, 0), 1000, complete=True)
            for i in range(3):
                pool.add(task('dyn', 'chromium:mirage', 1000, i + 1))
            pool.wait_all()
            self.assertIn(0, host.job_limits)
            self.assertIn(CFG['match_mem_mb'], host.job_limits)
            self.assertTrue(all(a['ok'] for a in pool.attempts))

    def test_windows_group_grows_after_external_memory_release(self):
        # (28.11) общий потолок commit после ПК 335 — только у строгих движков (Firefox / WebKit); Chromium / Node — без него
        # (test_dynamic_engines_share_unlimited_group). Проверка механизма потолка сохранена — на Firefox.
        with FakeHost(self.folder, total=16000, base=10500, protected=True).install() as host:
            pool = self.pool(est_mb={'firefox:mirage': 1200})
            pool._learn(task('old', 'firefox:mirage', 1200, 0), 1200, complete=True)
            for i in range(8):
                pool.add(task('recover', 'firefox:mirage', 1200, i + 1, GROW='4'))
            advance = host.advance

            def free_when_running(dt):
                advance(dt)
                if host.age == 102:
                    host.base = 2000

            guard.time.sleep = free_when_running
            pool.wait_all()
            self.assertEqual(host.job_limits[0], 2500)
            self.assertEqual(host.history[0][0], 100)
            self.assertGreater(max(a['group_limit_mb'] for a in pool.attempts), 2500)
            self.assertEqual(max(a['par_seen_max'] for a in pool.attempts), 8)
            self.assertGreaterEqual(min(host.samples), CFG['reserve_mb'])

    def test_windows_assignment_failure_keeps_gate_closed(self):
        with FakeHost(self.folder, protected=True).install() as host:
            pool = self.pool()
            number = 0
            original = host.job

            def fail_inner(limit):
                nonlocal number
                number += 1
                job = original(limit)
                if number == 2:
                    job.assign = lambda _: False
                return job

            pool.add(task('refused', 'node:mirage', 1000, 1))
            with patch.object(guard, 'Job', fail_inner), self.assertRaisesRegex(RuntimeError, 'Job Object'):
                pool.wait_all()
            self.assertEqual(host.history, [])
            self.assertFalse(any(p.returncode is None for p in host.children.values()))

    def test_low_memory_blocks_first_match_too(self):
        with FakeHost(self.folder, total=4200).install() as host:
            pool = self.pool(match_timeout_min=0.05)
            pool.add(task('wait', 'chromium:mirage', 1000, 1))
            with self.assertRaisesRegex(RuntimeError, 'Не хватает памяти'):
                pool.wait_all()
            self.assertEqual(host.history, [])

    def test_phase_counts_retry_work_but_not_restored_or_failed_ticks(self):
        p1, p2 = self.folder / 'fp_1.json', self.folder / 'fp_2.json'
        p1.write_text('{"ticks": 100}')
        p2.write_text('{"ticks": 1000}')
        phase = {'resumed': 1, 'count': 3, 'pending': [{'name': 'a', 'out': p1}, {'name': 'b', 'out': p2}],
                 'map': 'ancient', 'engine': 'node'}

        def attempt(name, a, b, final):
            return dict(task=name, start=a, end=b, t_start=a+10, t_end=b+10, ok=final,
                        stopped=None if final else 'lowmem', peak_mb=1, retry=a == 25)
        attempts = [attempt('a', 10, 20, False), attempt('b', 15, 25, False), attempt('a', 25, 35, True)]
        report = fp.phase_report(8, phase, attempts, [], 10, 20)
        self.assertEqual((report['par_max'], report['par_avg'], report['attempts']), (2, 1.2, 3))
        self.assertEqual((report['matches_played'], report['matches_resumed'], report['matches_failed']), (1, 1, 1))
        self.assertEqual(report['successful_ticks'], 100)
        self.assertEqual(report['ticks_per_s'], 4)
        self.assertFalse(report['complete_fresh_sample'])

    def test_resume_rejects_corrupt_or_mismatched_cache_and_copies_nothing(self):
        with FakeHost(self.folder).install():
            pool = self.pool()
            staged = self.folder / 'done'
            staged.mkdir()
            out, error, log = map(lambda n: str(self.folder / n), ('fp_3.json', 'err_3.txt', 'guard_3.json'))
            t = dict(task('resume', 'node:mirage', 10, 3), out=out, err=error, guard=log,
                     valid=lambda path: fp.fingerprint(path, 3),
                     save={'dir': staged, 'meta': {'runtime': 'known'}, 'files': [out, error, log]})
            (staged / 'fp_3.json').write_text('{"match":3,"hash":17,"ticks":119,"rounds":[[1]]}')
            (staged / 'guard_3.json').write_text('{"ok":true,"rc":0,"peak_mb":999}')
            (staged / 'meta.json').write_text('{"runtime":"other"}')
            self.assertIsNone(pool.restore(t))
            self.assertFalse(Path(out).exists())
            (staged / 'meta.json').write_text('{"runtime":"known"}')
            (staged / 'fp_3.json').write_text('{"hash":17}')
            self.assertIsNone(pool.restore(t))
            self.assertFalse(Path(out).exists())
            (staged / 'fp_3.json').write_text('{"match":3,"hash":17,"ticks":119,"rounds":[[1]]}')
            self.assertEqual(pool.restore(t)['peak_mb'], 999)
            self.assertEqual(pool._est('node:mirage'), 999)
            self.assertEqual(pool._est('node:ancient'), 800)

    def test_real_process_exit_before_next_poll(self):
        with patch.object(guard, 'STATE', str(self.folder / 'state.json')), \
             patch.object(guard, 'mem_mb', return_value=(16000, 14000)), patch.object(guard, 'procs', return_value={}):
            pool = self.pool(poll_s=0.5, job=False)
            pool.add({'name': 'quick', 'cmd': [sys.executable, '-c', 'pass'], 'engine': 'node'})
            pool.wait_all()
        self.assertEqual(len(pool.attempts), 1)
        row = pool.attempts[0]
        self.assertTrue(row['ok'])
        self.assertGreater(row['secs'], 0)
        self.assertEqual(row['par_seen_max'], 1)

    @unittest.skipUnless(os.name == 'nt', 'requires native Windows Job Objects')
    def test_native_windows_job_gate_with_small_process(self):
        # (28.11, ПК 355 — настоящий Windows) Chromium / Node — общий объект без лимита commit (решение ПК 335: group_limit_mb 0),
        # строгий движок (Firefox) — общий объект с лимитом; у обоих дерево назначено в объекты до запуска (вывод «released»)
        for engine, limited in (('node', False), ('firefox', True)):
            with self.subTest(engine=engine), patch.object(guard, 'STATE', str(self.folder / 'state.json')), \
                 patch.object(guard, 'mem_mb', return_value=(16000, 14000)):
                pool = self.pool(poll_s=0.1)
                output = self.folder / ('gate_%s.txt' % engine)
                pool.add({'name': 'sandbox', 'cmd': [sys.executable, '-c', 'print("released")'],
                          'engine': engine, 'out': output})
                pool.wait_all()
                row = pool.attempts[0]
                self.assertTrue(row['ok'])
                self.assertTrue(row['job'])
                if limited: self.assertGreater(row['group_limit_mb'], 0)
                else: self.assertEqual(row['group_limit_mb'] or 0, 0)
                self.assertEqual(output.read_text().strip(), 'released')

    def test_build_cache_pins_ref_and_separates_map_and_kind(self):
        remote_run.BUILT.clear()
        remote_run.REFS.clear()
        sha = 'a' * 40
        commands = []

        def run(args, **kwargs):
            commands.append(args)
            if args[0] == remote_run.PY:
                Path(args[-1]).write_text(args[1])

        with patch.object(remote_run, 'ROOT', ROOT), patch.object(remote_run, 'sh', run), \
             patch.object(remote_run.subprocess, 'check_output', return_value=sha + '\n'), \
             patch.object(remote_run.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout=sha+'\n')):
            for i, kind, game_map in [(0, False, 'ancient'), (1, False, 'ancient'), (2, True, 'ancient'), (3, False, 'mirage')]:
                remote_run.build('same-branch', game_map, self.folder / str(i), kind)
        self.assertEqual(sum(c[1] == 'fetch' for c in commands), 1)
        self.assertEqual(sum(c[0] == remote_run.PY for c in commands), 3)
        self.assertEqual((self.folder / '0').read_bytes(), (self.folder / '1').read_bytes())
        self.assertTrue(all(c[-1] == sha for c in commands if 'worktree' in c))


@unittest.skipUnless(USE_ARCHIVE, 'requires --archive and the pinned Git objects')
class ArchiveTests(Sandbox):
    def test_332_actual_archive_plan_and_saved_files(self):
        request = json.loads((HERE / 'request-332-resume.json').read_text())
        archive = fp.PublishedRun(request['resume_from'], lambda ref: ref, ROOT)
        old = json.loads(archive._json_gz('v636a_single_chr', 'versions.json'))
        versions = {**old, 'platform': 'win32', 'arch': 'x64',
                    'browsers': {'chromium': {'version': old['chromium'], 'ua': old['chromium_ua'], 'v8': old['chromium_v8']}}}
        test_here = self.folder / 'measure'
        (test_here / 'engine').mkdir(parents=True)
        for name in ['fingerprint.js', 'engine/field_watch.js']:
            (test_here / name).write_bytes((MEASURE / name).read_bytes())
        jobs = request['fp']
        built = []

        class PlanPool(guard.Pool):
            def wait_all(self):
                for t in self.q:
                    names.append(t['name'])
                    m = t['save']['meta']['match']
                    Path(t['out']).write_text(json.dumps({'ticks': 100 * m}))
                    self.attempts.append(dict(task=t['name'], start=self_time(), end=self_time()+1,
                                              t_start=10, t_end=11, ok=True, stopped=None, peak_mb=0, retry=False))
                self.q.clear()

        names = []
        with FakeHost(self.folder).install() as host:
            self_time = host.clock().monotonic
            pool = PlanPool(8, log=lambda _: None, resume=True)
            fp.run(jobs, pool, ROOT, test_here, self.folder, lambda r: r, lambda *a: built.append(a), versions, archive)
            reports = {j['label']: guard.read_json(test_here / 'runs' / j['label'] / 'phase.json') for j in jobs}
            self.assertEqual(sum(r['matches_resumed'] for r in reports.values()), 25)
            self.assertEqual(len(names), 9)
            self.assertEqual([r['matches_played'] for r in reports.values()], [0, 0, 0, 0, 1, 8])
            self.assertEqual([(game_map, core) for _, game_map, _, core in built], [('mirage', False), ('mirage', True)])
            self.assertEqual(names[0], 'fp v636a_chr_mir.html m29')
            self.assertTrue(all(not list((test_here / 'runs' / j['label']).glob('*.code.js')) for j in jobs))
            self.assertEqual(pool.peaks['chromium:ancient'], 2153)
            self.assertFalse(fp.PublishedRun._runtime_compatible(old, fp.runtime_identity({**versions, 'node_v8': 'changed'}, 'chromium'), 'chromium'))
            self.assertFalse(fp.PublishedRun._runtime_compatible(old, fp.runtime_identity({**versions, 'platform': 'linux'}, 'node'), 'node'))
            # Assets promoted to the new cache must then resume without touching Git or compiling.
            built.clear()
            names.clear()
            pool = PlanPool(8, log=lambda _: None, resume=True)
            fp.run(jobs[:4], pool, ROOT, test_here, self.folder, lambda r: r, lambda *a: built.append(a), versions)
            self.assertEqual((built, names), ([], []))


if __name__ == '__main__':
    unittest.main()
