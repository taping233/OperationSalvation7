"""老板认可外观但否决旧构图；先出一张新NAI全身分镜，不进入内置阶段。"""
import hashlib
import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

EVIDENCE = Path(__file__).resolve().parent
tags = (
    '1girl, solo, calm expression, closed mouth, looking at viewer, shadow, claws, '
    'magic, dark background, from below, full body, standing, arm up, open hand'
)
character = (
    'girl, young adult woman, delicate composed anime face, purple eyes, '
    'very pale low-saturation golden hair with faint warm ivory undertone, '
    'straight dense bangs with a nearly even edge above brows, smooth rounded crown, '
    'two long straight sidelocks framing cheeks, low side braid gathered behind neck, '
    'dark black-indigo crescent hairclip above bangs on viewer-right, '
    'black-gray high-collared priestess long robe, muted purple short cape '
    'with restrained gold trim, black gloves, dark short boots'
)
scene = (
    'Character 1 stands in a turning three-quarter pose, with the near boot '
    'pinning the edge of her own long shadow on a single abstract plane. '
    'The rest of that shadow rises diagonally into an immense black-violet '
    'demonic claw behind and beside her. Her raised open palm meets one broad '
    'finger of that claw, as though calmly accepting power from a much greater '
    'presence. Her other arm rests near the hip instead of pressing her chest. '
    'A thin restrained dark-red line connects the dim glow near her heart to '
    'the palm contact point, suggesting a cost while the large black claw '
    'gathers power. Her face remains unmoved: relaxed brows, steady eyes and '
    'a small neutral closed mouth. The cape sweeps opposite the raised arm '
    'and the low braid follows the shoulder turn. '
    'Show the complete connected figure from hair to both grounded boots. '
    'Her face, palm contact and pinned shadow form one upward diagonal. '
    'The close dark claw creates scale and foreground overlap without covering '
    'her face. Surround them with quiet subdued charcoal, desaturated violet '
    'and a small deep-burgundy abstract field, choosing value separation so '
    'the black robe, claw, pale face and hair remain distinct. '
    'The demonic presence is a single abstract claw, not another humanoid body.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc(
    'boy, male, bright yellow hair, orange hair, honey gold hair, metallic gold hair, '
    'side-swept bangs, fluffy crown, braided crown, horns on character, '
    'white priestess dress, teal cape, white background, pastel background, '
    'wicked grin, evil smirk, angry expression, exaggerated expression, '
    'lamp, lantern, staff, sword, held orb, blood, wound, gore, full demon body, '
    'multiple people, white border, inset illustration, detached torso, '
    'cropped feet, contact sheet, character sheet'
)
output = PROJECT.parent / '.tmp/nai/output/demon-darkform-20261010/demon-storyboard-fullbody.png'
if output.exists():
    raise SystemExit('新构图草稿已存在，停止重复请求。')
seed = build_payload(prompt, seed=None)['parameters']['seed']
request = {'card_id': 'cc-demon', 'model': 'nai-diffusion-5-full',
           'width': 1024, 'height': 1024, 'seed': seed, 'parameters': DEFAULTS,
           'prompt': prompt, 'character_prompt': character, 'negative_prompt': uc,
           'stage': '只生成新NAI分镜，等待老板评价，不进入内置重绘',
           'design': '低机位全身，靴踏影子，抬手与巨大影爪碰掌，远手收侧，心口暗红细流连到接触点。',
           'identity_source': '老板最新认可禁咒式直刘海/低侧辫/极浅淡金可见颜色、不动声色暗牧',
           'output': str(output)}
(EVIDENCE / 'nai-new-storyboard-request.json').write_text(
    json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, actual_seed = generate_image(prompt, uc, char_prompt=character, width=1024,
                                   height=1024, seed=seed, out=output, model=request['model'])
result = Path(path)
(EVIDENCE / 'nai-new-storyboard-receipt.json').write_text(json.dumps({
    'path': str(result), 'model': request['model'], 'seed': actual_seed,
    'bytes': result.stat().st_size, 'sha256': hashlib.sha256(result.read_bytes()).hexdigest(),
    'installed': False,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
