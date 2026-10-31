from pathlib import Path
import hashlib,json,datetime
here=Path(__file__).resolve().parent
root=here.parents[2]
native=['Assets/Scripts/Sdt.Run/SaveSystem.SlotArchive.cs','Assets/Scripts/Sdt.Run/SaveSystem.RunValidation.cs','Assets/Scripts/Sdt.Run/SaveSystem.cs','Assets/Scripts/Sdt.Run/AtomicJsonFile.cs','Assets/Scripts/Sdt.Run/GameRuntime.Settlement.cs','Assets/Scripts/Sdt.Run/GameRuntime.BattleCheckpoint.cs','Assets/Scripts/Sdt.UI/Screens/Menu/CurrentSlotArchiveScreen.cs','Assets/Scripts/Sdt.UI/Screens/Menu/CurrentSlotPage.cs','Assets/Scripts/Sdt.UI/Screens/Menu/CurrentSettingsDialogs.cs']
source=['src/hub/save-archive.js','src/hub/extraction.commands.js','src/ui/save-management.js','src/ui/menu-slots.js']
def record(p):return {'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
results=sorted((root/'_planning/migration-1030-fidelity/slot-archive').glob('data-run-*/result.json'),key=lambda p:p.stat().st_mtime)
observed=None
if results:
 result=json.loads(results[-1].read_text(encoding='utf-8-sig'))
 observed={**record(results[-1]),'passed':result['passed'],'testCount':len(result['tests']),'tests':result['tests'],'scope':result['scope'],'reviewerDidNotExecute':True}
output={'capturedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnlyProduction':True,'reviewerNoCompileNoUnityNoForeground':True,'native':[record(root/p) for p in native],'source':[record(root.parent/'搜打撤/game'/p) for p in source],'observedAuthorDataResults':observed}
(here/'slot-archive-fingerprints.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'native':len(native),'source':len(source),'observedAuthorTestCount':observed['testCount'] if observed else None,'archiveSha256':output['native'][0]['sha256']},ensure_ascii=False))
