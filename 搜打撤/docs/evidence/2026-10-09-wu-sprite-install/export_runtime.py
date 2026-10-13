from pathlib import Path
from PIL import Image
import json,hashlib

root=Path.cwd()
sources={
 'idle':root/'game/art-source/characters/wu-idle-sprite-20261009/v2',
 'atk':root/'game/art-source/characters/wu-attack-sprite-20261009/v3',
 'hurt':root/'game/art-source/characters/wu-hurt-sprite-20261009',
 'death':root/'game/art-source/characters/wu-death-sprite-20261009',
}
out=root/'game/assets/portraits/frames/wu/sprite-v1'
bank={};sequence={};timings={};files=[]
for action,p in sources.items():
 spec=json.loads((p/'sprite.json').read_text(encoding='utf8'))
 names=[]
 for pose in spec['sequence']:
  source=p/'frames'/('idle-%03d.png'%pose) if action=='idle' else p/(('%s-%02d.png'%({'atk':'attack'}.get(action,action),pose)))
  im=Image.open(str(source)).convert('RGBA').resize((512,342),Image.Resampling.LANCZOS)
  key=hashlib.sha256(im.tobytes()).hexdigest()
  if key not in bank:
   name='neutral' if not bank else 'frame-%03d'%len(bank)
   target=out/(name+'.webp');im.save(target,lossless=True,exact=True)
   bank[key]='sprite-v1/'+name
   files.append({'path':target.relative_to(root).as_posix(),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source':source.relative_to(root).as_posix()})
  names.append(bank[key])
 sequence[action]=names;timings[action]=spec['durationsMs']
sequence['cast']=[sequence['idle'][0]];timings['cast']=[800]
assert sequence['atk'][0]==sequence['atk'][-1]==sequence['hurt'][0]==sequence['hurt'][-1]==sequence['idle'][0]
assert sequence['death'][0]==sequence['idle'][0] and sequence['death'][-1]!=sequence['idle'][0]
catalog={'width':512,'height':342,'sequences':sequence,'timings':timings,'fixedGeometry':True,'assetVersion':'sprite-v1'}
(out/'animations.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf8')
# Preserve all unrelated manifest observations from the current shared working tree.
manifest_path=root/'game/assets/asset-manifest.json';manifest=json.loads(manifest_path.read_text(encoding='utf8'))
existing={e['path']:e for e in manifest['assets']}
for item in files:
 path=item['path'].split('game/assets/',1)[1]
 assert path not in existing,'Unexpected existing runtime asset: '+path
 manifest['assets'].append({'path':path,'ext':'webp','bytes':item['bytes'],'sha256':item['sha256'],
 'license':'项目原创；内置imagegen生成，老板授权游戏使用','source':item['source']})
manifest['count']=len(manifest['assets'])
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(root/'docs/evidence/2026-10-09-wu-sprite-install/runtime-assets.json').write_text(json.dumps({'files':files,'uniqueTextures':len(bank),'decodedBytes':len(bank)*512*342*4,'catalog':catalog},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'uniqueTextures':len(bank),'decodedMiB':round(len(bank)*512*342*4/1048576,2),'bytes':sum(f['bytes'] for f in files)},ensure_ascii=False))
