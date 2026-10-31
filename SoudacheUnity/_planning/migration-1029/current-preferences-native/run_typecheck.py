from pathlib import Path
p=Path(__file__).resolve().parent
source=(p.parent/'check_compile.py').read_text(encoding='utf-8')
source=source.replace('parents[2]','parents[3]').replace(' / "compile"',' / "typecheck"')
exec(compile(source,str(p/'run_typecheck.py'),'exec'))
