import sys, json, hashlib, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'tools'))
from nai_gen import generate_image, build_payload
from nai_prompt_clean import build_asset_prompt, build_uc
from nai_style import RECIPE_VERSION

EVIDENCE = Path(__file__).parent
OUT = ROOT.parent / '.tmp/nai/tt13-career-redraw-20261020'
OUT.mkdir(parents=True, exist_ok=True)
definitions = [
    dict(id='tt13-soul-contract', name='灵魂契约',
         subject='1man, upper body, three-quarter view. A calm male occultist occupies the left half, looking toward a floating crimson contract seal held above his open right gloved palm at center. Two dark faceless pawn-shaped soul tokens float at different depths on the right. A taut red thread connects the central seal to both tokens; one bright pulse travels along the thread. The seal and connecting thread are the event center. Keep the face and glasses clearly visible, no objects covering the eyes.',
         composition='Horizontal card art. The magician is large in the left foreground, tokens smaller in the right background, clear separation between hand, seal and face. Quiet midnight-blue backdrop with no scenery, purple accents and a single focused crimson light. Simplified anime color planes, few coherent shadows, restrained highlights, no ornamental clutter.',
         character='adult man, silver-gray long hair tied into a low bun behind the head, two long sidelocks, yellow eyes, pointed ears, thin round eyeglasses, black wide-brimmed witch hat with a bent pointed crown and purple underside, black high-collar robe with purple lining and simple gold trim, black gloves, white feather and blue sapphire brooch on his left chest, composed faint smile',
         uc='staff, short hair, blue eyes, female protagonist, filigree, intricate engraving',
         authority='docs/character-bible/changwuyu.md'),
    dict(id='tt13-stellar-divination', name='星辰占卜',
         subject='1woman, upper body, three-quarter view. A serene priestess occupies the left half, looking down at three dark-blue fortune cards floating in a loose fan beside her raised right fingertips at center-right. The nearest card contains one bright white-cyan star, the two rear cards catch two fainter identical star reflections. Her raised hand connects naturally to her sleeve and body. Only the priestess and her own visible hand appear, no arm entering from the opposite edge.',
         composition='Horizontal card illustration. Face at upper left, fingertips at center, card fan at center-right; clear spaces between face, fingers and cards. Quiet deep-indigo background, soft cool starlight and muted warm skin. Simplified Japanese anime color planes, broad coherent hair locks and principal cloth folds, economical highlights, no detailed environment or dense tiny ornaments.',
         character='adult woman, pale blonde long hair, straight bangs, a long thick braid descending beside her shoulder, golden eyes, calm restrained expression, white crescent moon hairpin clipped flat into her hair just above the bangs on the viewer-right side, white priestess dress with simple gold edging, deep teal short cape, black wrist cuffs',
         uc='lantern, extra people, floating hands, detached arm, silver hair, blue eyes, ornate filigree',
         authority='docs/character-bible/xingyue.md'),
]
records=[]
for index, d in enumerate(definitions):
    prompt=build_asset_prompt(d['subject'], purpose_layer='Collectible game card illustration, Japanese anime, clear visual storytelling.', composition_layer=d['composition'])
    characters=[dict(prompt=d['character'], uc='', center=dict(x=.3,y=.5))]
    payload=build_payload(prompt,build_uc(d['uc']),model='nai-diffusion-4-5-full',char_prompts=characters,use_coords=True)
    records.append(dict(card_id=d['id'],name=d['name'],status='prepared',recipe_version=RECIPE_VERSION,authority=d['authority'],identity_reference=str(ROOT/'game/assets/portraits/full'/('changwuyu.webp' if index==0 else 'xingyue.webp')),reference_usage='Identity inspected locally; no image or vibe uploaded to NAI.',payload=payload,output=str(OUT/(d['id']+'.png'))))
request=EVIDENCE/'request.json'
if request.exists():
    raise SystemExit('Request already exists; preserve previous batch.')
def save():
    request.write_text(json.dumps(dict(status='preview-only-no-runtime-replacement',items=records),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
save()
selected=Path(r'C:/Users/太平/AppData/Local/Temp/codex-clipboard-86136ee5-2e08-4dc2-b199-351e7d8d9402.png')
selected_out=OUT/'mercy-user-selected.png'
shutil.copy2(selected,selected_out)
(EVIDENCE/'mercy-selection.json').write_text(json.dumps(dict(card_id='tt13-mercy',status='selected-only-not-installed',user_source=str(selected),retained=str(selected_out),sha256=hashlib.sha256(selected_out.read_bytes()).hexdigest(),selection='老板选定收刀白花版；取代本轮NPC候选。'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for record in records:
    p=record['payload']; record['status']='sending';save()
    try:
        file,seed=generate_image(p['input'],p['parameters']['negative_prompt'],seed=p['parameters']['seed'],model=p['model'],out=record['output'],char_prompts=p['parameters']['characterPrompts'],use_coords=True)
    except BaseException as e:
        record.update(status='failed',error=str(e));save();raise
    record.update(status='generated',sha256=hashlib.sha256(Path(file).read_bytes()).hexdigest());save()
    print('READY '+record['card_id'],flush=True)
