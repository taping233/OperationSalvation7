# -*- coding: utf-8 -*-
"""使用现有编辑器 DLL 检查 C#，实际 Unity 编译仍为最终依据。"""
import glob
import json
import os
from pathlib import Path
import subprocess
import sys
from xml.sax.saxutils import escape
sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path('D:\\素材\\代号柒\\SoudacheUnity')
OUTPUT = Path(__file__).resolve().parent / "compile"
EDITOR = Path(os.environ.get("SDT_UNITY_EDITOR", "D:/Unity/6000.6.7f1/Editor"))
OUTPUT.mkdir(parents=True, exist_ok=True)
(OUTPUT / "NuGet.Config").write_text('<configuration><packageSources><clear /></packageSources></configuration>', encoding="utf-8")
definitions = {}
for path in (ROOT / "Assets/Scripts").rglob("*.asmdef"):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    definitions[data["name"]] = (path.parent, data)
engine = sorted((EDITOR / "Data/Managed/UnityEngine").glob("*.dll"))
ui = ROOT / "Library/ScriptAssemblies/UnityEngine.UI.dll"
json_libraries = sorted((ROOT / "Library/PackageCache").glob("com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll"))
if not engine or not ui.exists() or not json_libraries:
    raise SystemExit("需要先用已有 Unity 完成基础包导入。")

for name, (directory, definition) in definitions.items():
    files = sorted(directory.rglob("*.cs"))
    dependencies = [reference for reference in definition.get("references", []) if reference in definitions]
    dlls = [] if definition.get("noEngineReferences") else engine + [ui]
    if "Newtonsoft.Json" in definition.get("references", []): dlls += json_libraries[:1]
    sources = ''.join(f'<Compile Include="{escape(str(file))}" />' for file in files)
    references = ''.join(f'<Reference Include="{escape(file.stem)}"><HintPath>{escape(str(file))}</HintPath><Private>false</Private></Reference>' for file in dlls)
    references += ''.join(f'<ProjectReference Include="{reference}.csproj" />' for reference in dependencies)
    (OUTPUT / f"{name}.csproj").write_text(f'''<Project Sdk="Microsoft.NET.Sdk">
<PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion>
<AssemblyName>{name}</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems>
<Nullable>disable</Nullable><GenerateAssemblyInfo>false</GenerateAssemblyInfo>
<DefineConstants>UNITY_6000_6_OR_NEWER;UNITY_EDITOR</DefineConstants>
<NoWarn>CS0618;CS0169;CS0414</NoWarn></PropertyGroup>
<ItemGroup>{sources}{references}</ItemGroup></Project>''', encoding="utf-8")

target = sys.argv[1] if len(sys.argv) > 1 else "Sdt.Boot"
command = ["dotnet", "build", str(OUTPUT / f"{target}.csproj"), "--nologo", "-m:1", "-v", "minimal", "-p:UseSharedCompilation=false"]
result = subprocess.run(command, cwd=OUTPUT, capture_output=True, text=True, encoding="utf-8", errors="replace",
                        env={**os.environ, "DOTNET_CLI_TELEMETRY_OPTOUT": "1", "DOTNET_CLI_UI_LANGUAGE": "en-US"})
(OUTPUT / "latest.log").write_text(result.stdout + result.stderr, encoding="utf-8")
for line in (result.stdout + result.stderr).splitlines():
    if "error " in line or "Warning(s)" in line or "Error(s)" in line or "Time Elapsed" in line: print(line)
print(f"exit={result.returncode}; log={OUTPUT / 'latest.log'}")
raise SystemExit(result.returncode)
