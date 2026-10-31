from pathlib import Path
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.cs');s=p.read_text(encoding='utf-8-sig')
a=s.index('        public void SaveCurrent()');b=s.index('        /// <summary>game.session.js syncPlayTime',a)
s=s[:a]+'''        public void SaveCurrent()
        {
            if(!State.runActive||ActiveSlot==null||State.Phase=="title"||State.Phase=="done"||State.Phase=="boot"||Saves.InTransaction)return;
            TryPersistMutation(()=>{},out _);
        }

'''+s[b:]
s=s.replace('const int BaseFireHeal = 10;','const int BaseFireHeal = GameRules.FireHeal;',1)
p.write_text(s,encoding='utf-8')
