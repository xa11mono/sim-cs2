"""Plan, resume and report guarded fingerprint phases."""
import gzip
import hashlib
import json
import os
import re
import subprocess
import time
from pathlib import Path

import procguard

MATCHES = [3, 7, 11, 13, 17, 19, 23, 29]
ENGINES = {'chromium', 'node', 'webkit', 'firefox'}


def fingerprint_code(template, fields_code, match, fields=False):
    return (fields_code + '\n' if fields else '') + template.replace('__M__', str(match))


def text(data):
    return data.decode('utf-8').replace('\r\n', '\n')


def digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def fingerprint(path, match):
    try:
        row = procguard.read_json(path)
        return valid_fp(row, match)
    except (OSError, ValueError):
        return False


def valid_fp(row, match):
    return (isinstance(row, dict) and type(row.get('hash')) is int and 0 <= row['hash'] < 2**32
            and row.get('match') == match and type(row.get('ticks')) is int and 0 < row['ticks'] < 400000
            and isinstance(row.get('rounds'), list) and bool(row['rounds']))


def runtime_identity(versions, engine):
    identity = {k: versions[k] for k in ('node', 'node_v8', 'platform', 'arch')}
    if engine != 'node':
        identity.update(playwright=versions['playwright'], browser=versions['browsers'][engine])
    return identity


class PublishedRun:
    """Read a pinned pc-results commit with the pinned tools used to produce it."""
    def __init__(self, config, resolve, root):
        for key in ('results', 'runner'):
            if not re.fullmatch('[0-9a-f]{40}', config.get(key, '')):
                raise ValueError('resume_from.%s needs a full commit SHA' % key)
        self.results = resolve(config['results'])
        self.runner = resolve(config['runner'])
        self.root = root
        request = json.loads(self._read(self.results, 'request.json'))
        if request != json.loads(self._read(self.runner, 'tools/measure/request.json')):
            raise ValueError('Archived request differs from the selected original runner request')
        self.jobs = {j['label']: j for j in request.get('fp', [])}
        self.versions = {}
        self.template = text(self._read(self.runner, 'tools/measure/fingerprint.js'))
        self.runners = {}

    def _read(self, ref, name):
        return subprocess.run(['git', 'show', ref + ':' + name], cwd=self.root, check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

    def _json_gz(self, label, filename):
        return gzip.decompress(self._read(self.results, label + '/' + filename + '.gz'))

    @staticmethod
    def _runtime_compatible(old, current, engine):
        # The original version manifest reported Windows x64 in Chromium's UA,
        # alongside the exact Node and browser builds. Reject unproven hosts.
        ua = old.get('chromium_ua', '')
        if not ('Windows NT ' in ua and 'Win64; x64' in ua
                and current['platform'] == 'win32' and current['arch'] == 'x64'):
            return False
        if any(not current[k] or current[k] != old.get(k) for k in ('node', 'node_v8')):
            return False
        if engine == 'node':
            return True
        if engine != 'chromium':
            return False   # older archive did not measure these browser versions
        actual = current['browser']
        return (current['playwright'] == old.get('playwright') and
                all(actual.get(k) and actual[k] == old.get('chromium' + suffix)
                    for k, suffix in (('version', ''), ('ua', '_ua'), ('v8', '_v8'))))

    def result(self, label, task, launcher):
        original = self.jobs.get(label)
        meta = task['save']['meta']
        m = meta['match']
        if (not original or original.get('ref') != meta['sha'] or original.get('fields') or meta['fields']
                or original.get('map', 'ancient') != meta['map']
                or original.get('engine', 'chromium') != meta['engine'] or m not in original.get('matches', MATCHES)):
            return None
        try:
            if label not in self.versions:
                self.versions[label] = json.loads(self._json_gz(label, 'versions.json'))
            if not self._runtime_compatible(self.versions[label], meta['runtime'], meta['engine']):
                return None
            if launcher not in self.runners:
                self.runners[launcher] = digest(text(self._read(self.runner, launcher)))
            if self.runners[launcher] != meta['q'] or digest(fingerprint_code(self.template, '', m)) != meta['code']:
                return None
            result = self._json_gz(label, 'fp_%d.json' % m)
            guard = self._json_gz(label, 'guard_%d.json' % m)
            row, check = json.loads(result), json.loads(guard)
            if (not valid_fp(row, m) or check.get('engine') != meta['engine'] or
                    check.get('ok') is not True or check.get('rc') != 0 or check.get('stopped')):
                return None
        except (OSError, ValueError, AttributeError, subprocess.CalledProcessError):
            return None
        return {task['out']: result, task['guard']: guard, task['err']: b''}


def phase_report(par, phase, attempts, cap_log, started, t0):
    live = [(a['start'], a['end']) for a in attempts]
    end = max((b for _, b in live), default=started)
    timing = procguard.interval_stats(live, started, end)
    successful = [a for a in attempts if a['ok']]
    ticks = sum(procguard.read_json(t['out'])['ticks'] for t in phase['pending']
                if any(a['task'] == t['name'] for a in successful))
    wall = timing['wall_s']
    resumed = phase['resumed']
    requested = phase['count']
    distinct = len({a['task'] for a in attempts})
    return dict(timing, par=par, par_req=par, t0=t0, engine=phase['engine'], map=phase['map'],
                ends=[a['t_end'] for a in attempts], cap_log=cap_log, matches_requested=requested,
                matches_played=len(successful), matches_resumed=resumed,
                matches_failed=distinct - len(successful), matches_unstarted=requested - resumed - distinct,
                attempts=len(attempts),
                repeated_attempts=len(attempts) - distinct, successful_ticks=ticks,
                ticks_per_s=ticks / wall if wall else None,
                matches_per_hour=len(successful) * 3600 / wall if wall else None,
                complete_fresh_sample=bool(wall and len(successful) == requested and not resumed),
                complete_without_retries=bool(wall and len(attempts) == len(successful) == requested and not resumed),
                attempt_log=[{k: a[k] for k in ('task', 'ok', 'stopped', 't_start', 't_end', 'peak_mb', 'retry')}
                             for a in attempts])


def run(jobs, pool, root, here, sims, resolve, build, versions, archive=None):
    if not jobs:
        return
    root, here, sims = map(Path, (root, here, sims))
    template = (here / 'fingerprint.js').read_text(encoding='utf-8')
    fields_code = (here / 'engine' / 'field_watch.js').read_text(encoding='utf-8')
    labels = set()
    plans = []
    # A resume-only phase needs neither a game build nor a per-match code file.
    for j in jobs:
        label, game_map, engine = j['label'], j.get('map', 'ancient'), j.get('engine', 'chromium')
        matches = j.get('matches', MATCHES)
        if label in labels or not re.fullmatch(r'[\w.-]+', label) or label in ('.', '..'):
            raise ValueError('Invalid or duplicate fp label: ' + label)
        if engine not in ENGINES or not matches or any(type(m) is not int or m < 1 for m in matches) or len(set(matches)) != len(matches):
            raise ValueError('Invalid fp engine or match list: ' + label)
        labels.add(label)
        ref = resolve(j['ref'])
        fields = bool(j.get('fields'))
        outdir = here / 'runs' / label
        outdir.mkdir(parents=True, exist_ok=True)
        procguard.atomic_write(outdir / 'versions.json', json.dumps(versions, ensure_ascii=False).encode('utf-8'))
        actual = runtime_identity(versions, engine)
        launcher = 'tools/node/core_run.js' if engine == 'node' else 'src/q.js'
        launch_hash = digest((root / launcher).read_text(encoding='utf-8'))
        sim = sims / (label + ('.core.js' if engine == 'node' else '.html'))
        plan = {'engine': engine, 'map': game_map, 'label': label, 'dir': outdir, 'phased': bool(j.get('phase')),
                'count': len(matches), 'resumed': 0, 'pending': [], 'ref': ref, 'sim': sim, 'fields': fields, 'all_out': []}
        for m in matches:
            out, err, guard = [str(outdir / (name % m)) for name in ('fp_%d.json', 'err_%d.txt', 'guard_%d.json')]
            plan['all_out'].append(out)
            code = fingerprint_code(template, fields_code, m, fields)
            codefile = out[:-5] + '.code.js'
            meta = dict(sha=ref, map=game_map, engine=engine, fields=fields, match=m, code=digest(code), q=launch_hash, runtime=actual)
            t = {'name': 'fp %s m%d' % (sim.name, m), 'cmd': ['node', str(root / launcher), str(sim), '@' + codefile],
                 'cwd': root, 'env': dict(os.environ, SIM_BROWSER=engine), 'out': out, 'err': err, 'guard': guard,
                 'engine': engine, 'valid': lambda path, m=m: fingerprint(path, m), 'est_key': engine + ':' + game_map,
                 'save': {'dir': os.path.join(procguard.DONE, label, 'm%d' % m), 'meta': meta, 'files': [out, err, guard]},
                 'code': code, 'codefile': codefile}
            restored = pool.restore(t)
            if restored is None and archive is not None:
                previous = archive.result(label, t, launcher)
                if previous is not None:
                    restored = pool.restore(t, previous)
            if restored is None:
                plan['pending'].append(t)
            else:
                plan['resumed'] += 1
        plans.append(plan)
    for plan in plans:
        if plan['phased'] and (pool.q or pool.run or pool.retry):
            pool.wait_all()
        if plan['pending']:
            build(plan['ref'], plan['map'], plan['sim'], plan['engine'] == 'node')
            for t in plan['pending']:
                Path(t['codefile']).write_text(t['code'], encoding='utf-8')
                pool.q.append(t)
        if plan['phased']:
            first, caps = len(pool.attempts), len(pool.cap_log)
            start = time.monotonic()
            t0 = time.time()
            try:
                if plan['pending']:
                    pool.wait_all()
            finally:
                data = phase_report(pool.par, plan, pool.attempts[first:], pool.cap_log[caps:], start, t0)
                procguard.atomic_write(plan['dir'] / 'phase.json', json.dumps(data, ensure_ascii=False, indent=1).encode('utf-8'))
    if pool.q or pool.run or pool.retry:
        pool.wait_all()
    for plan in plans:
        for t in plan['pending']:
            Path(t['codefile']).unlink(missing_ok=True)
        if not plan['fields']:
            continue
        for out in plan['all_out']:
            if Path(out).is_file():
                try:
                    row = procguard.read_json(out)
                except (OSError, ValueError):
                    continue
                if 'fields' in row:
                    shadow = os.path.join(os.path.dirname(out), os.path.basename(out).replace('fp_', 'fw_'))
                    procguard.atomic_write(shadow, json.dumps(row.pop('fields')).encode('utf-8'))
                    procguard.atomic_write(out, json.dumps(row, separators=(',', ':')).encode('utf-8'))
