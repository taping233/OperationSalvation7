"""Offline contracts: explicit reference transfer, shared pacing and paid-encoding cache."""
import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import nai_gen
import nai_vibe


class VibeTests(unittest.TestCase):
    def test_reference_arrays_are_aligned_and_opt_in(self):
        self.assertNotIn('reference_image_multiple', nai_gen.build_payload('scene')['parameters'])
        p = nai_gen.build_payload('scene', vibes=[{'encoding': 'encoded', 'strength': .45}])['parameters']
        self.assertEqual(p['reference_image_multiple'], ['encoded'])
        self.assertEqual(p['reference_strength_multiple'], [.45])
        self.assertEqual(p['reference_information_extracted_multiple'], [1.0])
        with self.assertRaises(ValueError):
            nai_gen.build_payload('scene', vibes=[{'encoding': 'a', 'strength': .6}] * 2)

    def test_cached_encoding_does_not_dispatch_or_load_token_again(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source.jpg'
            source.write_bytes(b'offline source image')
            calls = []
            def send(payload, output, token, channel):
                body = json.loads(payload.read_text(encoding='utf-8'))
                self.assertEqual(base64.b64decode(body['image']), source.read_bytes())
                self.assertEqual(body['information_extracted'], 1.0)
                calls.append(body)
                output.write_bytes(b'offline encoded vibe')
                return '201'
            guard = MagicMock()
            guard.perform.side_effect = lambda w, h, request: request()
            first = nai_vibe.encode_vibe(source, root / 'cache', guard=guard, transport=send, token='offline')
            with patch.object(nai_vibe, 'load_token', side_effect=AssertionError('cache must not read credentials')):
                second = nai_vibe.encode_vibe(source, root / 'cache')
            self.assertEqual(first, second)
            self.assertEqual(len(calls), 1)
            guard.perform.assert_called_once()
            cache = next((root / 'cache').glob('*.json'))
            record = json.loads(cache.read_text(encoding='utf-8'))
            record['encoding_sha256'] = 'invalid'
            cache.write_text(json.dumps(record), encoding='utf-8')
            with self.assertRaises(ValueError):
                nai_vibe.encode_vibe(source, root / 'cache')

    def test_encoding_endpoint_uses_existing_transport(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            payload = root / 'payload.json'
            payload.write_text('{}', encoding='utf-8')
            with patch('requests.Session') as session_type:
                session = session_type.return_value.__enter__.return_value
                session.post.return_value.status_code = 201
                session.post.return_value.content = b'encoded'
                status = nai_gen._requests_request(payload, root / 'out.bin', 'offline',
                                                   ['--noproxy', '*'], endpoint=nai_vibe.ENDPOINT)
                self.assertEqual(status, '201')
                self.assertEqual(session.post.call_args.args[0], nai_vibe.ENDPOINT)


if __name__ == '__main__':
    unittest.main()
