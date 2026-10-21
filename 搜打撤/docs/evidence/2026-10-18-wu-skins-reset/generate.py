import sys, json, hashlib, shutil
from pathlib import Path
from PIL import Image

evidence = Path(__file__).resolve().parent
project = evidence.parents[2]
workspace = project.parent
sys.path.insert(0, str(project / 'tools'))
import nai_gen
from nai_prompt_clean import build_prompt, build_uc

local = workspace / '.tmp/nai/wu-skins-reset-1018'
local.mkdir(parents=True, exist_ok=True)
identity = 'adult woman, mature adult proportions, silver white long hair, high ponytail, parted bangs, both cyan blue eyes visible, blue satin ribbon bow, fair skin, confident relaxed smile, small fang'
items = [
    dict(id='casual', name='春日·机车', asset='portraits/full/wu-casual-v14.webp',
         character=identity + ', black round sunglasses worn on nose, black rose hair ornament, cobalt blue oversized long sleeve shirt with rolled cuffs, black shorts, black lace-up ankle boots',
         scene='Spring afternoon beside a modern city park. The woman sits sideways on the seat of a parked black classic motorcycle facing left; one bent knee rests near the fuel tank, the other leg descends naturally beside the motorcycle. One hand rests by her shorts pocket, the other steadies her on the saddle. She looks toward camera with a confident smile. Large black motorcycle with coherent round headlamp, fuel tank, engine, aligned front and rear wheels, readable handlebars. Pink cherry blossom branches frame upper left, fresh green trees and quiet contemporary urban shapes in distance. Clear blue daylight, petals as sparse accents. Full figure and motorcycle inside landscape canvas, adult character large at center-right, face and hands readable; coherent limbs and practical seated balance.'),
    dict(id='spring', name='新春·旗袍', asset='portraits/full/wu-spring-v15.webp',
         character=identity.replace('blue satin ribbon bow','red satin ribbon bow') + ', red plum blossom hairpin, long red qipao with gold piping, long sleeves with gold cuffs, modest side slit, black embroidered flat shoes',
         scene='Lunar new year winter tea scene. The woman sits elegantly on a dark simple chair at center-right, right hand holds a small blue porcelain teacup just below her mouth, left hand rests on her knee; cup and fingers clearly separated from face. Ankles crossed naturally, feet supported near floor. Red and gold long qipao drapes over seated legs, dress has coherent tension and gravity, no excessive embroidery. A dark small side table holds one porcelain teapot and spare cup; red draped cloth trails beside it. Large geometric window and a snow-covered plum courtyard at left, two red lanterns above, scattered red plum blossoms. Cool winter daylight against warm red silk. Balanced landscape composition, character face remains prominent, scene fills edges, intimate calm festive atmosphere.'),
    dict(id='beach', name='盛夏·水枪', asset='portraits/full/wu-beach.webp',
         character=identity + ', navy blue one-piece athletic swimsuit with sparse white stars, open white lightweight jacket loosely around shoulders and arms',
         scene='Bright summer seaside. Adult woman sits sideways on the edge of a clean wooden pier at center-right, torso turns toward camera with a cheerful confident fang smile. Her left hand rests flat on pier supporting her weight, right hand holds a small orange and white plastic toy water gun upright near shoulder, a visibly harmless recreational water toy. Two legs extend naturally toward left with one knee bent slightly; one foot makes a small splash in turquoise water. Normal limb proportions, no foreground body-part closeup. Silver ponytail arcs behind her, blue bow, jacket has believable draped folds. Clear blue sky with grouped white clouds, far modern coastal city and mountains, a few palm fronds framing upper-right. Luminous cyan sea and warm ochre boards, one coherent sunlight direction, person is central focal point. Tasteful nonsexual adult summer recreation, full landscape vignette, entire figure readable.'),
]

receipt = evidence / 'request.json'
assert not receipt.exists(), 'Existing batch receipt; do not replay.'
record = dict(status='prepared', pipeline='NAI V5 Full free-size drafts then built-in redraw', items=[])
manifest = json.loads((project / 'game/assets/asset-manifest.json').read_text(encoding='utf-8'))
for item in items:
    target = project / 'game/assets' / item['asset']
    before = local / (item['id'] + '-before.webp')
    assert not before.exists()
    shutil.copy2(target, before)
    prompt = build_prompt('1girl, solo, adult woman, game character skin scene illustration, highly detailed face and hands.', item['scene'])
    uc = build_uc('child, teen, loli, nude, erotic, underwear, extra legs, extra feet, broken limbs, goggles, text, logo, fisheye, giant foreground foot')
    chars = [dict(prompt=item['character'], uc='child, teen, goggles', center=dict(x=.60, y=.50))]
    payload = nai_gen.build_payload(prompt, uc, width=1152, height=896, char_prompts=chars)
    entry = dict(item, status='prepared', before=str(before.relative_to(workspace)), beforeSha256=hashlib.sha256(before.read_bytes()).hexdigest(), nai=str((local / (item['id'] + '-nai.png')).relative_to(workspace)), request=payload)
    record['items'].append(entry)

def save(): receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
save()
for entry in record['items']:
    payload = entry['request']
    try:
        path, seed = nai_gen.generate_image(payload['input'], payload['parameters']['negative_prompt'], width=1152, height=896, seed=payload['parameters']['seed'], char_prompts=[dict(prompt=entry['character'], uc='child, teen, goggles', center=dict(x=.60,y=.50))], out=str(workspace / entry['nai']))
    except BaseException as error:
        entry.update(status='failed', errorType=type(error).__name__)
        record['status']='partial'
        save()
        raise
    entry.update(status='nai-generated', seed=seed, naiSha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    save()
record['status']='nai-generated'
save()
