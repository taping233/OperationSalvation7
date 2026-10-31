# -*- coding: utf-8 -*-
from pathlib import Path
import subprocess,sys
root=Path('SoudacheUnity').resolve();directory=root/'_planning/migration-1030-fidelity/slot-archive';s=(root/'_planning/migration-1029/check_compile.py').read_text(encoding='utf-8-sig');s=s.replace('ROOT = Path(__file__).resolve().parents[2]','ROOT = Path('+repr(str(root))+')');p=directory/'compile_private.py';p.write_text('# -*- coding: utf-8 -*-\n'+s,encoding='utf-8');raise SystemExit(subprocess.run([sys.executable,str(p)],cwd=root).returncode)
