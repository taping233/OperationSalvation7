from pathlib import Path
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('altarActivated=g.altarActivated,bossDefeated=g.bossDefeated,nodeRewards=g.nodeRewards,','altarActivated=g.altarActivated,bossDefeated=g.bossDefeated,nodeRewards=g.nodeRewards,entrySupply=g.entrySupply,spellPower=g.spellPower,',1)
s=s.replace('g.altarActivated=s.altarActivated;g.bossDefeated=s.bossDefeated;','g.altarActivated=s.altarActivated;g.bossDefeated=s.bossDefeated;g.entrySupply=s.entrySupply;g.spellPower=s.spellPower;',1)
s=s.replace('g.altarActivated=false;g.bossDefeated=false;g.spellPower=0;','g.altarActivated=false;g.bossDefeated=false;g.spellPower=0;g.entrySupply=null;',1)
s=s.replace('int bonus = (lv - 1) * 2;','int bonus = lv - 1;',1)
a=s.index('            var card = CardLibrary.RandomClassCard(Rng, ch.rulesetId);')
b=s.index('            if (fromChoice)',a)
s=s[:a]+'''            var card = CardLibrary.RandomClassCard(Rng, ch.rulesetId);
            var second=CardLibrary.RandomClassCard(Rng,ch.rulesetId);
            for(int i=0;i<8&&card!=null&&second!=null&&card.id==second.id;i++)second=CardLibrary.RandomClassCard(Rng,ch.rulesetId);
            State.entrySupply=new EntrySupplyReceipt();
            if(card!=null){State.classCard=card;State.entrySupply.cardIds.Add(card.id);}
            if(second!=null&&second.id!=card?.id)State.entrySupply.cardIds.Add(second.id);
'''+s[b:]
s=s.replace('        public void ExitToTitle()\n        {\n            SaveCurrent();\n            ShowTitle();\n        }','''        public bool ExitToTitle()
        {
            if(State.runActive){SaveCurrent();if(!Saves.LastWriteSucceeded)return false;}
            ShowTitle();return true;
        }''',1)
p.write_text(s,encoding='utf-8')
