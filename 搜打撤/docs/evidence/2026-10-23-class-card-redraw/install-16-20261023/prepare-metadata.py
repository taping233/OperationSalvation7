"""Print minimal metadata patch from completed authorized asset imports."""
from pathlib import Path
import json
HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[3]
receipt=json.loads((HERE/'receipt.json').read_text('utf-8'))
assert len(receipt['items'])==16, 'Import incomplete'
mapping_path=PROJECT/'game/data/art-mapping.json'
manifest_path=PROJECT/'game/assets/asset-manifest.json'
mapping=mapping_path.read_text('utf-8')
manifest=manifest_path.read_text('utf-8')
j=lambda value:json.dumps(value,ensure_ascii=False)
chunks=['*** Begin Patch','*** Update File: '+str(mapping_path)]
mapping_chunks=[]
for item in receipt['items']:
    old=j(item['card_id'])+': '+j(item['revision_before'])
    new=j(item['card_id'])+': '+j(item['revision_after'])
    lines=[line for line in mapping.splitlines() if old in line]
    assert len(lines)==1,(item['card_id'],lines)
    mapping_chunks.append((mapping.index(lines[0]), ['@@','-'+lines[0],'+'+lines[0].replace(old,new)]))
for _,group in sorted(mapping_chunks): chunks.extend(group)
chunks.append('*** Update File: '+str(manifest_path))
manifest_chunks=[]
for item in receipt['items']:
    for patch in item['manifest_patches']:
        assert patch['before'] is not None, 'Unexpected new asset'
        block=lambda obj:'\n'.join('    '+line for line in json.dumps(obj,ensure_ascii=False,indent=2).splitlines())
        old,new=block(patch['before']),block(patch['after'])
        assert manifest.count(old)==1,patch['after']['path']
        if manifest[manifest.index(old)+len(old):].startswith(','):
            old+=','
            new+=','
        group=['@@']+['-'+line for line in old.splitlines()]+['+'+line for line in new.splitlines()]
        manifest_chunks.append((manifest.index(old),group))
for _,group in sorted(manifest_chunks): chunks.extend(group)
assert receipt['manifest_count_before']==receipt['manifest_count_after']
chunks.append('*** End Patch')
print('\n'.join(chunks))
