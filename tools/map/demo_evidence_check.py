"""Verify staged demo evidence and detect stale map/source bindings."""
import gzip
import json
import re

from demo_evidence import DEMO_ID, FRAME, VERSION, digest, geometry_inputs, revision
from demo_geometry import Geometry


def safe_artifact(root, row):
    path = root / row['file']
    if not path.resolve().is_relative_to(root.resolve()) or path.is_symlink() or not path.is_file():
        raise ValueError(f'invalid or missing artifact {path}')
    if digest(path) != row['sha256']:
        raise ValueError(f'checksum mismatch: {path}')
    return path


def validate_round(round_info, demo, geometry):
    rid, players = round_info['rid'], round_info['players']
    if not players or rid != f'{demo}|{round_info["num"]}' or round_info['t1'] <= round_info['t0']:
        raise ValueError(f'{rid}: invalid round identity or boundaries')
    ticks_by_player = {}
    for player, actor in players.items():
        if not player.isdecimal() or actor['side'] not in ('CT', 'T') or not actor['track']:
            raise ValueError(f'{rid}: invalid player record')
        ticks_by_player[player] = track = set()
        previous = round_info['t0'] - 1
        for row in actor['track']:
            if len(row) != len(FRAME):
                raise ValueError(f'{rid}: incomplete track row')
            tick, xyz, xy, areas = row[:4]
            if not previous < tick < round_info['t1']:
                raise ValueError(f'{rid}: invalid or unordered track ticks')
            expected_xy, expected_areas = geometry.point(*xyz)
            if xy != expected_xy or [tuple(a) for a in areas] != expected_areas:
                raise ValueError(f'{rid}: XYZ, radar projection or nav heights inconsistent at {tick}')
            previous = tick
            track.add(tick)
    for events in round_info['events'].values():
        if any(not round_info['t0'] <= e['tick'] <= round_info['t1'] for e in events):
            raise ValueError(f'{rid}: event outside round boundaries')
    for row in round_info['observerFacts']['clutchSamples']:
        track = ticks_by_player[row['player']]
        if (not row['opponents'] or row['firstObservedTick'] not in track
                or row['lastObservedTick'] not in track or any(i not in players for i in row['opponents'])):
            raise ValueError(f'{rid}: clutch references absent observations')
    for row in round_info['observerFacts']['awpActive']:
        if not row['sampleTicks'] or not set(row['sampleTicks']) <= ticks_by_player[row['player']]:
            raise ValueError(f'{rid}: AWP references absent track')
    for row in round_info['reviewCandidates']['siteEntries']:
        track = ticks_by_player[row['player']]
        earlier = row['previousOutsideTick']
        if row['tick'] not in track or (earlier is not None and (earlier not in track or earlier >= row['tick'])):
            raise ValueError(f'{rid}: crossing reference absent or reversed')
    for row in round_info['reviewCandidates']['checkJump']:
        if not set(row['ticks']) <= ticks_by_player[row['player']]:
            raise ValueError(f'{rid}: jump references absent track')
    for row in round_info['reviewCandidates']['boost']:
        for player in (row['lower'], row['upper']):
            if not {row['firstTick'], row['lastTick']} <= ticks_by_player[player]:
                raise ValueError(f'{rid}: boost references absent observations')


def validate(name, folder, source_dir=None):
    index = json.loads((folder / 'index.json').read_text(encoding='utf-8'))
    if index['schemaVersion'] != VERSION or index['map'] != name or tuple(index['frameColumns']) != FRAME:
        raise ValueError('unsupported evidence schema or mismatched map')
    inputs = geometry_inputs(name)
    if inputs != index['geometryInputs'] or revision(inputs) != index['geometryRevision']:
        raise ValueError('map geometry/revision differs; reproject original XYZ and review spatial labels')
    geometry = Geometry(name)
    if not index['demos']:
        raise ValueError('no demos in catalog')
    names = set()
    for entry in index['demos']:
        demo = entry['demo']
        if demo in names or not DEMO_ID.fullmatch(demo):
            raise ValueError(f'invalid or duplicate demo identifier {demo}')
        names.add(demo)
        for item in entry['sources'].values():
            if not re.fullmatch(r'[a-f0-9]{64}', item['sha256']):
                raise ValueError(f'{demo}: invalid source SHA-256')
            if source_dir:
                safe_artifact(source_dir, item)
        data = safe_artifact(folder, entry['evidence'])
        seen = set()
        with gzip.open(data, 'rt', encoding='utf-8') as stream:
            for line in stream:
                row = json.loads(line)
                validate_round(row, demo, geometry)
                if row['rid'] in seen:
                    raise ValueError(f'{data.name}: duplicate {row["rid"]}')
                seen.add(row['rid'])
        if not seen or len(seen) != entry['counts']['rounds']:
            raise ValueError(f'{data.name}: round count differs from catalog')
    if viewer := index.get('demoViewerExport'):
        rounds = json.loads(safe_artifact(folder, viewer).read_text(encoding='utf-8'))['rounds']
        if not rounds or len(rounds) != len(viewer['selectedRounds']):
            raise ValueError('viewer export is empty or incomplete')
        for selected, r in zip(viewer['selectedRounds'], rounds):
            if selected != f'{r["demo"]}:{r["num"]}' or r['len'] <= 0 or not r['players']:
                raise ValueError('viewer round does not match selection')
    print(f'{name}: {len(names)} staged demo(s) verified, {len(index["rejected"])} rejected')
    return 2 if index['rejected'] else 0
