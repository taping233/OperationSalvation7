# -*- coding: utf-8 -*-
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
style = ROOT / 'tools/nai_style.py'
before = style.read_bytes()
changed = before.replace(b'v3.3', b'v3.4').replace(b"RECIPE_VERSION = '3.3'", b"RECIPE_VERSION = '3.4'")
for old, new in [(b"BASE_UC = 'blurry, lowres,", b"BASE_UC = 'lowres,"),
                 (b', overexposure, excessive bloom, plastic rendering', b', plastic rendering')]:
    assert changed.count(old) == 1, old
    changed = changed.replace(old, new)
style.write_bytes(changed)
p = ROOT / 'docs/production/art/NAI-PROMPTING.md'
b = p.read_bytes().replace(b'**v3.3**', b'**v3.4**')
old = '负面基线保留已有项并补入 `blurry, upscaled`。'.encode('utf-8')
new = '负面基线保留 `upscaled` 等已有项，通用层移除 `blurry`、`overexposure`、`excessive bloom`，避免限制景深虚化和强光效果；仅在单图确有对应缺陷且不冲突时定向添加。'.encode('utf-8')
assert b.count(old) == 1
p.write_bytes(b.replace(old, new))
p = ROOT / 'tools/NAI-PROMPTS.md'
b = p.read_bytes()
assert b.count(b'v3.3') == 1
p.write_bytes(b.replace(b'v3.3', b'v3.4'))
p = ROOT / 'docs/PARALLEL-REGISTRY.md'
b = p.read_bytes()
marker = '## 活跃登记'.encode('utf-8')
entry = 'Friday（NAI负面冲突清理 01a1445b），2026-10-16：属地 `tools/nai_style.py`、`tools/NAI-PROMPTS.md`、`docs/production/art/NAI-PROMPTING.md`、`docs/evidence/2026-10-16-nai-negative-conflict-cleanup/`；按老板要求从通用负面移除blurry/overexposure/excessive bloom，版本v3.4；编辑及离线验证中，无生图、无服务、未提交。'
assert b.count(marker) == 1
p.write_bytes(b.replace(marker, marker + ('\n\n' + entry).encode('utf-8')))
(HERE / 'change.json').write_text(json.dumps({'before_style': before.decode('utf-8'), 'removed_negative_terms': ['blurry', 'overexposure', 'excessive bloom'], 'recipe_version': '3.4'}, ensure_ascii=False, indent=2), encoding='utf-8')
print('Updated NAI shared recipe and manuals to v3.4.')
