"""Build analysis-side demo evidence through demos_bake.py, outside the live map."""
import argparse
import csv
import gzip
import hashlib
import json
import math
import os
import re
from collections import Counter, defaultdict
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
import pandas as pd

import demos
import mapdir
from demo_geometry import Geometry
from demo_round_evidence import FRAME, round_evidence, team

EVENTS = ('round_freeze_end', 'round_end', 'round_start', 'bomb_planted', 'bomb_defused',
          'bomb_exploded', 'player_death', 'player_hurt', 'player_blind', 'weapon_fire',
          'weapon_fire_full', 'smokegrenade_detonate', 'flashbang_detonate',
          'inferno_startburn', 'hegrenade_detonate', 'bomb_beginplant', 'bomb_begindefuse',
          'player_jump', 'item_pickup', 'item_purchase')
REQUIRED = ('tick', 'steamid', 'team_num', 'X', 'Y', 'Z', 'is_alive')
EXTRA = ('armor_value', 'has_helmet', 'has_defuser', 'inventory', 'is_ducking',
         'is_scoped', 'velocity_X', 'velocity_Y', 'velocity_Z', 'ground_entity',
         'balance', 'current_equip_value', 'round_start_equip_value', 'freeze_end_equip_value')
GEOMETRY = ('_build.json', 'map.json', 'navmesh.json', 'zones.json', 'map3d.json', 'heights.json',
            'walls.json', 'cover.json', 'climbs.json')
VERSION = 1
MAP_ID = re.compile(r'[a-z0-9][a-z0-9_]*\Z')
DEMO_ID = re.compile(r'[a-zA-Z0-9_-]+\Z')


def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def json_out(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))


def finite(value):
    if value in ('', None):
        return None
    n = float(value)
    return n if math.isfinite(n) else None


def read_source(files, name, revision):
    sidecar = files.get('source')
    if sidecar is None:
        return {'mapEvidence': 'map_recipe_directory', 'demoSha256': None,
                'demoGeometryRevision': None, 'geometryMatchesDemo': None}
    info = json.loads(sidecar.read_text(encoding='utf-8'))
    if str(info['map']).removeprefix('de_') != name:
        raise ValueError('demo header and requested map disagree')
    if info['ticksSha256'] != digest(files['ticks']):
        raise ValueError('demo provenance sidecar does not match tick data')
    declared = info.get('mapGeometryRevision')
    return {'mapEvidence': 'demo_header', 'demoSha256': info['demoSha256'],
            'demoGeometryRevision': declared, 'geometryMatchesDemo': declared == revision if declared else None,
            'parser': info.get('parser'), 'sampleEveryTicks': info.get('sampleEveryTicks'),
            'tickRateHz': info.get('tickRateHz')}


def read_events(paths):
    tables, records = {}, {}
    for kind in EVENTS:
        if kind not in paths:
            continue
        with gzip.open(paths[kind], 'rt', encoding='utf-8', newline='') as file:
            reader = csv.DictReader(file)
            if 'tick' not in (reader.fieldnames or ()):
                raise ValueError(f'{paths[kind].name}: missing tick field')
            rows = []
            for row in reader:
                tick = int(row.pop('tick'))
                rows.append({'tick': tick, **{k: v for k, v in row.items() if v not in ('', None)}})
        records[kind] = sorted(rows, key=lambda r: r['tick'])
        if kind in ('round_freeze_end', 'round_end', 'bomb_planted'):
            tables[kind] = pd.read_csv(paths[kind], dtype={'user_steamid': 'Int64'})
    return tables, records


def read_samples(path, rounds, quality):
    grouped = defaultdict(list)
    ticks = set()
    with gzip.open(path, 'rt', encoding='utf-8', newline='') as file:
        reader = csv.DictReader(file)
        fields = tuple(reader.fieldnames or ())
        if missing := set(REQUIRED) - set(fields):
            raise ValueError(f'{path.name}: missing columns {sorted(missing)}')
        starts = np.array([r['t0'] for r in rounds])
        index = -1
        last_tick = -1
        for row in reader:
            tick = int(row['tick'])
            if tick != last_tick:
                index = int(starts.searchsorted(tick, side='right')) - 1
                last_tick = tick
            if index < 0 or tick >= rounds[index]['t1'] or row.get('is_warmup_period') == 'True':
                continue
            ticks.add(tick)
            side = team(row['team_num'])
            if side is None:
                quality['nonPlayerSideRows'] += 1
                continue
            player = row['steamid']
            if not player.isdecimal() or int(player) == 0:
                quality['missingPlayerIdRows'] += 1
                continue
            xyz = [finite(row[k]) for k in ('X', 'Y', 'Z')]
            if any(v is None for v in xyz) or row['is_alive'] not in ('True', 'False'):
                quality['invalidSampleRows'] += 1
                continue
            grouped[index].append((tick, player, side, row.get('name') or None,
                                   xyz, row['is_alive'] == 'True', finite(row.get('health')),
                                   finite(row.get('yaw')), finite(row.get('pitch')), row.get('active_weapon_name') or None,
                                   {k: row[k] for k in EXTRA if row.get(k)} or None))
    ticks = sorted(ticks)
    intervals = Counter(b - a for a, b in zip(ticks, ticks[1:]))
    cadence = intervals.most_common(1)[0][0] if intervals else None
    return grouped, fields, cadence


def sources(folder, demo):
    files = {kind: folder / f'{demo}_{kind}.csv.gz' for kind in ('ticks', *EVENTS)}
    files['source'] = folder / f'{demo}_source.json'
    return {kind: path for kind, path in files.items() if path.is_file()}


def build_demo(demo, files, folder, output, geometry, geometry_revision):
    if 'ticks' not in files or not {'round_end', 'round_freeze_end'} <= files.keys():
        raise ValueError('tick data or required round event tables missing')
    provenance = read_source(files, demos.MAPNAME, geometry_revision)
    tables, records = read_events(files)
    rounds = demos.rounds_of(demo, tables=tables)
    if not rounds:
        raise ValueError('no rounds with usable boundaries')
    quality = Counter()
    grouped, columns, cadence = read_samples(files['ticks'], rounds, quality)
    counts, geometry_quality = Counter(), Counter()
    target = output / f'{demo}.jsonl.gz'
    start_ticks = {e['tick'] for e in records.get('round_end', []) if e.get('winner')}
    with target.open('wb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as stream:
        for index, info in enumerate(rounds):
            if not grouped[index]:
                counts['roundsWithoutSamples'] += 1
                continue
            t0, t1 = info['t0'], info['t1']
            event_slice = {kind: [e for e in rows if t0 <= e['tick'] <= t1] for kind, rows in records.items()}
            if len(event_slice.get('bomb_planted', ())) > 1:
                counts['roundsWithMultiplePlantRows'] += 1
            if t1 not in start_ticks:
                counts['roundsWithoutWinnerEvent'] += 1
            r = round_evidence(info, grouped[index], event_slice, geometry, cadence,
                               provenance['geometryMatchesDemo'] is True)
            geometry_quality.update(r['quality'])
            for section in ('observerFacts', 'reviewCandidates'):
                counts.update({k: len(v) for k, v in r[section].items()})
            counts['rounds'] += 1
            stream.write((json_out(r) + '\n').encode())
    if not counts['rounds']:
        raise ValueError('no rounds have sampled player tracks')
    return {'demo': demo, **provenance, 'observedSampleCadenceTicks': cadence,
            'tickColumns': columns, 'missingEventTables': sorted(set(EVENTS) - files.keys()),
            'sources': {k: {'file': p.relative_to(folder).as_posix(), 'sha256': digest(p)} for k, p in files.items()},
            'evidence': {'file': target.name, 'sha256': digest(target)}, 'counts': dict(counts),
            'quality': dict(quality + geometry_quality)}


def geometry_inputs(name):
    root = Path(mapdir.path(name))
    return {f: digest(root / f) for f in GEOMETRY if (root / f).is_file()}


def revision(inputs):
    return hashlib.sha256(json_out(dict(sorted(inputs.items()))).encode()).hexdigest()


def dry_report(args):
    name = demos.MAPNAME
    if not MAP_ID.fullmatch(name) or not demos._R:
        raise ValueError('required: supported map with _build.json')
    root = Path(mapdir.ROOT).resolve()
    out = args.prepare.resolve()
    runtime = Path(mapdir.MAPS).resolve()
    # mapset.py reads additional JSON from the runtime map directory.
    if out == root or root.is_relative_to(out) or out.is_relative_to(runtime):
        raise ValueError('preparation output must be outside data/maps and cannot contain the repository')
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        raise ValueError('preparation output must be absent or empty')
    folder = (args.demo_dir or Path(demos.DEMOS)).resolve()
    names = args.demo or [p.name.removesuffix('_ticks.csv.gz') for p in sorted(folder.glob('*_ticks.csv.gz'))]
    if not names:
        raise ValueError(f'no professional tick exports in {folder}')
    if len(set(names)) != len(names) or not all(DEMO_ID.fullmatch(n) for n in names):
        raise ValueError('invalid or duplicate demo name')
    inputs = geometry_inputs(name)
    key = revision(inputs)
    annotations = {}
    if args.site_areas:
        annotations = json.loads(args.site_areas.read_text(encoding='utf-8'))
        if annotations.get('map') != name or annotations.get('geometryRevision') != key:
            raise ValueError('site annotations are for another map or geometry revision')
        if not annotations.get('source'):
            raise ValueError('site annotations require provenance')
    geometry = Geometry(name, annotations.get('sites'))
    out.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=out.parent, prefix=f'.{out.name}-') as temporary:
        stage = Path(temporary) / 'evidence'
        stage.mkdir()
        completed, rejected = [], []
        for demo in names:
            try:
                item = build_demo(demo, sources(folder, demo), folder, stage, geometry, key)
            except (ValueError, KeyError, OSError, EOFError) as exc:
                (stage / f'{demo}.jsonl.gz').unlink(missing_ok=True)
                rejected.append({'demo': demo, 'reason': str(exc)})
                print(f'{demo}: rejected: {exc}', flush=True)
                continue
            completed.append(item)
            print(f'{demo}: {item["counts"]["rounds"]} rounds', flush=True)
        if not completed:
            raise ValueError(f'no usable demo: {rejected}')
        catalog = {'schemaVersion': VERSION, 'map': name, 'geometryRevision': key, 'geometryInputs': inputs,
                   'siteAnnotations': annotations or None, 'selection': 'explicit' if args.demo else 'recipe_directory',
                   'frameColumns': FRAME, 'demos': completed, 'rejected': rejected}
        if args.rounds_out:
            export_demorounds(stage, catalog, args.rounds_out, folder)
        (stage / 'index.json').write_text(json_out(catalog) + '\n', encoding='utf-8')
        os.replace(stage, out)
    return len(rejected)


def export_demorounds(stage, catalog, selections, folder):
    """Use the page's existing round exporter without writing to either live map."""
    import sys
    sys.path.insert(0, str(Path(mapdir.ROOT) / 'tools' / 'shadow'))
    from export_round import export_round
    result = []
    valid = {d['demo'] for d in catalog['demos']}
    for selection in selections:
        demo, sep, number = selection.rpartition(':')
        if not sep or demo not in valid or not number.isdecimal():
            raise ValueError(f'expected --rounds-out DEMO:NUMBER for a staged demo: {selection}')
        row = export_round(demo, int(number), folder=folder)
        row['title'] = f'{demo} · {number}'
        result.append(row)
    (stage / 'demorounds.json').write_text(json_out({'rounds': result}) + '\n', encoding='utf-8')
    catalog['demoViewerExport'] = {'file': 'demorounds.json', 'sha256': digest(stage / 'demorounds.json'),
                                   'selectedRounds': selections}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--prepare', type=Path, help='new out-of-runtime directory')
    modes.add_argument('--check-prepared', type=Path, help='validate a staged catalog, tracks and source binding')
    parser.add_argument('--demo-dir', type=Path, help='use parser exports instead of the recipe directory')
    parser.add_argument('--demo', action='append', help='process just this demo stem; repeatable')
    parser.add_argument('--site-areas', type=Path, help='optional reviewed nav-area membership with map/revision')
    parser.add_argument('--rounds-out', action='append', help='export one viewer round, DEMO:NUMBER; repeatable')
    args = parser.parse_args()
    try:
        if args.check_prepared:
            from demo_evidence_check import validate
            raise SystemExit(validate(demos.MAPNAME, args.check_prepared, args.demo_dir))
        count = dry_report(args)
    except (ValueError, TypeError, KeyError, OSError, EOFError) as exc:
        parser.exit(1, f'{exc}\n')
    if count:
        parser.exit(2, f'{count} rejected demos; inspect index.json\n')
