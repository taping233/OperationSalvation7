from pathlib import Path
p=Path(__file__).parent/'snapshot/Battle/BattleSession.cs';s=p.read_text(encoding='utf-8-sig')
old='            if (paymentUids!=null)\n';assert s.count(old)==1;s=s.replace(old,'            int committedCost = freeCost ? 0 : EffCostOf(card);\n'+old)
old='            int effCost = freeCost ? 0 : EffCostOf(card);';assert s.count(old)==1;s=s.replace(old,'            int effCost = committedCost;');p.write_text(s,encoding='utf-8')
