import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).parent
WORK = ROOT.parent / '.tmp/nai/baita-station-reset-1024'
ASSET = ROOT / 'game/assets/reconstruction/wallpaper-baita-station-1020.webp'
SOURCE = Path('C:/Users/太平/.codex/generated_images/01a16e5a-25e4-7923-9d72-cca7f40d01d0/exec-ec3ac202-f8b9-4838-9fa1-f77b26f31c6c.png')
FIRST = SOURCE.with_name('exec-de376e52-30f9-482e-9561-ec28fbeea9b1.png')
sha = lambda data: hashlib.sha256(data).hexdigest()
request = json.loads((EVIDENCE/'nai-request.json').read_text(encoding='utf8'))
old = ASSET.read_bytes()
expected = next(r['sha256'] for r in request['references'] if r['role']=='theme and station stair composition')
if sha(old) != expected:
    raise RuntimeError('Wallpaper changed concurrently; stop.')
backup = WORK/'before-wallpaper.webp'
if not backup.exists():
    backup.write_bytes(old)
shutil.copy2(FIRST, WORK/'builtin-first.png')
shutil.copy2(SOURCE, WORK/'builtin-final.png')
with Image.open(SOURCE) as image:
    size = image.size
    image.convert('RGB').save(WORK/'final.webp','WEBP',quality=94,method=6)
new = (WORK/'final.webp').read_bytes()
manifest = ROOT/'game/assets/asset-manifest.json'
raw = manifest.read_bytes()
text = raw.decode('utf8')
key = 'reconstruction/wallpaper-baita-station-1020.webp'
pos = text.index('"path": "'+key+'"')
begin = text.rfind('    {',0,pos)
tail = text[begin:]
entry,used = json.JSONDecoder().raw_decode(tail.lstrip())
end = begin+len(tail)-len(tail.lstrip())+used
entry.update(bytes=len(new),sha256=sha(new),
    license='项目AI生成素材（NAI V5底稿＋Codex内置ImageGen重绘，白塔车站首页第五张）',
    source='docs/evidence/2026-10-24-baita-station-reset/receipt.json')
fragment = '    '+json.dumps(entry,ensure_ascii=False,indent=2).replace('\n','\n    ')
if '\r\n' in text[begin:end]:
    fragment=fragment.replace('\n','\r\n')
updated=text[:begin]+fragment+text[end:]
css=ROOT/'game/css/title-p0.css'
cssraw=css.read_bytes()
oldurl=b'wallpaper-baita-station-1020.webp?v=selected-5401-1020'
if cssraw.count(oldurl)!=1:
    raise RuntimeError('Wallpaper reference changed; stop.')
cssnext=cssraw.replace(oldurl,b'wallpaper-baita-station-1020.webp?v=nai5-station-reset-1024')
if manifest.read_bytes()!=raw or css.read_bytes()!=cssraw:
    raise RuntimeError('Shared file changed concurrently; stop.')
ASSET.write_bytes(new)
manifest.write_bytes(updated.encode('utf8'))
css.write_bytes(cssnext)
receipt={
    'status':'installed','channels':['NAI V5 Full','built-in image_gen: repaint and local fringe correction'],
    'asset':str(ASSET.relative_to(ROOT)),'size':list(size),'bytes':len(new),'sha256':sha(new),
    'source':str(SOURCE),'source_sha256':sha(SOURCE.read_bytes()),
    'before':str(backup.relative_to(ROOT.parent)),'before_sha256':sha(old),
    'draft':str((WORK/'nai5-draft.png').relative_to(ROOT.parent)),'nai_seed':request['seed'],
    'builtin_first':str((WORK/'builtin-first.png').relative_to(ROOT.parent)),
    'builtin_final':str((WORK/'builtin-final.png').relative_to(ROOT.parent)),
    'prompt_files':['builtin-prompt.txt','fringe-correction-prompt.txt'],
    'review':'目视保留冬装、持票上台阶、背景人流；重绘台阶、落脚与持票动作；追加局部修正为观众左侧绿眼可见、右侧眼被刘海遮住，金夹在露眼侧，保留绿色贝雷帽',
    'verification':'按老板要求不测试、不打开游戏实页；只执行图片转换、尺寸与哈希登记',
    'large_binary_policy':'原始PNG均在根.tmp，不进Git；获取方式为本次NAI请求及内置ImageGen，路径/哈希见本记录与nai-request.json'
}
(EVIDENCE/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(EVIDENCE/'README.md').write_text(
    '# 白塔·车站：首页第五张壁纸重绘\n\n'
    '老板要求沿前两张重绘第五张，采用NAI5底稿加内置ImageGen重绘。保留高角度车站楼梯、冬装、持票、肩包与背景人流；现行身份沿深棕超长卷发、绿色贝雷帽、单侧绿眼与两枚金夹。第一轮沿用旧图的镜像刘海，第二轮局部修正为观众左侧眼可见、右侧眼遮住，未镜像整张图。\n\n'
    'NAI完整请求与seed见nai-request.json；内置两轮完整提示词见builtin-prompt.txt、fringe-correction-prompt.txt。最终尺寸、来源、SHA及原稿/旧图备份路径见receipt.json。大于1MB原始PNG在根.tmp/nai/baita-station-reset-1024/，不进Git。\n\n'
    '已替换game/assets/reconstruction/wallpaper-baita-station-1020.webp，仅修改asset-manifest.json本图条目和title-p0.css车站缓存。第三、第四张及其他增量保留。按老板要求未测试、未游戏实页验收；无build、提交或推送。\n',encoding='utf8')
print(json.dumps({'installed':receipt['asset'],'size':size,'bytes':len(new),'sha256':receipt['sha256']}))
