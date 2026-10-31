from pathlib import Path
p=Path(__file__).parent
def edit(f,old,new):
 f=p/f;s=f.read_text(encoding='utf-8-sig');assert s.count(old)==1,(f,old[:50],s.count(old));f.write_text(s.replace(old,new),encoding='utf-8')
edit('snapshot/Battle/StructuredRules.cs','public string act, sourceUid;','public string act, sourceUid, type;')
edit('snapshot/Battle/BattleHandPayment.cs','act="payment", n=HandRequirement(card).Number("count",1),','act="payment", type=HandRequirement(card).Text("type"), n=HandRequirement(card).Number("count",1),')
edit('ui/BattleRuleInputs.cs','void ToggleRulePayment(string uid,BattleSnapshot s,IBattleViewApi api)','bool PaymentEligible(string uid,BattleSnapshot s,IBattleViewApi api) => s.RuleHandSelection.candidateUids.Contains(uid) && s.Hand.Contains(uid) && BattleRules.MatchesHandSelectKey(api.FindCard(uid)?.Card,s.RuleHandSelection.type);\n        void ToggleRulePayment(string uid,BattleSnapshot s,IBattleViewApi api)')
edit('ui/BattleRuleInputs.cs','selection.candidateUids.Contains(uid) && s.Hand.Contains(uid) && _paymentPicked.Count<selection.n','PaymentEligible(uid,s,api) && _paymentPicked.Count<selection.n')
edit('ui/BattleRuleInputs.cs','s.Hand.Contains(p.Key) && selection.candidateUids.Contains(p.Key)','PaymentEligible(p.Key,s,api)')
edit('ui/BattleRuleInputs.cs','if(s.RuleHandSelection.act=="payment") card.Lift=_paymentPicked.ContainsKey(card.Uid);','if(s.RuleHandSelection.act=="payment") { card.SetOff(!PaymentEligible(card.Uid,s,api)); card.Lift=_paymentPicked.ContainsKey(card.Uid); }')
