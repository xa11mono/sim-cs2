"""End-to-end preparation smoke test with synthetic, non-production map inputs."""
import base64
import csv
import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zlib

import demo_evidence_test


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'src'))
from mapset import MAP_FILES


class PipelineTest(unittest.TestCase):
    def test_distinct_map_id_and_overlapping_floors(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for folder in ('tools/map', 'tools/map-pack'):
                shutil.copytree(ROOT / folder, root / folder, ignore=shutil.ignore_patterns('__pycache__'))
            (root / 'src').mkdir()
            shutil.copyfile(ROOT / 'src/mapset.py', root / 'src/mapset.py')
            for tool in ('mapdir.py', 'demos.py'):
                shutil.copyfile(ROOT / 'tools' / tool, root / 'tools' / tool)
            map_id = 'fixture_tower'
            assets = root / 'data/maps' / map_id
            assets.mkdir(parents=True)
            def write(path, obj):
                (assets / path).write_text(json.dumps(obj), encoding='utf-8')

            radar = {'pos_x': 0, 'pos_y': 0, 'scale': 2}
            (assets / 'radar-source.png').write_bytes(base64.b64decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7V0AAAAASUVORK5CYII='))
            extras = {f'{role}_{axis}': 0 for role in ('CTSpawn', 'TSpawn', 'bombA', 'bombB') for axis in ('x', 'y')}
            (assets / 'radar-source.txt').write_text(''.join(f'"{key}" "{value}"\n'
                                                            for key, value in (radar | extras).items()))
            write('_build.json', {'sources': {'radar': 'radar-source.png', 'txt': 'radar-source.txt'}, 'radar': radar,
                                  'map': {'name': 'Synthetic tower test'}, 'steps': ['map']})
            points = [{'name': name, 'x': x, 'y': y} for name, x, y in
                      [('CTspawn', 0, 0), ('Tspawn', 9, 9), ('Asite', 3, 3), ('Bsite', 18, 18)]]
            write('zones.json', {'zonemap': {'points': points, 'zones': [], 'portals': []},
                                 'sites': {'A': [[0, 0], [10, 0], [10, 10], [0, 10]]}})
            write('navmesh.json', {'areas': [demo_evidence_test.area(1, 0), demo_evidence_test.area(2, 20)],
                                   'ladders': [{'id': 7, 'below': [1], 'above': [2]}]})
            for name in MAP_FILES:
                if not (assets / name).exists() and name != 'map.json':
                    write(name, {'syntheticFixture': True})
            block = base64.b64encode(zlib.compress(bytes(4))).decode()
            write('map3d.json', {
                **{key: dict.fromkeys(('n', 'lo', 'hi', 'mat'), block) for key in ('sight', 'nade', 'sky')},
                'floors': dict.fromkeys(('n', 'z', 'kind'), block), 'sky_z': block,
                'prims': dict.fromkeys(('v', 'tri', 'tri_flag', 'tri_mat', 'hull_n', 'hull_p',
                                        'hull_box', 'hull_flag', 'hull_mat'), block),
            })
            (assets / 'geom3d').mkdir()
            write('geom3d/entities.json', {'bombsites': [{'model': 'fixture_upper',
                  'poly': [[0, 0], [0, -10], [10, -10], [10, 0]], 'min': [0, -10, 19], 'max': [10, 0, 21]}]})

            source = root / 'demo-input'
            source.mkdir()
            tables = {
                'round_freeze_end': [('tick', 'total_rounds_played'), (16, 0)],
                'round_end': [('tick', 'winner', 'reason'), (64, 'CT', 't_killed')],
                'ticks': [('tick', 'steamid', 'team_num', 'X', 'Y', 'Z', 'is_alive'),
                          (16, '111', 2, 3, -3, 0, True), (16, '222', 3, 3, -3, 20, True),
                          (32, '111', 2, 4, -3, 0, True), (32, '222', 3, 4, -3, 20, True)],
            }
            for name, rows in tables.items():
                with gzip.open(source / f'tower_{name}.csv.gz', 'wt', newline='') as f:
                    csv.writer(f).writerows(rows)

            def run(*args, expected=0):
                cmd = [sys.executable, 'tools/map/map_build.py', map_id, *map(str, args)]
                result = subprocess.run(cmd, cwd=root, capture_output=True, text=True,
                                        env=dict(os.environ, PYTHON=sys.executable))
                self.assertEqual(result.returncode, expected, result.stdout + result.stderr)

            run('--only', 'map')
            run('--prepare', root / 'evidence', '--demo-dir', source)
            run('--check-prepared', root / 'evidence', '--demo-dir', source)
            catalog = json.loads((root / 'evidence/index.json').read_text())
            artifact = catalog['demos'][0]['evidence']['file']
            with gzip.open(root / 'evidence' / artifact, 'rt') as f:
                round_sample = json.loads(f.readline())
            self.assertEqual(round_sample['players']['222']['track'][0][3], [[2, 20.0], [1, 0.0]])

            spec = root / 'spec.json'
            spec.write_text(json.dumps({
                'map': map_id, 'geometryRevision': catalog['geometryRevision'],
                'entitiesSha256': demo_evidence_test.digest(assets / 'geom3d/entities.json'),
                'sites': {'A': {'triggerModel': 'fixture_upper', 'labelEvidence': 'synthetic input'}},
            }))
            run('--retake-layout', root / 'layout.json', '--site-spec', spec)
            layout = json.loads((root / 'layout.json').read_text())['layout']['A']
            self.assertEqual(layout['coreAreas'], [2])
            self.assertEqual(layout['otherHeightAreas'], [1])
            self.assertEqual(layout['directedApproaches'][0]['kind'], 'ladder_link')

            run('--package', root / 'first.simmap')
            run('--package', root / 'second.simmap')
            self.assertEqual((root / 'first.simmap').read_bytes(), (root / 'second.simmap').read_bytes())
            self.assertEqual((root / 'first.simmap').read_bytes()[:8], b'SIMMAP01')
            run('--package', root / 'must-not-exist.simmap', '--strict', expected=1)
            self.assertFalse((root / 'must-not-exist.simmap').exists())


if __name__ == '__main__':
    unittest.main()
