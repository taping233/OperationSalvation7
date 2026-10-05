"""Offline checks: no credentials, network, generation, or output files."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import nai_style
import nai_prompt_clean as clean


class PromptCleanupTests(unittest.TestCase):
    def test_legacy_empty_uc_is_unchanged(self):
        self.assertEqual(clean.build_uc(), nai_style.BASE_UC)

    def test_repeated_baseline_and_extra_terms_keep_first_occurrence(self):
        actual = clean.build_uc('text, TEXT, extra fingers, wrong hat, wrong hat, ,')
        self.assertEqual(actual, nai_style.BASE_UC + ', wrong hat')

    def test_weighted_groups_keep_internal_commas_and_weight(self):
        actual = clean.build_uc('1.2::bad hands, extra arms::, 1.2::bad hands, extra arms::, 0.8::bad hands::')
        self.assertEqual(actual, nai_style.BASE_UC + ', 1.2::bad hands, extra arms::, 0.8::bad hands::')

    def test_special_exclusions_are_not_removed_by_semantic_guessing(self):
        self.assertTrue(clean.build_uc('background shadow, shadows').endswith('background shadow, shadows'))

    def test_existing_prompt_and_portrait_pose_are_preserved(self):
        self.assertEqual(clean.build_prompt('subject', 'scene'), nai_style.build_prompt('subject', 'scene'))
        self.assertEqual(clean.build_character_portrait_prompt('sitting woman'),
                         nai_style.build_character_portrait_prompt('sitting woman'))

    def test_transparent_battle_prompt_does_not_inherit_brushed_background(self):
        actual = clean.build_battle_portrait_prompt('Wu', composition_layer='body and gaze face screen-right')
        self.assertIn('truly transparent background', actual)
        self.assertIn('screen-right', actual)
        self.assertNotIn(nai_style.PORTRAIT_SCENE_TAIL, actual)
        self.assertEqual(actual.count(nai_style.STYLE_BLOCK), 1)


if __name__ == '__main__':
    unittest.main()
