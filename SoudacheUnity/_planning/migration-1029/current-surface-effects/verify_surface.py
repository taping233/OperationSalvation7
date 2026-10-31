"""Source/metadata contract checks; an isolated C# build, never Unity or shared compile/."""
from pathlib import Path
from xml.sax.saxutils import escape
import hashlib, json, os, re, subprocess, sys, uuid
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
GAME=ROOT.parent/'搜打撤/game'
PRODUCTION=[
 'Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs',
 'Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentLayout.cs',
 'Assets/Scripts/Sdt.UI/Screens/Hub/HubCurrentHomeCard.cs',
 'Assets/Scripts/Sdt.UI/Screens/Hub/PreparationScreen.cs',
 'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentHomeAmbient.cs',
 'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentHomeMotion.cs',
 'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentHomeMaterials.cs',
 'Assets/Scripts/Sdt.UI/Screens/Menu/CreditsScreen.cs',
]+['Assets/Scripts/Sdt.UI/Screens/Menu/Resources/'+name+'.shader' for name in ['CurrentHomeGhost','CurrentHomeComposite','CurrentHomeScene','CurrentHomeSnow']]
SOURCES=['src/hub/hub.home-v3.js','css/base-home-v7.css','src/hub/preparation.view.js','css/preparation.css','src/ui/home-layers.js','css/home-layers.css','src/ui/home-fx.js','css/home-polish.css','src/ui/home-menu-motion.js','css/home-menu-motion.css','src/ui/title-wallpaper.js','css/title-p0.css','css/title-credits.css']
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def fingerprint(root,paths):return [{'path':p,'sha256':sha(root/p)} for p in paths]
checks=[]
def check(name,result):
 checks.append({'name':name,'passed':bool(result)})
 if not result:raise AssertionError(name)
text={p:(ROOT/p).read_text(encoding='utf-8-sig') for p in PRODUCTION}
layout=text[PRODUCTION[1]];hub=text[PRODUCTION[0]];prep=text[PRODUCTION[3]];ambient=text[PRODUCTION[4]]
check('flow root fills hosts without LayoutGroup', 'parent.GetComponent<LayoutGroup>()==null)Fill' in layout and layout.count('MountFlowRoot(box,parent)')==2)
check('intrinsic flow height is not overridden by zero', 'preferredHeight=-1' in layout)
check('home cards use intrinsic height, max-height and scroll', 'HomeCard(page' in hub and 'scroll.content=body' in hub and 'LayoutUtility.GetPreferredHeight' in text[PRODUCTION[2]])
check('tracked goals use header, three tracks and dashed spanning empty state', all(s in prep for s in ['prep-goals-head','for(int i=tracked.Count;i<3;i++)','Border(empty,true)','goal-copy','FitControl(button)']) and not re.search(r'收藏目标 {4,}',prep))
check('ghost has real alpha-edge stroke, not Outline geometry copies', 'high-low' in text[PRODUCTION[8]] and 'AddComponent<Outline>' not in ambient and 'CurrentHomeGhost' in ambient)
check('ghost keeps 180s motion and source linear centre mask', 'time/180' in ambient and all(s in text[PRODUCTION[8]] for s in ['sx-.30','sx-.64','/.12']))
check('screen, soft-light, backdrop and departure filters are consumers', all(s in text[PRODUCTION[9]] for s in ['softLight','_GrabTexture','_MaskMode']) and 'CurrentHomeScene' in text[PRODUCTION[5]] and 'SetDeparture' in ambient)
check('safe Unity component reuse',not any(re.search(r'GetComponent[^;\n]*\?\?[^;\n]*AddComponent',s) for s in text.values()))
for relative in PRODUCTION+['Assets/Scripts/Sdt.UI/Screens/Menu/Resources']:
 path=ROOT/relative;meta=Path(str(path)+'.meta')
 if not meta.exists():
  guid=uuid.uuid5(uuid.NAMESPACE_URL,relative).hex
  extra='folderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n' if path.is_dir() else ('ShaderImporter:\n  externalObjects: {}\n  defaultTextures: []\n  nonModifiableTextures: []\n  preprocessorOverride: 0\n' if path.suffix=='.shader' else '')
  meta.write_text('fileFormatVersion: 2\nguid: '+guid+'\n'+extra,encoding='utf-8')
check('all owned assets have Unity metadata',all(Path(str(ROOT/p)+'.meta').exists() for p in PRODUCTION))
receipt={'sources':fingerprint(GAME,SOURCES),'production':fingerprint(ROOT,PRODUCTION),'checks':checks,'nativeVerification':'pending root Unity shader import, fresh captures and real input; this script never starts Unity'}
(HERE/'source-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if '--compile' in sys.argv:
 out=HERE/'compile-private';out.mkdir(exist_ok=True)
 # Snapshot the home/base surface and its existing local layout dependencies. Other screens
 # and game assemblies remain references; their concurrent work is outside this check.
 ui=ROOT/'Assets/Scripts/Sdt.UI'
 files=sorted(p for p in (ui/'Screens/Hub').glob('*.cs') if p.name.startswith('Hub') or p.name in ['CourtyardScreen.cs','PreparationScreen.cs'])
 files+=sorted((ui/'Screens/Menu').glob('CurrentHome*.cs'))
 files += [ui/'Screens/Menu'/name for name in ['TitleScreen.cs','CreditsScreen.cs']]
 files += [ui/'Kit/UIKit.cs',ui/'Screens/Run/DepartureElements.cs',ROOT/'Assets/Scripts/Sdt.Res/CurrentHomeAssets.cs']
 before={str(p.relative_to(ROOT)):sha(p) for p in files}
 sources=[]
 for p in files:
  snapshot=out/'snapshot'/p.relative_to(ROOT);snapshot.parent.mkdir(parents=True,exist_ok=True);snapshot.write_bytes(p.read_bytes());sources.append(snapshot)
 editor=Path(os.environ.get('SDT_UNITY_EDITOR','D:/Unity/6000.6.7f1/Editor'))
 refs=list((editor/'Data/Managed/UnityEngine').glob('*.dll'))+list((ROOT/'Library/ScriptAssemblies').glob('Sdt.*.dll'))+[ROOT/'Library/ScriptAssemblies/UnityEngine.UI.dll']
 refs+=list((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[:1]
 assert all(p.exists() for p in refs)
 compile_items=''.join(f'<Compile Include="{escape(str(p))}" />' for p in sources)
 ref_items=''.join(f'<Reference Include="{escape(p.stem)}"><HintPath>{escape(str(p))}</HintPath><Private>false</Private></Reference>' for p in refs)
 project=out/'SurfaceCheck.csproj'
 project.write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><AssemblyName>SurfaceCheck</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems><GenerateAssemblyInfo>false</GenerateAssemblyInfo><DefineConstants>UNITY_6000_6_OR_NEWER;UNITY_EDITOR</DefineConstants><NoWarn>CS0436;CS0618;CS0169;CS0414</NoWarn></PropertyGroup><ItemGroup>{compile_items}{ref_items}</ItemGroup></Project>',encoding='utf-8')
 (out/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
 result=subprocess.run(['dotnet','build',str(project),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
 output=result.stdout+result.stderr;(out/'latest.log').write_text(output,encoding='utf-8')
 after={str(p.relative_to(ROOT)):sha(p) for p in files}
 receipt['compile']={'exitCode':result.returncode,'files':len(files),'inputsStable':before==after,'sourceSnapshot':before,'log':'compile-private/latest.log'}
 errors=list(dict.fromkeys(line for line in output.splitlines() if 'error ' in line))
 for line in errors[:12]+[line for line in output.splitlines() if 'Warning(s)' in line or 'Error(s)' in line or 'Time Elapsed' in line]:print(line)
 (HERE/'source-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 if result.returncode:raise SystemExit(result.returncode)
print(json.dumps({'checks':len(checks),'passed':all(c['passed'] for c in checks),'production':len(PRODUCTION),'native':'pending'},ensure_ascii=False))
