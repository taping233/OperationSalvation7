from pathlib import Path
import hashlib,json,os,shutil,subprocess,sys
from xml.sax.saxutils import escape
here=Path(__file__).resolve().parent
root=here.parents[2]
mode=sys.argv[1] if len(sys.argv)>1 else 'native'
frozen='--frozen' in sys.argv
snapshot=here/(mode+'-snapshot');snapshot.mkdir(exist_ok=True)
source=json.loads((here/'source-results.json').read_text(encoding='utf-8'))
for entry in source['sourceHashes']:
 current=root.parent/'搜打撤/game'/entry['file']
 assert hashlib.sha256(current.read_bytes()).hexdigest()==entry['sha256'], 'source changed; rerun source-oracle: '+entry['file']
files=['Sdt.Core/Cards.cs','Sdt.Core/CardsExtras.cs','Sdt.Core/Rng.cs','Sdt.Core/Battle/RuleValue.cs','Sdt.Core/Data/CardDatabase.cs','Sdt.Core/Data/CurrentBalanceData.cs']
hashes=[]
for relative in files:
 p=root/'Assets/Scripts'/relative;dest=snapshot/p.name
 if not frozen:shutil.copy2(p,dest)
 hashes.append({'file':str(p.relative_to(root)), 'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
shop=root/'Assets/Scripts/Sdt.UI/Screens/Run/ShopScreen.cs';code=shop.read_text(encoding='utf-8-sig')
begin=code.index('        public static System.Collections.Generic.List<ShopSlot> GenerateStock()');end=code.index('\n        string _shopNodeId;',begin)
slot=next(line.strip() for line in code.splitlines() if 'public sealed class ShopSlot ' in line)
under='using System;using System.Collections.Generic;using System.Linq;using Sdt.Core;using Sdt.Run;public class ShopScreen {\n'+slot+'\n'+code[begin:end]+'\n}'
if not frozen:(snapshot/'ShopUnderTest.cs').write_text(under,encoding='utf-8')
hashes.append({'file':str(shop.relative_to(root)),'sha256':hashlib.sha256(shop.read_bytes()).hexdigest(),'methodSha256':hashlib.sha256(code[begin:end].encode()).hexdigest()})
if not frozen:(here/(mode+'-hashes.json')).write_text(json.dumps(hashes,ensure_ascii=False,indent=2),encoding='utf-8')
sources=''.join(f'<Compile Include="{escape(str(p))}" />' for p in sorted(snapshot.glob('*.cs')))+f'<Compile Include="{escape(str(here/"Program.cs"))}" />'
project=here/(mode+'.csproj');project.write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><EnableNETAnalyzers>false</EnableNETAnalyzers><BaseIntermediateOutputPath>obj/'+mode+'/</BaseIntermediateOutputPath><OutputPath>bin/'+mode+'/</OutputPath></PropertyGroup><ItemGroup>'+sources+'</ItemGroup></Project>',encoding='utf-8')
(here/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'}
build=subprocess.run(['dotnet','build',str(project),'--nologo','-v','quiet','-p:UseSharedCompilation=false'],cwd=here,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
(here/(mode+'-compile.log')).write_text(build.stdout+build.stderr,encoding='utf-8')
if build.returncode:print(build.stdout+build.stderr);raise SystemExit(build.returncode)
subprocess.run(['dotnet',str(here/'bin'/mode/'net8.0'/(mode+'.dll')),mode],cwd=here,env=env,check=True)
native=json.loads((here/(mode+'-results.json')).read_text(encoding='utf-8'))
diff=[]
expected_ids=[r['id'] for r in source['rows']];actual_ids=[r['id'] for r in native['rows']]
assert len(expected_ids)==len(actual_ids), 'native/source row count differs'
assert len(expected_ids)==len(set(expected_ids)) and len(actual_ids)==len(set(actual_ids)), 'duplicate test ID'
assert expected_ids==actual_ids, 'native/source test IDs or order differs'
for expected,actual in zip(source['rows'],native['rows']):
 for key in ['id','stock','shaCloned','shaCloneIndependent','after','drops','afterDrops']:
  if expected[key]!=actual[key]:diff.append({'id':expected['id'],'field':key,'expected':expected[key],'actual':actual[key]})
summary={'mode':mode,'catalogEqual':native['catalogEqual'],'catalogChecks':native['catalogChecks'],'cases':len(native['rows']),'differences':len(diff),'caseDifferences':len({r['id'] for r in diff}),'fullStockMatches':sum(a['stock']==e['stock'] for a,e in zip(native['rows'],source['rows'])),'rngAfterMatches':sum(a['after']==e['after'] for a,e in zip(native['rows'],source['rows'])),'dropsAfterShopMatches':sum(a['drops']==e['drops'] for a,e in zip(native['rows'],source['rows'])),'afterDropsRngMatches':sum(a['afterDrops']==e['afterDrops'] for a,e in zip(native['rows'],source['rows']))}
(here/(mode+'-comparison.json')).write_text(json.dumps({'summary':summary,'diff':diff},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
raise SystemExit(0 if native['catalogEqual'] and all(native['catalogChecks'].values()) and not diff else 1)
