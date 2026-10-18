"""Offline contracts for character identity separation and legacy requests."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import nai_gen


class MultiCharacterTests(unittest.TestCase):
    def test_legacy_single_character(self):
        params = nai_gen.build_payload('scene', 'bad', 'silver hair', seed=42)['parameters']
        self.assertEqual(params['characterPrompts'], [{
            'prompt': 'silver hair', 'uc': '', 'center': {'x': .5, 'y': .5}, 'enabled': True}])
        self.assertFalse(params['use_coords'])
        self.assertEqual(params['v4_prompt']['caption']['char_captions'][0]['char_caption'], 'silver hair')

    def test_two_identities_and_negatives_stay_aligned(self):
        characters = [
            {'prompt': 'silver hair', 'uc': 'blonde hair', 'center': {'x': .3, 'y': .5}},
            {'prompt': 'blonde hair', 'uc': 'silver hair', 'center': {'x': .7, 'y': .5}},
        ]
        params = nai_gen.build_payload('scene', 'bad', seed=42, char_prompts=characters,
                                       use_coords=True)['parameters']
        for field in ('v4_prompt', 'v4_negative_prompt'):
            self.assertTrue(params[field]['use_coords'])
            self.assertEqual([c['centers'][0] for c in params[field]['caption']['char_captions']],
                             [c['center'] for c in characters])
        self.assertTrue(params['use_coords'])
        self.assertEqual([c['prompt'] for c in params['characterPrompts']], ['silver hair', 'blonde hair'])
        self.assertEqual([c['char_caption'] for c in params['v4_negative_prompt']['caption']['char_captions']],
                         ['blonde hair', 'silver hair'])
        self.assertEqual(params['v4_prompt']['caption']['base_caption'], 'scene')

    def test_invalid_identity_or_position_fails_before_dispatch(self):
        for center in ({'x': -1, 'y': .5}, {'x': .5}, {'x': float('nan'), 'y': .5},
                       {'x': True, 'y': .5}):
            with self.subTest(center=center), self.assertRaises(ValueError):
                nai_gen.build_payload('scene', char_prompts=[{'prompt': 'girl', 'center': center}])
        with self.assertRaises(ValueError):
            nai_gen.build_payload('scene', char_prompt='girl', char_prompts=[{'prompt': 'girl'}])

    def test_generate_forwards_multichar_options_before_network(self):
        class StopBeforeNetwork(Exception):
            pass
        characters = [{'prompt': 'first'}, {'prompt': 'second'}]
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(nai_gen, 'build_payload', side_effect=StopBeforeNetwork) as build:
                with self.assertRaises(StopBeforeNetwork):
                    nai_gen.generate_image('scene', out=str(Path(directory) / 'out.png'),
                                           char_prompts=characters, use_coords=True)
                self.assertEqual(build.call_args.kwargs['char_prompts'], characters)
                self.assertTrue(build.call_args.kwargs['use_coords'])


if __name__ == '__main__':
    unittest.main()
