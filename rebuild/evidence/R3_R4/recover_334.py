"""Collect the surviving Windows files from run 334 without starting a match."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
RUN_START = datetime(2026, 11, 26, 12, 58, 18, tzinfo=timezone.utc).timestamp()
RUN_END = datetime(2026, 11, 26, 16, 23, 20, tzinfo=timezone.utc).timestamp()
MATCHES = [3, 7, 11, 13, 17, 19, 23, 29]


def read(path):
    try:
        return json.loads(path.read_bytes())
    except (OSError, ValueError):
        return None


def fresh(path):
    return path.is_file() and RUN_START <= path.stat().st_mtime <= RUN_END


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def completed(guard):
    return (isinstance(guard, dict) and guard.get('ok') is True and guard.get('rc') == 0
            and not guard.get('stopped'))


def recover(runs, homes, request, archive, r34_only=False):
    files = {}
    status = []

    def add(path, name):
        files[name] = path

    for kind in ('fp', 'rec', 'rust'):
        for job in request.get(kind, []):
            label = job['label']
            if r34_only and label not in {'v637a_chr_anc', 'v637a_chr_mir', 'v637a_rec_anc', 'v637a_rec_mir'}:
                continue
            folder = runs / label
            for name in ('versions.json', 'env.json', 'phase.json'):
                path = folder / name
                if fresh(path) and isinstance(read(path), dict):
                    add(path, f'{label}/{name}')
            if kind == 'rust':
                for path in folder.glob('*.txt'):
                    if fresh(path):
                        add(path, f'{label}/{path.name}')
                continue
            engine = job.get('engine', 'chromium')
            launcher = ROOT / ('tools/node/core_run.js' if engine == 'node' else 'src/q.js')
            template = (ROOT / 'tools/measure/fingerprint.js').read_text(encoding='utf-8')
            for match in job.get('matches', MATCHES):
                name, flag = f'{kind}_{match}.json', f'guard_{match}.json'
                candidates = [(folder, None)]
                if kind == 'fp':
                    candidates.extend((home / 'simcs2_done' / label / f'm{match}', home)
                                      for home in homes)
                entry = {'label': label, 'match': match, 'kind': kind, 'status': 'missing'}
                status.append(entry)
                for source, home in candidates:
                    result_path, guard_path = source / name, source / flag
                    if home is None and (not fresh(result_path) or not fresh(guard_path)):
                        continue
                    row, guard = read(result_path), read(guard_path)
                    if not isinstance(row, dict) or row.get('match') != match or not completed(guard):
                        continue
                    if guard.get('engine') != engine or not row.get('rounds'):
                        continue
                    if kind == 'fp':
                        if type(row.get('hash')) is not int or not 0 < row.get('ticks', 0) < 400000:
                            continue
                    elif (not isinstance(row.get('watch'), dict) or not isinstance(row['watch'].get('n'), dict)
                          or row.get('ticks') != 0):
                        # This exact request uses rec2 without a round limit. A
                        # completed match resets tick on the next match.
                        continue
                    if home is not None:
                        meta_path = source / 'meta.json'
                        meta = read(meta_path)
                        expected = dict(sha=job['ref'], map=job['map'], engine=engine, fields=False, match=match,
                                        code=digest(template.replace('__M__', str(match))),
                                        q=digest(launcher.read_text(encoding='utf-8')))
                        if not isinstance(meta, dict) or any(meta.get(k) != v for k, v in expected.items()):
                            continue
                        if not isinstance(meta.get('runtime'), dict):
                            continue
                        add(meta_path, f'{label}/meta_{match}.json')
                    add(result_path, f'{label}/{name}')
                    add(guard_path, f'{label}/{flag}')
                    entry.update(status='found', source='runner checkout' if home is None else 'resume cache')
                    break
    add(HERE / 'request_334.json', 'request.json')
    with ZipFile(archive, 'x', compression=ZIP_DEFLATED) as output:
        hashes = {}
        for name, path in sorted(files.items()):
            blob = path.read_bytes()
            hashes[name] = hashlib.sha256(blob).hexdigest()
            output.writestr(name, blob)
        output.writestr('manifest.json', json.dumps({'run': 334, 'matches': status, 'sha256': hashes},
                                                   ensure_ascii=False, indent=2))
    counts = {kind: sum(s['status'] == 'found' and s['kind'] == kind for s in status) for kind in ('fp', 'rec')}
    print(f"{archive}: {counts['fp']} fingerprints, {counts['rec']} recordings")


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--runner-root', type=Path, required=True)
    args.add_argument('--runner-home', type=Path, action='append', default=[])
    args.add_argument('--out', type=Path, required=True)
    args.add_argument('--r34-only', action='store_true')
    options = args.parse_args()
    request = read(HERE / 'request_334.json')
    recover(options.runner_root / 'tools/measure/runs', options.runner_home, request, options.out, options.r34_only)


if __name__ == '__main__':
    main()
