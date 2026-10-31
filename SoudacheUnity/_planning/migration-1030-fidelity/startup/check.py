from pathlib import Path
import hashlib,json,shutil,subprocess,sys,uuid
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SNAP=HERE/'snapshot'
for path in (ROOT/'Assets/Scripts').rglob('*.cs'):
    target=SNAP/path.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,target)
for path in (ROOT/'Assets/Scripts').rglob('*.asmdef'):
    target=SNAP/path.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,target)
source=ROOT/'_planning/migration-1030-fidelity/transitions/typecheck.py'
script=source.read_text(encoding='utf-8').replace('OUTPUT = Path(__file__).resolve().parent / "typecheck"','OUTPUT = Path(__file__).resolve().parent / "typecheck"\nSNAP = Path(__file__).resolve().parent / "snapshot"')
script=script.replace('(ROOT / "Assets/Scripts").rglob','(SNAP / "Assets/Scripts").rglob')
script=script.replace('UNITY_6000_6_OR_NEWER;UNITY_EDITOR','UNITY_6000_6_OR_NEWER;UNITY_STANDALONE_WIN')
(HERE/'private_typecheck.py').write_text(script,encoding='utf-8')
manifest={str(p.relative_to(SNAP)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in SNAP.rglob('*') if p.is_file()}
(HERE/'snapshot-sha256.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
result=subprocess.run([sys.executable,str(HERE/'private_typecheck.py'),'Sdt.Boot'],cwd=ROOT)
raise SystemExit(result.returncode)
