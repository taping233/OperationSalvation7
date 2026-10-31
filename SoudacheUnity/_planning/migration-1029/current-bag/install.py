"""Install reviewed draft only when the parent has opened the production write window."""
from pathlib import Path
import hashlib,json,sys,shutil
here=Path(__file__).resolve().parent
root=here.parents[2]
targets={f'Assets/Scripts/Sdt.UI/Screens/Bag/{p.name}':p for p in here.glob('*.cs') if p.name!='CardContainerCommands.cs'}
targets['Assets/Scripts/Sdt.Run/CardContainerCommands.cs']=here/'CardContainerCommands.cs'
if (here/'draft-run/BaseData.cs').exists():targets['Assets/Scripts/Sdt.Run/BaseData.cs']=here/'draft-run/BaseData.cs'
targets['Assets/Scripts/Sdt.UI/Screens/Bag/Resources/BagCurrentBackdrop.shader']=here/'Resources/BagCurrentBackdrop.shader'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
manifest=here/'target-before.json'
if '--prepare' in sys.argv:
    before=json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else {}
    if any(sha(root/name)!=expected for name,expected in before.items()):raise SystemExit('Production baseline changed; coordinate before preparing.')
    for name in targets:
        if name not in before:
            if manifest.exists() and (root/name).exists() and name!='Assets/Scripts/Sdt.Run/BaseData.cs':raise SystemExit('New target already exists; inspect before including '+name)
            before[name]=sha(root/name)
    manifest.write_text(json.dumps(before,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Prepared production baseline; wrote no production files.')
elif '--apply' in sys.argv:
    before=json.loads(manifest.read_text(encoding='utf-8'))
    changed=[name for name,expected in before.items() if sha(root/name)!=expected]
    if changed:raise SystemExit('Production changed; coordinate before installing: '+','.join(changed))
    for name,source in targets.items():
        target=root/name
        if target.exists():
            backup=here/'before'/name;backup.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(target,backup)
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        meta=target.with_name(target.name+'.meta')
        if not meta.exists():
            guid=hashlib.sha256(('current-bag:'+name).encode()).hexdigest()[:32]
            importer='ShaderImporter' if target.suffix=='.shader' else 'MonoImporter'
            meta.write_text(f'fileFormatVersion: 2\nguid: {guid}\n{importer}:\n  externalObjects: {{}}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n',encoding='utf-8')
    (here/'production-manifest.json').write_text(json.dumps({name:sha(root/name) for name in targets},ensure_ascii=False,indent=2),encoding='utf-8')
    print('Installed '+str(len(targets))+' files; native validation remains parent-owned.')
else:raise SystemExit('Use --prepare for a read-only production baseline, or --apply after the write window is granted.')
