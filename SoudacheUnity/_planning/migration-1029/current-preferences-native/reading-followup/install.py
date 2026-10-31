from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent;root=p.parents[3]
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
receipt=json.loads((p/'receipt.json').read_text(encoding='utf-8'))
for name,value in receipt['productionBefore'].items():assert sha(root/name)==value,name
for name,value in receipt['source'].items():assert sha(root.parent/'搜打撤/game'/name)==value,name
candidate=p/'CardFace.cs.candidate'
assert sha(candidate)==receipt['candidate']
destination=root/'Assets/Scripts/Sdt.UI/Screens/Run/CardFace.cs'
destination.write_bytes(candidate.read_bytes())
assert sha(destination)==receipt['candidate']
result={'state':'installed and frozen; real native scroll verification remains pending','production':{'Assets/Scripts/Sdt.UI/Screens/Run/CardFace.cs':sha(destination)},'sourceShaUnchanged':True,'privateCandidateTypecheck':'exit 0; 0 errors; 10 existing warnings','native':'Root owns actual wheel, RaycastAll and scrollHandler proof'}
(p/'production-freeze.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
