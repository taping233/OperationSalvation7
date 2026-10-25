import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
E=Path(__file__).resolve().parent
receipt=json.loads((E/'receipt.json').read_text(encoding='utf-8'))
item=receipt['items'][0]
p=ROOT/'game/assets/asset-manifest.json'
with p.open('r',encoding='utf-8-sig',newline='') as f:text=f.read()
nl='\r\n' if '\r\n' in text else '\n'
for patch in item['manifest_patches']:
    after=patch['after']
    marker='"path": '+json.dumps(after['path'],ensure_ascii=False)
    pos=text.find(marker)
    encoded=json.dumps(after,ensure_ascii=False,indent=2).splitlines()
    replacement=encoded[0]+nl+nl.join('    '+line for line in encoded[1:])
    if pos>=0:
        start=text.rfind('{',0,pos)
        current,length=json.JSONDecoder().raw_decode(text[start:])
        text=text[:start]+replacement+text[start+length:]
    else:
        at=text.index('[',text.index('"assets"'))+1
        text=text[:at]+nl+'    '+replacement+','+text[at:]
count=len(json.loads(text)['assets'])
text=re.sub(r'("count"\s*:\s*)\d+',lambda m:m.group(1)+str(count),text,count=1)
with p.open('w',encoding='utf-8',newline='') as f:f.write(text)
p=ROOT/'game/data/art-mapping.json'
with p.open('r',encoding='utf-8-sig',newline='') as f:text=f.read()
marker='"cardArtRevisions": {'
at=text.index(marker)+len(marker)
entry='    '+json.dumps(item['card_id'])+': '+json.dumps(item['revision_after'])+','
text=text[:at]+nl+entry+text[at:]
with p.open('w',encoding='utf-8',newline='') as f:f.write(text)
print('Installed migaofen artwork metadata; manifest count',count)
