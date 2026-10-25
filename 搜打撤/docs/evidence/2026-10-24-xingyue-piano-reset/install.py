import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).parent
WORK = ROOT.parent / '.tmp/nai/xingyue-piano-reset-1024'
ASSET = ROOT / 'game/assets/reconstruction/wallpaper-xingyue-piano-1020.webp'
SOURCE = Path('C:/Users/太平/.codex/generated_images/01a16e5a-25e4-7923-9d72-cca7f40d01d0/exec-d3e54298-af72-476d-a3d6-298e9075f718.png')
FIRST = SOURCE.with_name('exec-ff16072c-2566-466c-ab7e-9718178df9f6.png')
sha = lambda data: hashlib.sha256(data).hexdigest()
request = json.loads((EVIDENCE / 'nai-request.json').read_text(encoding='utf8'))
old = ASSET.read_bytes()
expected = next(r['sha256'] for r in request['references'] if r['role'] == 'theme and composition')
if sha(old) != expected:
    raise RuntimeError('Wallpaper changed concurrently; stop.')
backup = WORK / 'before-wallpaper.webp'
if not backup.exists():
    backup.write_bytes(old)
shutil.copy2(FIRST, WORK / 'builtin-first.png')
shutil.copy2(SOURCE, WORK / 'builtin-piano-hands.png')
with Image.open(SOURCE) as image:
    size = image.size
    image.convert('RGB').save(WORK / 'final.webp', 'WEBP', quality=94, method=6)
new = (WORK / 'final.webp').read_bytes()
manifest = ROOT / 'game/assets/asset-manifest.json'
raw = manifest.read_bytes()
text = raw.decode('utf8')
key = 'reconstruction/wallpaper-xingyue-piano-1020.webp'
pos = text.index('"path": "' + key + '"')
begin = text.rfind('    {', 0, pos)
tail = text[begin:]
entry, used = json.JSONDecoder().raw_decode(tail.lstrip())
end = begin + len(tail) - len(tail.lstrip()) + used
entry.update(bytes=len(new), sha256=sha(new),
    license='项目AI生成素材（NAI V5底稿＋Codex内置ImageGen重绘，钢琴及双手局部修订）',
    source='docs/evidence/2026-10-24-xingyue-piano-reset/receipt.json')
fragment = '    ' + json.dumps(entry, ensure_ascii=False, indent=2).replace('\n', '\n    ')
updated = text[:begin] + fragment + text[end:]
css = ROOT / 'game/css/title-p0.css'
cssraw = css.read_bytes()
oldurl = b'wallpaper-xingyue-piano-1020.webp'
if cssraw.count(oldurl) != 2:
    raise RuntimeError('Wallpaper references changed; stop.')
cssnext = cssraw.replace(oldurl, oldurl + b'?v=nai5-piano-hands-1024')
if manifest.read_bytes() != raw or css.read_bytes() != cssraw:
    raise RuntimeError('Shared file changed concurrently; stop.')
ASSET.write_bytes(new)
manifest.write_bytes(updated.encode('utf8'))
css.write_bytes(cssnext)
receipt = {
    'status': 'installed', 'channels': ['NAI V5 Full', 'built-in image_gen: repaint and piano/hands correction'],
    'asset': str(ASSET.relative_to(ROOT)), 'size': list(size), 'bytes': len(new), 'sha256': sha(new),
    'source': str(SOURCE), 'source_sha256': sha(SOURCE.read_bytes()),
    'before': str(backup.relative_to(ROOT.parent)), 'before_sha256': sha(old),
    'draft': str((WORK / 'nai5-draft.png').relative_to(ROOT.parent)), 'nai_seed': request['seed'],
    'builtin_first': str((WORK / 'builtin-first.png').relative_to(ROOT.parent)),
    'builtin_final': str((WORK / 'builtin-piano-hands.png').relative_to(ROOT.parent)),
    'prompt_files': ['builtin-prompt.txt', 'piano-hands-prompt.txt'],
    'review': '生成画面目视：双手手指弧度、手腕和触键姿势已调整，键盘黑键重新分组；未作乐器专业验收',
    'verification': '按老板此前要求，不运行测试、不打开游戏实页；只执行图片转换、尺寸和哈希登记',
    'large_binary_policy': '原始PNG保存在根.tmp，不进Git；获取方式为本次NAI请求及内置生成；路径与SHA见本记录及nai-request.json'
}
(EVIDENCE / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
builtin = json.loads((EVIDENCE / 'builtin-request.json').read_text(encoding='utf8'))
builtin.update(status='generated', prompt_file='builtin-prompt.txt', output=str(FIRST),
    final_correction_prompt='piano-hands-prompt.txt', final_output=str(SOURCE))
(EVIDENCE / 'builtin-request.json').write_text(json.dumps(builtin, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
(EVIDENCE / 'README.md').write_text(
    '# 星月钢琴：首页第三张壁纸重制\n\n'
    '老板确认采用NAI5底稿加内置生图重绘，并追加重点修正钢琴和手法。保留夕照、破旧木屋及星月弹琴主题，沿现行浅金长辫、金瞳、白色月牙发饰与白金神官服/青绿披肩身份。\n\n'
    'NAI V5 Full底稿1344×768，seed与完整请求见nai-request.json；内置先重绘画法，再局部修双手、琴键组别与键盘透视。内置两轮完整提示词分别见builtin-prompt.txt、piano-hands-prompt.txt。最终图片尺寸/哈希与原稿路径见receipt.json。大于1MB的原始PNG在根.tmp/nai/xingyue-piano-reset-1024/，旧运行图同处备份。\n\n'
    '已替换game/assets/reconstruction/wallpaper-xingyue-piano-1020.webp；仅改asset-manifest.json本图条目与title-p0.css钢琴两处缓存。其他会话剑仙清单条目保留。按老板此前要求不测试、未游戏实页验收；无build、提交或推送。\n', encoding='utf8')
print(json.dumps({'installed': receipt['asset'], 'size': size, 'bytes': len(new), 'sha256': receipt['sha256']}))
