import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
spec = importlib.util.spec_from_file_location('nai_workflow', Path(__file__).resolve().parents[1] / 'nai-workflow.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NaiWorkflowTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='nai-workflow-test-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.state = self.root / 'missing-state'
        self.spec = dict(subjectIdentity='adult man, gray hair', sceneAction='1boy, seated drummer', composition='wide horizontal',
                         lightMaterial='warm spotlight', allowedChanges=['neck proportion'], preserve=['clothes', 'scene'])

    def test_status_is_readonly_and_hides_credentials(self):
        with patch.dict(os.environ, {'NAI_TOKEN': 'test-secret', 'HTTPS_PROXY': 'http://user:password@127.0.0.1:12450'}):
            result = module.status(self.state, 1344, 768, now=1000)
        self.assertFalse(self.state.exists())
        self.assertTrue(result['readyToAttempt'])
        self.assertEqual(result['serverAvailability'], 'unverified')
        self.assertNotIn('test-secret', json.dumps(result))
        self.assertNotIn('password', json.dumps(result))

    def test_cooldown_pending_quota_and_corrupt_state_block_without_writing(self):
        self.state.mkdir()
        rate = self.state / 'request-rate.json'
        rate.write_text(json.dumps(dict(next_request_at=0, cooldown_until=2000, request_pending=True)), encoding='utf-8')
        result = module.status(self.state, 1344, 768, now=1000)
        self.assertFalse(result['readyToAttempt'])
        self.assertEqual(result['cooldownSeconds'], 1000)
        before = rate.read_bytes()
        module.status(self.state, 1344, 768, now=1000)
        self.assertEqual(rate.read_bytes(), before)
        rate.write_text('broken', encoding='utf-8')
        self.assertFalse(module.status(self.state, 1344, 768, now=1000)['readyToAttempt'])

    def test_prepare_records_reference_role_and_actual_seed_without_generation(self):
        source = self.root / 'reference.png'
        Image.new('RGB', (16, 16), 'gray').save(source)
        self.spec['references'] = [dict(path=str(source), role='identity')]
        out = self.root / 'request.json'
        result = module.prepare(self.root, self.spec, out, self.state)
        record = json.loads(out.read_text(encoding='utf-8'))
        self.assertEqual(result['status'], 'prepared')
        self.assertIsInstance(record['request']['parameters']['seed'], int)
        self.assertFalse(record['references'][0]['uploaded'])
        self.assertFalse(self.state.exists())
        with self.assertRaises(ValueError):
            module.prepare(self.root, self.spec, out, self.state)

    def test_large_quota_and_normal_pacing_remain_distinct(self):
        self.state.mkdir()
        day = module.datetime.datetime.fromtimestamp(1000).date().isoformat()
        (self.state / 'large-usage.json').write_text(json.dumps({day: 20}), encoding='utf-8')
        (self.state / 'request-rate.json').write_text(json.dumps(dict(next_request_at=1045, cooldown_until=0, request_pending=False)), encoding='utf-8')
        small = module.status(self.state, 1344, 768, now=1000)
        self.assertEqual(small['pacingSeconds'], 45)
        self.assertEqual(small['blocks'], [])
        large = module.status(self.state, 2048, 1152, now=1000)
        self.assertIn('Local large-image daily quota exhausted', large['blocks'])

    def test_rejects_missing_constraints_and_secret_fields(self):
        self.spec['token'] = 'never-store'
        with self.assertRaises(ValueError):
            module.prepare(self.root, self.spec, self.root / 'request.json', self.state)
        del self.spec['token']
        self.spec['preserve'] = []
        with self.assertRaises(ValueError):
            module.prepare(self.root, self.spec, self.root / 'request.json', self.state)

    def test_difference_is_only_a_hint_and_never_resizes_or_modifies_inputs(self):
        a, b = self.root / 'a.png', self.root / 'b.png'
        Image.new('RGB', (16, 16), 'gray').save(a)
        Image.new('RGB', (16, 16), 'gray').save(b)
        before = a.read_bytes(), b.read_bytes()
        self.assertTrue(module.compare(a, b)['identical'])
        self.assertEqual(before, (a.read_bytes(), b.read_bytes()))
        Image.new('RGB', (32, 16), 'gray').save(b)
        self.assertFalse(module.compare(a, b)['comparable'])
        with self.assertRaises(ValueError):
            module.compare(a, a, [15, 15, 2, 2])


if __name__ == '__main__':
    unittest.main()
