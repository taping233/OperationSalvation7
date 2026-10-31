"""Compile the actual Boot settlement method in the domain harness; only logging is adapted."""
from pathlib import Path
import hashlib,json
here=Path(__file__).resolve().parent
root=here.parents[3]
source=root/'Assets/Scripts/Sdt.Boot/BattleBridge.cs'
code=source.read_text(encoding='utf-8')
start=code.index('        static int ToPocket(')
brace=code.index('{',start)
depth=1
end=brace+1
while depth:
    if code[end]=='{':depth+=1
    if code[end]=='}':depth-=1
    end+=1
method=code[start:end]
output='// Generated directly from GameBattleHost.ToPocket; do not edit.\nusing System.Collections.Generic;\nusing Sdt.Core;\nstatic class PocketSettlement {\n'+method+'''\npublic static int Apply(RunState state,List<string> uids,List<OwnedCard> spent,HashSet<string> moved)=>ToPocket(state,uids,"domain test",spent,moved);
}
static class RunLog { public static void Log(string message,string kind) {} }
'''
(here/'PocketSettlement.generated.cs').write_text(output,encoding='utf-8')
(here/'pocket-source-receipt.json').write_text(json.dumps({'source':str(source),'method':'GameBattleHost.ToPocket','sha256':hashlib.sha256(method.encode()).hexdigest(),'adapted':'logging only'},indent=2)+'\n',encoding='utf-8')
