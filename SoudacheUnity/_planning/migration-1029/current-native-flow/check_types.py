"""Private source snapshot/type check; never launches Unity or touches shared compile output."""
from pathlib import Path
from xml.sax.saxutils import escape
import json, shutil, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
here=Path(__file__).resolve().parent
root=here.parents[2]
out=here/'types'
snapshot=out/'snapshot'
snapshot.mkdir(parents=True,exist_ok=True)
for source in (root/'Assets/Scripts').rglob('*'):
    if source.suffix not in ('.cs','.asmdef'):continue
    target=snapshot/source.relative_to(root/'Assets/Scripts')
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,target)
(out/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
editor=Path('D:/Unity/6000.6.7f1/Editor')
engine=list((editor/'Data/Managed/UnityEngine').glob('*.dll'))
editor_refs=list((editor/'Data/Managed/UnityEditor').glob('*.dll'))
ui=root/'Library/ScriptAssemblies/UnityEngine.UI.dll'
jsondll=next((root/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))
definitions={}
for path in snapshot.rglob('*.asmdef'):
    data=json.loads(path.read_text(encoding='utf-8-sig'));definitions[data['name']]=(path.parent,data)
def write(name,files,refs,projects):
    includes=''.join(f'<Compile Include="{escape(str(p))}" />' for p in files)
    references=''.join(f'<Reference Include="{p.stem}"><HintPath>{escape(str(p))}</HintPath><Private>false</Private></Reference>' for p in refs)
    references+=''.join(f'<ProjectReference Include="{p}.csproj" />' for p in projects)
    (out/f'{name}.csproj').write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><AssemblyName>{name}</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><GenerateAssemblyInfo>false</GenerateAssemblyInfo><DefineConstants>UNITY_6000_6_OR_NEWER;UNITY_EDITOR</DefineConstants><NoWarn>CS0618;CS0169;CS0414;CS0108</NoWarn></PropertyGroup><ItemGroup>{includes}{references}</ItemGroup></Project>',encoding='utf-8')
for name,(folder,data) in definitions.items():
    refs=[] if data.get('noEngineReferences') else engine+[ui]
    if 'Newtonsoft.Json' in data.get('references',[]):refs+=[jsondll]
    write(name,list(folder.rglob('*.cs')),refs,[r for r in data.get('references',[]) if r in definitions])
write('CurrentNativeEditor',list(here.glob('CurrentMigrationFlowValidation*.cs'))+[here/'CurrentUnitFrameValidation.cs',root/'Assets/Editor/OffscreenCapture.cs'],engine+editor_refs+[ui,jsondll],list(definitions))
result=subprocess.run(['dotnet','build',str(out/'CurrentNativeEditor.csproj'),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],cwd=out,capture_output=True,text=True,encoding='utf-8',errors='replace')
(here/'type-check.log').write_text(result.stdout+result.stderr,encoding='utf-8')
print('\n'.join(s for s in (result.stdout+result.stderr).splitlines() if 'error ' in s or 'Warning(s)' in s or 'Error(s)' in s or 'Time Elapsed' in s))
raise SystemExit(result.returncode)
