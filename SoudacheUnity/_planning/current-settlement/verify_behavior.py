from pathlib import Path
import subprocess,os
from xml.sax.saxutils import escape
HERE=Path(__file__).resolve().parent;ROOT=HERE.parent.parent;OUT=HERE/'behavior-check';OUT.mkdir(exist_ok=True)
vectors=subprocess.run(['node',str(HERE/'source_vectors.mjs')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',errors='replace');print(vectors.stdout+vectors.stderr);assert vectors.returncode==0
files=[HERE/'CurrentSettlementReceipt.cs',HERE/'GameRuntime.Settlement.cs',HERE/'SettlementHarness.cs',ROOT/'Assets/Scripts/Sdt.Core/Rng.cs']
jsondll=list((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[0]
sources=''.join(f'<Compile Include="{escape(str(p))}" />' for p in files)
project=OUT/'Behavior.csproj';project.write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><EnableDefaultCompileItems>false</EnableDefaultCompileItems><LangVersion>9</LangVersion><NoWarn>CS0649</NoWarn></PropertyGroup><ItemGroup>{sources}<Reference Include="Newtonsoft.Json"><HintPath>{escape(str(jsondll))}</HintPath></Reference></ItemGroup></Project>',encoding='utf-8')
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
result=subprocess.run(['dotnet','run','--project',str(project),'-p:UseSharedCompilation=false','--',str(HERE/'source-vectors.json')],capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
(OUT/'latest.log').write_text(result.stdout+result.stderr,encoding='utf-8');print(result.stdout+result.stderr);raise SystemExit(result.returncode)
