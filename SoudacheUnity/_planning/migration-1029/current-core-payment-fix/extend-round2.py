from pathlib import Path
p=Path(__file__).parent
f=p/'snapshot/Battle/StructuredRules.cs';s=f.read_text(encoding='utf-8-sig');old='case "draw":\n                    n = Amount(card, op);';assert s.count(old)==1;s=s.replace(old,'case "draw":\n                    ResolveDrawHandOps(op);\n                    n = Amount(card, op);');f.write_text(s,encoding='utf-8')
for name in ['Round2.cs','source-round2-results.json']:(p/name).write_bytes((p.parent/'current-core-independent'/name).read_bytes())
(p/'Round2.csproj').write_text((p.parent/'current-core-independent/Round2.csproj').read_text().replace('snapshot-round2','snapshot'))
