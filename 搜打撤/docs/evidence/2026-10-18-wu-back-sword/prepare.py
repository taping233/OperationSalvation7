from pathlib import Path
here = Path(__file__).resolve().parent
root = here.parents[2]
script = (root / 'docs/evidence/2026-10-18-roster-reference-final/import.py').read_text(encoding='utf-8')
script = script.replace('roster-reference-final-20261018', 'wu-back-sword-20261018').replace('2026-10-18-roster-reference-final/receipt.json', '2026-10-18-wu-back-sword/receipt.json')
script = script.replace("manifest = json.loads(manifest_text)", "original_manifest = manifest_text\nmanifest = json.loads(manifest_text)")
script = script.replace("manifest_path.write_text(manifest_text, encoding='utf-8')", "assert manifest_path.read_text(encoding='utf-8') == original_manifest, 'Manifest changed concurrently; stop before overwrite'\nmanifest_path.write_text(manifest_text, encoding='utf-8')")
(here / 'import.py').write_text(script, encoding='utf-8')
