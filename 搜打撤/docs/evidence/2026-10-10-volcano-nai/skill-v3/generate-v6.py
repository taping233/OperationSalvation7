"""在获认可v5方向上仅修背景对比与躯干裁切；共享配方不变。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload
import nai_style

EVIDENCE = Path(__file__).resolve().parent
previous = json.loads((EVIDENCE / 'request-v5.json').read_text(encoding='utf-8'))
request = json.loads(json.dumps(previous))
prompt = previous['prompt']

def replace_once(old, new):
    global prompt
    if prompt.count(old) != 1:
        raise SystemExit('v5输入变化，停止核对：' + old)
    prompt = prompt.replace(old, new, 1)

replace_once('from above, upper body, leaning forward',
             'from above, cowboy shot, leaning forward')
replace_once('His face remains readable beneath the hat brim; his torso continues through the lower-left crop.',
             'His face remains readable beneath the hat brim. The robe follows his '
             'continuous body from shoulders through chest, waist and hips to the '
             'upper thighs; its lower folds extend beyond the bottom-left image edge. '
             'The body is cropped only by the canvas edge, with the waist and hips '
             'visibly joining the chest and lower robe.')
replace_once('Plain deep ink-blue background, even flat color extending to all four canvas edges; '
             'the character, dark vent rim and eruptive plume belong to one continuous image.',
             'Plain light warm-gray background, even matte color extending to all four '
             'canvas edges. The pale neutral field clearly separates the dark robe '
             'and charcoal vent from the vivid orange lava; the character, dark vent '
             'rim and eruptive plume belong to one continuous image.')
if not prompt.endswith(nai_style.STYLE_BLOCK):
    raise SystemExit('共享画风原文变化，停止。')
request['prompt'] = prompt
request['negative_prompt'] += ', blue background, navy background, floating bust, torso cutout'
request['model'] = previous['model']
request['status'] = '老板反馈v5后，仅修灰底与躯干连续性，单张v6候选'
request['parent_request'] = 'request-v5.json'
request['changes'] = {
    'background': '深蓝改浅暖灰纯色底，黑袍/炭黑火山口与橙熔岩清楚分离。',
    'crop': 'upper body改cowboy shot，肩胸腰胯连贯至大腿上段，袍服在画框边缘出画。',
}
request['unchanged'] = ['角色栏全文', '正式画师链', 'STYLE_BLOCK原文', '火山口/熔岩/烟柱与三卡交互', '其他机位动作', '模型尺寸参数']
output = PROJECT.parent / '.tmp/nai/output/volcano-painterly-20261010/volcano-nai5-v6.png'
if output.exists():
    raise SystemExit('v6候选已存在，禁止重复请求或覆盖。')
seed = build_payload(prompt, seed=None)['parameters']['seed']
request['seed'] = seed
(EVIDENCE / 'request-v6-sent.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(
    prompt, request['negative_prompt'], char_prompt=request['character_prompt'],
    width=request['width'], height=request['height'], seed=seed, out=output,
    model=request['model'],
)
result = Path(path)
(EVIDENCE / 'receipt-v6.json').write_text(json.dumps({
    'path': str(result), 'model': request['model'], 'seed': actual_seed,
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
    'request': 'request-v6-sent.json', 'installed': False,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
