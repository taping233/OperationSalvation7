"""Compile only home-owned sources against already imported assemblies, in a private tree.
Never starts Unity and never compiles or writes another agent's live source/output.
"""
from pathlib import Path
import json, os, subprocess
from xml.sax.saxutils import escape
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent/'compile-photo-only';OUT.mkdir(exist_ok=True)
MENU=ROOT/'Assets/Scripts/Sdt.UI/Screens/Misc'
files=[MENU/name for name in ['CardLibraryScreen.cs','PhotoDetailScreen.cs','PhotoStudioElements.cs','PhotoStudioChoice.cs','PhotoStudioWall.cs','PhotoStudioDossier.cs','PhotoStudioRoom.cs','PhotoInlineLinks.cs','PhotoStudioMotion.cs','PhotoPrismaticText.cs','PhotoNegativeGesture.cs']]
files.extend([ROOT/'Assets/Scripts/Sdt.Res'/name for name in ['CurrentPhotoAssets.cs','CurrentCardPresentation.cs','CurrentCardPresentation.Rich.cs']])
engine=Path(os.environ.get('SDT_UNITY_EDITOR','D:/Unity/6000.6.7f1/Editor'))/'Data/Managed/UnityEngine'
refs=list(engine.glob('*.dll'))+list((ROOT/'Library/ScriptAssemblies').glob('Sdt.*.dll'))
refs.append(ROOT/'Library/ScriptAssemblies/UnityEngine.UI.dll')
refs+=list((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[:1]
assert all(p.exists() for p in files+refs)
sources=''.join(f'<Compile Include="{escape(str(p))}" />' for p in files)
references=''.join(f'<Reference Include="{escape(p.stem)}"><HintPath>{escape(str(p))}</HintPath><Private>false</Private></Reference>' for p in refs)
project=OUT/'CurrentPhotoCheck.csproj'
project.write_text(f'''<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework>
<LangVersion>9</LangVersion><AssemblyName>CurrentPhotoCheck</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems>
<GenerateAssemblyInfo>false</GenerateAssemblyInfo><NoWarn>CS0436;CS0618;CS0169;CS0414</NoWarn></PropertyGroup>
<ItemGroup>{sources}{references}</ItemGroup></Project>''',encoding='utf-8')
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
result=subprocess.run(['dotnet','build',str(project),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],
    capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
output=result.stdout+result.stderr;(OUT/'latest.log').write_text(output,encoding='utf-8')
for line in output.splitlines():
    if 'error ' in line or 'Warning(s)' in line or 'Error(s)' in line or 'Time Elapsed' in line:print(line)
print('exit='+str(result.returncode));raise SystemExit(result.returncode)





