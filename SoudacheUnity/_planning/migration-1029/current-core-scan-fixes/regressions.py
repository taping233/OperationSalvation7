from pathlib import Path
import shutil, subprocess
p=Path(__file__).resolve().parent
old=p.parent/'current-core-target-fix'
for name in ['integration','forecast','semantics']:
 d=p/name;d.mkdir(exist_ok=True)
 for f in (old/name).iterdir():
  if f.is_file() and f.suffix in ['.cs','.json','.csproj']:
   if f.suffix=='.csproj':
    s=f.read_text(encoding='utf-8-sig').replace(str(old/'snapshot/Sdt.Core').replace('/','\\'),str(p/'snapshot/Sdt.Core').replace('/','\\'))
    (d/f.name).write_text(s,encoding='utf-8')
   else:shutil.copyfile(f,d/f.name)
 project=next(d.glob('*.csproj'))
 with (d/'run.txt').open('w',encoding='utf-8') as out:
  r=subprocess.run(['dotnet','run','--project',str(project)],cwd=d,stdout=out,stderr=subprocess.STDOUT)
 if r.returncode:raise RuntimeError(str(d/'run.txt'))
d=p/'targets';d.mkdir(exist_ok=True)
shutil.copyfile(old/'TargetTests.cs',d/'TargetTests.cs')
(d/'Tests.csproj').write_text((p/'Scan.csproj').read_text().replace('snapshot/**/*.cs','../snapshot/**/*.cs').replace('Scan.cs','TargetTests.cs'),encoding='utf-8')
with (d/'run.txt').open('w',encoding='utf-8') as out:r=subprocess.run(['dotnet','run','--project','Tests.csproj'],cwd=d,stdout=out,stderr=subprocess.STDOUT)
if r.returncode:raise RuntimeError(str(d/'run.txt'))
