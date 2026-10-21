from pathlib import Path
import hashlib, json, shutil
from PIL import Image
here = Path(__file__).resolve().parent
root = here.parents[2]
original = root / '.tmp/imagegen/roster-unified-20261018/backup'
saved = root / '.tmp/imagegen/roster-four-restore-20261018'
roles = ['changwuyu','baita','heixiang','xingyue']
records = json.loads((root / 'docs/evidence/2026-10-18-roster-unified/receipt.json').read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
wu = root / 'game/assets/portraits/full/wu.webp'
wu_before = sha(wu)
for role in roles:
 item = next(x for x in records if x['id'] == role)
 assert sha(original / f'{role}.webp') == item['previousSha256'], role
 assert Image.open(original / f'{role}.webp').size == (1024,1536)
saved.mkdir(parents=True, exist_ok=True)
manifest_path = root / 'game/assets/asset-manifest.json'
text = manifest_path.read_text(encoding='utf-8')
manifest = json.loads(text)
receipt = []
for role in roles:
 target = root / f'game/assets/portraits/full/{role}.webp'
 backup = saved / target.name
 assert not backup.exists(), 'Do not overwrite restore backup'
 shutil.copy2(target, backup)
 shutil.copy2(original / target.name, target)
 reference = root / f'docs/character-bible/ref-images/{role}.webp'
 shutil.copy2(target, reference)
 key = f'portraits/full/{role}.webp'
 entry = next(x for x in manifest['assets'] if x['path'] == key)
 updated = dict(entry, bytes=target.stat().st_size, sha256=sha(target), source='docs/evidence/2026-10-18-roster-reference-final/restored-four.json')
 begin = text.rfind('    {', 0, text.index('"path": "' + key + '"'))
 end = text.index('\n    }', begin) + len('\n    }')
 text = text[:begin] + '    ' + json.dumps(updated, ensure_ascii=False, indent=2).replace('\n','\n    ') + text[end:]
 assert target.read_bytes() == reference.read_bytes()
 receipt.append(dict(id=role, path=key, sha256=sha(target), bytes=target.stat().st_size, size=[1024,1536], restoredFrom=str(original / target.name), referenceMatches=True))
 p = root / f'docs/character-bible/{role}.md'
 t = p.read_text(encoding='utf-8').replace('于2026-10-18按老板指定的10-16无原图画法重绘，统一1024×1536', '于2026-10-18按老板要求恢复至本轮重绘前的10-13版本，1024×1536')
 p.write_text(t, encoding='utf-8')
manifest_path.write_text(text, encoding='utf-8')
assert sha(wu) == wu_before
(here / 'restored-four.json').write_text(json.dumps(dict(items=receipt, wuUnchanged=wu_before), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
p = root / 'docs/character-bible/README.md'
t = p.read_text(encoding='utf-8')
for before, after in [('10-18统一重绘，扶镜、黑雾与橙火保留','10-18恢复重绘前10-13版本；扶镜、黑雾与橙火保留'),('10-18统一重绘，坐姿与身份保留','10-18恢复重绘前10-13版本；坐姿与身份保留'),('10-18统一重绘，喝咖啡与背剑保留','10-18恢复重绘前10-13版本；喝咖啡与背剑保留'),('10-18统一重绘，胸前祝祷、长辫与星灯保留','10-18恢复重绘前10-13版本；胸前祝祷、长辫与星灯保留')]:
 t = t.replace(before, after)
t = t.replace('四人按其块面画法重绘', '四人已按老板要求恢复本轮重绘前10-13版本')
p.write_text(t, encoding='utf-8')
p = root / 'docs/production/art/VISUAL-BIBLE.md'
t = p.read_text(encoding='utf-8').replace('其他四人按其块面画法重绘', '其他四人按老板最终要求恢复本轮重绘前的10-13版本')
p.write_text(t, encoding='utf-8')
print(json.dumps(dict(restored=roles, matchedOriginalHashes=True, size=[1024,1536], wuUnchanged=True)))
