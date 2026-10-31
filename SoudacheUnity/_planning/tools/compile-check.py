# 协调者的编译验证脚手架：按 asmdef 生成 csproj 并按依赖链 dotnet build
# 用法: python compile-check.py [asm名...]  缺省=全部（源码缺失的程序集自动跳过）
import os, sys, glob, subprocess

ROOT = r'D:\素材\代号柒\SoudacheUnity'
TOOLS = os.path.join(ROOT, '_planning', 'tools', 'ccbuild')
UNITY_DLL_DIR = r'D:\Unity\6000.3.23f1\Editor\Data\Managed\UnityEngine'
UGUI_SRC = r'D:\Unity\6000.3.23f1\Editor\Data\Resources\PackageManager\BuiltInPackages\com.unity.ugui\Runtime'
NEWTONSOFT = os.path.join(ROOT, '_thirdparty', 'Newtonsoft.Json.dll')
DOTNET = r'C:\Program Files\dotnet\dotnet.exe'

ENGINE_REFS = sorted(glob.glob(os.path.join(UNITY_DLL_DIR, '*.dll')))

# (名, 源目录列表, 项目引用, 额外 dll 引用, 是否含引擎)
ASMS = [
    ('Sdt.Core',     ['Assets/Scripts/Sdt.Core'],                     [],            [],                        False, None),
    ('Sdt.Narrative',['Assets/Scripts/Sdt.Narrative'],                ['Sdt.Core'],  [],                        False, None),
    ('Sdt.Res',      ['Assets/Scripts/Sdt.Res'],                      ['UguiShim'],  [],                        True, None),
    ('Sdt.Run',      ['Assets/Scripts/Sdt.Run'],                      ['Sdt.Core','Sdt.Narrative','Sdt.Res','UguiShim'], [NEWTONSOFT], True, None),
    ('Sdt.View',     ['Assets/Scripts/Sdt.View'],                     ['Sdt.Core','Sdt.Res','UguiShim'], [],              True, None),
    ('UguiShim',     None,                                             [],            [],                        True, 'UnityEngine.UI'),
    ('Sdt.UI',       ['Assets/Scripts/Sdt.UI'],                       ['Sdt.Core','Sdt.Run','Sdt.Narrative','Sdt.View','Sdt.Res','UguiShim'], [NEWTONSOFT], True, None),
    ('Sdt.Boot',     ['Assets/Scripts/Sdt.Boot'],                     ['Sdt.Core','Sdt.Run','Sdt.Narrative','Sdt.View','Sdt.UI','Sdt.Res','UguiShim'], [], True, None),
]

def src_files(rel_dirs):
    out = []
    for d in rel_dirs:
        out += glob.glob(os.path.join(ROOT, d, '**', '*.cs'), recursive=True)
    return out

import re
STRIP_PATTERNS = (re.compile(r'^\s*\[UGUIHelpURL\('), re.compile(r'^\s*\[UIModuleHelpURL\('),
                  re.compile(r'^\s*\[TMPHelpURL\('), re.compile(r'^\s*\[HelpURL\('))

def ugui_files():
    fs = glob.glob(os.path.join(UGUI_SRC, '**', '*.cs'), recursive=True)
    out_dir = os.path.join(TOOLS, 'ugui_src')
    os.makedirs(out_dir, exist_ok=True)
    out = []
    stub = os.path.join(out_dir, '_Stubs.cs')
    stub_src = ("namespace UnityEngineInternal { internal static class DisplayInternal"
                " { public static bool IsASecondaryDisplayIndex(int i) { return false; } } }\n")
    open(stub, 'w', encoding='utf-8').write(stub_src)
    out.append(stub)
    for f in fs:
        rel = os.path.relpath(f, UGUI_SRC)
        if 'AssemblyInfo' in os.path.basename(f): continue
        if '\\TMP\\' in os.path.abspath(f) or rel.startswith('TMP'): continue
        if 'InternalBridge' in rel: continue
        if rel.startswith('Editor') or os.path.sep + 'Editor' + os.path.sep in os.path.join('', rel): continue
        tgt = os.path.join(out_dir, rel.replace(os.path.sep, '__'))
        lines = open(f, encoding='utf-8-sig', errors='replace').readlines()
        with open(tgt, 'w', encoding='utf-8') as w:
            for ln in lines:
                if any(p.match(ln) for p in STRIP_PATTERNS): continue
                if ln.strip() == 'MarkDirty();': continue  # 引擎内部脏标记，垫片中为空操作
                w.write(ln)
        out.append(tgt)
    return out

def csproj(name, srcs, proj_refs, dll_refs, engine, asm_name=None):
    refs = ''
    if engine:
        for d in ENGINE_REFS:
            refs += f'<Reference Include="{os.path.splitext(os.path.basename(d))[0]}"><HintPath>{d}</HintPath><Private>false</Private></Reference>'
    for d in dll_refs:
        refs += f'<Reference Include="{os.path.splitext(os.path.basename(d))[0]}"><HintPath>{d}</HintPath><Private>false</Private></Reference>'
    prefs = ''.join(f'<ProjectReference Include="{n}.csproj" />' for n in proj_refs)
    compile_items = ''.join(f'<Compile Include="{s}" />' for s in srcs)
    an = asm_name or name
    return f'''<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <AssemblyName>{an}</AssemblyName>
    <TargetFramework>net8.0</TargetFramework>
    <LangVersion>9</LangVersion>
    <Nullable>disable</Nullable>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <GenerateDependencyFile>false</GenerateDependencyFile>
    <NoWarn>CS0618;CS0169;CS0414</NoWarn>
  </PropertyGroup>
  <ItemGroup>{compile_items}</ItemGroup>
  <ItemGroup>{refs}{prefs}</ItemGroup>
</Project>'''

def main():
    wanted = sys.argv[1:] or [a[0] for a in ASMS]
    os.makedirs(TOOLS, exist_ok=True)
    results = []
    for name, dirs, prefs, dlls, engine, asm_name in ASMS:
        if name not in wanted:
            continue
        if name == 'UguiShim':
            srcs = ugui_files()
            if not srcs:
                results.append((name, 'SKIP', 'ugui 包源码未找到')); continue
        else:
            srcs = src_files(dirs)
            if not srcs:
                results.append((name, 'SKIP', '无源码')); continue
        proj = csproj(name, srcs, prefs, dlls, engine, asm_name)
        p = os.path.join(TOOLS, name + '.csproj')
        open(p, 'w', encoding='utf-8').write(proj)
        r = subprocess.run([DOTNET, 'build', p, '-v', 'q', '--nologo', '-p:RestorePackages=false'],
                           capture_output=True, text=True, shell=False,
                           env={**os.environ, 'DOTNET_CLI_TELEMETRY_OPTOUT': '1', 'DOTNET_NOLOGO': '1'})
        ok = r.returncode == 0
        err = ''
        if not ok:
            errs = [l for l in (r.stdout + r.stderr).splitlines() if 'error' in l.lower()][:4]
            err = ' | '.join(errs)[:400]
        results.append((name, 'PASS' if ok else 'FAIL', err))
    for name, st, err in results:
        print(f'{st:4} {name:14} {err}')
    sys.exit(0 if all(s != 'FAIL' for _, s, _ in results) else 1)

if __name__ == '__main__':
    main()
