"""Compile the current validation scripts against a private production snapshot."""
from pathlib import Path
from xml.sax.saxutils import escape
import hashlib, json, shutil, subprocess, sys

sys.stdout.reconfigure(encoding='utf-8')
here = Path(__file__).resolve().parent
root = here.parents[2]
out = here / 'types'
snapshot = out / 'snapshot'
snapshot.mkdir(parents=True, exist_ok=True)
sources = [p for p in (root / 'Assets/Scripts').rglob('*') if p.suffix in ('.cs', '.asmdef')]
editors = list((root / 'Assets/Editor').glob('CurrentMigrationFlowValidation*.cs')) + [root / 'Assets/Editor/OffscreenCapture.cs']
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
before = {str(p.relative_to(root)): digest(p) for p in sources + editors}
for source in sources + editors:
    target = snapshot / source.relative_to(root / 'Assets')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
if '--pending' in sys.argv:
    for override in (here / 'pending').glob('*.cs'):
        shutil.copyfile(override, snapshot / 'Editor' / override.name)
        before['private-pending/' + override.name] = digest(override)
after = {str(p.relative_to(root)): digest(p) for p in sources + editors}
if {key:value for key,value in before.items() if not key.startswith('private-pending/')} != after:
    raise RuntimeError('Production changed during snapshot; retry after a freeze.')
(here / 'source-manifest.json').write_text(json.dumps(before, indent=2), encoding='utf-8')
(out / 'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>', encoding='utf-8')
editor = Path('D:/Unity/6000.6.7f1/Editor')
engine = list((editor / 'Data/Managed/UnityEngine').glob('*.dll'))
editor_refs = list((editor / 'Data/Managed/UnityEditor').glob('*.dll'))
ui = root / 'Library/ScriptAssemblies/UnityEngine.UI.dll'
jsondll = next((root / 'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))
definitions = {}
for path in (snapshot / 'Scripts').rglob('*.asmdef'):
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    definitions[data['name']] = (path.parent, data)
def write(name, files, refs, projects):
    includes = ''.join(f'<Compile Include="{escape(str(p))}" />' for p in files)
    references = ''.join(f'<Reference Include="{p.stem}"><HintPath>{escape(str(p))}</HintPath><Private>false</Private></Reference>' for p in refs)
    references += ''.join(f'<ProjectReference Include="{p}.csproj" />' for p in projects)
    (out / f'{name}.csproj').write_text(f'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><LangVersion>9</LangVersion><AssemblyName>{name}</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems><Nullable>disable</Nullable><GenerateAssemblyInfo>false</GenerateAssemblyInfo><DefineConstants>UNITY_6000_6_OR_NEWER;UNITY_EDITOR</DefineConstants><NoWarn>CS0618;CS0169;CS0414;CS0108</NoWarn></PropertyGroup><ItemGroup>{includes}{references}</ItemGroup></Project>', encoding='utf-8')
for name, (folder, data) in definitions.items():
    refs = [] if data.get('noEngineReferences') else engine + [ui]
    if 'Newtonsoft.Json' in data.get('references', []): refs += [jsondll]
    write(name, list(folder.rglob('*.cs')), refs, [r for r in data.get('references', []) if r in definitions])
write('CurrentReceiptEditor', list((snapshot / 'Editor').glob('*.cs')), engine + editor_refs + [ui, jsondll], list(definitions))
result = subprocess.run(['dotnet', 'build', str(out / 'CurrentReceiptEditor.csproj'), '--nologo', '-m:1', '-v', 'minimal', '-p:UseSharedCompilation=false'], cwd=out, capture_output=True, text=True, encoding='utf-8', errors='replace')
(here / 'type-check.log').write_text(result.stdout + result.stderr, encoding='utf-8')
print('\n'.join(s for s in (result.stdout + result.stderr).splitlines() if 'error ' in s or 'Warning(s)' in s or 'Error(s)' in s or 'Time Elapsed' in s))
raise SystemExit(result.returncode)
