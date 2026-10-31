# -*- coding: utf-8 -*-
from pathlib import Path
from xml.sax.saxutils import escape
import subprocess,os

directory=Path(__file__).resolve().parent
root=directory.parents[2]
output=directory/'compile'
editor=Path('D:/Unity/6000.6.7f1/Editor')
dlls=sorted((editor/'Data/Managed/UnityEngine').glob('*.dll'))+[root/'Library/ScriptAssemblies/UnityEngine.UI.dll']+list((root/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[:1]
references=''.join('<Reference Include="'+escape(p.stem)+'"><HintPath>'+escape(str(p))+'</HintPath><Private>false</Private></Reference>' for p in dlls)
references+=''.join('<ProjectReference Include="'+p.name+'" />' for p in output.glob('Sdt.*.csproj'))
sources=[root/'Assets/Editor/CurrentBattlePileValidation.cs',root/'Assets/Editor/OffscreenCapture.cs']
project=output/'Pile.Editor.csproj'
project.write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><GenerateAssemblyInfo>false</GenerateAssemblyInfo><DefineConstants>UNITY_6000_6_OR_NEWER;UNITY_EDITOR</DefineConstants></PropertyGroup><ItemGroup>'+''.join('<Compile Include="'+escape(str(p))+'" />' for p in sources)+references+'</ItemGroup></Project>',encoding='utf-8')
result=subprocess.run(['dotnet','build',str(project),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],cwd=output,capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
(directory/'editor-check.log').write_text(result.stdout+result.stderr,encoding='utf-8')
for line in (result.stdout+result.stderr).splitlines():
    if 'error ' in line or 'Warning(s)' in line or 'Error(s)' in line or 'Time Elapsed' in line: print(line)
raise SystemExit(result.returncode)
