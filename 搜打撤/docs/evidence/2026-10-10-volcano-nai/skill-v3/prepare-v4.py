"""基于v3实际看图，限定三组改动；离线更新提示词，不生图。"""
import json
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
previous = json.loads((EVIDENCE / 'request.json').read_text(encoding='utf-8'))
request = json.loads(json.dumps(previous))
prompt = previous['prompt']

def replace_once(old, new):
    global prompt
    if prompt.count(old) != 1:
        raise SystemExit('v3输入已变化，停止核对：' + old[:60])
    prompt = prompt.replace(old, new, 1)

# 1. 消除纸上草图/白色外缘；保留粗笔仅作用于画面内部。
replace_once(
    'while letting selected outer contours remain open.',
    'with handmade brush edges inside the illustration. The dark background '
    'covers the entire canvas and reaches all four image edges without unpainted margins.'
)
replace_once(
    'The background is abstract volcanic pressure expressed by dark color layers and '
    'eruptive fire, not a physical mountain or a landscape.',
    'The background is one continuous abstract field of ink blue and charcoal violet, '
    'painted edge to edge behind the figure and eruption. Volcanic pressure is expressed '
    'through dark color layers and fire; there is no visible paper surface, inset '
    'rectangular painting, frame or separate blank region.'
)

# 2. 喷发从角落白爆点改成画内旋涡；数量/动作/卡片交互保留。
replace_once(
    'He releases three small black spell cards toward a fiery vortex at the lower right. '
    'The cards recede along a diagonal, their edges burning away as they feed the eruption. '
    'A broad orange-gold surge curls up the right edge from a small ivory hot core, '
    'leaving deep ink-blue and charcoal-violet negative space inside the curve.',
    'He releases three small black spell cards toward a fiery vortex inside the '
    'lower-right quadrant. Its hot core remains visibly inside the image, separated '
    'from the bottom and right edges by dark background. The cards recede along a '
    'diagonal into that core, their edges burning away. Two broad orange-gold bands '
    'curl inward around the small ivory core, forming a readable spiral; one outer '
    'surge then rises along the right side. Dark gaps separate the curved bands. '
    'The core is a small concentrated hot point rather than a large radial white explosion.'
)

# 3. 主次与画法：缩减抢眼的大帽子/亮披风，清楚脸手，压细线与平滑反光。
replace_once(
    'Character 1 occupies the upper-left of the square composition, with his reaching '
    'hand nearer to the viewer at the center. His torso remains joined to that arm '
    'and continues out of the lower-left crop.',
    'Character 1 occupies the upper-left of the square composition, with his reaching '
    'hand nearer to the viewer at the center. His torso remains joined to that arm '
    'and continues out of the lower-left crop. His face and reaching hand are the '
    'focal points of the figure: the hat frames the face without dwarfing it, and '
    'the cloak stays behind his shoulders instead of forming an oversized bright '
    'flag across the upper-right half.'
)
replace_once(
    'The surge lights his fingers and cheek from below and pulls the cloak along its flow.',
    'The surge lights only the lower-facing edges of his fingers and cheek and pulls '
    'the cloak along its flow. The reflected warmth does not recolor the whole hand; '
    'the large robe and cloak shadows stay matte and subdued.'
)
replace_once(
    'opaque broad color masses, clear shadow planes, grouped hair locks, principal '
    'cloth folds, matte painting, selective facial detail. Paint the volcanic surge '
    'in a few broad directional swipes; keep dark surfaces quiet.',
    '1.3::opaque broad color masses, clear shadow planes, grouped hair locks, '
    'principal cloth folds::, matte painting, selective facial detail. '
    'Resolve the eyes, glasses and finger gesture selectively. Most hair and cloth '
    'surfaces use connected color planes with only a few wide directional swipes, '
    'not narrow outlined strips or continuous silky highlights. Keep dark surfaces quiet.'
)
replace_once(
    'Soft directional light reveals the planes of forms.',
    'Directional light separates the principal light and shadow planes without '
    'long smooth reflective gradients.'
)

request['prompt'] = prompt
request['negative_prompt'] = previous['negative_prompt'] + (
    ', white border, unpainted margins, inset illustration, paper background, '
    'feathered hat, hat feather, radial white explosion, glossy fabric, '
    'silky hair highlights, thin contour tracing'
)
request['seed'] = None
request['status'] = 'v4已根据v3视觉检查离线优化，未调用API'
request['parent_request'] = 'request.json'
request['parent_receipt'] = 'receipt.json'
request['changes'] = [
    {'group': '画幅完整性', 'observed': '白边和内部矩形暗底形成纸上插画',
     'change': '粗笔边缘限制在画内；暗底满幅；追加白边/纸底/嵌套画面排除'},
    {'group': '火山交互与能量形状', 'observed': '纸牌链条存在，但白爆点挤在右下角且缺少旋涡',
     'change': '核心移到画内下右；两条宽弧围绕小热点；暗间隙明确旋涡；保留三牌卷入关系'},
    {'group': '焦点与画法', 'observed': '巨帽与亮紫披风抢焦点；细线和平滑反光较多；帽上误加羽毛',
     'change': '脸手优先，帽仅框脸，披风后置并灰化；强调块面，压细线/长反光；排除帽羽'},
]
request['unchanged'] = ['男性原创人设角色栏', '画师串', '人数/表情/视线/机位/姿势词组',
                        'V5 Full、尺寸和客户端参数', '已选对角线分镜']
request['seed_note'] = '若下一轮授权生成，由客户端随机生成新seed；本轮只优化提示词。'
(EVIDENCE / 'request-v4.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('v4提示词已更新：三组定向修改，角色栏与离散事实词组保留；未调用API。')
