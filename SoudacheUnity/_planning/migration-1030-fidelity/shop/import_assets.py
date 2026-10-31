# -*- coding: utf-8 -*-
from pathlib import Path
import hashlib,json,uuid,re
from PIL import Image
project=Path(__file__).resolve().parents[3]
source=project.parent/'搜打撤/game/assets'
target=project/'Assets/Resources/Art/CurrentShop'
target.mkdir(parents=True,exist_ok=True)
template=next((project/'Assets/Resources/Art/CurrentGuide').glob('*.png.meta')).read_text(encoding='utf-8-sig')
rows=[]
for source_name,name in [('scenes/shop/shop-cardstyle-approved-1011.webp','merchant-approved'),('cards/shop-mystery-back-1025.webp','mystery-back')]:
    original=source/source_name;output=target/(name+'.png')
    with Image.open(original) as image:
        rgba=image.convert('RGBA');rgba.save(output)
        with Image.open(output) as native:assert native.convert('RGBA').tobytes()==rgba.tobytes()
        rows.append({'source':str(original),'output':str(output),'sourceSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'width':rgba.width,'height':rgba.height,'decodedRgbaSha256':hashlib.sha256(rgba.tobytes()).hexdigest(),'pixelsIdentical':True})
    meta=output.with_suffix('.png.meta')
    if not meta.exists():meta.write_text(re.sub(r'^guid: [a-f0-9]+$', 'guid: '+uuid.uuid4().hex,template,flags=re.M),encoding='utf-8')
receipt={'consumer':['game/css/expedition-shop.css:12','game/src/run/game.run.shop.js:23-24'],'sourceReadOnly':True,'method':'Lossless decoded RGBA conversion to Unity PNG; no image generation/redesign','binaryPolicy':'Local assets; no git stage/commit','assets':rows}
(Path(__file__).parent/'assets-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'assets':len(rows),'pixelsIdentical':True}))
