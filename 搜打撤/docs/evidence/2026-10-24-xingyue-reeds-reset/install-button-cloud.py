import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
EVIDENCE=Path(__file__).parent
WORK=ROOT.parent/'.tmp/nai/xingyue-reeds-reset-1024'
ASSET=ROOT/'game/assets/reconstruction/wallpaper-xingyue-reeds-1020.webp'
SOURCE=Path('C:/Users/太平/.codex/generated_images/01a16e5a-25e4-7923-9d72-cca7f40d01d0/exec-af28e8f8-d796-461e-98ae-1045e9a0640b.png')
sha=lambda data:hashlib.sha256(data).hexdigest()
previous=json.loads((EVIDENCE/'receipt.json').read_text(encoding='utf8'))
old=ASSET.read_bytes()
if sha(old)!=previous['sha256']:
    raise RuntimeError('Wallpaper changed concurrently; stop.')
backup=WORK/'before-button-cloud.webp'
if not backup.exists():
    backup.write_bytes(old)
shutil.copy2(SOURCE,WORK/'builtin-button-cloud.png')
with Image.open(SOURCE) as image:
    size=image.size
    image.convert('RGB').save(WORK/'button-cloud.webp','WEBP',quality=94,method=6)
new=(WORK/'button-cloud.webp').read_bytes()
manifest=ROOT/'game/assets/asset-manifest.json'
raw=manifest.read_bytes()
text=raw.decode('utf8')
key='reconstruction/wallpaper-xingyue-reeds-1020.webp'
pos=text.index('"path": "'+key+'"')
begin=text.rfind('    {',0,pos)
tail=text[begin:]
entry,used=json.JSONDecoder().raw_decode(tail.lstrip())
end=begin+len(tail)-len(tail.lstrip())+used
entry.update(bytes=len(new),sha256=sha(new),
    license='项目AI生成素材（NAI V5底稿＋Codex内置ImageGen重绘，星月芦苇换装版；扣子与NAI云层质感修订）',
    source='docs/evidence/2026-10-24-xingyue-reeds-reset/button-cloud-revision.json')
fragment='    '+json.dumps(entry,ensure_ascii=False,indent=2).replace('\n','\n    ')
if '\r\n' in text[begin:end]:
    fragment=fragment.replace('\n','\r\n')
updated=text[:begin]+fragment+text[end:]
css=ROOT/'game/css/title-p0.css'
cssraw=css.read_bytes()
oldurl=b'wallpaper-xingyue-reeds-1020.webp?v=nai5-winter-outfit-1024'
if cssraw.count(oldurl)!=1:
    raise RuntimeError('Wallpaper reference changed; stop.')
cssnext=cssraw.replace(oldurl,b'wallpaper-xingyue-reeds-1020.webp?v=nai5-buttons-cloud-1024')
if manifest.read_bytes()!=raw or css.read_bytes()!=cssraw:
    raise RuntimeError('Shared file changed concurrently; stop.')
ASSET.write_bytes(new)
manifest.write_bytes(updated.encode('utf8'))
css.write_bytes(cssnext)
record={
    'status':'installed','tool':'built-in image_gen','asset':str(ASSET.relative_to(ROOT)),
    'size':list(size),'bytes':len(new),'sha256':sha(new),'source':str(SOURCE),
    'source_sha256':sha(SOURCE.read_bytes()),'previous_receipt':'receipt.json',
    'before':str(backup.relative_to(ROOT.parent)),'before_sha256':sha(old),
    'generated_copy':str((WORK/'builtin-button-cloud.png').relative_to(ROOT.parent)),
    'prompt_file':'button-cloud-prompt.txt',
    'reference_roles':['本轮已实装换装图为编辑目标','原NAI5底稿为云层质感权威'],
    'changes':'开襟外套改为一侧三颗单排扣、对侧三个对应扣眼；云层改回柔和蓝灰大块层次，收掉细碎金边和强烈光束；保留人物、衣色、姿态与芦苇构图',
    'verification':'按老板要求未测试、未游戏实页；生成画面目视后转换WebP并登记尺寸/SHA；原PNG在根.tmp不进Git'
}
(EVIDENCE/'button-cloud-revision.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
with (EVIDENCE/'README.md').open('a',encoding='utf8') as output:
    output.write('\n## 追加：扣子与NAI云层质感\n\n老板指出扣子错误，并要求天空保持NAI图质感。内置局部修订为开襟单排三扣及对侧对应扣眼；天空回到NAI底稿的柔和蓝灰大块层次，收掉碎金边与强光束。人物、衣色与芦苇构图保留。最新运行图与来源/SHA以button-cloud-revision.json为准，完整提示词见button-cloud-prompt.txt；上一版receipt及原图备份保留。按要求未测试、未游戏实页。\n')
print(json.dumps({'installed':record['asset'],'size':size,'bytes':len(new),'sha256':record['sha256']}))
