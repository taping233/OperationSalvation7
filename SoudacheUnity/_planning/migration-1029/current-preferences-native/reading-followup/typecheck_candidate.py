from pathlib import Path
p=Path(__file__).resolve().parent
source=(p.parents[1]/'check_compile.py').read_text(encoding='utf-8')
source=source.replace('parents[2]','parents[4]').replace(' / "compile"',' / "typecheck"')
source=source.replace('escape(str(file))','escape(str(file if file.name != "CardFace.cs" else Path(__file__).resolve().parent / "CardFace.cs.candidate"))')
exec(compile(source,str(p/'typecheck_candidate.py'),'exec'))
