"""Plan and verify the final R3/R4 checks using the recovered run 334."""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import re
from zipfile import ZipFile

from recover_334 import HERE, MATCHES, completed

MAPS = {'ancient': 'anc', 'mirage': 'mir'}
FINGERPRINTS = ('match', 'rounds', 'kills', 'nades', 'ticks', 'hash')
RUNTIME = ('platform', 'arch', 'node', 'node_v8', 'playwright', 'chromium')
STALL_KINDS = ('stall.block', 'stall.geom', 'stall.free', 'stall.path')
BASE = HERE.parent / 'R2' / 'fp_cloud_chromium158'


def load_result(path):
    if path.is_file():
        return json.loads(path.read_bytes())
    compressed = path.with_suffix(path.suffix + '.gz')
    return json.loads(gzip.decompress(compressed.read_bytes())) if compressed.is_file() else None


def normalized_runtime(row):
    if not isinstance(row, dict) or row.get('error'):
        return None
    version = row.get('browser') or {}
    result = {key: row.get(key) for key in RUNTIME}
    result['platform'] = result['platform'] or str(row.get('os', '')).partition(' ')[0]
    result['node_v8'] = result['node_v8'] or row.get('v8')
    result['chromium'] = result['chromium'] or version.get('version')
    return tuple(result[key] for key in RUNTIME) if all(result.values()) else None


def same_fp(left, right, match):
    return (all(isinstance(row, dict) and row.get('match') == match and
                all(key in row for key in FINGERPRINTS) for row in (left, right))
            and left == right)


def rec_errors(row, match):
    if not isinstance(row, dict):
        return ['запись матча неполна']
    ticks = row.get('ticks')
    finished = type(ticks) is int and (ticks > 0 and row.get('finished') is True
                                       or ticks == 0 and 'finished' not in row)
    if (row.get('match') != match or not finished
            or not row.get('rounds') or not isinstance(row.get('prob'), list)
            or not isinstance(row.get('watch'), dict)):
        return ['запись матча неполна']
    watch = row['watch']
    counts, events = watch.get('n'), watch.get('all')
    if not isinstance(counts, dict) or not isinstance(events, dict):
        return ['нет полного журнала сторожа']
    errors = []
    prob = Counter()
    motion = {key: [] for key in ('stall', 'tug', 'nav')}
    for e in row['prob']:
        if not isinstance(e, list) or len(e) != 9 or not e[4] or not isinstance(e[8], dict):
            errors.append('у события PROB нет причины')
            continue
        prob[e[2]] += 1
        if e[2] in motion:
            motion[e[2]].append([e[0], e[1], e[4], e[5], e[6], e[7], e[3], e[8]])
        if e[3]:
            prob[e[3]] += 1
    episodes = set()
    for kind in ('stall', 'tug', 'nav', 'danger', 'flashKnown'):
        rows = events.get(kind, [])
        key = 'danger.flashKnown' if kind == 'flashKnown' else kind
        if not isinstance(rows, list) or counts.get(key, 0) != len(rows):
            errors.append(f'счётчик {key} не совпал с полным журналом')
            continue
        if kind in motion and motion[kind] != [e[:8] for e in rows if isinstance(e, list)]:
            errors.append(f'{kind}: W.all и REC.prob расходятся')
        for e in rows:
            if not isinstance(e, list) or len(e) < 3 or not e[2]:
                errors.append(f'{key}: у события нет причины')
            elif kind == 'stall':
                if len(e) < 9 or e[6] not in STALL_KINDS or not isinstance(e[7], dict) or not e[8]:
                    errors.append('у события stall нет типа, следа или номера эпизода')
                else:
                    episodes.add(e[8])
    for key in STALL_KINDS:
        if counts.get(key, 0) != prob[key]:
            errors.append(f'{key}: счётчик не совпал с REC.prob')
    if counts.get('stall.ep') != len(episodes):
        errors.append('stall.ep не совпал с числом уникальных эпизодов')
    return list(dict.fromkeys(errors))


def danger_summary(row):
    watch = row.get('watch', {})
    counts, events = watch.get('n'), watch.get('all')
    if not isinstance(counts, dict) or not isinstance(events, dict):
        return None
    groups = {key: events.get(key, []) for key in ('danger', 'flashKnown')}
    if (any(not isinstance(rows, list) for rows in groups.values())
            or counts.get('danger') != len(groups['danger'])
            or counts.get('danger.flashKnown', 0) != len(groups['flashKnown'])):
        return None
    return groups


def read_archive(path):
    with ZipFile(path) as z:
        manifest = json.loads(z.read('manifest.json'))
        if manifest.get('run') != 334 or len(set(z.namelist())) != len(z.namelist()):
            raise ValueError('Архив не соответствует формату восстановления 334')

        def read(name, required=True):
            if name not in manifest['sha256'] and not required:
                return None
            buf = z.read(name)
            if hashlib.sha256(buf).hexdigest() != manifest['sha256'].get(name):
                raise ValueError(f'Контрольная сумма не совпала: {name}')
            return json.loads(buf)

        if read('request.json') != json.loads((HERE / 'request_334.json').read_bytes()):
            raise ValueError('Запрос внутри архива отличается от задания 334')
        found = {(m['label'], m['match']) for m in manifest['matches'] if m['status'] == 'found'}
        headers, usable, diagnostic_gaps, danger = {}, {}, [], {}
        for map_name, tag in MAPS.items():
            for kind, source in (('fp', f'v637a_chr_{tag}'), ('rec', f'v637a_rec_{tag}')):
                env_file = 'versions.json' if kind == 'fp' else 'env.json'
                env = read(f'{source}/{env_file}', required=False)
                for match in MATCHES:
                    if (source, match) not in found:
                        continue
                    guard = read(f'{source}/guard_{match}.json')
                    if not completed(guard) or guard.get('engine') != 'chromium':
                        raise ValueError(f'Негодный guard: {source}/{match}')
                    meta = read(f'{source}/meta_{match}.json', required=False) if kind == 'fp' else None
                    identity = normalized_runtime(env)
                    runtime = normalized_runtime(meta.get('runtime')) if meta else identity
                    if runtime is None or (identity is not None and identity != runtime):
                        continue
                    row = read(f'{source}/{kind}_{match}.json')
                    if kind == 'fp':
                        baseline = load_result(BASE / tag / f'fp_{match}.json')
                        if not same_fp(row, baseline, match):
                            raise ValueError(f'{source}/{match}: расхождение с отпечатком Р2')
                    elif errors := rec_errors(row, match):
                        diagnostic_gaps.append(f'{source}/{match}: ' + '; '.join(errors))
                        if partial := danger_summary(row):
                            danger[map_name, match] = (runtime, partial)
                        continue
                    key = (kind, map_name, match)
                    headers[key] = runtime
                    usable[key] = row if kind == 'fp' else True
        preferred = Counter(headers.values()).most_common(1)
        identity = preferred[0][0] if preferred else None
        if identity is None and danger:
            identity = Counter(runtime for runtime, _ in danger.values()).most_common(1)[0][0]
        return (identity, {key: usable[key] for key in headers if headers[key] == identity}, diagnostic_gaps,
                {key: rows for key, (runtime, rows) in danger.items() if runtime == identity})


def job_plan(ref, identity, reusable):
    plan = {'par': 8, 'resume': True, 'fp': [], 'rec': []}
    if identity is not None:
        plan['require_runtime'] = dict(zip(RUNTIME, identity))
    for name, tag in MAPS.items():
        for kind, label in (('fp', f'r34_on_{tag}'), ('off', f'r34_off_{tag}'), ('rec', f'r34_rec_{tag}')):
            # The current build's trace-on fingerprint rides with each new rec.
            matches = [m for m in MATCHES if (('rec', name, m) in reusable if kind == 'fp'
                                              else (kind, name, m) not in reusable)]
            if matches:
                job = dict(label=label, ref=ref, map=name, matches=matches)
                if kind == 'off':
                    job['trace'] = False
                if kind == 'rec':
                    job['complete'] = True
                    job['fingerprint'] = True
                plan['rec' if kind == 'rec' else 'fp'].append(job)
    return plan


def verify(root, plan, identity, reusable, danger):
    if load_result(root / 'request.json') != plan:
        raise ValueError('В результатах отсутствует исходный запрос приёмки')
    if identity is None:
        identity = normalized_runtime(load_result(root / 'r34_off_anc' / 'versions.json'))
    issues = []
    for name, tag in MAPS.items():
        fp_on, fp_off = {}, {}
        for kind, label in (('fp', f'r34_on_{tag}'), ('off', f'r34_off_{tag}'), ('rec', f'r34_rec_{tag}')):
            folder = root / label
            env_file = 'env.json' if kind == 'rec' else 'versions.json'
            job = next((job for section in ('fp', 'rec') for job in plan[section] if job['label'] == label), None)
            if job:
                env = normalized_runtime(load_result(folder / env_file))
                if env is None or env != identity:
                    issues.append(f'{label}: среда не совпала')
            for match in job['matches'] if job else []:
                prefix = 'rec' if kind == 'rec' else 'fp'
                row = load_result(folder / f'{prefix}_{match}.json')
                guard = load_result(folder / f'guard_{match}.json')
                if not completed(guard) or guard.get('engine') != 'chromium':
                    issues.append(f'{label}/{match}: нет успешного guard')
                if kind == 'fp':
                    fp_on[match] = row
                elif kind == 'off':
                    fp_off[match] = row
                else:
                    issues.extend(f'{label}/{match}: {error}' for error in rec_errors(row, match))
                    fp_on[match] = row.get('fingerprint') if isinstance(row, dict) else None
                    preserved = danger.get((name, match))
                    if preserved is not None and (not isinstance(row, dict) or danger_summary(row) != preserved):
                        issues.append(f'{label}/{match}: события danger отличаются от сохранившихся в 334')
        for match in MATCHES:
            baseline = reusable.get(('fp', name, match)) or load_result(BASE / tag / f'fp_{match}.json')
            if not same_fp(fp_on.get(match), baseline, match):
                issues.append(f'{name}/{match}: отпечаток текущей сборки со следом отличается от эталона')
            if not same_fp(fp_off.get(match), fp_on.get(match), match):
                issues.append(f'{name}/{match}: след вкл/выкл дал разные отпечатки')
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--ref', required=True)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--out', type=Path)
    action.add_argument('--verify', type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.ref):
        parser.error('--ref требует полный SHA приёмочной сборки')
    identity, reusable, diagnostic_gaps, danger = read_archive(args.archive)
    plan = job_plan(args.ref, identity, reusable)
    print('Из 334:', sum(k[0] == 'fp' for k in reusable), 'отпечатков,',
          sum(k[0] == 'rec' for k in reusable), 'полных записей и', len(danger), 'частичных отчётов danger')
    for gap in diagnostic_gaps:
        print('Недостающие данные Р3.6:', gap)
    if args.out:
        with args.out.open('x', encoding='utf-8') as f:
            json.dump(plan, f, indent=2, ensure_ascii=False)
            f.write('\n')
    else:
        issues = verify(args.verify, plan, identity, reusable, danger)
        print('\n'.join(issues) if issues else 'Э1, след вкл/выкл и записи Р3.6: 16 из 16 на каждую проверку')
        return bool(issues)


if __name__ == '__main__':
    raise SystemExit(main())
