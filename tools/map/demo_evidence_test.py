"""Tests for map-independent offline extraction edge cases."""
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapdir

mapdir.set_current('fixture')
with patch.object(mapdir, 'game_to_map', return_value=None):
    from demo_evidence import read_source, sources
from demo_geometry import Geometry
from demo_round_evidence import clutches, crossings, round_evidence


def area(ident, height, links=()):
    return {'id': ident, 'z': height, 'points': [dict(x=x, y=y, z=height) for x, y in
            [(0, 0), (10, 0), (10, 10), (0, 10)]], 'conn': list(links)}


class GeometryTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.folder = Path(folder.name)
        (self.folder / 'navmesh.json').write_text(json.dumps({
            'areas': [area(1, 0), area(2, 20), area(3, 40)],
            'ladders': [{'id': 1, 'below': [1], 'above': [2]}],
        }))
        (self.folder / 'zones.json').write_text(json.dumps({'sites': {'X': [[0, 0], [9, 0], [9, 9], [0, 9]]}}))
        with patch.object(mapdir, 'path', side_effect=lambda _, file: self.folder / file), patch.object(
                mapdir, 'radar', return_value={'pos_x': 0, 'pos_y': 0, 'scale': 2}):
            self.geometry = Geometry('fixture', {'X': [1]})

    def test_xy_overlap_keeps_all_heights_and_refuses_site_assignment(self):
        xy, candidates = self.geometry.point(3, -4, 19)
        self.assertEqual(xy, [3, 4])
        self.assertEqual(candidates, [(2, 20), (1, 0), (3, 40)])
        self.assertIsNone(self.geometry.site('X', xy, candidates, True))
        self.assertIsNone(self.geometry.site('X', xy, candidates, False))
        self.assertEqual(self.geometry.transition(1, 2), 'ladder_link')
        self.assertEqual(self.geometry.transition(2, 3), 'unsampled_or_unlinked')

    def test_sampled_entry_binds_ticks_and_keeps_ties(self):
        track = [[20, [12, -4, 0], [12, 4], [(2, 0)], True],
                 [36, [3, -4, 0], [3, 4], [(1, 0)], True]]
        actors = {pid: {'side': 'CT', 'track': track} for pid in ['2', '1']}
        rows = crossings(actors, 20, 'X', self.geometry, True)
        self.assertEqual([(e['previousOutsideTick'], e['tick'], e['method']) for e in rows],
                         [(20, 36, 'nav_area'), (20, 36, 'nav_area')])

    def test_loser_sample_has_no_result_without_round_end(self):
        info = dict(rid='demo|0', t0=16, t1=48, tplant=None, site=None, planter=None)
        samples = [(16, '100', 'CT', 'A', [1, -1, 0], True, 100, 0, 0, 'AWP', None),
                   (16, '200', 'T', 'B', [2, -2, 0], True, 100, 0, 0, None, None)]
        row = round_evidence(info, samples, {}, self.geometry, 16, False)
        self.assertEqual(row['reviewCandidates']['save'], [])
        self.assertIsNone(row['winner'])
        self.assertEqual(row['observerFacts']['awpActive'][0]['sampleTicks'], [16])


class ProvenanceTest(unittest.TestCase):
    def test_wrong_map_and_wrong_tick_hash_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            with gzip.open(p / 'sample_ticks.csv.gz', 'wt') as file:
                file.write('tick\n1\n')
            meta = p / 'sample_source.json'
            meta.write_text(json.dumps({'map': 'de_other', 'ticksSha256': 'x'}))
            with self.assertRaisesRegex(ValueError, 'requested map'):
                read_source(sources(p, 'sample'), 'fixture', 'geom')
            meta.write_text(json.dumps({'map': 'de_fixture', 'ticksSha256': 'x'}))
            with self.assertRaisesRegex(ValueError, 'does not match'):
                read_source(sources(p, 'sample'), 'fixture', 'geom')

    def test_incomplete_frame_breaks_clutch_interval(self):
        live = [0, [], [], [], True]
        all_players = {'a': ('T', live), 'b': ('CT', live), 'c': ('CT', live)}
        rows = clutches({1: all_players, 2: {'a': all_players['a']}, 3: all_players}, set(all_players))
        self.assertEqual([(r['firstObservedTick'], r['lastObservedTick']) for r in rows], [(1, 1), (3, 3)])


if __name__ == '__main__':
    unittest.main()
