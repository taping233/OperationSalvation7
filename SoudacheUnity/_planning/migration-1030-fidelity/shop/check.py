from pathlib import Path
import subprocess,sys
directory=Path(__file__).resolve().parent
root=directory.parents[2]
source=(root/'_planning/migration-1029/check_compile.py').read_text(encoding='utf-8-sig')
source=source.replace('ROOT = Path(__file__).resolve().parents[2]','ROOT = Path('+repr(str(root))+')')
script=directory/'private_compile.py'
script.write_text('# -*- coding: utf-8 -*-\n'+source,encoding='utf-8')
raise SystemExit(subprocess.run([sys.executable,str(script)],cwd=root).returncode)
