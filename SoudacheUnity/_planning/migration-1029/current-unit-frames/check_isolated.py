"""Snapshot production C# and run local compilation and existing domain regressions.
Never invokes Unity or the shared migration-1029/compile output.
"""
import json
import os
from pathlib import Path
import subprocess
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE / "isolated"
SNAP = OUT / "snapshot"
EDITOR = Path(os.environ.get("SDT_UNITY_EDITOR", "D:/Unity/6000.6.7f1/Editor"))


def text(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")


def run(command, name):
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
                            env={**os.environ, "DOTNET_CLI_TELEMETRY_OPTOUT":"1", "DOTNET_CLI_UI_LANGUAGE":"en-US"})
    text(HERE / (name+".log"), result.stdout+result.stderr)
    print(name, "exit="+str(result.returncode))
    for line in (result.stdout+result.stderr).splitlines():
        if "error " in line or "/289" in line or "/167" in line or "checks:" in line or "checks " in line:
            print(line)
    if result.returncode:
        raise SystemExit(result.returncode)


def main():
    definitions={}
    for path in (ROOT / "Assets/Scripts").rglob("*.asmdef"):
        data=json.loads(path.read_text(encoding="utf-8-sig")); definitions[data["name"]]=(path.parent,data)
    for source in (ROOT/"Assets/Scripts").rglob("*.cs"):
        dest=SNAP/source.relative_to(ROOT/"Assets/Scripts")
        dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(source.read_bytes())
    text(OUT/"NuGet.Config", '<configuration><packageSources><clear /></packageSources></configuration>')
    engine=sorted((EDITOR/"Data/Managed/UnityEngine").glob("*.dll"))
    ui=ROOT/"Library/ScriptAssemblies/UnityEngine.UI.dll"
    jsondll=next((ROOT/"Library/PackageCache").glob("com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll"))
    for name,(directory,definition) in definitions.items():
        dlls=[] if definition.get("noEngineReferences") else engine+[ui]
        if "Newtonsoft.Json" in definition.get("references",[]): dlls.append(jsondll)
        refs=''.join('<Reference Include="'+escape(p.stem)+'"><HintPath>'+escape(str(p))+'</HintPath><Private>false</Private></Reference>' for p in dlls)
        refs+=''.join('<ProjectReference Include="'+escape(r)+'.csproj" />' for r in definition.get("references",[]) if r in definitions)
        files=sorted((SNAP/directory.relative_to(ROOT/"Assets/Scripts")).rglob("*.cs"))
        sources=''.join('<Compile Include="'+escape(str(p))+'" />' for p in files)
        text(OUT/(name+".csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><AssemblyName>'+name+'</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><GenerateAssemblyInfo>false</GenerateAssemblyInfo><DefineConstants>UNITY_6000_6_OR_NEWER;UNITY_EDITOR</DefineConstants><NoWarn>CS0618;CS0169;CS0414</NoWarn></PropertyGroup><ItemGroup>'+sources+refs+'</ItemGroup></Project>')
    run(["dotnet","build",str(OUT/"Sdt.Boot.csproj"),"--nologo","-m:1","-v","minimal","-p:UseSharedCompilation=false"],"isolated-build")
    for name, files in {"current-forecast":["Audit.cs"],"card-semantics-fix":["Audit.cs","BoundaryChecks.cs","BossAudit.cs"]}.items():
        source_dir=HERE.parent/name; target_dir=OUT/name; target_dir.mkdir(parents=True,exist_ok=True)
        for filename in files:
            value=(source_dir/filename).read_text(encoding="utf-8-sig")
            value=value.replace("_planning/migration-1029/"+name, "_planning/migration-1029/current-unit-frames/isolated/"+name)
            text(target_dir/filename,value)
        for vector in source_dir.glob("*source-vectors.json"):
            (target_dir/vector.name).write_bytes(vector.read_bytes())
        includes='<Compile Include="../snapshot/Sdt.Core/**/*.cs" />'+''.join('<Compile Include="'+f+'" />' for f in files)
        text(target_dir/"Audit.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><NoWarn>CS0169;CS0414</NoWarn></PropertyGroup><ItemGroup>'+includes+'</ItemGroup></Project>')
        run(["dotnet","run","--project",str(target_dir/"Audit.csproj"),"-p:UseSharedCompilation=false"],name)


if __name__ == "__main__": main()
