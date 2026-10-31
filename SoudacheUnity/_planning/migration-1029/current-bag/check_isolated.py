"""Freeze current sources and compile the Bag draft in its own output directory. No Unity launch."""
from pathlib import Path
import json, os, shutil, subprocess, sys
from xml.sax.saxutils import escape
sys.stdout.reconfigure(encoding='utf-8')
here=Path(__file__).resolve().parent
root=here.parents[2]
output=here/'isolated'
scripts=output/'snapshot'
scripts.mkdir(parents=True,exist_ok=True)
for source in (root/'Assets/Scripts').rglob('*'):
    if source.suffix not in ('.cs','.asmdef'): continue
    target=scripts/source.relative_to(root/'Assets/Scripts')
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,target)
for source in here.glob('*.cs'):
    target=scripts/('Sdt.Run' if source.name=='CardContainerCommands.cs' else 'Sdt.UI/Screens/Bag')/source.name
    shutil.copyfile(source,target)
if (here/'draft-run/BaseData.cs').exists():shutil.copyfile(here/'draft-run/BaseData.cs',scripts/'Sdt.Run/BaseData.cs')
(output/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
editor=Path('D:/Unity/6000.6.7f1/Editor')
engine=list((editor/'Data/Managed/UnityEngine').glob('*.dll'))
ui=root/'Library/ScriptAssemblies/UnityEngine.UI.dll'
json_dll=list((root/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))
definitions={}
for path in scripts.rglob('*.asmdef'):
    data=json.loads(path.read_text(encoding='utf-8-sig'));definitions[data['name']]=(path.parent,data)
for name,(directory,data) in definitions.items():
    files=list(directory.rglob('*.cs'))
    refs=[] if data.get('noEngineReferences') else engine+[ui]
    if 'Newtonsoft.Json' in data.get('references',[]):refs+=json_dll[:1]
    includes=''.join(f'<Compile Include="{escape(str(path))}" />' for path in files)
    references=''.join(f'<Reference Include="{path.stem}"><HintPath>{escape(str(path))}</HintPath><Private>false</Private></Reference>' for path in refs)
    references+=''.join(f'<ProjectReference Include="{ref}.csproj" />' for ref in data.get('references',[]) if ref in definitions)
    (output/f'{name}.csproj').write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><AssemblyName>{name}</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><GenerateAssemblyInfo>false</GenerateAssemblyInfo><DefineConstants>UNITY_6000_6_OR_NEWER;UNITY_EDITOR</DefineConstants><NoWarn>CS0618;CS0169;CS0414;CS0108</NoWarn></PropertyGroup><ItemGroup>{includes}{references}</ItemGroup></Project>',encoding='utf-8')
result=subprocess.run(['dotnet','build',str(output/'Sdt.UI.csproj'),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],cwd=output,capture_output=True,text=True,encoding='utf-8',errors='replace')
(here/'isolated-build.log').write_text(result.stdout+result.stderr,encoding='utf-8')
print('\n'.join(line for line in (result.stdout+result.stderr).splitlines() if 'error ' in line or 'Warning(s)' in line or 'Error(s)' in line or 'Time Elapsed' in line))
raise SystemExit(result.returncode)
