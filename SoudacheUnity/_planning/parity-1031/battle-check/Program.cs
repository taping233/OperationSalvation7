using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Core.Battle;

static partial class Program
{
    sealed class Host : BattleHost
    {
        public int Hp { get; set; } = 1000;
        public int MaxHp => 1000;
        public int Atk => 0;
        public int SpellPower => 0;
        public string MyClass { get; set; }
        public string CharacterId => "wu";
        IReadOnlyList<OwnedCard> ownedCards;
        public int OwnedCardReads;
        public IReadOnlyList<OwnedCard> OwnedCards { get { OwnedCardReads++; return ownedCards; } set { ownedCards=value; } }
        public readonly List<string> Logs = new List<string>();
        public readonly List<BattleResult> Results = new List<BattleResult>();
        public void Log(string text,string kind = null) => Logs.Add(text);
        public void Heal(int amount) => Hp = Math.Min(MaxHp,Hp + amount);
        public void OnBattleEnd(BattleResult result) => Results.Add(result);
    }
    static int checks;
    static void Check(bool condition,string message) { if (!condition) throw new Exception(message); checks++; }
    static object Field(BattleSession session,string field) => typeof(BattleSession).GetField(field,BindingFlags.NonPublic|BindingFlags.Instance).GetValue(session);
    static void Set(BattleSession session,string field,object value) => typeof(BattleSession).GetField(field,BindingFlags.NonPublic|BindingFlags.Instance).SetValue(session,value);
    static CardDef Card(string id,string type = "武术",int cost = 0,params RuleValue[] operations) => new CardDef {
        id=id,name=id,type=type,cost=cost,desc="受控规则卡",rarity="古朴",rules=RuleValue.Obj("version",1,
            "battle",RuleValue.Obj("target",RuleValue.Obj("side",null,"area",false)),"triggers",RuleValue.Obj("onPlay",operations.Cast<object>().ToArray())) };
    static BattleSession Start(params CardDef[] cards)
    {
        var session = new BattleSession();
        session.Start(new BattleStartContext { host = new Host { OwnedCards=cards.Select((card,index)=>new OwnedCard { uid="c"+index,card=card }).ToArray() },
            rng=new Rng(1031),enemies=new[] { new EnemyInput { id="probe",name="受控敌人",hp=10000,atk=0 } } });
        Set(session,"energy",100); return session;
    }
    static CardDef Discount(params RuleValue[] modifiers)
    {
        var card=Card("discount","法术",6);
        card.rules.Get("battle").Values["costModifiers"]=modifiers.Cast<object>().ToArray(); return card;
    }
    static void Selection()
    {
        var copy=Card("copy","法术",0,RuleValue.Obj("op","handSelect","act","copy","n",2));
        var session=Start(copy,Card("material-a"),Card("material-b"));
        Check(session.PlayCard("c0",-2,false).Ok,"copy source rejected");
        var selection=session.Snapshot.RuleHandSelection;
        Check(selection.act=="copy"&&selection.n==2&&selection.canCancel&&selection.sourceCard==copy,"source selection contract incomplete");
        Check(!session.CancelRuleHandSelection(selection.selectionId+1).Ok,"stale selection cancelled current job");
        Check(session.SelectRuleHand("c1").Ok,"first copy rejected");
        var next=session.Snapshot.RuleHandSelection;
        Check(next.n==1&&next.selectionId==selection.selectionId,"multi-copy lost progress or identity");
        Check(session.SelectRuleHand("c2").Ok&&session.Snapshot.RuleHandSelection==null,"second copy did not finish");
        Check(session.Snapshot.Hand.Count==4&&session.Snapshot.Hand.Contains("c1")&&session.Snapshot.Hand.Contains("c2"),"copy changed original materials");

        session=Start(copy,Card("material-a")); session.PlayCard("c0",-2,false); selection=session.Snapshot.RuleHandSelection;
        Check(selection.n==1,"selection did not clamp to matching cards");
        int count=session.Snapshot.Hand.Count;
        Check(session.CancelRuleHandSelection(selection.selectionId).Ok&&session.Snapshot.Hand.Count==count,"cancel applied copy effect");
        Check(session.Snapshot.RuleHandSelection==null&&session.Snapshot.Phase=="player","cancel leaked pending resolution");

        var typed=Card("typed","法术",0,RuleValue.Obj("op","handSelect","act","play","type","初始攻击","n",1));
        session=Start(typed,CardLibrary.SHA.Clone(),Card("other")); session.PlayCard("c0",-2,false);
        Check(session.Snapshot.RuleHandSelection.candidateUids.SequenceEqual(new[]{"c1"}),"selection does not use shared starter identity rules");
        Check(!session.SelectRuleHand("c2").Ok,"unqualified card selected");
        ((List<string>)Field(session,"hand")).Remove("c1");
        Check(!session.SelectRuleHand("c1").Ok,"removed UID selected");

        var payment=Card("payment","法术",0,RuleValue.Obj("op","armor","n",1));
        payment.rules.Get("battle").Values["requirements"]=RuleValue.Arr(RuleValue.Obj("kind","handCards","count",2));
        session=Start(payment,Card("material-a"),Card("material-b"));session.PlayCard("c0",-2,false);selection=session.Snapshot.RuleHandSelection;
        Check(selection.act=="payment"&&!selection.canCancel&&selection.sourceCard==payment,"payment contract changed");
        Check(!session.CancelRuleHandSelection(selection.selectionId).Ok,"mandatory payment was cancelled");
        Check(!session.ConfirmRuleHandPayment(selection.selectionId,new[]{"c1","c1"}).Ok,"duplicate material payment committed");
    }
    static void Costs()
    {
        var spell=Card("spell","法术",0,RuleValue.Obj("op","armor","n",1));
        var backup=CardLibrary.FindById("tt12-backupcell").Clone();
        var session=Start(spell,backup,Card("martial"));
        Check(session.GetEffectiveCost(backup)==6,"empty consumed pile discount");
        Check(session.PlayCard("c0",-2,false).Ok&&session.GetEffectiveCost(backup)==5,"played spell absent from consumed discount");
        ((List<string>)Field(session,"consumed")).AddRange(new[]{"c0","c0"});
        Check(session.GetEffectiveCost(backup)==5,"duplicate consumed UID counted twice");
        typeof(BattleSession).GetMethod("RestoreBattleConsumed",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(session,new object[]{1});
        Check(session.GetEffectiveCost(backup)==6,"restored spell retained stale discount");
        Set(session,"rulePlayedMartial",2);Set(session,"rulePlayedMoves",3);
        var moves=Discount(RuleValue.Obj("kind","movesPlayedDiscount","amount",1));
        Check(session.GetEffectiveCost(moves)==3,"movesPlayedDiscount missing");
        var mixed=Discount(RuleValue.Obj("kind","movesPlayedDiscount","amount",1),RuleValue.Obj("kind","martialPlayedDiscount","amount",1));
        Check(session.GetEffectiveCost(mixed)==4,"modifiers were applied cumulatively or in array order");
        var higher=Discount(RuleValue.Obj("kind","armorZeroFree"),RuleValue.Obj("kind","martialPlayedDiscount","amount",1));
        Check(session.GetEffectiveCost(higher)==4,"armorFree bypassed higher-priority martial discount");
        var legacyBase=Card("overridden","法术",5);legacyBase.runtimeCost=2;legacyBase.zeroCostUntilTurn=session.Turn;
        Check(session.GetEffectiveCost(legacyBase)==0,"exact-turn zero lost priority over changed base cost");
        legacyBase.zeroCostUntilTurn=null; ((Combatant)Field(session,"pstat")).status.cosmosForm=1;
        Check(session.GetEffectiveCost(legacyBase)==1,"changed base cost bypassed cosmos form");
        var infusion=Card("infused","法术");infusion.infuse=2;infusion.noInfuse=true;
        Check(session.GetInfusionNeed(infusion)==0,"waived instance still asks for infusion");
        infusion.noInfuse=false; ((HashSet<string>)Field(session,"persistentRules")).Add("allSpellsInfused");
        Check(session.GetInfusionNeed(infusion)==0,"battle-wide waiver absent from view read");
        Check(session.Mode=="normal"&&session.Turn==session.Snapshot.Turn,"read-only mode/turn projection changed");
    }
    static void Main()
    {
        CardLibrary.Init(()=>CardDatabase.All);Selection();EquipmentCancellation();Costs();Presentation();ShortcutProjection();TargetReadProjection();HandTransformLookups();
        AutomaticCastSelections();AutomaticCastDrawSelections();AutomaticGeneratedSelections();NecromancerFeedback();
        EnemyTurnSelections();
        DiscoveryCancellation();
        DiscoveryPreviewChecks();
        CardPresentationChecks();
        Console.WriteLine("PASS "+checks+" current production battle assertions; source semantics: hand-material-selection, hand-selection, card-cost and card-inspection.");
    }
    static void ShortcutProjection()
    {
        var source=Card("source","法术");var same=Card("same");var other=Card("other");var renamed=Card("custom");renamed.name="初始攻击";
        var entries=new[]{("a",same),("source",source),("b",other),("c",same.Clone()),("equip",Card("equip","装备")),("sha",CardLibrary.SHA.Clone()),("renamed",renamed)};
        var order=BattleHandProjection.InfusionShortcuts(entries,"source",card=>card.cost);
        Check(order.SequenceEqual(new[]{"sha","a","c","b","renamed","equip"}),"infusion shortcuts lost physical UID grouping/rank/order");
        Check(entries[0].Item1=="a"&&entries[2].Item1=="b"&&entries[3].Item1=="c","shortcut projection changed original hand order");
        Check(BattleHandProjection.InfusionShortcuts(entries,"source",card=>card.cost).SequenceEqual(order),"shortcut projection is not repeatable");
        var expensive=Card("same-cost-variant","法术",3);var cheaper=expensive.Clone();cheaper.cost=1;
        var variantEntries=new[]{("high-a",expensive),("low",cheaper),("high-b",expensive.Clone()),("source",source)};
        Check(BattleHandProjection.StackKey(expensive,1)!=BattleHandProjection.StackKey(cheaper,1),"equal effective cost erased original cost identity");
        Check(BattleHandProjection.StackKey(expensive,1)==BattleHandProjection.StackKey(variantEntries[2].Item2,1),"identical original and effective cost did not stack");
        Check(BattleHandProjection.InfusionShortcuts(variantEntries,"source",_=>1).SequenceEqual(new[]{"high-a","high-b","low"}),"original-cost variants lost stack/physical UID shortcut order");
        Check(variantEntries.Select(entry=>entry.Item1).SequenceEqual(new[]{"high-a","low","high-b","source"})&&expensive.cost==3&&cheaper.cost==1,"cost projection mutated source cards or hand order");
    }
    static void TargetReadProjection()
    {
        var session=Start(Card("target-a"),Card("target-b"));var host=(Host)Field(session,"G");
        string token=session.Snapshot.BattleToken;host.OwnedCardReads=0;
        bool sameToken=true;for(int i=0;i<100;i++)sameToken&=session.BattleToken==token;
        Check(sameToken,"direct battle token changed identity");
        Check(host.OwnedCardReads==0,"identity read projected live battle inventory");
        var original=session.FindCard("c0").card;
        var pending=new PendingTargetSnapshot{uid="c0",card=original,Kind="fighters",BattleToken=token,SelectionId=27,ExcludedTargetIndex=0};
        Set(session,"pendingTarget",pending);
        var fuel=new List<string>{"c1"};Set(session,"pendingFuel",fuel);Set(session,"pendingFuelUid","c0");
        var fighters=((List<BattleFoe>)Field(session,"foes")).ToArray();Set(session,"preparedFighters",fighters);Set(session,"preparedFightersUid","c0");
        Action<BattleFoe> continuation=_=>{};Set(session,"deferredTargetAction",continuation);
        var current=original.Clone();current.name="当前有效牌";((Dictionary<string,CardDef>)Field(session,"cardOverrides"))["c0"]=current;
        session.LockPendingTarget(new PendingTargetSnapshot{uid="c0"});
        var kept=session.Snapshot.PendingTarget;
        Check(kept.Kind=="fighters"&&kept.BattleToken==token&&kept.SelectionId==27&&kept.ExcludedTargetIndex==0,"same-UID lock erased target ownership or selection state");
        Check(ReferenceEquals(kept.card,current)&&ReferenceEquals(pending.card,original),"same-UID lock lost current face or mutated previous target projection");
        Check(ReferenceEquals(Field(session,"pendingFuel"),fuel)&&ReferenceEquals(Field(session,"preparedFighters"),fighters)&&ReferenceEquals(Field(session,"deferredTargetAction"),continuation),"same-UID lock discarded payment or target continuation");
        session.LockPendingTarget(new PendingTargetSnapshot{uid="c1"});
        Check(Field(session,"pendingFuel")==null&&Field(session,"preparedFighters")==null&&Field(session,"deferredTargetAction")==null,"different UID retained the previous card's continuation");
        Check(session.Snapshot.PendingTarget.uid=="c1"&&session.Snapshot.PendingTarget.Kind==null,"different UID inherited old selection metadata");
        session.CancelPendingTarget();
        Check(session.Snapshot.PendingTarget==null&&session.Snapshot.Phase=="player"&&session.BattleToken==token,"cancel changed battle identity or left target state");
    }
    static void HandTransformLookups()
    {
        var imitate=Card("imitate-source");imitate.rules.Get("battle").Values["handTransform"]=RuleValue.Obj("afterType","武术","cost",1);
        var unchanged=Card("unrelated");var session=Start(imitate,unchanged);var host=(Host)Field(session,"G");
        var temporary=imitate.Clone();((List<OwnedCard>)Field(session,"granted")).Add(new OwnedCard{uid="temp-imitate",card=temporary});
        var hand=new List<string>{"c0","c1","temp-imitate"};Set(session,"hand",hand);
        var overrides=(Dictionary<string,CardDef>)Field(session,"cardOverrides");overrides["c0"]=Card("prior-copy");
        var played=Card("played-martial","武术",5);played.runtimeCost=2;
        var rng=(Rng)Field(session,"rng");var expected=new Rng(1);expected.LoadState(rng.SaveState());
        host.OwnedCardReads=0;
        var apply=typeof(BattleSession).GetMethod("ApplyHandTransforms",BindingFlags.NonPublic|BindingFlags.Instance);
        apply.Invoke(session,new object[]{played});
        Check(host.OwnedCardReads==hand.Count,"hand transforms repeated original inventory lookup per UID");
        Check(overrides.Count==2&&!overrides.ContainsKey("c1"),"unrelated card acquired a transform override");
        Check(overrides["c0"].id==played.id&&overrides["temp-imitate"].id==played.id&&overrides["c0"].cost==1&&overrides["temp-imitate"].cost==1,"owned or generated transform lost source rule or fixed cost");
        Check(overrides["c0"].runtimeCost==null&&overrides["temp-imitate"].runtimeCost==null&&!ReferenceEquals(overrides["c0"],overrides["temp-imitate"]),"transformed copies retained runtime override or shared mutable identity");
        Check(imitate.id=="imitate-source"&&temporary.id=="imitate-source"&&played.cost==5&&played.runtimeCost==2,"hand transform mutated raw source or played template");
        var first=overrides["c0"];apply.Invoke(session,new object[]{Card("wrong-type","法术")});
        Check(ReferenceEquals(overrides["c0"],first)&&hand.SequenceEqual(new[]{"c0","c1","temp-imitate"}),"wrong trigger type changed override or physical UID order");
        Check(rng.Random("battle")==expected.Random("battle"),"hand transform lookup optimization advanced gameplay random flow");
    }
    static void EquipmentCancellation()
    {
        foreach(string id in new[]{"tt3-crimson-pouch","tt7-naturestaff"})
        {
            var session=Start(CardLibrary.FindById(id).Clone(),Card("material"));
            Check(session.PlayCard("c0",-1,false).Ok,"equipment play rejected: "+id);
            Check(session.UseEquipment("c0").Ok,"equipment skill rejected: "+id);
            var selection=session.Snapshot.RuleHandSelection;
            Check(session.Snapshot.Equipment.Single().canUse,"preparing selection spent oncePerBattle: "+id);
            Check(session.CancelRuleHandSelection(selection.selectionId).Ok,"equipment selection cancel rejected: "+id);
            Check(session.Snapshot.Equipment.Single().canUse&&session.UseEquipment("c0").Ok,"cancel prevented reopening skill: "+id);
            Check(session.SelectRuleHand("c1").Ok&&!session.Snapshot.Equipment.Single().canUse,"confirmed selection did not spend oncePerBattle: "+id);
        }
    }
    static void Presentation()
    {
        var card=Card("kill","武术",0,RuleValue.Obj("op","damage","amount",10000,"dmgType","fixed","target","chosenEnemy"));
        var session=Start(card);var rng=(Rng)Field(session,"rng");var expected=new Rng(1);expected.LoadState(rng.SaveState());
        var cues=new List<BattleActorCue>();Action<BattleActorCue> capture=cue=>cues.Add(cue);BattleSession.ActorPresentation+=capture;
        try
        {
            Check(session.PlayCard("c0",0,false).Ok,"kill command rejected");
            Check(rng.Random("battle")==expected.Random("battle"),"visual kill cheer advanced gameplay battle stream");
            var hit=cues.Single(cue=>cue.Kind=="hit"&&cue.Unit==0);
            Check(hit.CardName==card.name&&hit.DamageType=="fixed"&&hit.HpAfter==0,"resolved hit lost source audio/art facts");
            Check(cues.Select(cue=>cue.Sequence).Distinct().Count()==cues.Count,"presentation sequences repeat");
        }
        finally { BattleSession.ActorPresentation-=capture; }
    }
}
