from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image

project = Path(__file__).resolve().parents[3]
source = project.parent / '\u641c\u6253\u64a4' / 'game'
data_path = source / 'data' / 'beginner-guide.json'
data = json.loads(data_path.read_text(encoding='utf-8-sig'))
destination = project / 'Assets/Resources/Data/CurrentBeginnerGuide.json'
destination.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(data_path, destination)
art = project / 'Assets/Resources/Art/CurrentGuide'
art.mkdir(parents=True, exist_ok=True)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
files = [{'source': str(data_path), 'destination': str(destination), 'sourceSha256':sha(data_path), 'outputSha256':sha(destination)}]
for page in data['pages']:
    original = source / page['image']
    target = art / (page['id'] + '.png')
    with Image.open(original) as image:
        image.convert('RGBA').save(target)
        size = list(image.size)
    files.append({'source':str(original),'destination':str(target),'sourceSha256':sha(original),'outputSha256':sha(target),'size':size,'acquisition':'Lossless RGBA decode of current source WebP; no resize'})
out = Path(__file__).resolve().parent / 'guide-assets-receipt.json'
out.write_text(json.dumps({'pages':len(data['pages']),'files':files},ensure_ascii=True,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'pages':len(data['pages']),'sourceImages':len(files)-1,'receipt':str(out)},ensure_ascii=True))
