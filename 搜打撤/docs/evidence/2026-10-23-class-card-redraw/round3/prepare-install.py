from pathlib import Path
from PIL import Image
import json, hashlib, shutil

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE.parent
PROJECT = EVIDENCE.parents[2]
ROOT = PROJECT.parent
INSTALL = EVIDENCE/'install-16-20261023'
DEST = PROJECT/'game/art-source/class-card-redraw-20261023/v3'
RAW = ROOT/'.tmp/imagegen/class-card-feedback-v3-1023'
for folder in (INSTALL, DEST, RAW): folder.mkdir(parents=True, exist_ok=True)
assert not (INSTALL/'request.json').exists(), 'Installation request already exists'
read = lambda p: json.loads(p.read_text('utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
baseline = read(EVIDENCE/'round2/final-receipt.json')['items']
latest = {x['card_id']:x for x in read(HERE/'receipt.json')['items']}
assert len(latest)==5
manifest = read(PROJECT/'game/assets/asset-manifest.json')
mapping = read(PROJECT/'game/data/art-mapping.json')
items=[]
for old in baseline:
    cid=old['card_id']
    selected=dict(old)
    if cid in latest:
        edit=latest[cid]
        source=Path(edit['source'])
        raw=RAW/(cid+'.png')
        shutil.copy2(source,raw)
        webp=DEST/(cid+'.webp')
        with Image.open(raw) as image:
            assert image.size==(1254,1254), (cid,image.size)
            image.convert('RGB').save(webp,'WEBP',quality=94,method=6)
        selected.update(source=str(source),png=str(raw),webp=str(webp),revision=3)
        if cid in ('tt7-swordimmortal','tt7-goldencicada'):
            selected['nai']=str(ROOT/'.tmp/nai/class-card-feedback-v3-1023'/(cid+'.png'))
    source=Path(selected['png'])
    assert source.exists()
    candidates=[x['path'] for x in manifest['assets'] if x['path'].startswith('cards/') and x['path'].endswith(cid+'.webp')]
    asset=mapping['cardArtOverrides'].get(cid)
    if not asset:
        assert len(candidates)==1,(cid,candidates)
        asset=candidates[0]
    items.append(dict(card_id=cid,name=old['name'],asset=asset,source=str(source),
                      source_sha256=sha(source),revision='career-final-20261023',
                      selected_revision=selected['revision'],candidate_webp=selected['webp'],
                      nai=selected['nai']))
for relative in ('game/data/art-mapping.json','game/assets/asset-manifest.json'):
    shutil.copy2(PROJECT/relative,INSTALL/(Path(relative).stem+'.before.json'))
request=dict(authorization='Owner: 16 cards all installed; no review-page update',items=items)
(INSTALL/'request.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n','utf-8')
(HERE/'final-selection.json').write_text(json.dumps(request,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps(dict(selected=len(items),new_revision=sum(x['selected_revision']==3 for x in items),request=str(INSTALL/'request.json')),ensure_ascii=True))
