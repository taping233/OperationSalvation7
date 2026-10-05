"""One-shot local cleanup, preserving exact original bytes and refusing changed inputs."""
import ast
import hashlib
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
NAI = PROJECT.parent / '.tmp' / 'nai'
changes, inventory = [], []
for file in sorted(NAI.rglob('*.py')):
    raw = file.read_bytes()
    source = raw.decode('utf-8-sig')
    tree = ast.parse(source)
    names = [node.func.id if isinstance(node.func, ast.Name) else
             node.func.attr if isinstance(node.func, ast.Attribute) else ''
             for node in ast.walk(tree) if isinstance(node, ast.Call)]
    generating = ('image.novelai.net' in source or 'generate_image' in names or
                  'ENDPOINT' in source and ('subprocess.run' in source or 'requests.post' in source))
    reasons = []
    edited = source
    if generating and 'build_uc' in names:
        edited = re.sub(r'(?m)^import nai_style(\r?)$', r'import nai_prompt_clean as nai_style\1', edited)
        edited = edited.replace('from nai_style import ', 'from nai_prompt_clean import ')
        if edited != source:
            reasons.append('deduplicated UC via compatible shared-style adapter')

    if generating and file.name.startswith('wu_select_portrait_'):
        if 'young woman' in edited and 'mature face, adult woman, ' in edited:
            edited = edited.replace('mature face, adult woman, ', 'mature face, ')
            reasons.append('removed adult-identity exclusion; retained face-age exclusions')
        old = 'the star-patterned lining visible only through the gaps between the black ruffle layers, '
        if 'ONLY ONE row of black ruffles' in edited and old in edited:
            edited = edited.replace(old, 'the blue star-patterned lining visible below the single outer hem ruffle, ')
            reasons.append('one hem ruffle with visible inner lining; no contradictory multiple layers')

    if file.name in {'changwuyu_profession_cards_batch_20260923.py',
                     'changwuyu_profession_cards_v2_20260923.py',
                     'changwuyu_cards_fire_abyss_v3_20260923.py'}:
        edited = edited.replace('1man, solo main hero, ', 'one focal mage, ')
        reasons.append('removed solo count constraint from enemy-containing scenes')
    replacements = {
        'changwuyu_profession_cards_v2_20260923.py': (
            'Use the approved v1.0 painterly sketch recipe: confident broad planes, visible varied brushstrokes, broken outer edges, crisp selective highlights, painterly rather than vector-clean rendering.',
            'Keep the face and action readable at thumbnail size.'),
        'changwuyu_cards_fire_abyss_v3_20260923.py': (
            'Use the approved v1.0 painterly sketch language: broad confident planes, loose visible brushstrokes, broken selected edges, crisp highlights and varied brush texture. Keep the figure and spell readable at thumbnail size.',
            'Keep the figure and spell readable at thumbnail size.'),
        'redo_research_cards_20260923.py': (
            ' Approved v1.0 painterly sketch treatment: broad confident paint planes, loose varied visible brushstrokes, broken selected edges and crisp material highlights.', ''),
    }
    if file.name in replacements:
        old, new = replacements[file.name]
        if old not in edited:
            raise RuntimeError('Expected style passage changed: ' + str(file))
        edited = edited.replace(old, new)
        reasons.append('generic style sentence now supplied once by shared recipe')
    if file.name == 'wu_profession_two_previews_20260923.py':
        edited = edited.replace('1girl, solo, Wu, original fantasy heroine. ', 'Wu, the single focal fantasy heroine. ')
        edited = edited.replace("identity = identity.replace('Black gloves, bare legs, black boots. ', 'Black gloves. ') if KIND == 'stealth' else identity",
            "if KIND == 'stealth':\n    identity = identity.replace('Black gloves, bare legs, black boots. ', '')\n    identity = identity.replace('head around one seventh of the full visible figure height, shoulders about two head widths, long legs, narrow waist. ', '')")
        reasons.append('enemy-compatible heroine count and no full-visible-body demand for stealth crop')
    if file.name == 'fullmoon_card_batch_1002.py':
        edited = edited.replace("'open ground below her feet'", "'the background stays secondary to her face and gesture'")
        reasons.append('shared background no longer demands visible feet under knee crop')

    item = {'file': file.relative_to(NAI).as_posix(), 'generation_entry': generating,
            'shared_positive_builder': any(x in names for x in ('build_prompt', 'build_asset_prompt', 'build_character_portrait_prompt')),
            'shared_client': 'generate_image' in names,
            'before_sha256': hashlib.sha256(raw).hexdigest()}
    inventory.append(item)
    if edited == source:
        continue
    ast.parse(edited)
    new_bytes = (b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'') + edited.encode('utf-8')
    changes.append((file, raw, new_bytes, item, reasons))

# Validate the entire plan before any batch write.
for file, raw, new_bytes, item, reasons in changes:
    if file.read_bytes() != raw:
        raise RuntimeError('Concurrent edit; no writes: ' + str(file))
for file, raw, new_bytes, item, reasons in changes:
    backup = HERE / 'original-scripts' / file.relative_to(NAI)
    backup.parent.mkdir(parents=True, exist_ok=True)
    if backup.exists():
        raise RuntimeError('Backup exists; do not overwrite or repeat cleanup: ' + str(backup))
    backup.write_bytes(raw)
    if file.read_bytes() != raw:
        raise RuntimeError('Concurrent edit after backup; stop: ' + str(file))
    file.write_bytes(new_bytes)
    item.update(after_sha256=hashlib.sha256(new_bytes).hexdigest(), changes=reasons,
                original_backup=backup.relative_to(HERE).as_posix())

report = {'python_files': len(inventory), 'generation_entries': sum(x['generation_entry'] for x in inventory),
          'changed_scripts': len(changes), 'files': inventory}
(HERE / 'cleanup-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'files'}))
