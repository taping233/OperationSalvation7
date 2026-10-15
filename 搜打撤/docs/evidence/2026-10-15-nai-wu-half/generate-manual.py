"""One candidate using the user-selected September manual; no default changes."""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import nai_gen

out = ROOT.parent / '.tmp/nai/wu-half-20261015/wu-half-manual.png'
assert not out.exists(), 'Candidate exists; do not overwrite or regenerate.'
style_path = ROOT / 'tools/nai_style.py'
style_sha = hashlib.sha256(style_path.read_bytes()).hexdigest()
prompt = ('1.2::miv4t::, 0.8::quasarcake::\n\n'
          '1girl, solo, waist-up character portrait, white background, looking at viewer, '
          'head and hair accessories fully inside the frame, crop at waist.\n\n'
          'Silver-white hair in a high ponytail tied with a blue satin bow, parted bangs '
          'revealing both cyan-blue eyes, pale skin, confident smile showing a small fang. '
          'Ordinary black round sunglasses rest on her head. A black rose hair ornament '
          'is attached beside her left temple, on the right side of the image. '
          'Black-gray off-shoulder long-sleeved dress with layered ruffles and a black waist tie. '
          'A black straight sword stays sheathed diagonally on her back, fixed by a black strap. '
          'Its wrapped grip and angular pommel rise behind her right shoulder, on the left '
          'side of the image. Her arms rest at her sides.\n\n'
          'Her extremely long white hair is drawn with fine individual strands, and several '
          'thin locks dissolve into flowing line work against the background. '
          'limited palette, blue theme, flat color, film grain')
uc = ('lowres, worst quality, low quality, jpeg artifacts, blurry, bad anatomy, bad hands, '
      'extra digits, fewer digits, extra fingers, missing fingers, malformed hands, fused fingers, '
      'extra limbs, extra arms, extra legs, deformed, mutated, disfigured, bad proportions, long neck, '
      'distorted face, ugly, text, watermark, signature, logo')
record = dict(recipe_version='manual-20260913-candidate', prompt=prompt, uc=uc,
              artist_chain='1.2::miv4t::, 0.8::quasarcake::', model=nai_gen.MODEL,
              seed=15102027, width=832, height=1216, parameters=nai_gen.DEFAULTS,
              source_manual='C:/Users/太平/xwechat_files/wxid_l4rna79xolo712_c0f8/msg/file/2026-09/NovelAI生图功能手册-AI接手版.md',
              identity_source='docs/character-bible/wu.md; game/assets/portraits/full/wu.webp',
              references_uploaded=[], output=str(out), default_style_sha256=style_sha,
              default_style_modified=False, status='prepared')
receipt = HERE / 'request-manual.json'
receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print('Manual portrait recipe prepared; default style unchanged.', flush=True)
if '--generate' in sys.argv:
    path, seed = nai_gen.generate_image(prompt, uc, width=832, height=1216,
                                      seed=record['seed'], model=record['model'], out=out)
    assert hashlib.sha256(style_path.read_bytes()).hexdigest() == style_sha
    record.update(status='generated', sha256=hashlib.sha256(Path(path).read_bytes()).hexdigest())
    receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
