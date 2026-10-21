from pathlib import Path
here = Path(__file__).resolve().parent
script = (here / 'import.py').read_text(encoding='utf-8').replace("HERE / 'request.json'", "HERE / 'gray-request.json'").replace("HERE / 'receipt.json'", "HERE / 'gray-receipt.json'").replace('roster-reference-final-20261018', 'roster-reference-gray-20261018').replace('2026-10-18-roster-reference-final/receipt.json', '2026-10-18-roster-reference-final/gray-receipt.json')
(here / 'gray-import.py').write_text(script, encoding='utf-8')
root = here.parents[2]
p = root / 'docs/character-bible/changwuyu.md'
t = p.read_text(encoding='utf-8')
insert = '\n## 当前发色（2026-10-18老板纠正）\n\n灰发，采用中性中灰底色与深灰阴影，浅灰只作局部高光；不是白发或银白发。低发髻与两侧长鬓发保持。下方旧版本中的银灰描述仅供历史追溯，后续出图以本条为准。\n'
t = t.replace('## 身份与参考使用', insert + '\n## 身份与参考使用', 1)
p.write_text(t, encoding='utf-8')
