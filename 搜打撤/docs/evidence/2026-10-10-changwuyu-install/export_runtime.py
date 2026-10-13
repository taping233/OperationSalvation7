"""Export approved frames and timings for the existing battle sprite player."""
from pathlib import Path
from PIL import Image
import json,hashlib

project=Path.cwd()
source=project/'game/art-source/characters/changwuyu-sprites-20261009'
out=project/'game/assets/portraits/frames/changwuyu/sprite-v1'
out.mkdir(parents=True,exist_ok=True)
names={};assets=[];sequences={};timings={}
neutral=Image.open(str(source/'idle/frames/idle-000.png')).convert('RGBA')
neutral.save(out/'neutral.webp',lossless=True,exact=True)
for key in ['idle','attack','hurt','death']:
    spec=json.loads((source/key/'sprite.json').read_text(encoding='utf8'))
    mapped=[]
    for slot in spec['sequence']:
        path=source/key/('frames/idle-%03d.png'%slot if key=='idle' else 'frame-%02d.png'%slot)
        im=Image.open(str(path)).convert('RGBA')
        digest=hashlib.sha256(im.tobytes()).hexdigest()
        if digest not in names:
            name='sprite-v1/f%03d'%len(names)
            im.save(out/(name.split('/')[-1]+'.webp'),lossless=True,exact=True)
            names[digest]=name
        mapped.append(names[digest])
    action='atk' if key=='attack' else key
    sequences[action]=mapped;timings[action]=spec['durationsMs']
sequences['cast']=sequences['atk'];timings['cast']=timings['atk']
data={'character':'changwuyu','width':768,'height':512,'sequences':sequences,'timings':timings,
      'staticFallback':'sprite-v1/neutral','source':'game/art-source/characters/changwuyu-sprites-20261009',
      'approved':'老板10-10认可并授权实装；角色左手挥动、无火球、连续受击、倒地保持'}
(out/'animations.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
neutral.save(project/'game/assets/portraits/battle/changwuyu.webp',lossless=True,exact=True)
for path in sorted(out.glob('*.webp')):
    assets.append({'path':path.relative_to(project/'game/assets').as_posix(),'ext':'webp',
                   'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                   'license':'项目自有（内置imagegen生成；老板认可并授权常无欲四动作实装）',
                   'source':'docs/evidence/2026-10-10-changwuyu-install/receipt.json'})
p=project/'game/assets/portraits/battle/changwuyu.webp'
assets.append({'path':'portraits/battle/changwuyu.webp','ext':'webp','bytes':p.stat().st_size,
               'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'license':'项目自有（认可Sprite待机基准）',
               'source':'docs/evidence/2026-10-10-changwuyu-install/receipt.json'})
manifest=project/'game/assets/asset-manifest.json';raw=manifest.read_text(encoding='utf8')
m=json.loads(raw);updates={item['path']:item for item in assets}
m['assets']=[updates.pop(item['path'],item) for item in m['assets']]+list(updates.values());m['count']=len(m['assets'])
manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
receipt={'status':'implemented-unverified-per-user','uniqueTextures':len(names),'dimensions':[768,512],
         'sequences':{k:len(v) for k,v in sequences.items()},'durationMs':{k:sum(v) for k,v in timings.items()},
         'assets':assets,'checks':'按老板停止检查要求，未新增验证'}
(project/'docs/evidence/2026-10-10-changwuyu-install/receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'exportedTextures':len(names),'durationMs':receipt['durationMs']},ensure_ascii=False))
