# -*- coding: utf-8 -*-
from pathlib import Path
import shutil
p=Path(__file__).resolve().parent
unity=p.parents[2]
snapshot=p/'snapshot'
snapshot.mkdir(exist_ok=True)
for f in (unity/'Assets/Scripts/Sdt.Core').rglob('*.cs'):
    dest=snapshot/f.relative_to(unity/'Assets/Scripts/Sdt.Core')
    dest.parent.mkdir(exist_ok=True,parents=True)
    shutil.copyfile(f,dest)
base=(p.parent/'current-core-independent/final-review/scan-source.mjs').read_text(encoding='utf-8-sig')
base=base[:base.index('  const allowed=')]
base=base.replace("path.resolve(taskDir, '../../../..')","path.resolve(taskDir, '../../..')")
(p/'source.mjs').write_text(base+(p/'source-cases.mjs').read_text(encoding='utf-8'),encoding='utf-8')
(p/'Tests.csproj').write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><NoWarn>CS0169;CS0414</NoWarn></PropertyGroup><ItemGroup><Compile Include="snapshot/**/*.cs"/><Compile Include="Tests.cs"/></ItemGroup></Project>',encoding='utf-8')
print('prepared private Core and source harness')
