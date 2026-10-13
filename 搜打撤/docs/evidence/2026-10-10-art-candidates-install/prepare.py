import json
import hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[3]
evidence = Path(__file__).parent
specs = [
    ('2026-10-10-element-seal-redraw', None, 'tt3-element-seal', 'equip-tt3-element-seal', 'element-seal'),
    ('2026-10-10-fel-bats-redraw', 0, 'tt12-felguard', 'spell-tt12-felguard', 'felguard'),
    ('2026-10-10-fel-bats-redraw', 1, 'tt3sp-bloodstorm', 'spell-tt3sp-bloodstorm', 'bloodstorm'),
    ('2026-10-10-cursed-blade-redraw', None, 'cc-cursed-blade', 'martial-cc-cursed-blade', 'cursed-blade'),
    ('2026-10-10-equip-redraw', 0, 'tt3-wolf-bow', 'equip-tt3-wolf-bow', 'wolf-bow'),
    ('2026-10-10-equip-redraw', 1, 'tt3-holy-staff', 'equip-tt3-holy-staff', 'holy-staff'),
    ('2026-10-10-equip-redraw', 2, 'tt3-crimson-pouch', 'equip-tt3-crimson-pouch', 'crimson-pouch'),
    ('2026-10-10-sporewall-redraw', None, 'tt12-sporewall', 'spell-tt12-sporewall', 'sporewall'),
]
items = []
for folder, index, card_id, stem, revision in specs:
    origin = root / 'docs/evidence' / folder / 'request.json'
    request = json.loads(origin.read_text(encoding='utf-8-sig'))
    item = request if index is None else request['items'][index]
    source = root / item.get('output', item.get('candidate', ''))
    if not source.is_file():
        raise RuntimeError(f'Missing candidate: {source}')
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if item.get('sha256') and digest != item['sha256'].lower():
        raise RuntimeError(f'Candidate changed: {source}')
    items.append(dict(card_id=card_id, asset=f'cards/{stem}.webp', source=str(source),
                      revision=f'{revision}-redraw-20261010', prompt=item['prompt'],
                      references=item['references'], candidate_sha256=digest,
                      origin_request=origin.relative_to(root).as_posix()))
(evidence / 'request.json').write_text(json.dumps(dict(items=items), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Prepared {len(items)} authorized candidates')
