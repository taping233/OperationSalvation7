from pathlib import Path
import subprocess,os
from xml.sax.saxutils import escape
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=HERE/'domain-check';OUT.mkdir(exist_ok=True)
SNAP=HERE/'isolated/snapshot'
jsondll=next((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))
files=list((SNAP/'Sdt.Core').rglob('*.cs'))+[p for p in (SNAP/'Sdt.Run').rglob('*.cs') if p.name!='AudioService.cs']+[HERE/'NodeChecks.cs']+[SNAP/'Sdt.UI/Screens/Run'/name for name in ['CurrentRewardState.cs','CurrentEventOptionState.cs']]
includes=''.join('<Compile Include="'+escape(str(p))+'" />' for p in files)
(OUT/'Audit.csproj').write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><DefineConstants>UNITY_EDITOR</DefineConstants><NoWarn>CS0169;CS0414</NoWarn></PropertyGroup><ItemGroup>'+includes+'<Reference Include="Newtonsoft.Json"><HintPath>'+escape(str(jsondll))+'</HintPath></Reference></ItemGroup></Project>',encoding='utf-8')
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
r=subprocess.run(['dotnet','run','--project',str(OUT/'Audit.csproj'),'-p:UseSharedCompilation=false'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1'})
(HERE/'domain-check.log').write_text(r.stdout+r.stderr,encoding='utf-8');print(r.stdout+r.stderr);raise SystemExit(r.returncode)
