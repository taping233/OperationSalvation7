using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using Sdt.Core;
using Sdt.Core.Battle;

partial class Audit {
 static object Invoke(BattleSession b,string name,params object[] args)=>typeof(BattleSession).GetMethod(name,BF).Invoke(b,args);
 static CardDef Definition(string id)=>CardDatabase.All.Single(c=>c.id==id).Clone();
 static void Give(BattleSession b,string id){var c=Definition(id);c.runtimeCost=0;Invoke(b,"AddTempCard",c);}
 static BattleFoe Foe(BattleSession b)=>((List<BattleFoe>)Field(b,"foes"))[0];
 static void Op(BattleSession b,RuleValue op)=>Invoke(b,"ApplyRuleOperation",Definition("tt13-chaos-deck"),op,Foe(b));
 static void BoundaryChecks(){
  var s=Start("tt13-guard");Play(s.b,"tt13-guard");Record("guardWithoutEnemyDamage",s.b.Snapshot.pdef.Armor,10);
  s=Start("starter-attack","tt13-guard");Foe(s.b).defense.Armor=100;Play(s.b,"starter-attack");Play(s.b,"tt13-guard");Record("guardAfterFullyBlockedEnemyHit",s.b.Snapshot.pdef.Armor,10);
  s=Start("tt13-guard");Invoke(s.b,"OnStructuredPlayerDamaged",Foe(s.b),1);Play(s.b,"tt13-guard");Record("guardAfterOnlyPlayerDamaged",s.b.Snapshot.pdef.Armor,10);
  s=Start("starter-attack","tt13-guard");Play(s.b,"starter-attack");s.b.EndTurn();Play(s.b,"tt13-guard");Record("guardEnemyDamageResetsPerTurn",s.b.Snapshot.pdef.Armor,10);

  s=Start("tt13-astrolabe","starter-attack","tt3-fireball");Play(s.b,"tt13-astrolabe");s.b.EndTurn();int e=s.b.Snapshot.energy;Play(s.b,"starter-attack");Record("astrolabeTurnTwoMartialNoRefund",s.b.Snapshot.energy-e,0);e=s.b.Snapshot.energy;Play(s.b,"tt3-fireball");Record("astrolabeTurnTwoFirstSpellRefund",s.b.Snapshot.energy-e,1);
  s=Start("starter-attack","tt13-astrolabe","starter-attack");Play(s.b,"starter-attack");Play(s.b,"tt13-astrolabe");e=s.b.Snapshot.energy;Play(s.b,"starter-attack");Record("astrolabeMidTurnEquipCannotRefundSecondMartial",s.b.Snapshot.energy-e,0);
  s=Start("tt13-astrolabe","tt13-astrolabe","starter-attack");Play(s.b,"tt13-astrolabe");Play(s.b,"tt13-astrolabe");e=s.b.Snapshot.energy;Play(s.b,"starter-attack");Record("twoAstrolabesEachRefund",s.b.Snapshot.energy-e,2);

  var eligibleSpell=CardDatabase.All.First(c=>c.type=="法术"&&CardLibrary.IsRandomObtainable(c));
  s=Start("tt8-hero-priest");var deck=s.b.Snapshot.drawPile.ToArray();CardLibrary.Init(()=>new[]{eligibleSpell});Play(s.b,"tt8-hero-priest");Record("priestForcedSpellPoolFillsSix",s.b.Snapshot.hand.Count,6);Record("priestSixSpellsHeal18",s.h.Hp,48);Record("priestOriginalDeckOrderUnchanged",s.b.Snapshot.drawPile.ToArray(),deck);Record("priestGeneratedOnlyPoolCards",s.b.Snapshot.hand.All(uid=>s.b.FindCard(uid).card.id==eligibleSpell.id),true);CardLibrary.Init(()=>CardDatabase.All);
  s=Start("tt8-hero-priest");((Combatant)Field(s.b,"pstat")).status.healban=1;CardLibrary.Init(()=>new[]{eligibleSpell});Play(s.b,"tt8-hero-priest");Record("priestHealBanRespected",s.h.Hp,30);CardLibrary.Init(()=>CardDatabase.All);
  s=Start("tt8-hero-priest");CardLibrary.Init(()=>Array.Empty<CardDef>());Play(s.b,"tt8-hero-priest");Record("priestEmptyRandomPoolStops",s.b.Snapshot.hand.Count,0);CardLibrary.Init(()=>CardDatabase.All);
  var apollo=Definition("tt2-apollo");var bandage=Definition("tt3-bandage");
  s=Start("tt8-hero-priest");CardLibrary.Init(()=>new[]{apollo});e=s.b.Snapshot.energy;Play(s.b,"tt8-hero-priest");Record("priestApolloAcquireHookPerCard",s.b.Snapshot.energy,e+6);Record("priestApolloStillFillsSix",s.b.Snapshot.hand.Count,6);CardLibrary.Init(()=>CardDatabase.All);
  s=Start();CardLibrary.Init(()=>new[]{apollo,bandage});e=s.b.Snapshot.energy;Invoke(s.b,"AddTempCard",apollo);Record("tempApolloAcquireHookOnce",s.b.Snapshot.energy,e+1);Record("tempApolloAcquiresAnotherCard",s.b.Snapshot.hand.Count,2);Invoke(s.b,"AddTempCard",apollo);Record("separateApolloAcquisitionsBothTrigger",s.b.Snapshot.energy,e+2);CardLibrary.Init(()=>CardDatabase.All);
  s=Start();CardLibrary.Init(()=>new[]{apollo,bandage});e=s.b.Snapshot.energy;int initialDeck=s.b.Snapshot.drawPile.Count;Invoke(s.b,"AddDeckCard",apollo);Record("deckApolloAcquireHookOnce",s.b.Snapshot.energy,e+1);Record("deckApolloGoesToDeck",s.b.Snapshot.drawPile.Count,initialDeck+1);Record("deckApolloExtraCardGoesToHand",s.b.Snapshot.hand.Count,1);CardLibrary.Init(()=>CardDatabase.All);
  s=Start();CardLibrary.Init(()=>new[]{apollo,bandage});e=s.b.Snapshot.energy;Op(s.b,RuleValue.Obj("op","acquire","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr(apollo.id))));Record("acquireApolloDoesNotDoubleTrigger",s.b.Snapshot.energy,e+1);CardLibrary.Init(()=>CardDatabase.All);
  s=Start();CardLibrary.Init(()=>new[]{apollo,bandage});e=s.b.Snapshot.energy;Invoke(s.b,"StartStructuredDiscover",apollo,RuleValue.Obj("pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr(apollo.id))),Foe(s.b),null);s.b.PickDiscover(0);Record("discoverApolloDoesNotDoubleTrigger",s.b.Snapshot.energy,e+1);CardLibrary.Init(()=>CardDatabase.All);

  s=Start("tt13-chaos-deck","tt3-fireball","tt3-bandage");Set(s.b,"mode","boss");var fuel=s.b.Snapshot.hand.Where(uid=>s.b.FindCard(uid).card.id!="tt13-chaos-deck").ToArray();Play(s.b,"tt13-chaos-deck");Record("chaosBossOtherCardsDiscard",fuel.All(uid=>s.b.Snapshot.discard.Contains(uid)),true);Record("chaosBossOtherCardsNotGrave",fuel.Any(uid=>Pile(s.b,"grave").Contains(uid)),false);Record("chaosDiscardNoFuelCounters",Field(s.b,"infusionTotal"),0);

  s=Start("tt3sp-shadowbug","tt3sp-shadowbug");Foe(s.b).atk=8;Play(s.b,"tt3sp-shadowbug");Play(s.b,"tt3sp-shadowbug");s.b.EndTurn();Record("stealRepeatedZeroGrantRestoresExactly",Foe(s.b).atk,8);Record("stealPlayerHasNoResidualBuff",s.b.Snapshot.pstat.status["atkUp"],0);
  s=Start();Foe(s.b).atk=8;Op(s.b,RuleValue.Obj("op","stealAtk","amount",2,"duration",2));Op(s.b,RuleValue.Obj("op","stealAtk","amount",1,"duration",1));s.b.EndTurn();Record("stealIndependentExpiryEnemyTurnTwo",Foe(s.b).atk,6);Record("stealIndependentExpiryPlayerTurnTwo",s.b.Snapshot.pstat.status["atkUp"],2);s.b.EndTurn();Record("stealIndependentExpiryEnemyTurnThree",Foe(s.b).atk,8);Record("stealIndependentExpiryPlayerTurnThree",s.b.Snapshot.pstat.status["atkUp"],0);
  s=Start("cc-poison-burst");Foe(s.b).status.poison=3;Foe(s.b).status.immune=1;Play(s.b,"cc-poison-burst");Record("poisonBurstRespectsImmunity",Foe(s.b).hp,100);
  s=Start("tt3sp-flowerzhen");Foe(s.b).status.poison=3;Foe(s.b).defense.Armor=5;Play(s.b,"tt3sp-flowerzhen");Record("poisonMultiplyBurstHp",Foe(s.b).hp,94);Record("poisonMultiplyBurstStacks",Foe(s.b).status.poison,6);Record("poisonMultiplyBurstKeepsArmor",Foe(s.b).defense.Armor,5);
  s=Start("cc-poison-burst");Foe(s.b).hp=2;Foe(s.b).status.poison=3;Play(s.b,"cc-poison-burst");Record("poisonBurstLethalEnemyMarkedDead",Foe(s.b).dead,true);

  s=Start("cmtn1ntxzoc4");Op(s.b,RuleValue.Obj("op","registerInfusionBonus","every",2,"key","spellUp","stacks",1));var uid=s.b.Snapshot.hand[0];Invoke(s.b,"RecordRuleConsumption",uid);Op(s.b,RuleValue.Obj("op","registerInfusionBonus","every",2,"key","spellUp","stacks",1));Invoke(s.b,"RecordRuleConsumption",uid);Record("infusionNewInstanceStartsOwnCounter",s.b.Snapshot.pstat.status["spellUp"],1);Invoke(s.b,"RecordRuleConsumption",uid);Record("infusionSecondInstanceReachesOwnThreshold",s.b.Snapshot.pstat.status["spellUp"],2);

  s=Start("tt3-frostfall","starter-attack");Set(s.b,"mode","boss");Play(s.b,"tt3-frostfall");var chosen=s.b.Snapshot.RuleHandSelection.candidateUids.Single();e=s.b.Snapshot.energy;s.b.SelectRuleHand(chosen);Record("selectedAutoPlayBossDiscard",s.b.Snapshot.discard.Contains(chosen),true);Record("selectedAutoPlayFree",s.b.Snapshot.energy,e);Record("selectedAutoPlayMoveCounter",Field(s.b,"rulePlayedMoves"),2);
  s=Start("starter-attack","starter-attack");var ids=s.b.Snapshot.hand.ToArray();Op(s.b,RuleValue.Obj("op","release","key","初始攻击","max",1));Record("releaseHonorsMaximum",ids.Count(id=>Pile(s.b,"played").Contains(id)),1);
  s=Start("tt8-hero-sword");Play(s.b,"tt8-hero-sword");Record("castDrawnFiveAttacksRecorded",Pile(s.b,"played").Count,6);Record("castDrawnMovesCounted",Field(s.b,"rulePlayedMoves"),5);Record("castDrawnNoFuelSpent",Field(s.b,"infusionTotal"),0);
  s=Start();Op(s.b,RuleValue.Obj("op","release","source","generated","key","初始攻击"));Record("generatedReleaseRecorded",Pile(s.b,"played").Count,1);
  s=Start();Set(s.b,"mode","boss");Op(s.b,RuleValue.Obj("op","acquire","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball")),"act","play"));Record("acquireAutoPlayRecorded",Pile(s.b,"played").Count,1);Record("acquireAutoPlayBossDiscard",s.b.Snapshot.discard.Count,1);
  s=Start("tt3sp-bloodstorm");var autoBlood=s.b.Snapshot.hand.Single();e=s.b.Snapshot.energy;Invoke(s.b,"CastRuleHandCard",autoBlood,Foe(s.b),true);Record("directReleaseInfusedWithoutFuel",Foe(s.b).hp,90);Record("directReleaseFree",s.b.Snapshot.energy,e);Record("directReleaseDoesNotCountFuel",Field(s.b,"infusionTotal"),0);
  s=Start();var childRule=RuleValue.Obj("triggers",RuleValue.Obj("onPlay",RuleValue.Arr(RuleValue.Obj("op","choice","options",RuleValue.Arr(RuleValue.Obj("label","确认","ops",RuleValue.Arr(RuleValue.Obj("op","energy","n",1))))))));
  var parent=new CardDef{id="fixture-parent",name="母牌",type="能力卡",runtimeCost=0,rules=RuleValue.Obj("triggers",RuleValue.Obj("onPlay",RuleValue.Arr(RuleValue.Obj("op","release","key","child"),RuleValue.Obj("op","energy","n",10))))};
  var children=new[]{new CardDef{id="fixture-child1",name="child1",type="武术",runtimeCost=0,rules=childRule},new CardDef{id="fixture-child2",name="child2",type="法术",runtimeCost=0,rules=childRule}};
  foreach(var c in new[]{parent}.Concat(children)){s.h.cards.Add(new OwnedCard{uid=c.id,card=c});Pile(s.b,"hand").Add(c.id);}e=s.b.Snapshot.energy;Play(s.b,parent.id);Record("automaticChildChoicePausesParent",s.b.Snapshot.energy,e);Record("automaticChildPendingNoCompletedMoves",Field(s.b,"rulePlayedMoves"),0);s.b.ChooseRuleOption(0);Record("automaticSecondChildChoicePausesParent",s.b.Snapshot.energy,e+1);s.b.ChooseRuleOption(0);Record("automaticParentResumesAfterBothChildren",s.b.Snapshot.energy,e+12);Record("automaticNestedChildrenBothRecorded",Pile(s.b,"played").Count,3);Record("automaticNestedChildrenBothCompleted",Field(s.b,"rulePlayedMoves"),2);
  s=Start();var randomChild=new CardDef{id="fixture-random-child",name="随机施放子牌",type="法术",rarity="古朴",rules=childRule};CardLibrary.Init(()=>new[]{randomChild});e=s.b.Snapshot.energy;Op(s.b,RuleValue.Obj("op","castRandomSpells","count",2,"infused",true));Record("randomAutoBatchOnlySubmitsFirstPendingChild",Pile(s.b,"played").Count,1);s.b.ChooseRuleOption(0);Record("randomAutoBatchSubmitsSecondAfterFirstChoice",Pile(s.b,"played").Count,2);s.b.ChooseRuleOption(0);Record("randomAutoBatchCompletesBothChildren",s.b.Snapshot.energy,e+2);CardLibrary.Init(()=>CardDatabase.All);

  s=Start("tt8-heavensword");var sword=s.b.Snapshot.hand.Single();Pile(s.b,"hand").Clear();Pile(s.b,"drawPile").Clear();Pile(s.b,"drawPile").Add(sword);Invoke(s.b,"DrawCards",1);Record("onDrawSwordRetainsInHand",s.b.Snapshot.hand.Contains(sword),true);Record("onDrawSwordNotDiscarded",s.b.Snapshot.discard.Contains(sword),false);
  s=Start("starter-attack");Foe(s.b).affix="frenzy";Foe(s.b).atk=4;((DefenseState)Field(s.b,"pdef")).Armor=50;s.b.EndTurn();Record("frenzyFullyAbsorbedNoCurse",s.b.Snapshot.pstat.status["bleed"]+s.b.Snapshot.pstat.status["poison"],0);
  s=Start("starter-attack");Foe(s.b).affix="frenzy";Foe(s.b).atk=1;s.b.EndTurn();Record("frenzyActualDamageAddsTwoCurses",s.b.Snapshot.pstat.status["bleed"]+s.b.Snapshot.pstat.status["poison"],2);
  using var vectors=JsonDocument.Parse(System.IO.File.ReadAllText("_planning/migration-1029/current-node-rooms/isolated/card-semantics-fix/boundary-source-vectors.json"));
  foreach(var v in vectors.RootElement.GetProperty("costVectors").EnumerateArray()){
   s=Start();Pile(s.b,"drawPile").Clear();int i=0;foreach(var id in v.GetProperty("input").EnumerateArray()){
    var c=Definition(id.GetString());string key="source-cost:"+i++;s.h.cards.Add(new OwnedCard{uid=key,card=c});Pile(s.b,"drawPile").Add(key);
   }
   Set(s.b,"rng",new Rng(v.GetProperty("seed").GetInt32()));Op(s.b,RuleValue.Obj("op","transformCards","raritySteps",1,"swapCosts",true));
   Record("chaosSourceExactSeed"+v.GetProperty("seed"),s.b.Snapshot.drawPile.Select(uid=>s.b.FindCard(uid).card).Select(c=>$"{c.id}|{c.type}|{c.rarity}|{c.cost}").ToArray(),v.GetProperty("expected").EnumerateArray().Select(x=>x.GetString()).ToArray());
  }
  int vectorIndex=0;foreach(var v in vectors.RootElement.GetProperty("poisonVectors").EnumerateArray()){
   int N(string key)=>v.GetProperty(key).GetInt32();
   var unit=new Combatant{hp=100,damageCap=N("cap"),status=new UnitStatus{poison=5,necroticExposure=N("exposure"),abreak=N("abreak"),immune=N("immune")},defense=new DefenseState{Armor=9}};
   var hit=CombatResolver.TickPoison(unit);Record("poisonSourceExactVector"+vectorIndex++,new[]{hit.dealt,unit.hp,unit.defense.Armor,unit.status.poison},v.GetProperty("expected").EnumerateArray().Select(x=>x.GetInt32()).ToArray());
  }
  results.AddRange(BossAudit.Run());
  CardLibrary.Init(()=>CardDatabase.All);
 }
}
