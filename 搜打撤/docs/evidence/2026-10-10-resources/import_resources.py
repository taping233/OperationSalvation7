"""Import this transparent resource-card batch and preserve source alpha."""
import hashlib,json,shutil
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
EVIDENCE=Path(__file__).resolve().parent
REQUEST=EVIDENCE/'request.json'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def record(p): return {'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)}
def main():
    req=json.loads(REQUEST.read_text('utf-8-sig'))
    raw=ROOT/'.tmp/imagegen'/EVIDENCE.name
    receipt_path=EVIDENCE/'receipt.json'
    if receipt_path.exists(): raise RuntimeError('Receipt exists; do not replay')
    manifest_file=ROOT/'game/assets/asset-manifest.json'
    mapping_file=ROOT/'game/data/art-mapping.json'
    manifest_text=manifest_file.read_text('utf-8-sig')
    mapping_text=mapping_file.read_text('utf-8-sig')
    manifest=json.loads(manifest_text);mapping=json.loads(mapping_text)
    prepared=[]
    for i in [item for item in req['items'] if item.get('source')]:
        src=Path(i['source']);full=ROOT/'game/assets'/i['asset']
        thumb=ROOT/'game/assets/thumbs'/i['asset']
        assert src.is_file() and full.is_file() and thumb.is_file()
        im=Image.open(src).convert('RGBA')
        assert im.getchannel('A').getextrema()[0]==0,'Generated image needs actual transparency'
        prepared.append((i,src,full,thumb,im))
    raw.mkdir(parents=True,exist_ok=True)
    receipt={'method':'Built-in ImageGen; RGBA WebP and existing thumbnail color bake, alpha preserved','verification':'Only generated image inspection; no tests/browser/build','items':[]}
    additions=[]
    for i,src,full,thumb,im in prepared:
        key=i['name'];source_copy=raw/(key+'-source.png')
        if source_copy.exists():
            assert sha(source_copy)==sha(src), 'Resume source differs'
        else:
            shutil.copy2(src,source_copy)
        backups=[]
        for p,label in ((full,'full'),(thumb,'thumb')):
            backup=raw/(key+'-'+label+'-before.webp')
            if not backup.exists(): shutil.copy2(p,backup)
            backups.append(record(backup))
        im.save(full,'WEBP',quality=90,method=6)
        small=im.copy();small.thumbnail((448,448),Image.Resampling.LANCZOS)
        rgb=small.convert('RGB');pixels=rgb.load()
        matrix=((1.087994,.003705,.005219),(.006245,1.079741,.004274),(.002781,-.006867,1.082379))
        for y in range(rgb.height):
            for x in range(rgb.width):
                c=pixels[x,y];pixels[x,y]=tuple(max(0,min(255,round(sum(row[k]*c[k] for k in range(3))-.02575*255))) for row in matrix)
        small=rgb.convert('RGBA');small.putalpha(im.getchannel('A').resize(small.size,Image.Resampling.LANCZOS))
        small.save(thumb,'WEBP',quality=82,method=6)
        outputs=[record(full),record(thumb)];patches=[]
        for p in (full,thumb):
            path=p.relative_to(ROOT/'game/assets').as_posix()
            old=next((e for e in manifest['assets'] if e['path']==path),None)
            new=dict(old or {'path':path,'ext':'webp','license':'项目自有（AI 生成）'})
            new.update(bytes=p.stat().st_size,sha256=sha(p),source=receipt_path.relative_to(ROOT).as_posix())
            patches.append({'before':old,'after':new})
            if old:
                start=manifest_text.index('"path": '+json.dumps(path));end=manifest_text.index('}',start)
                part=manifest_text[start:end]
                for k in ('bytes','sha256','source'):
                    value=json.dumps(k)+': '+json.dumps(new[k],ensure_ascii=False)
                    if k in old:
                        needle=json.dumps(k)+': '+json.dumps(old[k],ensure_ascii=False);assert needle in part
                        part=part.replace(needle,value,1)
                    else:
                        part=part.rstrip()+',\n      '+value+'\n    '
                manifest_text=manifest_text[:start]+part+manifest_text[end:]
            else: additions.append(new)
        receipt['items'].append({'card_id':i['card_id'],'raw':record(source_copy),'backups':backups,'outputs':outputs,'revision_before':mapping.get('cardArtRevisions',{}).get(i['card_id']),'revision_after':i['revision'],'manifest_patches':patches})
        receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n','utf-8')
    if additions:
        pos=manifest_text.index('[',manifest_text.index('"assets"'))+1
        block='\n'+',\n'.join('    '+json.dumps(e,ensure_ascii=False,indent=2).replace('\n','\n    ') for e in additions)+','
        manifest_text=manifest_text[:pos]+block+manifest_text[pos:]
        manifest_text=manifest_text.replace('"count": '+str(manifest['count']),'"count": '+str(manifest['count']+len(additions)),1)
    pos=mapping_text.index('{',mapping_text.index('"cardArtRevisions"'))+1
    block='\n'+''.join('    '+json.dumps(i['card_id'])+': '+json.dumps(i['revision'])+',\n' for i,_,_,_,_ in prepared)
    mapping_text=mapping_text[:pos]+block+mapping_text[pos:]
    old='"tt-rations": "cards/expedition-starters/rations.webp"'
    if any(i['card_id']=='tt-rations' for i,_,_,_,_ in prepared):
        assert old in mapping_text
        mapping_text=mapping_text.replace(old,'"tt-rations": "cards/resources/ration.webp"',1)
    json.loads(manifest_text);json.loads(mapping_text)
    manifest_file.write_text(manifest_text,'utf-8');mapping_file.write_text(mapping_text,'utf-8')
    receipt['manifest_count_after']=manifest['count']+len(additions)
    receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n','utf-8')
    print('Imported',len(prepared),'transparent resource cards and thumbnails')
if __name__=='__main__': main()
