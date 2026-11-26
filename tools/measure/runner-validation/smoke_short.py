"""Run a short, non-benchmark smoke with real Node and Chromium processes.

Use two existing v636a Mirage builds, a local Playwright install and browser.
"""
import json
import os
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
MEASURE = HERE.parent
ROOT = MEASURE.parent.parent
sys.path.insert(0, str(MEASURE))

import fingerprint_jobs as fp
import procguard

if len(sys.argv) != 3:
    raise SystemExit('Usage: smoke_short.py CORE_MIRAGE.js MIRAGE.html')
core, html = (Path(x).resolve(strict=True) for x in sys.argv[1:])
ticks = 1200
with tempfile.TemporaryDirectory(prefix='runner-smoke-') as temp:
    folder = Path(temp)
    procguard.STATE = str(folder / 'state.json')
    pool = procguard.Pool(8, {'poll_s': 0.1, 'tree_s': 0.1}, log=lambda line: print(line, file=sys.stderr))
    template = (MEASURE / 'fingerprint.js').read_text(encoding='utf-8')
    template = template.replace('t < 400000;', 't < %d;' % ticks)
    results, footprints = {}, []
    for engine, game, launcher in [('node', core, 'tools/node/core_run.js'), ('chromium', html, 'src/q.js')]:
        filename = folder / (engine + '.js')
        filename.write_text(template.replace('__M__', '3'), encoding='utf-8')
        outfile = folder / (engine + '.json')

        def valid(path):
            try:
                result = procguard.read_json(path)
                return result.get('match') == 3 and result.get('ticks') == ticks and type(result.get('hash')) is int
            except (ValueError, OSError):
                return False

        task = {'name': engine, 'engine': engine, 'est_key': engine + ':mirage', 'out': outfile,
                'err': folder / (engine + '.txt'), 'cwd': ROOT, 'env': dict(os.environ, SIM_BROWSER=engine),
                'valid': valid, 'cmd': ['node', str(ROOT / launcher), str(game), '@' + str(filename)]}
        first = len(pool.attempts)
        pool.add(task)
        started, t0 = time.monotonic(), time.time()
        pool.wait_all()
        rows = pool.attempts[first:]
        if len(rows) != 1 or not rows[0]['ok']:
            raise RuntimeError((folder / (engine + '.txt')).read_text(encoding='utf-8'))
        result = fp.phase_report(8, {'count': 1, 'resumed': 0, 'pending': [task], 'engine': engine, 'map': 'mirage'},
                                 rows, [], started, t0)
        if result['par_max'] != 1 or result['successful_ticks'] != ticks:
            raise RuntimeError('Smoke phase accounted incorrectly')
        footprints.append(procguard.read_json(outfile))
        results[engine] = {'matches_played': result['matches_played'], 'par_max': result['par_max'],
                           'ticks': result['successful_ticks'], 'fingerprint': footprints[-1]['hash']}
    if footprints[0] != footprints[1]:
        raise RuntimeError('Short Node and Chromium footprints differ')
    print(json.dumps({'kind': 'short smoke', 'results': results}, indent=2))
