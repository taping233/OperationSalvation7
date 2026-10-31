from pathlib import Path
import re,json,hashlib
ROOT=Path(__file__).resolve().parents[3]
source=ROOT.parent/'搜打撤/game/src/cards/builtin-card-identities.js'
raw=source.read_text(encoding='utf-8');body=raw.split('Object.freeze([',1)[1].split(']);',1)[0]
ids=json.loads('['+body.strip().rstrip(',')+']')
target=ROOT/'Assets/Scripts/Sdt.Core/Battle/BuiltinCardIdentities.cs'
rows=[', '.join(json.dumps(value) for value in ids[i:i+6])+',' for i in range(0,len(ids),6)]
target.write_text('// Generated directly from current cards/builtin-card-identities.js.\nusing System.Collections.Generic;\nnamespace Sdt.Core.Battle {\n public static class BuiltinCardIdentities {\n  static readonly HashSet<string> Ids=new HashSet<string>{\n'+''.join('   '+line+'\n' for line in rows)+'  };\n  public static bool IsExecutable(CardDef card)=>card!=null&&card.id!=null&&Ids.Contains(card.id);\n  public static bool OwnsExecution(CardDef card)=>IsExecutable(card)&&card.rules!=null&&(card.rules.Get("battle")?.Items("hosted").Length??0)==0;\n }\n}\n',encoding='utf-8')
(ROOT/'_planning/migration-1029/current-integration/card-identities.json').write_text(json.dumps({'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'count':len(ids)},indent=2),encoding='utf-8')
print('Synchronized '+str(len(ids))+' current executable identities')
