"""Read-only audit of the published 332 artifacts and the v637a admission rule."""
import gzip
import json
import os
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BASE = '543c68dc5789aa730e2b7bf167846cf4d9a4f006'
request = json.loads((HERE / 'request-332-resume.json').read_text())
archive = request['resume_from']['results']


def show(ref, path):
    return subprocess.check_output(['git', 'show', ref + ':' + path], cwd=ROOT, stderr=subprocess.DEVNULL)


def result(label, prefix, match):
    try:
        return json.loads(gzip.decompress(show(archive, '%s/%s_%d.json.gz' % (label, prefix, match))))
    except (ValueError, subprocess.CalledProcessError):
        return {}


log = show(archive, 'run.log').decode('utf-8', errors='replace')
rows, footprints = {}, {}
for j in request['fp']:
    label = j['label']
    n = j.get('matches', [3, 7, 11, 13, 17, 19, 23, 29])
    saved = {}
    peaks = []
    for m in n:
        guard, fp = [result(label, prefix, m) for prefix in ['guard', 'fp']]
        if guard.get('ok') and type(fp.get('hash')) is int and fp.get('match') == m:
            saved[m] = fp
            peaks.append(guard['peak_mb'])
    footprints[label] = saved
    max_running = max((int(v) for v in re.findall(r'^start fp ' + re.escape(label) + r'\.(?:core\.js|html) m\d+ \(идёт (\d+),', log, re.M)), default=0)
    rows[label] = {'engine': j.get('engine', 'chromium'), 'map': j['map'], 'ready': sorted(saved),
                   'missing': sorted(set(n) - saved.keys()), 'peak_range_mb': [min(peaks), max(peaks)] if peaks else None,
                   'max_running_at_launch': max_running}

scope = {'__name__': 'v637a_guard'}
exec(compile(show(BASE, 'tools/measure/procguard.py'), 'v637a/procguard.py', 'exec'), scope)
physical, available, reserve = 15977, 8293, 3195   # Ancient wave and guard reserve in the published log
scope['mem_mb'] = lambda: (physical, available)
scope['STATE'] = os.devnull
p = scope['Pool'](par=8, log=lambda _: None)
task = {'engine': 'chromium', 'est_key': 'chromium:ancient'}
while len(p.run) < p.cap and (not p.run or available - p._need() - p._est(p._key(task)) >= reserve):
    p.run.append({'t': task, 'peak': 0, 'now': 0})
observed = rows['v636a_chr_anc']['peak_range_mb'][1]
print(json.dumps({'archive': archive, 'rows': rows,
                  'ancient_equal_fingerprints': sum(footprints['v636a_chr_anc'].get(m) == h
                                                     for m, h in footprints['v636a_node_anc'].items()),
                  'old_archive_browser_env_probes': len(re.findall(r'^> .*env\.js ', log, re.M)),
                  'old_archive_git_fetches': len(re.findall(r'^> git fetch ', log, re.M)),
                  'old_archive_real_builds': len(re.findall(r'^> .*\b(?:core_build|build)\.py --map ', log, re.M)),
                  'v637a_cold_ancient_scenario': {'available_mb': available, 'reserve_mb': reserve,
                                                 'estimate_mb': p._est(p._key(task)), 'admitted': len(p.run),
                                                 'simultaneous_observed_peak_mb': len(p.run) * observed}},
                 ensure_ascii=False, indent=2))
