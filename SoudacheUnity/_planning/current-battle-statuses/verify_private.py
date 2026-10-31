from pathlib import Path
import os,subprocess,json,hashlib
from xml.sax.saxutils import escape
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent;OUT=HERE/'private-check';SNAP=OUT/'snapshot';OUT.mkdir(exist_ok=True)
files=[]
for source in (ROOT/'Assets/Scripts').rglob('*.cs'):
    if '/Editor/' in source.as_posix():continue
    dest=SNAP/source.relative_to(ROOT/'Assets/Scripts');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(source.read_bytes());files.append(dest)
refs=list(Path('D:/Unity/6000.6.7f1/Editor/Data/Managed/UnityEngine').glob('*.dll'))+[ROOT/'Library/ScriptAssemblies/UnityEngine.UI.dll']+list((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[:1]
compile=''.join(f'<Compile Include="{escape(str(p))}" />' for p in files);references=''.join(f'<Reference Include="{p.stem}"><HintPath>{escape(str(p))}</HintPath><Private>false</Private></Reference>' for p in refs)
project=OUT/'CurrentBattleStatusesCheck.csproj';project.write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><GenerateAssemblyInfo>false</GenerateAssemblyInfo><NoWarn>CS0618;CS0169;CS0414</NoWarn></PropertyGroup><ItemGroup>{compile}{references}</ItemGroup></Project>',encoding='utf-8');(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
paths=['src/battle/view/battle.status-chips.js','css/battle-status-chips.css','src/ui/status-icons.js','src/battle/core/combat.factory.js','src/battle/view/battle.layers.js','src/battle/view/battle.intent.view.js','src/battle/core/battle.enemy-intent.js','css/battle-stage.css','src/battle/view/battle.aim.js','src/battle/view/battle.piles.view.js','src/battle/effects/battle.target-rules.js']
paths+=['src/battle/runtime/battle.player-effects.js','src/battle/core/battle.snapshot-projection.domain.js','src/battle/runtime/battle.snapshot.js','src/battle/effects/effect-steps.m2.domain.js','src/battle/effects/card-semantic-operations.js','src/battle/core/battle.setup-mechanics.domain.js']
(HERE/'source-sha256.json').write_text(json.dumps({p:hashlib.sha256((ROOT.parent/'搜打撤/game'/p).read_bytes()).hexdigest() for p in paths},ensure_ascii=False,indent=2),encoding='utf-8')
result=subprocess.run(['dotnet','build',str(project),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'});output=result.stdout+result.stderr;(OUT/'latest.log').write_text(output,encoding='utf-8')
for line in output.splitlines():
    if 'error ' in line or 'Warning(s)' in line or 'Error(s)' in line:print(line)
raise SystemExit(result.returncode)
