import sys, json, hashlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tools'))
from nai_gen import generate_image, build_payload
from nai_prompt_clean import build_asset_prompt, build_uc

HERE=Path(__file__).parent
old=json.loads((HERE.parent/'career-nai45/request.json').read_text(encoding='utf-8'))['items']
outdir=ROOT.parent/'.tmp/nai/tt13-career-redraw-v2-20261020'
outdir.mkdir(parents=True,exist_ok=True)
specs=[
  ('Close upper-body view of a calm male occultist at image left. He holds his black-gloved right palm upward near center. A small red wax seal floats immediately above the palm. Exactly two black pawn-shaped soul tokens occupy the right half: one large token at lower right, one smaller token at upper right. A single crimson thread runs from the floating seal through the large token to the small token, visibly touching each token. One bright pulse travels along this connected thread. His face and glasses remain unobscured.',
   'adult man, yellow eyes, pointed ears, thin round eyeglasses, silver-gray long hair gathered into one low bun behind his head, long straight sidelocks, black bent-pointed wide-brim witch hat with purple underside, black high-collar robe, purple lining, simple gold trim, black gloves, a white feather with blue sapphire brooch clearly pinned to his left chest, restrained faint smile',
   'Quiet deep-indigo backdrop, broad calm color fields, purple and crimson accents, economical grouped anime shadows. One clear triangle of connected seal and two tokens, no extra tokens. Keep hat and chest brooch readable. Simplified card illustration, no scenery.',
   'extra pawns, multiple rows of tokens, white gloves, short hair, blue eyes, female, staff, intricate filigree'),
  ('Upper-body portrait of one serene priestess at image left, face turned slightly toward image right. Her own bare right hand rises naturally from her white sleeve at center. Exactly three dark-blue cards float above her fingertips at image right in a loose fan: one nearest bright star card, one dimmer echo card behind it on each side. All three card outlines are separate and clear. Her calm golden eyes look toward the cards. No detached hand or second person.',
   'adult woman, golden eyes, straight level bangs, pale blonde long hair styled asymmetrically into ONE single thick braid over her right shoulder, braid visible on image-left side, opposite shoulder has no braid, white crescent hairclip attached flat ABOVE THE BANGS ON IMAGE RIGHT at her left temple, white high-neck priestess dress, simple gold edging, deep teal short cape, black wrist cuffs, quiet neutral expression',
   'Horizontal anime card illustration. Portrait fills left half, one raised hand at center, three-card fan at right. Simple dark navy background, cyan star illumination, broad quiet color planes and coherent hair locks. One single braid and hairclip on image-right, no symmetric braids. Only one star is brightest, two faint echo stars.',
   'twin braids, twintails, symmetrical hairstyle, extra cards, many cards, detached hands, second person, lantern, silver hair, blue eyes, elaborate ornaments')
]
records=[]
for prior,(subject,identity,composition,negative) in zip(old,specs):
    prompt=build_asset_prompt(subject,purpose_layer='Japanese anime collectible card illustration, simplified cel-color masses, clear character identity and hand anatomy.',composition_layer=composition)
    chars=[dict(prompt=identity,uc='',center=dict(x=.28,y=.5))]
    payload=build_payload(prompt,build_uc(negative),seed=prior['payload']['parameters']['seed'],model='nai-diffusion-4-5-full',char_prompts=chars,use_coords=True)
    records.append(dict(card_id=prior['card_id'],name=prior['name'],status='prepared',payload=payload,output=str(outdir/(prior['card_id']+'.png')),previous_request='../career-nai45/request.json',reference_usage='Text-only NAI request; previously inspected authoritative portraits define identity, no image upload.'))
target=HERE/'request.json'
if target.exists():raise SystemExit('Request exists; preserve prior result')
def save():target.write_text(json.dumps(dict(status='preview-only-no-runtime-replacement',items=records),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save()
for record in records:
    p=record['payload'];record['status']='sending';save()
    try:
        file,seed=generate_image(p['input'],p['parameters']['negative_prompt'],seed=p['parameters']['seed'],model=p['model'],out=record['output'],char_prompts=p['parameters']['characterPrompts'],use_coords=True)
    except BaseException as error:
        record.update(status='failed',error=str(error));save();raise
    record.update(status='generated',sha256=hashlib.sha256(Path(file).read_bytes()).hexdigest());save()
    print('READY '+record['card_id'],flush=True)
