#!/usr/bin/env python3
"""Compare legacy, shared, streamed and optionally light-page jobs on the same short inputs."""
import argparse
import collections
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import psutil

ROOT = Path(__file__).resolve().parents[3]
WALK = ROOT / 'tools/measure/engine/walk_run.py'


def kind(process):
    command = process.cmdline()
    executable = Path(command[0]).name.lower() if command else process.name().lower()
    if 'chrom' in executable:
        flag = next((arg for arg in command if arg.startswith('--type=')), '')
        return 'browser.' + (flag.partition('=')[2] if flag else 'main')
    if 'node' in executable:
        return 'node'
    return 'python_or_helper'


def sample(parent, metric, seen):
    totals = collections.Counter()
    counts = collections.Counter()
    for process in [parent, *parent.children(recursive=True)]:
        try:
            group = kind(process)
            memory = process.memory_info().rss if metric == 'rss' else getattr(process.memory_full_info(), metric)
            totals[group] += memory
            counts[group] += 1
            seen[process.pid] = process.create_time()
        except psutil.NoSuchProcess:
            pass
    return dict(totals), dict(counts)


def run(mode, page, options, matches, args):
    out = args.output / mode
    out.mkdir()
    process = subprocess.Popen(
        [sys.executable, str(WALK), 'case', f'--sim={page}', f'--ticks={args.ticks}',
         f'--par={args.par}', f'--matches={matches}', *options],
        cwd=ROOT, env=dict(os.environ, SIMCS2_RUNS_DIR=str(out))
    )
    parent = psutil.Process(process.pid)
    start = time.perf_counter()
    seen = {}
    samples = []
    while process.poll() is None:
        try:
            totals, counts = sample(parent, args.metric, seen)
            samples.append({'s': round(time.perf_counter() - start, 3), 'bytes': totals, 'processes': counts})
        except psutil.NoSuchProcess:
            break
        time.sleep(args.interval)
    rc = process.wait()
    elapsed = time.perf_counter() - start
    if rc:
        raise subprocess.CalledProcessError(rc, process.args)
    left = []
    deadline = time.monotonic() + 3
    while True:
        left = []
        for pid, created in seen.items():
            try:
                candidate = psutil.Process(pid)
                if candidate.create_time() == created and candidate.status() != psutil.STATUS_ZOMBIE:
                    left.append(pid)
            except psutil.NoSuchProcess:
                pass
        if not left or time.monotonic() >= deadline:
            break
        time.sleep(args.interval)
    peak = max(samples, key=lambda row: sum(row['bytes'].values()))
    return {
        'seconds': elapsed, 'peak_bytes': sum(peak['bytes'].values()), 'at_peak': peak,
        'surviving_sampled_pids': left, 'samples': samples
    }


def compare(baseline, candidate, matches):
    result = {}
    for match in matches.split(','):
        name = f'rec_{match}.json'
        old = json.loads((baseline / 'case' / name).read_bytes())
        new = json.loads((candidate / 'case' / name).read_bytes())
        # This field records actual wall-clock slow ticks; both runners keep it in the output.
        slow = [len(old.pop('slow')), len(new.pop('slow'))]
        diff = sorted(key for key in old.keys() | new.keys() if key not in old or key not in new or old[key] != new[key])
        result[name] = {'different_game_or_diagnostic_fields': diff, 'slow_samples': slow}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('page', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--light', type=Path)
    parser.add_argument('--matches', default='3,7,11')
    parser.add_argument('--ticks', type=int, default=1600)
    parser.add_argument('--par', type=int, default=2)
    parser.add_argument('--interval', type=float, default=0.25)
    parser.add_argument('--metric', choices=('pss', 'uss', 'rss'), default='pss' if sys.platform.startswith('linux') else 'uss')
    args = parser.parse_args()
    if args.ticks < 1 or args.par < 1 or args.interval <= 0:
        parser.error('ticks, par и interval должны быть положительными')
    args.output = args.output.resolve()
    args.output.mkdir()
    modes = [
        ('legacy', args.page, []),
        ('shared', args.page, ['--shared-browser']),
        ('stream', args.page, ['--shared-browser', '--stream-records'])
    ]
    if args.light:
        modes.append(('light', args.light, modes[-1][2]))
    report = {'metric': args.metric, 'par': args.par, 'ticks': args.ticks, 'matches': args.matches, 'modes': {}}
    failure = False
    for mode, page, flags in modes:
        stats = run(mode, page.resolve(), flags, args.matches, args)
        failure |= bool(stats['surviving_sampled_pids'])
        if mode != 'legacy':
            stats['comparison'] = compare(args.output / 'legacy', args.output / mode, args.matches)
            failure |= any(result['different_game_or_diagnostic_fields'] for result in stats['comparison'].values())
        report['modes'][mode] = stats
        print(f"{mode}: {stats['peak_bytes'] / 2**20:.1f} MiB {args.metric}, {stats['seconds']:.2f} s", flush=True)
        (args.output / 'comparison.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return int(failure)


if __name__ == '__main__':
    sys.exit(main())
