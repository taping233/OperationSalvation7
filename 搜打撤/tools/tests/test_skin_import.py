import argparse
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location('skin_import', Path(__file__).resolve().parents[1] / 'skin-import.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SkinImportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='skin-import-test-')
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        (self.root / 'game/assets/portraits/full').mkdir(parents=True)
        (self.root / 'game/src/core').mkdir(parents=True)
        Image.new('RGB', (32, 48), '#556655').save(self.root / 'source.png')
        Image.new('RGB', (32, 48), '#333333').save(self.root / 'game/assets/portraits/full/wu.webp')
        self.art = self.root / 'game/src/core/art.js'
        self.art.write_text("const SKIN_FULL_ART = Object.freeze({\n  wu: Object.freeze([\n    { id: 'old', name: 'Old', file: 'portraits/full/old.webp' },\n  ]),\n});\n", encoding='utf-8')
        self.manifest = self.root / 'game/assets/asset-manifest.json'
        self.manifest.write_text(json.dumps(dict(count=0, assets=[]), indent=2), encoding='utf-8')
        self.args = argparse.Namespace(root=self.root, source=self.root / 'source.png', character='wu', id='drums',
                                       name='余响·鼓房', evidence='docs/evidence/import', quality=94, apply=True)

    def test_preview_has_no_project_writes(self):
        self.args.apply = False
        before = self.art.read_bytes(), self.manifest.read_bytes()
        self.assertEqual(module.import_skin(self.args)['status'], 'preview')
        self.assertEqual(before, (self.art.read_bytes(), self.manifest.read_bytes()))
        self.assertFalse((self.root / self.args.evidence).exists())

    def test_import_is_repeatable_and_preserves_other_skin_and_default(self):
        default = (self.root / 'game/assets/portraits/full/wu.webp').read_bytes()
        first = module.import_skin(self.args)
        self.assertEqual(first['source_size'], (32, 48))
        before = self.art.read_bytes(), self.manifest.read_bytes()
        second = module.import_skin(self.args)
        self.assertEqual(second['operations'], [])
        self.assertEqual(before, (self.art.read_bytes(), self.manifest.read_bytes()))
        self.assertIn("id: 'old'", self.art.read_text(encoding='utf-8'))
        self.assertEqual(default, (self.root / 'game/assets/portraits/full/wu.webp').read_bytes())

    def test_resume_after_interruption_between_catalogue_and_manifest(self):
        save = module.save_json

        def interrupt(file, value):
            save(file, value)
            if value.get('status') == 'applying' and len(value.get('completed', [])) == 2:
                raise RuntimeError('simulated interruption')

        with patch.object(module, 'save_json', interrupt):
            with self.assertRaisesRegex(RuntimeError, 'interruption'):
                module.import_skin(self.args)
        self.assertEqual(json.loads(self.manifest.read_text(encoding='utf-8'))['count'], 0)
        module.import_skin(self.args)
        self.assertEqual(json.loads(self.manifest.read_text(encoding='utf-8'))['count'], 1)
        self.assertEqual(self.art.read_text(encoding='utf-8').count("id: 'drums'"), 1)

    def test_conflicting_asset_is_rejected_before_catalogue_or_manifest_changes(self):
        target = self.root / 'game/assets/portraits/full/wu-drums.webp'
        target.write_bytes(b'someone elses asset')
        before = self.art.read_bytes(), self.manifest.read_bytes()
        with self.assertRaisesRegex(ValueError, 'different content'):
            module.import_skin(self.args)
        self.assertEqual(before, (self.art.read_bytes(), self.manifest.read_bytes()))

    def test_changed_request_and_path_escape_are_rejected(self):
        module.import_skin(self.args)
        self.args.name = 'Different name'
        with self.assertRaisesRegex(ValueError, 'different request'):
            module.import_skin(self.args)
        self.args.evidence = '../escape'
        with self.assertRaises(ValueError):
            module.import_skin(self.args)


if __name__ == '__main__':
    unittest.main()
