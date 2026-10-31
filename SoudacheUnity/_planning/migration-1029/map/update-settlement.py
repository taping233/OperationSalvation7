from pathlib import Path
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('        List<StashStack> _extractLeft;');b=s.index('        /// <summary>game.menu.js exitToTitle',a)
s=s[:a]+s[b:]
p.write_text(s,encoding='utf-8')
