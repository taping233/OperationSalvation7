using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using Sdt.Core;
using Sdt.Core.Battle;

sealed class Host : BattleHost, BattleHostEffects {
 public int Hp {get;set;}=30; public int MaxHp=>60; public int Atk=>4; public int SpellPower=>2;
 public string MyClass=>"牧师"; public string CharacterId=>"wu";
 public List<OwnedCard> cards=new List<OwnedCard>(); public IReadOnlyList<OwnedCard> OwnedCards=>cards;
 public List<string> logs=new List<string>(); public void Log(string s,string k=null)=>logs.Add(s);
 public void Heal(int n)=>Hp=Math.Min(MaxHp,Hp+n); public void OnBattleEnd(BattleResult r){}
 public void GainCoins(int n){} public void ChangeMaxHp(int n){}
}
partial class Audit {
 static readonly List<object> results=new List<object>();
 static BindingFlags BF=BindingFlags.NonPublic|BindingFlags.Instance;
 static object Field(BattleSession b,string n)=>typeof(BattleSession).GetField(n,BF).GetValue(b);
 static void Set(BattleSession b,string n,object v)=>typeof(BattleSession).GetField(n,BF).SetValue(b,v);
 static List<string> Pile(BattleSession b,string n)=>(List<string>)Field(b,n);
 static (BattleSession b,Host h) Start(params string[] ids){
  var h=new Host(); foreach(var id in ids) h.cards.Add(new OwnedCard{uid=id+":"+h.cards.Count,card=CardLibrary.FindById(id).Clone()});
  foreach(var c in h.cards)c.card.runtimeCost=0;
  var b=new BattleSession(); b.Start(new BattleStartContext{host=h,rng=new Rng(123),enemies=new[]{new EnemyInput{id="dummy",name="目标",hp=100,atk=1}}});
  return(b,h);
 }
 static void Play(BattleSession b,string id){ var uid=b.Snapshot.hand.First(x=>b.FindCard(x).card.id==id); var c=b.FindCard(uid).card; string side=b.TargetSide(c); var r=b.PlayCard(uid,side=="self"?-1:side=="enemy"?0:-2,false); if(!r.Ok)throw new Exception(r.Reason); }
 static void Record(string name,object actual,object expected)=>results.Add(new{name,actual,expected,equal=JsonSerializer.Serialize(actual)==JsonSerializer.Serialize(expected)});
 static void Main(){
  CardLibrary.Init(()=>CardDatabase.All);
  var noRules=CardDatabase.All.Where(c=>c.rules==null).GroupBy(c=>c.type).ToDictionary(g=>g.Key,g=>g.Select(c=>c.id).ToArray());
  Record("catalogCount",CardDatabase.All.Length,291);
  results.Add(new{name="cardsWithoutRules",groups=noRules});
  var s=Start("starter-attack","tt13-guard"); Play(s.b,"starter-attack"); Play(s.b,"tt13-guard"); Record("guardAfterPlayerDealtDamage",s.b.Snapshot.pdef.Armor,6);
  s=Start("tt13-astrolabe","starter-attack","tt3-fireball","starter-attack"); Play(s.b,"tt13-astrolabe"); int e=s.b.Snapshot.energy; Play(s.b,"starter-attack"); Record("astrolabeFirstMartialRefund",s.b.Snapshot.energy-e,1); e=s.b.Snapshot.energy; Play(s.b,"tt3-fireball"); Record("astrolabeSameTurnOppositeTypeNoRefund",s.b.Snapshot.energy-e,0); e=s.b.Snapshot.energy; Play(s.b,"starter-attack"); Record("astrolabeSameTurnRepeatedMartialNoRefund",s.b.Snapshot.energy-e,0);
  s=Start("tt8-hero-priest"); int deck=s.b.Snapshot.drawPile.Count; Play(s.b,"tt8-hero-priest"); Record("heroPriestDoesNotDrawFromDeck",s.b.Snapshot.drawPile.Count,deck); results.Add(new{name="heroPriestGrantedCards",cards=s.b.Snapshot.hand.Select(uid=>s.b.FindCard(uid).card.id).ToArray()});
  s=Start("tt13-chaos-deck","tt3-fireball","tt3-bandage"); var other=s.b.Snapshot.hand.Where(uid=>s.b.FindCard(uid).card.id!="tt13-chaos-deck").ToArray(); Play(s.b,"tt13-chaos-deck"); Record("chaosOtherHandGoesToDiscard",other.All(uid=>s.b.Snapshot.discard.Contains(uid)),true); Record("chaosOtherHandNotConsumed",other.Any(uid=>Pile(s.b,"consumed").Contains(uid)),false);
  s=Start("tt13-chaos-deck"); var before=s.b.Snapshot.drawPile.ToDictionary(uid=>uid,uid=>s.b.FindCard(uid).card.type); Play(s.b,"tt13-chaos-deck"); var changed=before.Select(kv=>new{uid=kv.Key,from=kv.Value,to=s.b.FindCard(kv.Key).card.type,id=s.b.FindCard(kv.Key).card.id}).ToArray(); Record("chaosMaintainsCardType",changed.All(c=>c.from==c.to),true); results.Add(new{name="chaosTransformedDeck",cards=changed});
  s=Start("tt3sp-shadowbug"); var foe=((List<BattleFoe>)Field(s.b,"foes"))[0]; foe.atk=8; Play(s.b,"tt3sp-shadowbug"); Record("shadowbugDuringSteal",foe.atk,1); s.b.EndTurn(); Record("shadowbugEnemyAttackRestoredNextTurn",foe.atk,8); Record("shadowbugPlayerAttackRemovedNextTurn",s.b.Snapshot.pstat.status["atkUp"],0);
  s=Start("cc-poison-burst"); foe=((List<BattleFoe>)Field(s.b,"foes"))[0]; foe.status.poison=3;foe.defense.Armor=5;Play(s.b,"cc-poison-burst");Record("poisonBurstBypassesArmorHp",foe.hp,94);Record("poisonBurstPreservesArmor",foe.defense.Armor,5);
  s=Start("cmtn1ntxzoc4","cmtn1ntxzoc4","tt3sp-bloodstorm","starter-attack","starter-attack"); Play(s.b,"cmtn1ntxzoc4");Play(s.b,"cmtn1ntxzoc4"); var blood=s.b.Snapshot.hand.Single(uid=>s.b.FindCard(uid).card.id=="tt3sp-bloodstorm");var infusedResult=s.b.PlayCard(blood,0,true);if(!infusedResult.Ok)throw new Exception(infusedResult.Reason);Record("twoFlameFormsEachTrackTwoFuel",s.b.Snapshot.pstat.status["spellUp"],4);
  s=Start("tt3-frostfall","starter-attack");Play(s.b,"tt3-frostfall");var attack=s.b.Snapshot.RuleHandSelection.candidateUids.Single();s.b.SelectRuleHand(attack);Record("handSelectedPlayRecorded",Pile(s.b,"played").Contains(attack),true);
  s=Start("tt8-curse1","tt3-hold-fast");var curse=s.b.Snapshot.hand.Single(uid=>s.b.FindCard(uid).card.id=="tt8-curse1");Pile(s.b,"hand").Remove(curse);Pile(s.b,"drawPile").Clear();Pile(s.b,"drawPile").Add(curse);Play(s.b,"tt3-hold-fast");Record("onDrawTokenNotLeftInHand",s.b.Snapshot.hand.Contains(curse),false);Record("onDrawTokenGoesToDiscard",s.b.Snapshot.discard.Contains(curse),true);
  // Current catalog fallback reachability: all nonstructured playable cards, including fuel-only tokens.
  foreach(var c in CardDatabase.All.Where(c=>c.rules==null&&(c.type=="武术"||c.type=="法术"||c.type=="装备"||c.type=="能力卡"))){
   var v=Start(c.id); try{Play(v.b,c.id);}catch(Exception ex){results.Add(new{name="fallbackRejected",id=c.id,reason=ex.Message});continue;}
   if(v.h.logs.Any(log=>log.Contains("M1 后续实装")))results.Add(new{name="reachablePlaceholder",id=c.id,card=c.name,desc=c.desc});
  }
  BoundaryChecks();
  var json=JsonSerializer.Serialize(results,new JsonSerializerOptions{WriteIndented=true});
  System.IO.File.WriteAllText("_planning/migration-1029/current-node-rooms/isolated/card-semantics-fix/unity-results.json",json+Environment.NewLine);
  using var report=JsonDocument.Parse(json);
  var checks=report.RootElement.EnumerateArray().Where(r=>r.TryGetProperty("equal",out _)).ToArray();
  var failures=checks.Count(r=>!r.GetProperty("equal").GetBoolean());
  Console.WriteLine($"Card semantic checks: {checks.Length-failures}/{checks.Length} passed; failures: {failures}");
  foreach(var row in checks.Where(r=>!r.GetProperty("equal").GetBoolean()))Console.WriteLine(row.ToString());
  Environment.ExitCode=failures==0?0:1;
 }
}
