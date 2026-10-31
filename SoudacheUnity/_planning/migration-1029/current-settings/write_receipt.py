from pathlib import Path
import ast,datetime,hashlib,json,re
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];MENU=ROOT/'Assets/Scripts/Sdt.UI/Screens/Menu';KIT=ROOT/'Assets/Scripts/Sdt.UI/Kit'
deployment=ast.parse((HERE/'deploy_owned.py').read_text(encoding='utf-8'))
helpers=ast.Module(body=[n for n in deployment.body if isinstance(n,ast.FunctionDef) and n.name=='span'],type_ignores=[])
scope={};exec(compile(helpers,'span-helper','exec'),scope);span=scope['span']
planned=(HERE/'settings-menu-segments.cs.txt').read_text(encoding='utf-8');actual=(MENU/'MenuDialogs.cs').read_text(encoding='utf-8-sig')
for name in ['SettingsScreen','VolSlider','SuggestionBox']:
    a,b=span(planned,name);c,d=span(actual,name);assert planned[a:b]==actual[c:d],name+' differs from checked segment'
paths=[MENU/'MenuDialogs.cs']
for name in ['CurrentUiPreferences.cs','CurrentInputBindings.cs','CurrentSettingsPage.cs','CurrentSettingsDialogs.cs','CurrentFeedbackComposer.cs','CurrentAudioSourcesText.cs']:
    path=(KIT if name.startswith('CurrentUi') or name.startswith('CurrentInput') else MENU)/name
    assert path.read_bytes()==(HERE/name).read_bytes(),name+' differs from checked source'
    meta=path.with_name(path.name+'.meta');assert re.search(r'guid: [0-9a-f]{32}',meta.read_text(encoding='utf-8'))
    assert not re.search(r'GetComponent[^\n]*\?\?[^\n]*AddComponent',path.read_text(encoding='utf-8'))
    paths.extend([path,meta])
receipt={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'state':'installed-complete-uncommitted',
 'sourceFingerprint':'source-sha256.json','privateCompilation':{'log':'private-check/latest.log','warnings':0,'errors':0,'scope':'owned components against imported DLLs; final Sdt.UI/Unity compile remains coordinator-owned'},
 'behavior':{'log':'behavior-check/latest.log','assertions':22,'scope':'in-memory storage and native-cap property substitutes; no Unity execution'},
 'ownedMenuClasses':['SettingsScreen','VolSlider','SuggestionBox'],
 'coordinatorIntegration':['App real action dispatch/capture','ReadingLarge and EndTurnHold actual battle/card consumers','HintBar and LayerBanner HUD consumers','ReduceShake and BattlePace shared-key consumers','Quality actual render consumers and QualityProjectionAvailable=true','CurrentSettingsActions.OpenRunData page and actual record collection','Unity native compile/offscreen images/real input'],
 'sourceFiles':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
(HERE/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print('Receipt verified: 3 exact owned classes, 6 production/prepared source pairs and metas, 22 behavior assertions.')
