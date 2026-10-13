import hashlib
import json
import sys
from pathlib import Path

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from nai_gen import generate_image, build_payload, DEFAULTS
from nai_prompt_clean import build_asset_prompt, build_uc

tags = 'no humans, spear, armor, broken armor, extreme close-up, foreshortening, dutch angle, simple background'
scene = (
    'Show the instant a spear forces through armor, viewed from almost against the newly torn exit rim. '
    'The puncture sits slightly left of center and is the brightest, sharpest local contrast in the entire image. '
    'A huge dark curved armor surface fills the left and bottom edges and continues beyond all those frame boundaries; its complete outline is never visible. '
    'At the opening, two thick metal lips are bending toward the camera, a narrow white exposed edge beside a deep black cavity. '
    'One connected steel spearhead emerges from that opening, projecting diagonally toward the lower-right foreground. '
    'The nearer blade is much broader than its receding base: the tip is close to the lens, while the socket is partly occluded by the torn rim. '
    'The point reaches the lower-right edge; show only the short section of shaft immediately behind the opening, exiting the upper-left crop. '
    'Keep the main blade planes muted cold silver and blue-gray so their large area never outshines the small bright impact edge. '
    'A small deep-crimson slash follows the torn rim as a symbolic fatal-wound accent. '
    'A partially cropped short red tassel behind the socket trails backward toward upper-left, secondary to the piercing contact. '
    'Two large nearby torn pieces are pushed apart from the opening, one in front of the shaft and one behind the blade, with overlap and different scales showing depth. '
    'Keep them close to the impact instead of decorating distant empty space with floating debris. '
    'Broad gray-blue and dirty ivory diagonal background swipes converge toward the opening and continue off-frame. '
    'Fill the square with this close action; the abstract background appears only through gaps between the cropped armor, spear and fragments. '
    'The image reads first as a violent concentrated puncture, then as the thrust direction, and only then as metal material. '
    'No separate rectangular background panel, blank margin, displayed complete weapon, intact freestanding armor shell or visible warrior.'
)
prompt = build_asset_prompt(tags, composition_layer=scene)
uc = build_uc('people, hands, face, body, gore, organs, blood spray, multiple spears, sword, ornate weapon, particle cloud, detailed scenery, white border, rectangular background panel, full weapon, still life, text, watermark, frame, collage')
seed = build_payload(prompt, seed=None)['parameters']['seed']
output = PROJECT.parent / '.tmp/nai/output/fatal-pierce-20261010/fatal-pierce-v2.png'
if output.exists():
    raise SystemExit('Output already exists; stop')
request = dict(card_id='tt3-fatal-pierce', model='nai-diffusion-5-full', width=1024, height=1024,
    seed=seed, parameters=DEFAULTS, prompt=prompt, character_prompt='', negative_prompt=uc,
    output=str(output), installed=False, design='贴近穿透出口；甲面与枪杆出框，破口最强明暗，枪头前大后小，背景斜面与甲片汇向发生点。',
    decision='老板认可对照格挡/血箭/处决的分镜结论：从道具陈列改为穿透瞬间，先修构图再修笔触。')
(EVIDENCE / 'nai-request.json').write_text(json.dumps(request, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(EVIDENCE / 'prompt.md').write_text('# 致命穿刺 · 贴近穿透点\n\n' + request['design'] + '\n\nPrompt:\n```text\n' + prompt + '\n```\n\nUC:\n```text\n' + uc + '\n```\n', encoding='utf-8')
path, seed = generate_image(prompt, uc, width=1024, height=1024, seed=seed, out=output, model=request['model'])
source = Path(path)
(EVIDENCE / 'nai-receipt.json').write_text(json.dumps(dict(path=str(source), seed=seed,
    model=request['model'], bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    installed=False), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(str(source), flush=True)
