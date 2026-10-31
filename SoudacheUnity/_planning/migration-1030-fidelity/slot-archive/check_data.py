# -*- coding: utf-8 -*-
from pathlib import Path
import subprocess,os,sys
from xml.sax.saxutils import escape
root=Path('SoudacheUnity').resolve();d=root/'_planning/migration-1030-fidelity/slot-archive';dll=list((d/'compile/bin/Debug/net8.0').glob('Sdt.*.dll'))+list((root/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[:1]+list(Path('D:/Unity/6000.6.7f1/Editor/Data/Managed/UnityEngine').glob('*.dll'))
refs=''.join('<Reference Include="'+escape(p.stem)+'"><HintPath>'+escape(str(p))+'</HintPath></Reference>' for p in dll)
p=d/'ArchiveCheck.csproj';p.write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><OutputType>Exe</OutputType><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><GenerateAssemblyInfo>false</GenerateAssemblyInfo></PropertyGroup><ItemGroup><Compile Include="ArchiveCheck.cs"/>'+refs+'</ItemGroup></Project>',encoding='utf-8')
r=subprocess.run(['dotnet','build',str(p),'--nologo','-v','minimal','-p:UseSharedCompilation=false'],capture_output=True,text=True,encoding='utf-8',errors='replace');(d/'data-compile.log').write_text(r.stdout+r.stderr,encoding='utf-8');print('\n'.join(x for x in r.stdout.splitlines() if 'Error(s)' in x or 'error ' in x));
if r.returncode:sys.exit(r.returncode)
from datetime import datetime
out=d/('data-run-'+datetime.now().strftime('%H%M%S'));r=subprocess.run(['dotnet',str(d/'bin/Debug/net8.0/ArchiveCheck.dll'),str(d/'native-run-fixture.json'),str(out)],capture_output=True,text=True,encoding='utf-8',errors='replace');(d/'data-run.log').write_text(r.stdout+r.stderr,encoding='utf-8');print(r.stdout+r.stderr);sys.exit(r.returncode)
