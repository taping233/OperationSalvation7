import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
EVIDENCE=Path(__file__).parent
WORK=ROOT.parent/'.tmp/nai/xingyue-reeds-reset-1024'
ASSET=ROOT/'game/assets/reconstruction/wallpaper-xingyue-reeds-1020.webp'
SOURCE=Path('C:/Users/太平/.codex/generated_images/01a16e5a-25e4-7923-9d72-cca7f40d01d0/exec-4f186df6-562c-42b9-b171-1de81f6852a4.png')
sha=lambda data:hashlib.sha256(data).hexdigest()
request=json.loads((EVIDENCE/'nai-request.json').read_text(encoding='utf8'))
old=ASSET.read_bytes()
expected=next(r['sha256'] for r in request['references'] if r['role'].startswith('reeds sunset scene'))
if sha(old)!=expected:
    raise RuntimeError('Wallpaper changed concurrently; stop.')
backup=WORK/'before-wallpaper.webp'
if not backup.exists():
    backup.write_bytes(old)
shutil.copy2(SOURCE,WORK/'builtin-final.png')
with Image.open(SOURCE) as image:
    size=image.size
    image.convert('RGB').save(WORK/'final.webp','WEBP',quality=94,method=6)
new=(WORK/'final.webp').read_bytes()
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
    license='项目AI生成素材（NAI V5底稿＋Codex内置ImageGen重绘，星月芦苇首页第六张换装版）',
    source='docs/evidence/2026-10-24-xingyue-reeds-reset/receipt.json')
fragment='    '+json.dumps(entry,ensure_ascii=False,indent=2).replace('\n','\n    ')
if '\r\n' in text[begin:end]:
    fragment=fragment.replace('\n','\r\n')
updated=text[:begin]+fragment+text[end:]
css=ROOT/'game/css/title-p0.css'
cssraw=css.read_bytes()
oldurl=b'wallpaper-xingyue-reeds-1020.webp'
if cssraw.count(oldurl)!=1:
    raise RuntimeError('Wallpaper reference changed; stop.')
cssnext=cssraw.replace(oldurl,oldurl+b'?v=nai5-winter-outfit-1024')
if manifest.read_bytes()!=raw or css.read_bytes()!=cssraw:
    raise RuntimeError('Shared file changed concurrently; stop.')
ASSET.write_bytes(new)
manifest.write_bytes(updated.encode('utf8'))
css.write_bytes(cssnext)
receipt={
    'status':'installed','channels':['NAI V5 Full','built-in image_gen'],
    'asset':str(ASSET.relative_to(ROOT)),'size':list(size),'bytes':len(new),'sha256':sha(new),
    'source':str(SOURCE),'source_sha256':sha(SOURCE.read_bytes()),
    'before':str(backup.relative_to(ROOT.parent)),'before_sha256':sha(old),
    'draft':str((WORK/'nai5-draft.png').relative_to(ROOT.parent)),'nai_seed':request['seed'],
    'builtin_final':str((WORK/'builtin-final.png').relative_to(ROOT.parent)),
    'prompt_file':'builtin-prompt.txt',
    'outfit':'深青绿长羊毛外套、燕麦色高领针织衫、赭金围巾、炭灰褶裥长裙；鞋靴被前景自然遮挡',
    'reference_roles':['NAI5新换装底稿','旧图仅芦苇夕照场景与构图','现行星月立绘仅身份，不继承神官服或提灯'],
    'review':'目视新冬装完整上身，保留浅金长辫、金瞳、白月牙发饰与芦苇夕照红飘带主题；双手动作重绘',
    'verification':'按老板要求不测试、不打开游戏实页；只执行图片转换、尺寸及哈希登记',
    'large_binary_policy':'原始PNG在根.tmp，不进Git；由本次NAI及内置ImageGen获取，路径与SHA见本记录及nai-request.json'
}
(EVIDENCE/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(EVIDENCE/'README.md').write_text(
    '# 星月·芦苇：首页第六张换装重制\n\n'
    '老板要求重置第六张并换一身衣服，沿前几张采用NAI5底稿加内置ImageGen重绘。新衣服为深青绿长羊毛外套、燕麦色高领针织衫、赭金围巾和炭灰褶裥长裙；旧露肩裙/落肩灰外套不继承。身份保留浅金长辫、金瞳和白色月牙发饰。场景沿银芦苇、红飘带与蓝金夕照；右手拢围巾、左手轻触芦苇。\n\n'
    'NAI完整请求与seed见nai-request.json，内置完整提示词见builtin-prompt.txt。最终来源/尺寸/SHA与原稿、旧图备份路径见receipt.json。大于1MB原始PNG存根.tmp/nai/xingyue-reeds-reset-1024/，不进Git。\n\n'
    '已替换game/assets/reconstruction/wallpaper-xingyue-reeds-1020.webp，仅修改asset-manifest.json本图条目与title-p0.css芦苇缓存，其他壁纸与增量保留。按老板要求未测试、未游戏实页验收；无build、提交或推送。\n',encoding='utf8')
print(json.dumps({'installed':receipt['asset'],'size':size,'bytes':len(new),'sha256':receipt['sha256']}))
