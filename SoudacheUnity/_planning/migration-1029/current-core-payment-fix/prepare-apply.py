from pathlib import Path
import difflib,json,hashlib
p=Path(__file__).parent;root=p.parents[2]
files={}
for name in ['BattleSession.cs','StructuredRules.cs','BattleRules.cs','BattlePlayerEffects.cs','BattleHandPayment.cs','BattleRuleConsumers.cs']:files['Assets/Scripts/Sdt.Core/Battle/'+name]=p/'snapshot/Battle'/name
for name in ['BattleScreen.cs','BattlePresentation.cs','BattleRuleInputs.cs','BattleEvents.cs','BattleFx.cs']:files['Assets/Scripts/Sdt.UI/Screens/Battle/'+name]=p/'ui'/name
for name in ['BattleBridge.cs','BattleViewApi.cs']:files['Assets/Scripts/Sdt.Boot/'+name]=p/'ui'/name
manifest=[];diff=[]
for rel,draft in files.items():
 target=root/rel;old=target.read_text(encoding='utf-8-sig') if target.exists() else '';new=draft.read_text(encoding='utf-8-sig');a=old.splitlines(keepends=True);b=new.splitlines(keepends=True)
 hunks=[]
 for group in difflib.SequenceMatcher(None,a,b,autojunk=False).get_grouped_opcodes(3):
  hunks.append({'old':''.join(a[group[0][1]:group[-1][2]]),'new':''.join(b[group[0][3]:group[-1][4]])})
 manifest.append({'path':rel,'existed':target.exists(),'hunks':hunks,'new':new if not target.exists() else None})
 diff.extend(difflib.unified_diff(a,b,fromfile=rel,tofile=rel))
(p/'apply-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');(p/'production.patch').write_text(''.join(diff),encoding='utf-8')
print('Prepared',len(manifest),'production files;',sum(len(m['hunks']) for m in manifest),'context guarded hunks')
