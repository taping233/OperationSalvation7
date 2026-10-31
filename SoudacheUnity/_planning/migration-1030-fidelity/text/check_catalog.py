from pathlib import Path
import re,json,hashlib
root=Path(__file__).resolve().parents[3]
here=Path(__file__).resolve().parent
vectors=json.loads((here/'copy-vectors.json').read_text(encoding='utf-8'))
source={c['id']:c for c in vectors['cards']}
catalog={}
path=root/'Assets/Scripts/Sdt.Core/Data/CardDatabase.cs'
for line in path.read_text(encoding='utf-8-sig').splitlines():
    if not line.strip().startswith('new CardDef {'): continue
    fields={}
    for key,value in re.findall(r'(\w+)=("(?:\\.|[^"\\])*"|-?\d+|true|false|null)',line):
        try: fields[key]=json.loads(value)
        except json.JSONDecodeError: pass
    if 'id' in fields: catalog[fields['id']]=fields
fields=['name','desc','type','rarity','cost','dmg','heal','armor','draw','infuse','cls','dmgType']
differences=[]
for key,card in source.items():
    actual=catalog.get(key)
    if actual is None: differences.append({'id':key,'missing':True});continue
    for field in fields:
        default=0 if field in ['cost','dmg','heal','armor','draw','infuse'] else None
        if card.get(field,default)!=actual.get(field,default): differences.append({'id':key,'field':field,'source':card.get(field,default),'actual':actual.get(field,default)})
fresh=json.loads((here/'fresh-presentation-data.json').read_text(encoding='utf-8'))
installed_path=root/'Assets/Resources/Art/CurrentPhoto/descriptions.json'
installed=json.loads(installed_path.read_text(encoding='utf-8-sig'))
result={'sourceCards':len(source),'generatedCards':len(catalog),'comparedFields':fields,'differences':differences,'presentationDataMatches':fresh==installed,
        'generatedSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'presentationDataSha256':hashlib.sha256(installed_path.read_bytes()).hexdigest()}
(here/'catalog-comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:result[k] for k in ['sourceCards','generatedCards','presentationDataMatches','differences']},ensure_ascii=True))
raise SystemExit(0 if not differences and fresh==installed else 2)
