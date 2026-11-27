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
    from demo_evidence import digest, read_source, sources
from demo_geometry import Geometry
from demo_revision import verify_bindings
from map_contract import problem
from retake_layout import approaches, select_areas
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
        (self.folder / 'map.json').write_text(json.dumps({'zoneLayer': {'scale': 1, 'dx': 5, 'dy': 0}}))
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

    def test_zone_projection_uses_map_baseline(self):
        self.assertEqual(self.geometry.site('X', [2, 2], [(1, 0)], False),
                         ('plant_polygon_xy_proxy', False))
        self.assertEqual(self.geometry.site('X', [6, 2], [(1, 0)], False),
                         ('plant_polygon_xy_proxy', True))

    def test_same_xy_retains_directed_ladder_to_only_the_selected_floor(self):
        selected = select_areas(self.geometry, [(0, 0), (10, 0), (10, 10), (0, 10)], [19, 21])
        self.assertEqual(selected, ({2}, set(), {1, 3}))
        edges = approaches(self.geometry, *selected[:2])
        self.assertEqual([(e['from'], e['to'], e['kind']) for e in edges], [(1, 2, 'ladder_link')])
        self.assertEqual(edges[0]['toZ'], [20, 20])

    def test_height_bounds_are_used_for_verified_site_observation(self):
        self.geometry.site_layout = {'X': {'heightBoundsWorld': [-1, 1]}}
        candidates = [(1, 0)]
        self.assertEqual(self.geometry.site('X', [5, 5], candidates, True, 0),
                         ('nav_area_and_trigger_height', True))
        self.assertEqual(self.geometry.site('X', [5, 5], candidates, True, 20),
                         ('nav_area_and_trigger_height', False))
        self.assertIsNone(self.geometry.site('X', [5, 5], candidates, True))

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

    def test_self_declared_revision_is_not_verified(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            ticks = p / 'demo_ticks.csv.gz'
            ticks.write_bytes(b'sample')
            (p / 'demo_source.json').write_text(json.dumps({
                'map': 'de_fixture', 'ticksSha256': digest(ticks),
                'mapGeometryRevision': 'geom', 'demoSha256': 'recording',
            }))
            source = read_source(sources(p, 'demo'), 'fixture', 'geom')
            self.assertTrue(source['reportedGeometryRevisionMatches'])
            self.assertIsNone(source['geometryMatchesDemo'])

    def test_archived_recording_and_map_bytes_are_verified(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            raw, local, server = [p / name for name in ('raw.dem', 'local.vpk', 'server.vpk')]
            raw.write_bytes(b'demo')
            local.write_bytes(b'geometry')
            server.write_bytes(b'geometry')
            def entry(file):
                return {'file': file.name, 'sha256': digest(file)}
            registry = {
                'map': 'fixture', 'geometryRevision': 'geom', 'geometryBakeReceipt': 'fixture receipt',
                'localMapVpk': entry(local),
                'demos': {'sample': {'rawDemo': entry(raw), 'serverMapVpk': entry(server),
                                      'serverManifestRef': 'fixture manifest', 'recordingRef': 'fixture match'}},
            }
            path = p / 'registry.json'
            path.write_text(json.dumps(registry))
            self.assertTrue(verify_bindings(path, 'fixture', 'geom', digest)['demos']['sample']['identicalMapVpk'])
            server.write_bytes(b'other geometry')
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                verify_bindings(path, 'fixture', 'geom', digest)

    def test_map_contract_rejects_truthy_invalid_values(self):
        field = {'key': 'pxUnits', 'type': 'number', 'positive': True}
        self.assertIsNone(problem({'pxUnits': 2.5}, field))
        self.assertEqual(problem({'pxUnits': True}, field), 'expected number')
        self.assertEqual(problem({'pxUnits': -1}, field), 'expected positive value')

    def test_incomplete_frame_breaks_clutch_interval(self):
        live = [0, [], [], [], True]
        all_players = {'a': ('T', live), 'b': ('CT', live), 'c': ('CT', live)}
        rows = clutches({1: all_players, 2: {'a': all_players['a']}, 3: all_players}, set(all_players))
        self.assertEqual([(r['firstObservedTick'], r['lastObservedTick']) for r in rows], [(1, 1), (3, 3)])


if __name__ == '__main__':
    unittest.main()
