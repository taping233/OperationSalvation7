from pathlib import Path
p=Path(__file__).parent
def edit(f,old,new):
 f=p/f;s=f.read_text(encoding='utf-8-sig');assert s.count(old)==1,(f,old[:60],s.count(old));f.write_text(s.replace(old,new),encoding='utf-8')
edit('ui/BattlePresentation.cs','SyncInfusionWorkspace(s, api, cmd);','SyncPaymentDraft(s);\n            SyncInfusionWorkspace(s, api, cmd);')
edit('snapshot/Battle/BattleSession.cs','foreach(var entry in entries) RunStructuredTrigger(entry.card,"onConsume",Alive().FirstOrDefault());','foreach(var entry in entries) { if(entry.card.type=="法术") ruleConsumedSpells++; ResolveInfusedFuel(entry.card,Alive().FirstOrDefault()); }')
edit('snapshot/Battle/BattleRuleConsumers.cs','RunStructuredTrigger(card,"onConsume",Alive().FirstOrDefault());','ResolveInfusedFuel(card,Alive().FirstOrDefault());')
edit('snapshot/Battle/StructuredRules.cs','private int ApplyRuleRawHit(CardDef card, BattleFoe foe, int amount, string type, bool nonLethal)','private int ApplyRuleRawHit(CardDef card, BattleFoe foe, int amount, string type, bool nonLethal, bool preserveBaseDamage = false)')
edit('snapshot/Battle/StructuredRules.cs','if(persistentRules.Contains("stealthStrike")&&pstat.status.stealth>0)','if(!preserveBaseDamage && persistentRules.Contains("stealthStrike")&&pstat.status.stealth>0)')
edit('snapshot/Battle/StructuredRules.cs','if (damage <= 0) return;\n            foreach (var entry in equippedCards)','if (damage <= 0 || G.Hp<=0) return;\n            foreach (var entry in equippedCards.ToArray())')
edit('snapshot/Battle/StructuredRules.cs','response.Number("damage"), CombatResolver.FIXED, false);','response.Number("damage"), CombatResolver.FIXED, false, true);')
