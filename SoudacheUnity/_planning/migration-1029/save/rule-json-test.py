from pathlib import Path
p=Path('_planning/migration-1029/save/Program.cs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('using Sdt.Run;','using Sdt.Run;\nusing Sdt.Core.Battle;',1)
a=s.index('class Program {')
s=s[:a]+'''sealed class RuleHost : BattleHost {
 public int Hp{get;set;}=30;public int MaxHp=>30;public int Atk=>4;public int SpellPower=>0;public string MyClass=>"法师";public string CharacterId=>"baita";public IReadOnlyList<OwnedCard> OwnedCards{get;set;}
 public void Log(string text,string kind=null){}public void Heal(int n){Hp=Math.Min(MaxHp,Hp+n);}public void OnBattleEnd(BattleResult result){}
}
'''+s[a:]
a=s.index('  string beforeReplace=File.ReadAllText(SaveSystem.ProfilePath);')
s=s[:a]+'''  var ruleCard=new CardDef{id="save-rule-fixture",name="结构化护甲验证",cost=0,type="法术",rarity="古朴",desc="验证存档后规则执行",rules=RuleValue.Obj("triggers",RuleValue.Obj("onPlay",RuleValue.Arr(RuleValue.Obj("op","armor","amount",7))))};
  int Armor(CardDef c){var host=new RuleHost{OwnedCards=new[]{new OwnedCard{uid="rule",card=c}}};var battle=new BattleSession();battle.Start(new BattleStartContext{host=host,enemies=new[]{new EnemyInput{id="test",name="测试目标",hp=99,atk=0}},rng=new Rng(123)});Assert(battle.PlayCard("rule",-1,false).Ok,"结构化牌可提交");return battle.Snapshot.pdef.Armor;}
  Assert(Armor(ruleCard)==7,"原规则护甲7");g.State.ownedCards.Add(new OwnedCard{uid="rule",card=ruleCard});g.SaveCurrent();var restored=new SaveSystem().ReadSlot(5).ownedCards.First(o=>o.uid=="rule").card;
  Assert(restored.rules.Get("triggers") is RuleValue&&restored.rules.Get("triggers").Operations("onPlay").First().Number("amount")==7,"读档嵌套规则保持RuleValue");Assert(Armor(restored)==7,"读档实际牌效护甲7");
'''+s[a:]
p.write_text(s,encoding='utf-8')
