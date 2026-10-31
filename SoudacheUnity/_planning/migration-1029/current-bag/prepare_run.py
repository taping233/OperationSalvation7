from pathlib import Path
root = Path(__file__).resolve().parents[3]
source = root / 'Assets/Scripts/Sdt.Run/CardContainerCommands.cs'
text = source.read_text(encoding='utf-8-sig')
def replace(before, after):
    global text
    assert before in text, before
    text = text.replace(before, after, 1)
replace('public const string PouchId="tt7-stratagem",PearlId="tt2-pearlbox";', 'public const string PouchId="tt7-stratagem",PearlId="tt2-pearlbox";\n        static string Stable(CardDef card)=>GameRuntime.DepartureStackKey(new StashStack{card=card});')
replace('GroupBy(o=>o.card.name)', 'GroupBy(o=>Stable(o.card))')
replace('Normal(o)&&o.card.name==card.name', 'Normal(o)&&Stable(o.card)==Stable(card)')
before='''                if(!take){
                    if(observed!=null){if(observed.Count==0||observed.Distinct().Count()!=observed.Count)throw new InvalidOperationException("卡牌选择已变化");entries=entries.Where(o=>observed.Contains(o.uid)).ToList();if(entries.Count!=observed.Count)throw new InvalidOperationException("卡牌已不在原位置");}
                    else if(entries.Count>0)entries=entries.Take(StackCap(entries[0].card)).ToList();
                }'''
after='''                // Both directions consume the observed UID set, including same-name variants.
                if(observed!=null){
                    if(observed.Count==0||observed.Distinct().Count()!=observed.Count)throw new InvalidOperationException("卡牌选择已变化");
                    entries=entries.Where(o=>observed.Contains(o.uid)).ToList();
                    if(entries.Count!=observed.Count||entries.Select(o=>Stable(o.card)).Distinct().Count()!=1)throw new InvalidOperationException("卡牌已不在原位置");
                }else if(entries.Count>0){
                    string stable=Stable(entries[0].card);entries=entries.Where(o=>Stable(o.card)==stable).ToList();
                    if(!take)entries=entries.Take(StackCap(entries[0].card)).ToList();
                }'''
replace(before,after)
replace('GroupBy(o=>o.card.name).Select(g=>new StashStack{card=g.First().card,count=g.Count()})', 'GroupBy(o=>Stable(o.card)).Select(g=>new StashStack{card=g.First().card,count=g.Count(),variantKey=g.First().card.variantKey})')
(Path(__file__).resolve().parent / 'CardContainerCommands.cs').write_text(text,encoding='utf-8')
