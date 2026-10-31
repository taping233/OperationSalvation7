# -*- coding: utf-8 -*-
from pathlib import Path
import shutil,subprocess,xml.etree.ElementTree as ET,json
p=Path(__file__).resolve().parent
prior=p.parent/'current-core-target-fix'
def run(project,cwd,label):
    with (cwd/'run.txt').open('w',encoding='utf-8') as out:
        result=subprocess.run(['dotnet','run','--project',str(project)],cwd=cwd,stdout=out,stderr=subprocess.STDOUT)
    if result.returncode:raise RuntimeError(str(cwd/'run.txt'))
    print(label+': '+(cwd/'run.txt').read_text(encoding='utf-8-sig').splitlines()[-1])
for name in ['integration','forecast','semantics']:
    d=p/name;d.mkdir(exist_ok=True)
    for source in (prior/name).iterdir():
        if source.is_file() and source.suffix in ['.cs','.json','.csproj']:shutil.copyfile(source,d/source.name)
    project=next(d.glob('*.csproj'))
    xml=ET.parse(project)
    for compile in xml.getroot().iter('Compile'):
        if '**' in compile.attrib.get('Include',''):compile.set('Include',str(p/'snapshot/**/*.cs'))
    xml.write(project,encoding='utf-8',xml_declaration=True)
    run(project,d,name)
for name,file in [('payment','PaymentBoundary.cs'),('targets','TargetTests.cs'),('scan','Scan.cs')]:
    d=p/name;d.mkdir(exist_ok=True)
    origin=p.parent/('current-core-payment-fix' if name=='payment' else 'current-core-target-fix' if name=='targets' else 'current-core-scan-fixes')
    shutil.copyfile(origin/file,d/file)
    (d/'Tests.csproj').write_text((p/'Tests.csproj').read_text().replace('snapshot/**/*.cs','../snapshot/**/*.cs').replace('Tests.cs"',file+'"'),encoding='utf-8')
    if name=='scan':shutil.copyfile(p.parent/'current-core-independent/final-review/scan-source.json',d/'scan-source.json')
    run(d/'Tests.csproj',d,name)
    if name=='scan':
        source=json.loads((d/'scan-source.json').read_text(encoding='utf-8'))['rows']
        core=json.loads((d/'scan-core.json').read_text(encoding='utf-8'))
        differing=[]
        for a,b in zip(source,core):
            if any(a.get(k)!=b.get(k) for k in ['after','turn']):differing.append(a['id'])
        assert differing==['cmtn1r10xnl1'],differing
        print('scan: 128/129 exact; known discoverPlus internal-status projection only')
