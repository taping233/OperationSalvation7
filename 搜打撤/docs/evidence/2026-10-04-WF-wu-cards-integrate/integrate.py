"""Import the 16 selected final Wu card illustrations; preserve unrelated assets."""
from pathlib import Path
import json, hashlib, shutil, re
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path('C:/Users/太平/.codex/worktrees/3169/代号柒/搜打撤')
EVIDENCE = Path(__file__).resolve().parent
ORIGIN = SOURCE / 'docs/evidence/2026-10-04-WF-wu-class-cards'
LOCAL = ROOT / '.tmp/art-reference/wu-cards-integrate-20261004'
REVISION = 'wu-class-final-20261004'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
selected = json.loads((ORIGIN / 'selected-outputs.json').read_text('utf-8'))['selectedCards']
assert len(selected) == 16
assert not (EVIDENCE / 'images.json').exists(), 'Existing import report: refuse to overwrite backups'
manifest_path = ROOT / 'game/assets/asset-manifest.json'
mapping_path = ROOT / 'game/data/art-mapping.json'
manifest_raw = manifest_path.read_text('utf-8')
mapping_raw = mapping_path.read_text('utf-8')
manifest = json.loads(manifest_raw)
mapping = json.loads(mapping_raw)
thumb_manifest = (ROOT / 'game/src/generated/thumb-manifest.js').read_text('utf-8')
for card in selected:
    assert Path(card['final']).is_file(), card['id']
    assert 'cards/' + card['file'] in thumb_manifest, card['file']
    if card['id'].startswith('tt8-hero-'):
        assert mapping['cardArtOverrides'][card['id']] == 'cards/' + card['file']

sepia = .04 * np.array([[.393,.769,.189],[.349,.686,.168],[.272,.534,.131]]) + .96*np.eye(3)
saturate = 1.04*np.eye(3) - .04*np.array([[.213,.715,.072]]*3)
matrix = 1.03*1.05*saturate@sepia
bias = 1.03*(.5-.5*1.05)
records = []
for card in selected:
    source = Path(card['final'])
    local = LOCAL / 'final' / source.name
    local.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, local)
    full_path = ROOT / 'game/assets/cards' / card['file']
    thumb_path = ROOT / 'game/assets/thumbs/cards' / card['file']
    old_size = Image.open(full_path).size
    backups = []
    for target in (full_path, thumb_path):
        backup = LOCAL / 'before' / target.relative_to(ROOT / 'game/assets')
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            shutil.copy2(target, backup)
        backups.append({'path': backup.relative_to(ROOT).as_posix(), 'sha256':sha(backup)})
    image = Image.open(local).convert('RGB')
    assert abs((image.width/image.height)/(old_size[0]/old_size[1])-1) < .002
    image = image.resize(old_size, Image.Resampling.LANCZOS)
    image.save(full_path, 'WEBP', quality=90, method=6)
    with Image.open(full_path) as encoded:
        thumb = encoded.convert('RGB').resize((448, max(1, round(old_size[1]*448/old_size[0]))), Image.Resampling.LANCZOS)
    pixels = np.asarray(thumb).astype(np.float64)/255
    tinted = np.clip(np.round((pixels@matrix.T+bias)*255), 0, 255).astype(np.uint8)
    Image.fromarray(tinted).save(thumb_path, 'WEBP', quality=82, method=6)
    outputs = []
    for target in (full_path, thumb_path):
        rel = target.relative_to(ROOT / 'game/assets').as_posix()
        with Image.open(target) as decoded:
            decoded.load()
            size = list(decoded.size)
        assert target.stat().st_size < 1_000_000
        entry = {'path':rel,'ext':'webp','bytes':target.stat().st_size,'sha256':sha(target),
                 'license':'项目自有（AI 生成）','source':'docs/evidence/2026-10-04-WF-wu-cards-integrate/images.json'}
        matches = [e for e in manifest['assets'] if e['path'] == rel]
        for e in matches:
            e.update(entry)
        if not matches:
            manifest['assets'].append(entry)
        outputs.append({**entry, 'size':size})
    mapping['cardArtRevisions'][card['id']] = REVISION
    records.append({'id':card['id'],'name':card['name'],'generatedSource':card['generatedSource'],
                    'selectedSource':str(source),'localOriginal':local.relative_to(ROOT).as_posix(),
                    'originalSha256':sha(local),'originalBytes':local.stat().st_size,'backups':backups,'outputs':outputs})

# Text-level replacements keep unrelated entries and formatting intact.
assert manifest_path.read_text('utf-8') == manifest_raw, 'Concurrent manifest edit: stop'
new_manifest = manifest_raw
old_manifest = json.loads(manifest_raw)
for entry in manifest['assets']:
    old = next((e for e in old_manifest['assets'] if e['path']==entry['path']), None)
    block = lambda e: '\n'.join('    '+line for line in json.dumps(e,ensure_ascii=False,indent=2).splitlines())
    if old and old != entry:
        assert block(old) in new_manifest, entry['path']
        new_manifest = new_manifest.replace(block(old),block(entry),1)
    elif old is None:
        marker = '\n  ]'
        assert marker in new_manifest
        new_manifest = new_manifest.replace(marker, ',\n'+block(entry)+marker,1)
manifest['count'] = len(manifest['assets'])
new_manifest = re.sub(r'"count": \d+', '"count": '+str(manifest['count']), new_manifest, count=1)
assert json.loads(new_manifest) == manifest
assert manifest_path.read_text('utf-8') == manifest_raw
manifest_path.write_bytes(new_manifest.encode('utf-8'))
assert mapping_path.read_text('utf-8') == mapping_raw, 'Concurrent art mapping edit: stop'
old_revisions = json.loads(mapping_raw)['cardArtRevisions']
revision_block = lambda r: '\n'.join('  '+line for line in json.dumps(r,ensure_ascii=False,indent=2).splitlines())[2:]
old_block = revision_block(old_revisions)
assert old_block in mapping_raw
new_mapping = mapping_raw.replace(old_block,revision_block(mapping['cardArtRevisions']),1)
assert json.loads(new_mapping) == mapping
mapping_path.write_bytes(new_mapping.encode('utf-8'))
for name in ('selected-outputs.json','requests-v1.json','requests-repairs.json'):
    shutil.copy2(ORIGIN/name, EVIDENCE/('generation-'+name))
report = {'date':'2026-10-04','sourceThread':'01a10615-bc80-76f1-9180-db97f763caca',
          'sourceEvidence':str(ORIGIN),'revision':REVISION,'cards':records,
          'conversion':'existing runtime dimensions; WebP q90; thumbs width448 q82 with current baked colour matrix',
          'originalRetrieval':'Selected PNGs copied from worktree3169 final outputs; local originals/backups remain ignored, with path/bytes/SHA256 recorded'}
(EVIDENCE/'images.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'cards':len(records),'imagesDecoded':32,'manifestCount':manifest['count'],'revision':REVISION}))
