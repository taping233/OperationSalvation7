# -*- coding: utf-8 -*-
from pathlib import Path
from xml.sax.saxutils import escape
import subprocess
import os

directory=Path(__file__).resolve().parent
root=directory.parents[2]
output=directory/'data-check'
output.mkdir(exist_ok=True)
json_dll=next((root/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))
project=output/'PileCheck.csproj'
project.write_text('''<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable></PropertyGroup><ItemGroup>
<ProjectReference Include="'''+escape(str(directory/'compile/Sdt.Core.csproj'))+'''" />
<Compile Include="'''+escape(str(root/'Assets/Scripts/Sdt.UI/Screens/Battle/CurrentBattlePileData.cs'))+'''" />
<Compile Include="'''+escape(str(directory/'Program.cs'))+'''" />
<Reference Include="Newtonsoft.Json"><HintPath>'''+escape(str(json_dll))+'''</HintPath></Reference></ItemGroup></Project>''',encoding='utf-8')
(output/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
result=subprocess.run(['dotnet','run','--project',str(project),'--no-launch-profile','--verbosity','quiet','-p:UseSharedCompilation=false'],cwd=output,capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
(directory/'data-check.log').write_text(result.stdout+result.stderr,encoding='utf-8')
print(result.stdout+result.stderr)
raise SystemExit(result.returncode)
