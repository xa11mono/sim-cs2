import unittest

from light_page import lighten, PIXEL


class LightPageTest(unittest.TestCase):
    def test_only_rendering_data_changes(self):
        full = (
            b'var MAP = { "radar": "data:image/png;base64,AAAA", "navmesh": { "a": -0 },\n'
            b'"map3d": "AAAA", "walls": [[1, 2]], "heights": [3] };\n'
            b'var PLAYER_PHOTO = { "x": "data:image/png;base64,BBBB" };\n'
            b'var unrelated = "data:image/png;base64,CCCC";\n'
        )
        expected = full.replace(b'base64,AAAA', b'base64,' + PIXEL).replace(
            b'{ "x": "data:image/png;base64,BBBB" }', b'{}'
        )
        self.assertEqual(lighten(full), expected)

    def test_fails_closed_on_unknown_build(self):
        with self.assertRaises(ValueError):
            lighten(b'var MAP = {};')
        with self.assertRaises(ValueError):
            lighten(b'var MAP = {"radar":"data:image/png;base64,AAAA"};')


if __name__ == '__main__':
    unittest.main()
