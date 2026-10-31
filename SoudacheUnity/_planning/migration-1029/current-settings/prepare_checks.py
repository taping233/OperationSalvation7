"""Freeze current-source hashes, render adapters and private compilation inputs; does not touch Unity imports."""
from pathlib import Path
import hashlib,json,re,subprocess,os
from xml.sax.saxutils import escape
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SOURCE=ROOT.parent/'搜打撤/game'
OUT=HERE/'private-check';OUT.mkdir(exist_ok=True)
paths=['src/ui/menu-settings.js','src/ui/settings-navigation.js','src/ui/settings-input.js','src/core/input.js',
       'src/ui/performance-settings.js','src/core/performance-settings.js','src/ui/settings-audio.js',
       'src/ui/menu-feedback.js','src/ui/feedback.local.js','css/page-settings.css','css/settings-navigation.css',
       'css/settings-audio.css','css/performance-settings.css','css/home-ui-tokens.css','css/secondary-ui-tokens.css',
       'css/interface-components.css','index.html','assets/sfx/battle/SOURCES.md']
(HERE/'source-sha256.json').write_text(json.dumps({p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest() for p in paths},ensure_ascii=False,indent=2),encoding='utf-8')
source=(SOURCE/'assets/sfx/battle/SOURCES.md').read_text(encoding='utf-8-sig')
(HERE/'CurrentAudioSourcesText.cs').write_text('namespace Sdt.UI.Screens.Menu { internal static class CurrentAudioSourcesText { public const string Value = @"'+source.replace('"','""')+'"; } }',encoding='utf-8')
segments=(HERE/'settings-menu-segments.cs.txt').read_text(encoding='utf-8')
slider=segments[segments.index('    sealed class VolSlider'):segments.index('    public sealed class SuggestionBox')]
(OUT/'OwnedSlider.cs').write_text('using System;using UnityEngine;using UnityEngine.UI;using UnityEngine.EventSystems;using Sdt.UI.Kit;namespace Sdt.UI.Screens.Menu {\n'+slider+'\n}',encoding='utf-8')
# Utility and DLL inputs are copied/read as fixed baselines; never build another agent's changing source tree.
utility=ROOT/'Assets/Scripts/Sdt.UI/Screens/Menu/CurrentHomeElements.cs'
(OUT/utility.name).write_bytes(utility.read_bytes())
files=list(HERE.glob('*.cs'))+list(OUT.glob('*.cs'))
engine=Path('D:/Unity/6000.6.7f1/Editor/Data/Managed/UnityEngine')
refs=list(engine.glob('*.dll'))+list((ROOT/'Library/ScriptAssemblies').glob('Sdt.*.dll'))
refs.append(ROOT/'Library/ScriptAssemblies/UnityEngine.UI.dll')
refs+=list((ROOT/'Library/PackageCache').glob('com.unity.nuget.newtonsoft-json@*/Runtime/Newtonsoft.Json.dll'))[:1]
assert all(p.exists() for p in files+refs)
sources=''.join(f'<Compile Include="{escape(str(p))}" />' for p in files)
references=''.join(f'<Reference Include="{escape(p.stem)}"><HintPath>{escape(str(p))}</HintPath><Private>false</Private></Reference>' for p in refs)
project=OUT/'CurrentSettingsCheck.csproj'
project.write_text(f'''<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework>
<LangVersion>9</LangVersion><AssemblyName>CurrentSettingsCheck</AssemblyName><EnableDefaultCompileItems>false</EnableDefaultCompileItems>
<GenerateAssemblyInfo>false</GenerateAssemblyInfo><NoWarn>CS0436;CS0618;CS0169;CS0414</NoWarn></PropertyGroup>
<ItemGroup>{sources}{references}</ItemGroup></Project>''',encoding='utf-8')
(OUT/'NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>',encoding='utf-8')
result=subprocess.run(['dotnet','build',str(project),'--nologo','-m:1','-v','minimal','-p:UseSharedCompilation=false'],capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'DOTNET_CLI_TELEMETRY_OPTOUT':'1','DOTNET_CLI_UI_LANGUAGE':'en-US'})
output=result.stdout+result.stderr;(OUT/'latest.log').write_text(output,encoding='utf-8')
for line in output.splitlines():
    if 'error ' in line or 'Warning(s)' in line or 'Error(s)' in line or 'Time Elapsed' in line:print(line)
print('exit='+str(result.returncode));raise SystemExit(result.returncode)
