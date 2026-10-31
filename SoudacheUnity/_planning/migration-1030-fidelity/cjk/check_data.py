# -*- coding: utf-8 -*-
from pathlib import Path
from xml.sax.saxutils import escape
import subprocess,os
d=Path(__file__).resolve().parent
root=d.parents[2]
out=d/'data-check'
out.mkdir(exist_ok=True)
(out/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
sources=[root/'Assets/Scripts/Sdt.UI/Kit/CjkNativeLayout.cs',d/'Program.cs']
project=out/'CjkCheck.csproj'
project.write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup>'+''.join('<Compile Include="'+escape(str(p))+'"/>' for p in sources)+'</ItemGroup></Project>',encoding='utf-8')
r=subprocess.run(['dotnet','run','--project',str(project),'--no-launch-profile','--verbosity','quiet','-p:UseSharedCompilation=false'],cwd=out,capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1'})
(d/'data-check.log').write_text(r.stdout+r.stderr,encoding='utf-8')
print(r.stdout+r.stderr)
raise SystemExit(r.returncode)
