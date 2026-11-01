using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Core.Battle;

// Actual Core commands with controlled state and explicit ID pools; these are
// not cross-language Source RNG vectors. The existing mist-box oracle owns those.
static partial class Program
{
    static RuleValue PreviewPool()=>RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball","tt3-petal","tt2-piercearrow","tt3-magic-lamp"));
    static CardDef PreviewCard(int count=1)
        =>Card("round6-preview","法术",2,RuleValue.Obj("op","discover","count",count,"pool",PreviewPool()));
    static BattleSession PreviewSession(CardDef source,bool twoEnemies=false)
    {
        var material=Card("round6-preview-fuel");var payment=Card("round6-preview-payment");
        var host=new Host{OwnedCards=new[]{new OwnedCard{uid="c0",card=source},new OwnedCard{uid="c1",card=material},new OwnedCard{uid="c2",card=payment}}};
        var session=new BattleSession();session.Start(new BattleStartContext{host=host,rng=new Rng(1031),enemies=twoEnemies
            ?new[]{new EnemyInput{id="preview-a",name="受控目标甲",hp=10000,atk=0},new EnemyInput{id="preview-b",name="受控目标乙",hp=10000,atk=0}}
            :new[]{new EnemyInput{id="preview-a",name="受控目标",hp=10000,atk=0}}});
        Set(session,"hand",new List<string>{"c0","c1","c2"});Set(session,"drawPile",new List<string>());Set(session,"energy",2);return session;
    }
    static string PreviewRandom(BattleSession session)=>((Rng)Field(session,"rng")).SaveState();
    static List<string> PreviewLedger(BattleSession session,string name)=>(List<string>)Field(session,name);
    // Normal mode's built-in starter deck remains in the real session; count only awarded entities.
    static List<OwnedCard> PreviewGranted(BattleSession session)
    {var starters=(HashSet<string>)Field(session,"normalStarterUids");return ((List<OwnedCard>)Field(session,"granted")).Where(entry=>!starters.Contains(entry.uid)).ToList();}
    static string[] PreviewOptions(BattleSession session)=>session.Snapshot.Discovering.options.Select(card=>card.id+"|"+(card.variantKey??"")).ToArray();
    static void PreviewNoPayment(BattleSession session,string[] hand,int energy,string label)
    {
        Check(session.Snapshot.Hand.SequenceEqual(hand)&&session.Snapshot.Energy==energy,label+" preserves current hand and energy");
        Check(PreviewLedger(session,"played").Count==0&&PreviewLedger(session,"consumed").Count==0&&PreviewGranted(session).Count==0
            &&(int)Field(session,"rulePlayedMoves")==0&&session.Snapshot.Pdef.Armor==0,label+" commits no source/fuel/payment, reward or completed play");
        Check(((BattleHost)Field(session,"G")).OwnedCards.Select(entry=>entry.uid).SequenceEqual(new[]{"c0","c1","c2"}),label+" retains all permanent physical host sources");
    }
    static BattleSession PaidPreview(int count=2,bool enemy=false,bool reactiveFuel=false)
    {
        var source=PreviewCard(count);source.infuse=1;
        source.rules.Get("battle").Values["requirements"]=RuleValue.Arr(RuleValue.Obj("kind","infused"),RuleValue.Obj("kind","handCards","count",1));
        if(enemy)source.rules.Get("battle").Get("target").Values["side"]="enemy";
        var session=PreviewSession(source,enemy);
        if(reactiveFuel)((BattleHost)Field(session,"G")).OwnedCards[1].card.rules.Get("triggers").Values["onConsume"]=RuleValue.Arr(RuleValue.Obj("op","discover","count",1,"pool",PreviewPool()));
        Check(!session.PlayCard("c0",enemy?0:-2,false).Ok&&session.Snapshot.Infusing!=null,"paid preview starts real required infusion draft");
        Check(session.SelectInfusion("c1").Ok&&session.ConfirmInfusion(enemy?0:-2).Ok&&session.Snapshot.RuleHandSelection?.act=="payment","infusion proceeds to actual mandatory hand payment");
        var payment=session.Snapshot.RuleHandSelection;
        Check(session.ConfirmRuleHandPayment(payment.selectionId,new[]{"c2"}).Ok&&session.Snapshot.Discovering?.sourceCommit=="preview","completed material drafts open unpaid preview");
        return session;
    }
    static void PreviewCancelAndCommit()
    {
        var session=PaidPreview();var first=session.Snapshot.Discovering;string token=session.Snapshot.BattleToken;
        PreviewNoPayment(session,new[]{"c0","c1","c2"},2,"initial preview");
        Check(session.CancelDiscover(token,first.selectionId).Ok&&session.Snapshot.Discovering==null,"first cancellation releases its own selection");
        PreviewNoPayment(session,new[]{"c0","c1","c2"},2,"first cancellation");
        Check(!session.PickDiscover(0,token,first.selectionId).Ok,"cancelled first ticket cannot later pay");

        session=PaidPreview();first=session.Snapshot.Discovering;token=session.Snapshot.BattleToken;string chosen=first.options[1].id;
        Check(session.PickDiscover(1,token,first.selectionId).Ok,"first selected ticket commits through the normal payment path");
        var second=session.Snapshot.Discovering;
        Check(session.Snapshot.Energy==0&&PreviewLedger(session,"played").SequenceEqual(new[]{"c0"})&&PreviewLedger(session,"consumed").OrderBy(uid=>uid).SequenceEqual(new[]{"c1","c2"}),"first ticket pays two energy and exact distinct infusion/payment UIDs once");
        Check(PreviewGranted(session).Count==1&&PreviewGranted(session)[0].card.id==chosen&&second!=null&&second.sourceCommit=="committed"&&second.selectionId!=first.selectionId,"first chosen candidate is awarded once and only the second paid round remains");
        string afterFirst=PreviewRandom(session);
        Check(!session.PickDiscover(1,token,first.selectionId).Ok&&session.Snapshot.Discovering.selectionId==second.selectionId&&PreviewGranted(session).Count==1,"old first ticket cannot take or repay the second round");
        Check(session.CancelDiscover(token,second.selectionId).Ok&&session.Snapshot.Discovering==null&&PreviewGranted(session).Count==1
            &&PreviewGranted(session)[0].card.id==chosen&&session.Snapshot.Energy==0&&PreviewLedger(session,"played").Count==1&&PreviewLedger(session,"consumed").Count==2&&PreviewRandom(session)==afterFirst,
            "second cancellation retains first award and all committed costs without another random draw");

        session=PaidPreview(2,reactiveFuel:true);first=session.Snapshot.Discovering;token=session.Snapshot.BattleToken;chosen=first.options[1].id;
        Check(session.PickDiscover(1,token,first.selectionId).Ok&&PreviewGranted(session).Count==0&&session.Snapshot.Discovering?.sourceCommit=="committed","fuel onConsume discovery waits independently rather than stealing the source's prepared ticket");
        var fuelRound=session.Snapshot.Discovering;int fuelIndex=fuelRound.options.ToList().FindIndex(card=>card.id!=chosen);string fuelChoice=fuelRound.options[fuelIndex].id;
        Check(session.PickDiscover(fuelIndex,token,fuelRound.selectionId).Ok&&PreviewGranted(session).Count==2
            &&PreviewGranted(session)[0].card.id==fuelChoice&&PreviewGranted(session)[1].card.id==chosen,"fuel confirmation is followed by the original source's exact prepared award in order");
        second=session.Snapshot.Discovering;
        Check(second!=null&&second.selectionId!=fuelRound.selectionId&&session.CancelDiscover(token,second.selectionId).Ok&&PreviewGranted(session).Count==2
            &&PreviewLedger(session,"played").SequenceEqual(new[]{"c0"})&&PreviewLedger(session,"consumed").Count==2,"source second-round cancellation preserves independent fuel award and single payment");
    }
    static void PreviewCacheAndPlan()
    {
        var source=PreviewCard();var session=PreviewSession(source);session.PlayCard("c0",-2,false);
        var first=session.Snapshot.Discovering;var options=PreviewOptions(session);string random=PreviewRandom(session),token=session.Snapshot.BattleToken;
        Check(session.CancelDiscover(token,first.selectionId).Ok,"cache fixture cancels unpaid first round");
        source.cost=1;
        Check(session.PlayCard("c0",-2,false).Ok&&PreviewOptions(session).SequenceEqual(options)&&PreviewRandom(session)==random,"printed-cost change reuses same-turn candidates and their order without reroll");
        var current=session.Snapshot.Discovering;
        Check(current.selectionId!=first.selectionId&&!session.CancelDiscover(token,first.selectionId).Ok,"reopened preview has its own identity and rejects the old cancellation");
        source.cost=3;
        Check(!session.PickDiscover(0,token,current.selectionId).Ok,"printed-cost increase is rechecked against live energy at commitment");
        PreviewNoPayment(session,new[]{"c0","c1","c2"},2,"increased-cost rejection");
        Set(session,"energy",3);Check(session.PlayCard("c0",-2,false).Ok&&PreviewOptions(session).SequenceEqual(options)&&PreviewRandom(session)==random,"retry with sufficient current energy retains printed-cost-independent cached candidates");
        current=session.Snapshot.Discovering;
        Check(session.PickDiscover(0,token,current.selectionId).Ok&&session.Snapshot.Energy==0&&PreviewGranted(session).Count==1,"successful retry pays the new printed cost exactly once");

        foreach(bool rulesChange in new[]{false,true})
        {
            source=PreviewCard();session=PreviewSession(source);session.PlayCard("c0",-2,false);first=session.Snapshot.Discovering;token=session.Snapshot.BattleToken;random=PreviewRandom(session);
            if(rulesChange)source.rules.Get("triggers").Values["onPlay"]=RuleValue.Arr(RuleValue.Obj("op","discover","count",2,"pool",PreviewPool()));
            else source.desc="当前计划已改变";
            Check(!session.PickDiscover(0,token,first.selectionId).Ok,"changed effective "+(rulesChange?"rules":"description")+" cannot redeem an old preview");
            PreviewNoPayment(session,new[]{"c0","c1","c2"},2,"changed-plan rejection");
            session.CancelDiscover(token,first.selectionId);
            Check(session.PlayCard("c0",-2,false).Ok&&PreviewRandom(session)!=random,"new effective plan receives a fresh same-turn candidate sample");
            current=session.Snapshot.Discovering;session.CancelDiscover(token,current.selectionId);session.EndTurn();
            random=PreviewRandom(session);Set(session,"energy",2);
            Check(session.PlayCard("c0",-2,false).Ok&&session.Snapshot.Turn>1&&PreviewRandom(session)!=random,"next actual turn does not reuse the previous-turn candidate cache");
        }
    }
    static void PreviewWaitingChanges()
    {
        foreach(string change in new[]{"source","energy","target","fuel","payment"})
        {
            var session=PaidPreview(1,change=="target");var waiting=session.Snapshot.Discovering;string token=session.Snapshot.BattleToken;
            if(change=="source")PreviewLedger(session,"hand").Remove("c0");
            else if(change=="energy")Set(session,"energy",0);
            else if(change=="target")((List<BattleFoe>)Field(session,"foes"))[0].dead=true;
            else PreviewLedger(session,"hand").Remove(change=="fuel"?"c1":"c2");
            var hand=session.Snapshot.Hand.ToArray();int energy=session.Snapshot.Energy;string random=PreviewRandom(session);
            Check(!session.PickDiscover(0,token,waiting.selectionId).Ok,"waiting "+change+" change rejects commitment");
            PreviewNoPayment(session,hand,energy,"waiting "+change+" change");
            Check(PreviewRandom(session)==random,"waiting "+change+" rejection does not sample another candidate");
        }
    }
    static CardDef PreviewBag(RuleValue operation)
    {
        var source=Card("round6-preview-item","道具",9);source.rules.Values["bag"]=RuleValue.Obj("use",RuleValue.Arr(operation));return source;
    }
    static void PreviewBagAndExclusions()
    {
        var source=PreviewBag(RuleValue.Obj("op","discover","count",9,"amount",2,"pool",PreviewPool()));var session=PreviewSession(source);
        Check(session.UseItem("c0").Ok&&session.Snapshot.Discovering?.sourceCommit=="preview","pure bag discovery previews before permanent-item consumption");
        var first=session.Snapshot.Discovering;string token=session.Snapshot.BattleToken;
        Check(session.CancelDiscover(token,first.selectionId).Ok&&PreviewLedger(session,"played").Count==0&&session.Snapshot.Hand.Contains("c0"),"bag cancellation retains actual permanent item source");
        session.UseItem("c0");first=session.Snapshot.Discovering;
        Check(session.PickDiscover(0,token,first.selectionId).Ok&&PreviewGranted(session).Count==1&&session.Snapshot.Discovering?.sourceCommit=="committed"&&session.Snapshot.Energy==2,"bag amount=2 controls rounds despite discover.count=9 and does not charge printed energy");
        var second=session.Snapshot.Discovering;session.PickDiscover(0,token,second.selectionId);
        Check(session.Snapshot.Discovering==null&&PreviewGranted(session).Count==2&&PreviewLedger(session,"played").SequenceEqual(new[]{"c0"})&&((BattleHost)Field(session,"G")).OwnedCards.Count(entry=>entry.uid=="c0")==1,"two bag awards consume the item ledger once while retaining its permanent host source");
        session=PreviewSession(source);session.UseItem("c0");first=session.Snapshot.Discovering;((BattleHost)Field(session,"G")).OwnedCards[0].safe=true;
        Check(!session.PickDiscover(0,session.Snapshot.BattleToken,first.selectionId).Ok&&PreviewLedger(session,"played").Count==0&&PreviewGranted(session).Count==0&&session.Snapshot.Hand.Contains("c0"),"item that becomes unavailable during preview cannot be consumed or award a candidate");
        source=PreviewBag(RuleValue.Obj("op","discover","count",7,"n",1,"pool",PreviewPool()));session=PreviewSession(source);session.UseItem("c0");first=session.Snapshot.Discovering;
        session.PickDiscover(0,session.Snapshot.BattleToken,first.selectionId);
        Check(session.Snapshot.Discovering==null&&PreviewGranted(session).Count==1,"bag discovery uses n when amount is absent rather than discover.count");
        source=PreviewBag(RuleValue.Obj("op","discover","n",0,"pool",PreviewPool()));session=PreviewSession(source);session.UseItem("c0");first=session.Snapshot.Discovering;
        Check(first?.sourceCommit=="preview"&&session.PickDiscover(0,session.Snapshot.BattleToken,first.selectionId).Ok&&session.Snapshot.Discovering==null&&PreviewGranted(session).Count==1,"absent bag amount with n zero retains source n-or-one fallback");
        source=PreviewBag(RuleValue.Obj("op","discover","amount",0,"n",2,"pool",PreviewPool()));session=PreviewSession(source);string zeroRandom=PreviewRandom(session);session.UseItem("c0");
        Check(session.Snapshot.Discovering==null&&PreviewGranted(session).Count==0&&PreviewLedger(session,"played").SequenceEqual(new[]{"c0"})&&PreviewRandom(session)==zeroRandom,"bag amount zero consumes its item normally without preview, sampling, award or substituting n");
        source=PreviewBag(RuleValue.Obj("op","acquire","pool",RuleValue.Obj("kind","legendary")));session=PreviewSession(source);session.UseItem("c0");
        Check(session.Snapshot.Discovering==null&&PreviewLedger(session,"played").SequenceEqual(new[]{"c0"})&&PreviewGranted(session).Count>0,"legendary bag acquire retains direct-award committed semantics");
        var mixed=Card("round6-mixed","法术",2,RuleValue.Obj("op","discover","count",1,"pool",PreviewPool()),RuleValue.Obj("op","armor","amount",1));session=PreviewSession(mixed);session.PlayCard("c0",-2,false);first=session.Snapshot.Discovering;
        Check(first!=null&&first.sourceCommit=="committed"&&session.Snapshot.Energy==0&&PreviewLedger(session,"played").SequenceEqual(new[]{"c0"}),"mixed operations remain committed before their first discovery");
        session.CancelDiscover(session.Snapshot.BattleToken,first.selectionId);
        Check(session.Snapshot.Pdef.Armor==1&&session.Snapshot.Energy==0,"committed cancellation resumes the non-discovery continuation without refund");
        source=Card("round6-conditional","法术",2,RuleValue.Obj("op","discover","count",1,"pool",PreviewPool(),"when",RuleValue.Obj("infused",true)));session=PreviewSession(source);session.PlayCard("c0",-2,false);
        Check(session.Snapshot.Discovering==null&&session.Snapshot.Energy==0&&PreviewLedger(session,"played").Count==1,"conditional discovery does not create an unpaid preview");
        foreach(bool direct in new[]{false,true})
        {
            source=PreviewCard();session=PreviewSession(source);Set(session,"energy",0);
            typeof(BattleSession).GetMethod("CastRuleHandCard",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(session,new object[]{"c0",null,direct});
            first=session.Snapshot.Discovering;
            Check(first!=null&&first.sourceCommit==(direct?"committed":"preview")&&session.Snapshot.Energy==0&&PreviewLedger(session,"played").Count==(direct?1:0),"actual free-cost execution "+(direct?"direct release remains committed":"still previews"));
            if(!direct)Check(session.PickDiscover(0,session.Snapshot.BattleToken,first.selectionId).Ok&&PreviewGranted(session).Count==1&&session.Snapshot.Energy==0,"free-cost preview commits normally with zero energy");
        }
        // Source-supported 道具 acquisition and moves bag pool, through the real source command.
        var catalog=CardLibrary.All().ToArray();
        try
        {
            var item=PreviewBag(RuleValue.Obj("op","discover","amount",1,"pool",RuleValue.Obj("kind","moves")));
            item.id=item.name="round6-released-item";
            var move=Card("round6-released-award","法术",0,RuleValue.Obj("op","armor","amount",1));
            CardLibrary.Init(()=>new[]{item,move});
            var release=Card("round6-release-item-source","法术",2,RuleValue.Obj("op","acquire","n",1,"pool",RuleValue.Obj("kind","道具"),"dest","discover","act","play"));
            session=PreviewSession(release);session.PlayCard("c0",-2,false);first=session.Snapshot.Discovering;
            Check(first?.sourceCommit=="preview"&&first.kind=="play"&&session.PickDiscover(0,session.BattleToken,first.selectionId).Ok
                &&session.Snapshot.Discovering?.sourceCommit=="committed"&&session.Snapshot.Discovering.Options.Single().id==move.id,
                "discovered direct-release item enters its already-committed bag discovery without a second unpaid preview");
            string itemUid=PreviewGranted(session).Single().uid;second=session.Snapshot.Discovering;
            Check(PreviewLedger(session,"played").SequenceEqual(new[]{"c0",itemUid})&&session.Snapshot.Energy==0
                &&session.CancelDiscover(session.BattleToken,second.selectionId).Ok&&PreviewGranted(session).Count==1&&PreviewLedger(session,"played").Count==2,
                "cancelling the released item's paid discovery preserves its source and item costs without awarding the declined card");
        }
        finally{CardLibrary.Init(()=>catalog);}
    }
    sealed class PreviewContainerHost:BattleHost,BattleContainerHost
    {
        public int Hp{get;set;}=1000;public int MaxHp=>1000;public int Atk=>0;public int SpellPower=>0;public string MyClass=>"法师";public string CharacterId=>"wu";
        public readonly List<OwnedCard> Cards=new List<OwnedCard>();public readonly List<string> Used=new List<string>();public IReadOnlyList<OwnedCard> OwnedCards=>Cards;
        public void Log(string text,string kind=null){}public void Heal(int amount){Hp=Math.Min(MaxHp,Hp+amount);}public void OnBattleEnd(BattleResult result){}
        public bool ConsumeStoredCard(string uid){var entry=Cards.SingleOrDefault(card=>card.uid==uid);if(entry==null)return false;Used.Add(uid);return Cards.Remove(entry);}
    }
    static void PreviewRealDefinitions()
    {
        var actual=Builtin("cmtn125e1nk0");var session=Start(actual,actual.Clone());Set(session,"hand",new List<string>{"c0","c1"});Set(session,"drawPile",new List<string>());Set(session,"energy",2);
        Check(session.PlayCard("c0",-1,false).Ok&&session.Snapshot.Discovering?.sourceCommit=="preview","actual mysterious summon opens its first unpaid preview");
        var first=session.Snapshot.Discovering;string token=session.Snapshot.BattleToken,random=PreviewRandom(session);session.CancelDiscover(token,first.selectionId);
        Check(session.PlayCard("c1",-1,false).Ok&&session.Snapshot.Discovering.sourceUid=="c1"&&PreviewRandom(session)!=random,"same-ID second physical summon owns a separate candidate cache");
        var second=session.Snapshot.Discovering;Check(!session.PickDiscover(0,token,first.selectionId).Ok&&session.Snapshot.Discovering.selectionId==second.selectionId,"first physical source ticket cannot redeem second source preview");
        session.CancelDiscover(token,second.selectionId);Check(session.Snapshot.Hand.SequenceEqual(new[]{"c0","c1"})&&session.Snapshot.Energy==2&&PreviewLedger(session,"played").Count==0,"both real-source cancellations preserve their physical UIDs and energy");
        random=PreviewRandom(session);session.PlayCard("c0",-1,false);second=session.Snapshot.Discovering;
        Check(second.options.Select(card=>card.id).SequenceEqual(first.options.Select(card=>card.id))&&PreviewRandom(session)==random,"actual acquire source reuses only its own cached candidates after another physical copy");
        int chosenIndex=second.options.ToList().FindIndex(card=>card.id!="tt2-apollo"&&card.rules?.Get("triggers")?.Operations("onAcquire").Any()!=true);
        Check(chosenIndex>=0&&session.PickDiscover(chosenIndex,token,second.selectionId).Ok&&PreviewGranted(session).Count==1
            &&PreviewGranted(session)[0].card.id==second.options[chosenIndex].id&&session.Snapshot.Discovering==null&&session.Snapshot.Energy==0&&session.Snapshot.Hand.Contains("c1")
            &&PreviewLedger(session,"played").SequenceEqual(new[]{"c0"}),"actual mysterious-summon acquire ticket awards the confirmed candidate once and pays only its chosen source");

        var host=new PreviewContainerHost();host.Cards.Add(new OwnedCard{uid="pouch",card=Builtin("tt7-stratagem")});
        var storedA=Builtin("tt3-fireball");storedA.variantKey="stored-a";var storedB=storedA.Clone();storedB.variantKey="stored-b";storedB.cost=2;
        host.Cards.Add(new OwnedCard{uid="stored-a",card=storedA,stored=true,pouchOf="tt7-stratagem"});host.Cards.Add(new OwnedCard{uid="stored-b",card=storedB,stored=true,pouchOf="tt7-stratagem"});
        session=new BattleSession();session.Start(new BattleStartContext{host=host,rng=new Rng(1031),enemies=new[]{new EnemyInput{id="stored-target",name="受控锦囊目标",hp=10000,atk=0}}});
        Set(session,"hand",new List<string>{"pouch"});Set(session,"drawPile",new List<string>());Set(session,"energy",2);random=PreviewRandom(session);
        Check(session.PlayCard("pouch",-2,false).Ok&&session.Snapshot.Discovering?.sourceCommit=="preview"&&session.Snapshot.Discovering.kind=="stored","actual stratagem previews physical stored spells");
        first=session.Snapshot.Discovering;token=session.Snapshot.BattleToken;
        Check(first.options.Select(card=>card.variantKey).SequenceEqual(new[]{"stored-a","stored-b"})&&PreviewRandom(session)==random,"stored preview preserves same-ID variant order without sampling RNG");
        Check(session.CancelDiscover(token,first.selectionId).Ok&&host.Used.Count==0&&host.Cards.Count==3&&session.Snapshot.Energy==2&&PreviewRandom(session)==random,"stored cancellation preserves both physical mother cards and pouch cost");
        session.PlayCard("pouch",-2,false);second=session.Snapshot.Discovering;
        var removed=host.Cards.Single(card=>card.uid=="stored-a");host.Cards.Remove(removed);
        Check(!session.PickDiscover(1,token,second.selectionId).Ok&&host.Used.Count==0&&session.Snapshot.Energy==2&&session.Snapshot.Hand.Contains("pouch"),"changed physical stored candidates invalidate preview before pouch payment or consumption");
        host.Cards.Insert(1,removed);session.CancelDiscover(token,second.selectionId);session.PlayCard("pouch",-2,false);second=session.Snapshot.Discovering;
        Check(session.PickDiscover(1,token,second.selectionId).Ok&&host.Used.SequenceEqual(new[]{"stored-b"})&&host.Cards.Any(card=>card.uid=="stored-a")&&!host.Cards.Any(card=>card.uid=="stored-b"),"stored confirmation consumes exactly the chosen physical UID among identical card IDs");
        Check(session.Snapshot.Energy==1&&PreviewLedger(session,"played").Count(uid=>uid=="pouch")==1&&PreviewLedger(session,"consumed").Count(uid=>uid=="stored-b")==1,"stored ticket pays pouch once and records only the selected mother UID");
        Check(!session.PickDiscover(0,token,first.selectionId).Ok&&host.Used.Count==1,"cancelled old stored ticket cannot consume the unchosen mother card");
    }
    static void DiscoveryPreviewChecks()
    {
        PreviewCancelAndCommit();PreviewCacheAndPlan();PreviewWaitingChanges();PreviewBagAndExclusions();PreviewRealDefinitions();
    }
}
