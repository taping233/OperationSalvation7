from pathlib import Path
import json

project = Path(__file__).resolve().parents[3]
evidence = Path(__file__).resolve().parent
rows = json.loads((evidence / 'receipt.json').read_text(encoding='utf-8'))
css = project / 'game/css/scenes.css'
code = css.read_text(encoding='utf-8')
start = code.index('  /* 默认卡背「行囊粗布」')
end = code.index('  /* ============ 背包卡牌 3D', start)
rules = '\n'.join(f'  .hs-back.hb-{row["id"]} {{ background: url("../assets/{row["path"]}") center / 100% 100% no-repeat; }}' for row in rows)
css.write_text(code[:start] + '  /* 七款完整手绘卡背；图片包含主题纹章与边框。 */\n' + rules + '\n\n' + code[end:], encoding='utf-8')

manifest_path = project / 'game/assets/asset-manifest.json'
text = manifest_path.read_text(encoding='utf-8')
manifest = json.loads(text)
assert not any(row['path'] in {item['path'] for item in manifest['assets']} for row in rows)
entries = [{key: row[key] for key in ('path', 'ext', 'bytes', 'sha256', 'license', 'source')} for row in rows]
new_text = json.dumps(entries, ensure_ascii=False, indent=2)[2:-2]
new_text = '\n'.join('  ' + line for line in new_text.splitlines())
text = text.replace('  "assets": [\n', '  "assets": [\n' + new_text + ',\n', 1)
text = text.replace(f'  "count": {manifest["count"]},', f'  "count": {len(manifest["assets"]) + len(entries)},', 1)
verified = json.loads(text)
assert verified['assets'][len(entries):] == manifest['assets']
manifest_path.write_text(text, encoding='utf-8')
print(f'Integrated {len(entries)} card backs; existing manifest entries unchanged.')
