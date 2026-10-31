from pathlib import Path
p=Path('Assets/Scripts/Sdt.View/BoardView.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('            // 键盘（App.RegisterKey')
b=s.index('            UpdateHover(src);',a)
s=s[:a]+'''            // 全局键盘动作由 App 统一分派，避免一次按键执行两次。
'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('_planning/migration-1029/map/compare.mjs');s=p.read_text(encoding='utf-8-sig')
s=s.replace("let failed=0;","let failed=0;const checked=[];")
s=s.replace(" const cs=JSON.parse", " checked.push(seed);\n const cs=JSON.parse")
s=s.replace("process.exitCode=failed?1:0;", "fs.writeFileSync(path.join(import.meta.dirname,'comparison-result.json'),JSON.stringify({passed:failed===0,seeds:checked,matched:checked.length-failed,failed,scope:'entry/exit; ordered id/index/x/row/type/name/next; doors'},null,2));\nprocess.exitCode=failed?1:0;")
p.write_text(s,encoding='utf-8')
