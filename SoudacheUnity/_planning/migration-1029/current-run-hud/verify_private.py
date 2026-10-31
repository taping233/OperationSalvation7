from pathlib import Path
import json,hashlib,subprocess,os
from xml.sax.saxutils import escape
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OUT=HERE/'private-check';SNAP=OUT/'snapshot';OUT.mkdir(exist_ok=True)
copies=[]
for source in (ROOT/'Assets/Scripts').rglob('*.cs'):
    if '/Editor/' in source.as_posix():continue
    dest=SNAP/source.relative_to(ROOT/'Assets/Scripts');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(source.read_bytes());copies.append(dest)
refs=list(Path('D:/Unity/6000.6.7f1/Editor/Data/Managed/UnityEngine').glob('*.dll'))
refs+=[ROOT/'Library/ScriptAssemblies/UnityEngine.UI.dll']
refs+=list((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[:1]
assert refs and all(p.exists() for p in refs)
sources=''.join(f'<Compile Include="{escape(str(p))}" />' for p in copies)
references=''.join(f'<Reference Include="{escape(p.stem)}"><HintPath>{escape(str(p))}</HintPath><Private>false</Private></Reference>' for p in refs)
project=OUT/'CurrentRunHudCheck.csproj'
project.write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><GenerateAssemblyInfo>false</GenerateAssemblyInfo><NoWarn>CS0618;CS0169;CS0414</NoWarn></PropertyGroup><ItemGroup>{sources}{references}</ItemGroup></Project>',encoding='utf-8')
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
result=subprocess.run(['dotnet','build',str(project),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
output=result.stdout+result.stderr;(OUT/'latest.log').write_text(output,encoding='utf-8')
for line in output.splitlines():
    if 'error ' in line or 'Warning(s)' in line or 'Error(s)' in line or 'Time Elapsed' in line:print(line)
print('exit='+str(result.returncode));raise SystemExit(result.returncode)
