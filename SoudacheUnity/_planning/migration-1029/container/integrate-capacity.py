from pathlib import Path
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('public int BagCap => Base.BagCap;','public int BagCap => CardContainerCommands.Query(this).totalCap;',1)
a=s.index('        public List<StashStack> CardStacks(bool safe)');b=s.index('        /// <summary>game.addItem',a)
s=s[:a]+'''        public List<StashStack> CardStacks(bool safe) => CardContainerCommands.ZoneStacks(State.ownedCards,safe);
        public int UsedSlots()=>CardContainerCommands.Query(this).used;
        public int SafeUsed()=>CardStacks(true).Count;
        public bool CanReceiveCard(CardDef card)=>CardContainerCommands.CanReceive(this,card);

'''+s[b:]
s=s.replace('''            if (slot == null && UsedSlots() >= BagCap)
            {''','''            int before=slot?.count??0;int delta=(before+n+2)/3-(before+2)/3;var capacity=CardContainerCommands.Query(this);
            if(delta>0&&(capacity.used+delta>capacity.totalCap||capacity.ordinarySlots+delta>capacity.baseCap))
            {''',1)
s=s.replace('if (!State.ownedCards.Any(o => o.card.name == tpl.name) && UsedSlots() >= BagCap)','if (!CanReceiveCard(tpl))',1)
s=s.replace('bool FitsRestored(CardDef c)=>State.ownedCards.Any(o=>o.safe!=true&&o.card.name==c.name)||UsedSlots()<BagCap;','bool FitsRestored(CardDef c)=>CanReceiveCard(c);',1)
p.write_text(s,encoding='utf-8')
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.Settlement.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('var kept=CardStacks(true);','var kept=CardContainerCommands.RescueCards(this);',1)
s=s.replace('var kept=g.ownedCards.Where(o=>o.safe==true&&o.brought!=1).GroupBy(o=>o.card.name).Select(group=>new StashStack{card=group.First().card,count=group.Count()}).ToList();','var kept=CardContainerCommands.RescueCards(this,false);',1)
p.write_text(s,encoding='utf-8')
p=Path('Assets/Scripts/Sdt.Run/GameRuntime.Map.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('o=>o.uid==id&&o.safe!=true','o=>o.uid==id&&o.safe!=true&&!o.stored&&string.IsNullOrEmpty(o.pouchOf)',1)
p.write_text(s,encoding='utf-8')
