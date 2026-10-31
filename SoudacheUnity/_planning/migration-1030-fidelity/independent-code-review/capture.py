from pathlib import Path
import hashlib,json,datetime
here=Path(__file__).resolve().parent
root=here.parents[2]
native=['Assets/Scripts/Sdt.Run/GameRuntime.Persistence.cs','Assets/Scripts/Sdt.Run/GameRuntime.Commission.cs','Assets/Scripts/Sdt.Run/GameRuntime.ShopAcquisition.cs','Assets/Scripts/Sdt.Run/GameRuntime.cs','Assets/Scripts/Sdt.Run/SaveSystem.cs','Assets/Scripts/Sdt.Run/RunEvents.cs','Assets/Scripts/Sdt.UI/Screens/Run/ShopScreen.cs','Assets/Scripts/Sdt.UI/Screens/Run/CurrentShopCommission.cs','Assets/Scripts/Sdt.UI/Screens/Run/CurrentIllustratedDice.cs','Assets/Scripts/Sdt.UI/Screens/Run/CurrentShopView.cs','Assets/Scripts/Sdt.UI/Screens/Run/CurrentShopView.Detail.cs','Assets/Scripts/Sdt.UI/Screens/Run/CurrentShopView.Exchange.cs','Assets/Scripts/Sdt.UI/Screens/Run/CurrentNodeScene.cs','Assets/Scripts/Sdt.UI/Screens/Run/CurrentNodeElements.cs','Assets/Scripts/Sdt.UI/Screens/Menu/MenuDialogs.cs','Assets/Scripts/Sdt.UI/Screens/Menu/CurrentFeedbackComposer.cs','Assets/Scripts/Sdt.UI/Screens/Menu/CurrentLeavePage.cs','Assets/Scripts/Sdt.UI/Kit/App.cs','Assets/Scripts/Sdt.UI/Kit/UIKit.cs']
source=['src/run/game.run.shop.js','src/run/shop-commands.js','src/run/shop-commission.js','src/ui/event-dice.js','src/ui/overlay.js','src/core/run-checkpoint.js','src/ui/encounter-presentation.js','src/ui/menu-feedback.js','src/ui/dialog-surface.js','src/ui/input-isolation.js','css/event-dice.css']
record=lambda p:{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
manifest=json.loads((root/'_planning/migration-1030-fidelity/shop/production-freeze-manifest.json').read_text(encoding='utf-8-sig'))
freeze=[]
for entry in manifest['files']:
 p=root/entry['path'];actual=hashlib.sha256(p.read_bytes()).hexdigest();freeze.append({'path':entry['path'],'equalsFreeze':actual==entry['sha256'],'sha256':actual})
output={'capturedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnlyProduction':True,'noUnityNoCompileNoForeground':True,'native':[record(root/p) for p in native],'source':[record(root.parent/'搜打撤/game'/p) for p in source],'shopFreeze':freeze}
(here/'persistence-shop-commission-fingerprints.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'native':len(native),'source':len(source),'shopFreezeMatches':sum(e['equalsFreeze'] for e in freeze),'shopFreezeCount':len(freeze)},ensure_ascii=False))
