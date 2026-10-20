from pathlib import Path
import json
root = Path(__file__).resolve().parents[3]
here = Path(__file__).resolve().parent
old = root / 'docs/evidence/2026-10-18-roster-unified/import.py'
script = old.read_text(encoding='utf-8').replace('roster-unified-20261018', 'roster-reference-final-20261018').replace('2026-10-18-roster-unified/receipt.json', '2026-10-18-roster-reference-final/receipt.json')
script = script.replace("canvas = Image.new('RGB', (1024, 1536), 'white')\n    canvas.paste(raw.resize((922, 1382), Image.Resampling.LANCZOS), (51, 77))", 'canvas = raw')
(here / 'import.py').write_text(script, encoding='utf-8')
path = root / 'game/src/hub/hub.personnel.js'
text = path.read_text(encoding='utf-8')
text = text.replace("import { assetUrl } from '../core/asset-url.js';\n", '')
start = text.index('// 配置页默认大图单独版本化')
end = text.index('const avatarBounds', start)
text = text[:start] + '// 默认立绘与选人共用Art.skinUrl；统一画布完整展示，不沿用旧图裁切边界。\n' + text[end:]
text = text.replace("const alphaPortrait = skin === 'default' && !!personnelDefaultPortraits[character.id];", 'const alphaPortrait = false;')
text = text.replace('personnelPortraitUrl(art, stats.cls, character.id, skin)', 'art.skinUrl(stats.cls, skin)')
text = text.replace('data-portrait-fit="${personnelPortraitStyle(character.id, skin) ? \'body\' : \'canvas\'}" style="${personnelPortraitStyle(character.id, skin)}"', 'data-portrait-fit="canvas"')
assert 'personnelPortraitStyle' not in text and 'wu-default-cutout' not in text
path.write_text(text, encoding='utf-8')
path = root / 'game/css/base-personnel-v12.css'
with path.open('a', encoding='utf-8') as out:
 out.write('\n/* 默认五图共用白底画布；场景皮肤沿用各自背景。 */\nbody #overlay#overlay#overlay#overlay #hubMain.base-frame-v7 .personnel-v12 .pv12-agent-art[data-skin="default"] .pv12-agent-image-stage { background:#fff; }\nbody #overlay#overlay#overlay#overlay #hubMain.base-frame-v7 .personnel-v12 .pv12-agent-art[data-skin="default"] .pv12-agent-image-stage > img { mix-blend-mode:normal; }\n')
print('Prepared importer and common personnel portrait route')
