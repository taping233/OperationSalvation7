import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = '1girl, solo, upper body, three-quarter view, leaning forward, outstretched arm, holding cards, smile, fang, looking at viewer, foreshortening, simple background'
scene = ('Her face sits in the upper-left third, her torso leans toward the viewer. '
    'Her extended hand fills the lower-right foreground, gripping the lower edges of exactly three blank ivory cards fanned apart. '
    'The three-card fan occupies one third of the frame width and overlaps her sleeve; all three separate top edges remain visible. '
    'Her other hand is cropped out. Her silver ponytail sweeps behind the left shoulder. '
    'A quiet dark blue-gray background with one broad muted teal sweep follows the diagonal from her face to the offered cards. '
    'The strongest light-dark edges concentrate on her face and the offering hand. No scenery, card symbols or floating objects.')
character = 'girl, pale skin, silver hair, long straight hair, high ponytail, parted bangs, cyan blue eyes, black round goggles on head, black rose hair ornament, blue ribbon bow at ponytail base, black gray off shoulder long sleeve dress, ruffled neckline, black waist belt'
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('white background, green eyes, wavy hair, curly hair, hair over one eye, low ponytail, blue sleeves, ornate clothes, fine hair strands, dense wrinkles, extra arms, floating cards, card text, card symbols')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/jianghu-class-redraw-20261010/jianghu-class.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='cmtn1wnhhym', model='nai-diffusion-4-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt=character, negative_prompt=uc,
    output=str(output), installed=False, design='无探身向镜头递出三张扇形临时卡牌；脸左上、递牌手右下，深蓝灰抽象背景。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, char_prompt=character, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
