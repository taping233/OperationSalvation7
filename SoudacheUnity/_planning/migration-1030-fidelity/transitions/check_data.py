from pathlib import Path
from xml.sax.saxutils import escape
import hashlib,json,shutil,subprocess,sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];OUT=HERE/'data-check';SNAP=OUT/'snapshot'
SNAP.mkdir(parents=True,exist_ok=True)
manifest={}
for area in ('Sdt.Core','Sdt.Run'):
    for file in (ROOT/'Assets/Scripts'/area).rglob('*.cs'):
        if file.name=='AudioService.cs':continue
        target=SNAP/area/file.relative_to(ROOT/'Assets/Scripts'/area);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,target)
        manifest[str(file.relative_to(ROOT)).replace('\\','/')]=hashlib.sha256(file.read_bytes()).hexdigest()
(OUT/'source.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
library=next((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
project=OUT/'DataChecks.csproj'
project.write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="snapshot/**/*.cs"/><Compile Include="../DataChecks.cs"/><Reference Include="Newtonsoft.Json"><HintPath>'+escape(str(library))+'</HintPath></Reference></ItemGroup></Project>',encoding='utf-8')
result=subprocess.run(['dotnet','run','--project',str(project),'--verbosity','quiet','-p:UseSharedCompilation=false'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',errors='replace')
(OUT/'latest.log').write_text(result.stdout+result.stderr,encoding='utf-8');print(result.stdout+result.stderr);sys.exit(result.returncode)
