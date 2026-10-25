import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).parent
WORK = ROOT.parent / '.tmp/nai/wu-bass-reset-1024'
ASSET = ROOT / 'game/assets/reconstruction/wallpaper-wu-bass-1020.webp'
SOURCE = Path('C:/Users/太平/.codex/generated_images/01a16e5a-25e4-7923-9d72-cca7f40d01d0/exec-11748e63-17dd-464d-a1a0-2ec8604c4d4f.png')
sha = lambda data: hashlib.sha256(data).hexdigest()
request = json.loads((EVIDENCE / 'nai-request.json').read_text(encoding='utf8'))
old = ASSET.read_bytes()
expected = next(r['sha256'] for r in request['references'] if r['role'] == 'theme and lying composition')
if sha(old) != expected:
    raise RuntimeError('Wallpaper changed concurrently; stop.')
backup = WORK / 'before-wallpaper.webp'
if not backup.exists():
    backup.write_bytes(old)
shutil.copy2(SOURCE, WORK / 'builtin-final.png')
with Image.open(SOURCE) as image:
    size = image.size
    image.convert('RGB').save(WORK / 'final.webp', 'WEBP', quality=94, method=6)
new = (WORK / 'final.webp').read_bytes()
manifest = ROOT / 'game/assets/asset-manifest.json'
raw = manifest.read_bytes()
text = raw.decode('utf8')
key = 'reconstruction/wallpaper-wu-bass-1020.webp'
pos = text.index('"path": "' + key + '"')
begin = text.rfind('    {', 0, pos)
tail = text[begin:]
entry, used = json.JSONDecoder().raw_decode(tail.lstrip())
end = begin + len(tail) - len(tail.lstrip()) + used
entry.update(bytes=len(new), sha256=sha(new),
    license='项目AI生成素材（NAI V5底稿＋Codex内置ImageGen重绘，无贝斯首页第四张）',
    source='docs/evidence/2026-10-24-wu-bass-reset/receipt.json')
fragment = '    ' + json.dumps(entry, ensure_ascii=False, indent=2).replace('\n', '\n    ')
if '\r\n' in text[begin:end]:
    fragment = fragment.replace('\n', '\r\n')
updated = text[:begin] + fragment + text[end:]
css = ROOT / 'game/css/title-p0.css'
cssraw = css.read_bytes()
oldurl = b'wallpaper-wu-bass-1020.webp?v=final-face-1020'
if cssraw.count(oldurl) != 1:
    raise RuntimeError('Wallpaper reference changed; stop.')
cssnext = cssraw.replace(oldurl, b'wallpaper-wu-bass-1020.webp?v=nai5-bass-reset-1024')
if manifest.read_bytes() != raw or css.read_bytes() != cssraw:
    raise RuntimeError('Shared file changed concurrently; stop.')
ASSET.write_bytes(new)
manifest.write_bytes(updated.encode('utf8'))
css.write_bytes(cssnext)
receipt = {
    'status':'installed', 'channels':['NAI V5 Full','built-in image_gen'],
    'asset':str(ASSET.relative_to(ROOT)), 'size':list(size), 'bytes':len(new), 'sha256':sha(new),
    'source':str(SOURCE), 'source_sha256':sha(SOURCE.read_bytes()),
    'before':str(backup.relative_to(ROOT.parent)), 'before_sha256':sha(old),
    'draft':str((WORK/'nai5-draft.png').relative_to(ROOT.parent)), 'nai_seed':request['seed'],
    'builtin_final':str((WORK/'builtin-final.png').relative_to(ROOT.parent)),
    'prompt_file':'builtin-prompt.txt',
    'references':[
        {'path':str(WORK/'nai5-draft.png'),'role':'NAI5 color, identity and painting draft'},
        {'path':str(backup),'role':'lying composition and home scene'},
        {'path':'game/assets/portraits/full/wu.webp','role':'current identity only; no sword or dress inheritance'}],
    'review':'目视保留倒躺夜景、家居服和露额头身份；琴头完整、四个弦钮，双手按弦与拨弦姿势已重绘；未作乐器专业验收',
    'verification':'按老板要求不测试、不打开游戏实页；只执行图片转换、尺寸及哈希登记',
    'large_binary_policy':'原始PNG保存在根.tmp，不进Git；获取方式为本次NAI请求与内置ImageGen，路径/哈希见本记录及nai-request.json'
}
(EVIDENCE/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(EVIDENCE/'README.md').write_text(
    '# 无·贝斯：首页第四张壁纸重制\n\n'
    '老板要求沿上一张重制第四张，采用NAI5底稿加内置ImageGen重绘。保留地毯倒躺、家居服、夜间客厅、蓝色城市窗景与暖灯；现行人设沿无的露额头、银白高马尾、蓝缎带、青蓝眼睛与圆框墨镜，不继承立绘黑裙或背剑。\n\n'
    'NAI完整请求与seed见nai-request.json，内置完整提示词见builtin-prompt.txt。内置沿旧图构图，修完整琴头、四弦贝斯硬件和按弦/拨弦姿势。最终来源、尺寸、SHA与原稿/旧图备份路径见receipt.json。大于1MB原始PNG在根.tmp/nai/wu-bass-reset-1024/，不进Git。\n\n'
    '已替换game/assets/reconstruction/wallpaper-wu-bass-1020.webp，仅修改asset-manifest.json本图条目及title-p0.css贝斯缓存；上一张星月钢琴改动和其他增量保留。按老板要求未测试、未游戏实页验收；无build、提交或推送。\n',encoding='utf8')
print(json.dumps({'installed':receipt['asset'],'size':size,'bytes':len(new),'sha256':receipt['sha256']}))
