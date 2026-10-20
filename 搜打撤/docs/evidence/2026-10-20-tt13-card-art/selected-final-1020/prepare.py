import json
from pathlib import Path

HERE=Path(__file__).parent
EVIDENCE=HERE.parent
def read(relative):return json.loads((EVIDENCE/relative).read_text(encoding='utf-8'))
original={i['card_id']:i for i in read('request.json')['items']}
styled={i['card_id']:i for i in read('original-style/request.json')['items']}
corrections={i['card_id']:i for i in read('corrections/request.json')['items']}
default={i['card_id']:i for i in read('default-style-reset/request.json')['items']}
three=read('stellar-three-cards/request.json')
items=[]
for cid in original:
    base=dict(styled[cid])
    if cid in ('tt13-spring','tt13-magazine'):
        base=dict(original[cid])
    if cid in ('tt13-guard','tt13-snipe','tt13-flame-staff'):
        selection=corrections[cid]
        base.update(source=selection['output'],prompt=selection['prompt'],references=selection['references'])
    if cid=='tt13-soul-contract':
        selection=default[cid]
        base.update(source=selection['output'],prompt=selection['prompt'],references=selection['references'])
    if cid=='tt13-stellar-divination':
        base.update(source=three['source'],prompt=three['prompt'],references=three['references'])
    if cid=='tt13-mercy':
        selection=read('career-nai45/mercy-selection.json')
        base=dict(original[cid])
        base.update(source=selection['retained'],selection_record='../career-nai45/mercy-selection.json')
    base['revision']='selected-final-20261020'
    if not Path(base['source']).is_file():raise SystemExit('Missing selected source: '+base['source'])
    if not base.get('prompt'):raise SystemExit('Missing prompt for '+cid)
    items.append(base)
target=HERE/'request.json'
if target.exists():raise SystemExit('Selected request exists; preserve it')
target.write_text(json.dumps(dict(status='authorized-installation',items=items),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Selected 13 sources with complete prompts; ready for import.')
