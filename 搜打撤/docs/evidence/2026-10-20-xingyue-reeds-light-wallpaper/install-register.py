import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
p = ROOT / 'game/assets/asset-manifest.json'
before = p.read_text(encoding='utf-8')
d = json.loads(before)
receipt = HERE / 'install-receipt.json'
r = json.loads(receipt.read_text(encoding='utf-8'))
entry = dict(path='reconstruction/wallpaper-xingyue-reeds-1020.webp', ext='webp',
             bytes=r['bytes'], sha256=r['sha256'],
             license='Project AI-generated asset; owner authorized home wallpaper installation.',
             source='docs/evidence/2026-10-20-xingyue-reeds-light-wallpaper/install-receipt.json')
assert not any(x['path'] == entry['path'] for x in d['assets'])
marker = '\n  ],\n  "verified"'
assert before.count(marker) == 1
after = before.replace(marker, ',\n' + '\n'.join('    ' + line for line in json.dumps(entry, ensure_ascii=False, indent=2).splitlines()) + marker)
after = after.replace('"count": ' + str(d['count']), '"count": ' + str(len(d['assets']) + 1), 1)
assert len(json.loads(after)['assets']) == len(d['assets']) + 1
assert p.read_text(encoding='utf-8') == before
p.write_text(after, encoding='utf-8')
t = ROOT / 'tests/title-wallpaper.test.js'
s = t.read_text(encoding='utf-8').replace('/5', '/6').replace('共5张', '共6张').replace('all five wallpapers', 'all six wallpapers')
s = s.replace("['baita-station', 4, '5/6'],", "['baita-station', 4, '5/6'],\n    ['xingyue-reeds', 5, '6/6'],")
s = s.replace("button().click();\n    expect(selection()).toBe('snow-road');", "button().click();\n    expect(selection()).toBe('xingyue-reeds');\n    button().click();\n    expect(selection()).toBe('snow-road');")
t.write_text(s, encoding='utf-8')
r.update(status='installed', order=6, default_wallpaper='wu-bass', committed=False)
receipt.write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding='utf-8')
print('manifest and tests updated')
