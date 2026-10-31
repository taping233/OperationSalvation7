from pathlib import Path
import hashlib,json,subprocess,os
from xml.sax.saxutils import escape
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent;SOURCE=ROOT.parent/'搜打撤/game';OUT=HERE/'private-check';SNAP=OUT/'snapshot';OUT.mkdir(exist_ok=True)
def schema(path,text):
    if path.name=='GameRuntime.cs' and 'public int PocketKept,PocketLost,PocketRuleLost;' not in text:
        text=text.replace('public bool Done;','public List<StashStack> SavedCards = new List<StashStack>(), KeptPocket = new List<StashStack>();\n        public int PocketKept,PocketLost,PocketRuleLost; public SettlementReceipt Receipt; public RunGrowthReceipt Growth;\n        public bool Done;',1)
        text=text.replace('public int SavedN;','public int SavedN; public SettlementReceipt Receipt; public RunGrowthReceipt Growth;',1)
        text=text.replace('public int BroughtN, KeptN, Coins;','public int BroughtN, KeptN, Coins; public SettlementReceipt Receipt;',1)
    if path.name=='SaveSystem.cs' and 'public int sourceIdentityVersion,requestSeq,totalPocketCount,lostPocketCount;' not in text:text=text.replace('public AbandonResult abandon;','public AbandonResult abandon;\n        public int sourceIdentityVersion,requestSeq,totalPocketCount,lostPocketCount;\n        public List<StashStack> keptPocket = new List<StashStack>();\n        public RunGrowthReceipt growth; public SettlementReceipt receipt;',1)
    if path.name=='MenuDialogs.cs':
        start=text.index('    public sealed class LeaveMenuScreen : Panel');end=text.index('    // ============================================================\n    // 现行试玩反馈',start)
        text=text[:start]+(HERE/'menu-segments.cs.txt').read_text(encoding='utf-8')+text[end:]
    return text
copies=[]
for source in (ROOT/'Assets/Scripts').rglob('*.cs'):
    if '/Editor/' in source.as_posix():continue
    dest=SNAP/source.relative_to(ROOT/'Assets/Scripts');dest.parent.mkdir(parents=True,exist_ok=True)
    draft=HERE/source.name
    text=draft.read_text(encoding='utf-8-sig') if draft.exists() else source.read_text(encoding='utf-8-sig')
    dest.write_text(schema(source,text),encoding='utf-8');copies.append(dest)
for name,domain in [('CurrentSettlementReceipt.cs','Sdt.Run'),('CurrentSettlementView.cs','Sdt.UI/Screens/Run'),('CurrentExtractionPage.cs','Sdt.UI/Screens/Run'),('CurrentSettlementReport.cs','Sdt.UI/Screens/Run'),('CurrentLeavePage.cs','Sdt.UI/Screens/Menu')]:
    draft=HERE/name
    if draft.exists() and not (ROOT/'Assets/Scripts'/domain/name).exists():
        dest=SNAP/domain/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(draft.read_bytes());copies.append(dest)
refs=list(Path('D:/Unity/6000.6.7f1/Editor/Data/Managed/UnityEngine').glob('*.dll'))+[ROOT/'Library/ScriptAssemblies/UnityEngine.UI.dll']+list((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[:1]
sources=''.join(f'<Compile Include="{escape(str(p))}" />' for p in copies);references=''.join(f'<Reference Include="{escape(p.stem)}"><HintPath>{escape(str(p))}</HintPath><Private>false</Private></Reference>' for p in refs)
project=OUT/'CurrentSettlementCheck.csproj';project.write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><GenerateAssemblyInfo>false</GenerateAssemblyInfo><NoWarn>CS0618;CS0169;CS0414</NoWarn></PropertyGroup><ItemGroup>{sources}{references}</ItemGroup></Project>',encoding='utf-8')
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
sources=['src/hub/extraction.commands.js','src/ui/extraction-rewards-view.js','src/ui/extraction-stash-update.js','src/ui/settlement-report.js','src/ui/terminal-settlement.js','src/ui/menu-leave.js','src/run/game.run.altar.js','src/run/game.session.death.js','src/run/run-memento.js','src/ui/run-memento-view.js','src/hub/terminal.commands.js','src/hub/run-rescue-cards.js','src/hub/stored-card-identity.js','css/extraction-rewards.css','css/settlement-report.css','css/leave-run.css','css/run-memento.css','css/run-experience.css','src/core/rule-config.js']
(HERE/'source-sha256.json').write_text(json.dumps({p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest() for p in sources},ensure_ascii=False,indent=2),encoding='utf-8')
result=subprocess.run(['dotnet','build',str(project),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
(OUT/'latest.log').write_text(result.stdout+result.stderr,encoding='utf-8')
for line in (result.stdout+result.stderr).splitlines():
    if 'error ' in line or 'Warning(s)' in line or 'Error(s)' in line:print(line)
raise SystemExit(result.returncode)
