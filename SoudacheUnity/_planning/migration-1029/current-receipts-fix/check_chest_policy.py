from pathlib import Path
from xml.sax.saxutils import escape
import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
here=Path(__file__).resolve().parent
subprocess.run(['node',str(here/'source_chest_policy.mjs')],check=True)
subprocess.run([sys.executable,str(here/'check_types.py')],check=True)
out=here/'policy-types';out.mkdir(exist_ok=True)
(out/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
policy=here/'types/snapshot/Scripts/Sdt.UI/Screens/Run/CurrentChestProgress.cs'
(out/'ChestPolicy.csproj').write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="{escape(str(here/"ChestPolicyChecks.cs"))}"/><Compile Include="{escape(str(policy))}"/><ProjectReference Include="{escape(str(here/"types/Sdt.Core.csproj"))}"/></ItemGroup></Project>',encoding='utf-8')
subprocess.run(['dotnet','build',str(out/'ChestPolicy.csproj'),'--nologo','-v','quiet','-p:UseSharedCompilation=false'],check=True)
result=subprocess.run(['dotnet',str(out/'bin/Debug/net8.0/ChestPolicy.dll'),str(here/'chest-source-vectors.json'),str(here/'chest-policy-result.json')],capture_output=True,text=True,encoding='utf-8',errors='replace')
(here/'chest-policy.log').write_text(result.stdout+result.stderr,encoding='utf-8')
print(result.stdout+result.stderr)
raise SystemExit(result.returncode)
