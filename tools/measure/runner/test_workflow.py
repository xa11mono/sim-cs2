import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

RUNNER = Path(__file__).resolve().parents[1] / 'remote_run.py'
SPEC = importlib.util.spec_from_file_location('remote_run_test', RUNNER)
remote_run = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(remote_run)


class WorkflowTest(unittest.TestCase):
    def run_request(self, request):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            req = root / 'request.json'
            req.write_text(json.dumps(request), encoding='utf-8')
            with (
                patch.object(sys, 'argv', [str(RUNNER), str(req)]),
                patch.object(remote_run, 'ROOT', str(root)),
                patch.object(remote_run, 'LOG', str(root / 'runner.log')),
                patch.object(remote_run, 'ensure_playwright'),
                patch.object(remote_run, 'build') as build,
                patch.object(remote_run, 'sh') as shell
            ):
                remote_run.main()
                return build.call_args_list, [call.args[0] for call in shell.call_args_list]

    def test_explicit_request_uses_shared_queue_and_light_copy(self):
        builds, commands = self.run_request({
            'par': 2, 'shared_browser': True, 'stream_records': True,
            'jobs': [{'label': 'probe', 'ref': 'same', 'map': 'mirage', 'matches': [3, 7], 'light_page': True}]
        })
        self.assertEqual(builds[0].args[:2], ('same', 'mirage'))
        light, queue = commands[-2:]
        self.assertTrue(light[1].endswith('light_page.py'))
        self.assertTrue(light[-1].endswith('probe.measure.html'))
        self.assertIn('--job=probe,' + light[-1], queue)
        self.assertIn('--shared-browser', queue)
        self.assertIn('--stream-records', queue)
        self.assertIn('--matches=3,7', queue)
        self.assertIn('--par=2', queue)

    def test_default_keeps_standard_page_and_queue(self):
        _, commands = self.run_request({'jobs': [{'label': 'probe', 'ref': 'same'}]})
        self.assertFalse(any('light_page.py' in item for cmd in commands for item in cmd))
        self.assertFalse(any('--shared-browser' in cmd for cmd in commands))
        self.assertTrue(any(item.startswith('--job=probe,') and item.endswith('probe.html')
                            for item in commands[-1]))


if __name__ == '__main__':
    unittest.main()
