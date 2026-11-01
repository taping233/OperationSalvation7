using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;

static partial class Program
{
    sealed class ReactiveCase { public BattleSession Session;public Host Host;public string[] Copies;public int Seed; }
    static CardDef Builtin(string id)=>CardDatabase.All.Single(card=>card.id==id).Clone();
    static int ResponseSeed(int count,bool draw=true)
    {
        for(int seed=1;seed<4096;seed++)
        {
            var candidate=new Rng(seed);bool all=true;
            for(int i=0;i<count;i++){candidate.Random("battle","target");all&=(candidate.Random("battle","generation")<.5)==draw;}
            if(all)return seed;
        }
        throw new Exception("No controlled legal response roll found");
    }
    static ReactiveCase Reactive(bool boss=false,int scales=1,bool multi=false)
    {
        var cards=new List<CardDef>{Builtin("tt13-stellar-divination"),Builtin("tt3-crimson-pouch"),Builtin("tt2-piercearrow"),Builtin("tt3-blue-potion")};
        for(int i=0;i<scales;i++)cards.Add(Builtin("tt13-scale-armor"));
        var host=new Host{MyClass="牧师",OwnedCards=cards.Select((card,i)=>new OwnedCard{uid="r4-"+i,card=card}).ToArray()};
        var session=new BattleSession();session.Start(new BattleStartContext{host=host,rng=new Rng(1104),isBoss=boss,
            enemies=new[]{new EnemyInput{id="first",name="第一敌人",hp=10000,atk=3,affix=multi?"frenzy":null},new EnemyInput{id="second",name="第二敌人",hp=10000,atk=4}}.Take(multi?2:1).ToArray()});
        if(boss){foreach(var entry in host.OwnedCards.Where(entry=>entry.card.type!="道具"))Check(session.SelectDeckCard(entry.uid).Ok,"boss fixture deck selection rejected");Check(session.ConfirmDeck().Ok,"boss fixture deck rejected");}
        Set(session,"hand",host.OwnedCards.Where(entry=>entry.card.type!="道具").Select(entry=>entry.uid).ToList());Set(session,"energy",100);
        for(int i=0;i<scales;i++)Check(session.PlayCard("r4-"+(4+i),-1,false).Ok,"real scale armor rejected");
        if(scales==1)Check(session.PlayCard("r4-1",-1,false).Ok,"real pouch equipment rejected");
        Check(session.PlayCard("r4-0",-1,false).Ok&&session.Snapshot.Discovering!=null,"real stellar divination did not discover");
        int lamp=session.Snapshot.Discovering.Options.ToList().FindIndex(card=>card.id=="tt3-magic-lamp");
        Check(lamp>=0&&session.PickDiscover(lamp).Ok,"legal lamp candidate did not create stellar copies");
        var copies=((HashSet<string>)Field(session,"castOnDraw")).ToArray();
        Check(copies.Length==2&&copies.All(uid=>session.FindCard(uid).card.id=="tt3-magic-lamp"),"stellar did not produce two real on-draw lamp UIDs");
        Set(session,"drawPile",copies.Reverse().ToList());int seed=ResponseSeed(scales);Set(session,"rng",new Rng(seed));
        return new ReactiveCase{Session=session,Host=host,Copies=copies,Seed=seed};
    }
    static int Attacks(Host host)=>host.Logs.Count(text=>text.Contains("反击：你受到"));
    static void NeutralLamps(BattleSession session)
    {
        int guard=0;while(session.Snapshot.TurnEndPending&&guard++<12)
        {Check(session.Snapshot.RuleChoice!=null&&session.ChooseRuleOption(1).Ok,"boss lamp did not accept its legal non-BOSS-only no-op choice");}
        Check(!session.Snapshot.TurnEndPending&&!session.RuleInputPending,"owned turn did not complete its finite input chain");
    }
    static void EnemyTurnSelections()
    {
        var original=CardLibrary.All().ToArray();
        var spells=CurrentBattlePools.Resolve(original,RuleValue.Obj("kind","types","types",RuleValue.Arr("法术"),"randomEligible",true),"牧师");
        Check(spells.Any(card=>card.id=="tt3-magic-lamp"),"full live catalog excludes lamp from stellar's formal pool");
        Check(CurrentBattlePools.Resolve(original,RuleValue.Obj("kind","其它职业"),"牧师").Any(card=>card.id=="tt7-bloodpoison"),"bloodpoison is not legal in priest's explicit other-class pool");
        Check(CurrentBattlePools.Resolve(original,RuleValue.Obj("kind","招式"),"牧师").Any(card=>card.id=="tt2-jianghu"),"jianghu is not legal in lamp's formal move pool");
        // Restrict only the test catalog, keeping these current built-in definitions unchanged.
        // This makes the legal discover choices deterministic; it is not a natural-pool probability test.
        var catalog=new[]{"tt13-stellar-divination","tt13-scale-armor","tt3-magic-lamp","tt2-jianghu","tt7-bloodpoison","tt2-piercearrow","tt3-crimson-pouch","tt3-blue-potion","tt3-petal"}.Select(Builtin).ToArray();
        CardLibrary.Init(()=>catalog);
        try
        {
            var sample=Reactive();var s=sample.Session;var h=sample.Host;
            Check(s.EndTurn().Ok&&s.Snapshot.RuleChoice!=null,"real enemy response did not expose lamp choice");
            Check(s.Snapshot.TurnEndPending&&!s.Snapshot.Busy&&s.Snapshot.Phase=="player"&&s.Turn==1&&Attacks(h)==1&&h.Hp==997,"enemy phase advanced past its first unresolved hit");
            int energy=s.Snapshot.Energy;string random=((Rng)Field(s,"rng")).SaveState();
            Check(!s.EndTurn().Ok&&!s.PlayCard("r4-2",0,false).Ok&&!s.UseEquipment("r4-1").Ok&&!s.UseHeroSkill().Ok&&!s.UseItem("r4-3").Ok,"independent command stole a suspended turn");
            s.LockPendingTarget(new PendingTargetSnapshot{uid="r4-2"});
            Check(s.Snapshot.PendingTarget==null&&s.Snapshot.Energy==energy&&((Rng)Field(s,"rng")).SaveState()==random,"rejected command changed owned targeting, cost or RNG");
            Check(s.ChooseRuleOption(1).Ok&&s.Snapshot.Over&&h.Results.Count==1,"real lamp terminal choice did not end battle");
            Check(!s.Snapshot.TurnEndPending&&!s.RuleInputPending&&((ICollection)Field(s,"drawnCasts")).Count==0&&((List<Action>)Field(s,"ruleContinuations")).Count==0,"victory retained turn ownership or held copies");

            sample=Reactive(true,2,true);s=sample.Session;h=sample.Host;
            var expected=new Rng(sample.Seed);
            for(int gear=0;gear<2;gear++){expected.Random("battle","target");expected.Random("battle","generation");}expected.Random("status","generation");
            s.EndTurn();var first=s.Snapshot.RuleChoice;
            Check(first!=null&&s.Turn==1&&Attacks(h)==1&&s.Snapshot.TurnEndPending,"multi-hit enemy did not suspend after first hit");
            Check(((Rng)Field(s,"rng")).SaveState()==expected.SaveState(),"interactive spell ran before same-hit equipment or frenzy RNG completed");
            Check(s.Snapshot.DrawPile.Count==0&&sample.Copies.All(uid=>!s.Snapshot.Hand.Contains(uid))&&((ICollection)Field(s,"drawnCasts")).Count==1,"held second copy became a material or disappeared");
            Check(s.ChooseRuleOption(1).Ok&&s.Snapshot.RuleChoice!=null&&!ReferenceEquals(s.Snapshot.RuleChoice,first)&&Attacks(h)==1&&s.Turn==1,"second response overwrote first choice or enemy resumed before the second copy");
            Check(((Rng)Field(s,"rng")).SaveState()==expected.SaveState(),"same-hit second no-op lamp added RNG");
            NeutralLamps(s);
            for(int hit=1;hit<3;hit++){for(int gear=0;gear<2;gear++){expected.Random("battle","target");expected.Random("battle","generation");}if(hit==1)expected.Random("status","generation");}
            Check(Attacks(h)==3&&s.Turn==2&&s.Snapshot.Phase=="player"&&!s.Snapshot.Busy,"same-enemy next hit or next enemy resumed more/less than once");
            Check(((Rng)Field(s,"rng")).SaveState()==expected.SaveState(),"owned wait changed complete turn RNG sequence");

            sample=Reactive(true,1,true);s=sample.Session;h=sample.Host;s.EndTurn();
            Check(s.ChooseRuleOption(2).Ok,"real lamp freeze choice rejected");NeutralLamps(s);
            Check(Attacks(h)==1&&s.Turn==2,"suspended enemy plan ignored newly applied freeze");

            sample=Reactive(true);s=sample.Session;
            while(s.Snapshot.Hand.Count<GameRules.BattleHandMax)Call(s,"AddTempCard",Builtin("tt2-piercearrow"));
            s.EndTurn();
            Check(s.Snapshot.RuleChoice!=null&&s.Snapshot.TurnEndPending&&s.Snapshot.Hand.Count==GameRules.BattleHandMax,"full hand blocked an on-draw cast or kept its physical copy in materials");
            NeutralLamps(s);Check(s.Snapshot.Hand.Count==GameRules.BattleHandMax,"queued copies overflowed the full hand after completion");

            sample=Reactive(false,1,true);s=sample.Session;h=sample.Host;Foes(s)[0].hp=9999;
            s.EndTurn();Check(s.ChooseRuleOption(1).Ok,"real wounded-enemy execution choice rejected");
            Check(Foes(s)[0].dead&&!Foes(s)[1].dead&&Attacks(h)==2&&h.Logs.Count(text=>text.Contains("第一敌人")&&text.Contains("反击：你受到"))==1,"dead frenzy enemy continued a saved hit or next enemy did not act once");
            if(s.Snapshot.RuleChoice!=null)Check(s.ChooseRuleOption(2).Ok,"second enemy's dependent choice rejected");
            Check(!s.Snapshot.TurnEndPending&&s.Turn==2,"dead-current continuation did not finish the surviving enemy's turn");

            sample=Reactive(true);s=sample.Session;h=sample.Host;
            h.OwnedCards=h.OwnedCards.Concat(new[]{new OwnedCard{uid="r4-petal",card=Builtin("tt3-petal")}}).ToArray();((List<string>)Field(s,"hand")).Add("r4-petal");
            Check(s.PlayCard("r4-petal",-1,false).Ok,"real petal registration rejected");h.Hp=900;Set(s,"rng",new Rng(ResponseSeed(1,false)));
            s.EndTurn();
            Check(s.Turn==2&&s.Snapshot.TurnEndPending&&s.Snapshot.RuleChoice!=null&&h.Hp==897,"turn-start draw failed to retain the pending turn or ran petal's following heal early");
            NeutralLamps(s);Check(h.Hp==900&&s.Turn==2,"turn-start selection lost or repeated petal's following heal");

            sample=Reactive(true);s=sample.Session;s.EndTurn();
            Check(s.ChooseRuleOption(0).Ok&&s.Snapshot.Discovering!=null,"lamp's real discover branch rejected");
            int index=s.Snapshot.Discovering.Options.ToList().FindIndex(card=>card.id=="tt2-jianghu");
            Check(index>=0&&s.PickDiscover(index).Ok&&s.Snapshot.Discovering!=null,"legal jianghu release did not enter explicit other-class discover");
            index=s.Snapshot.Discovering.Options.ToList().FindIndex(card=>card.id=="tt7-bloodpoison");
            Check(index>=0&&s.PickDiscover(index).Ok&&s.Snapshot.PendingTarget?.Kind=="rulePick","real nested other-class release did not enter dependent target");
            var target=s.Snapshot.PendingTarget;
            Check(s.Snapshot.TurnEndPending&&s.Turn==1&&s.CancelPendingTarget().Ok,"dependent target could not cancel inside owned enemy wait");
            Check(!s.SelectRuleTarget(0,target.BattleToken,target.SelectionId).Ok,"cancelled target callback stole the resumed turn");
            NeutralLamps(s);Check(s.Turn==2,"cancel did not return to the same finite turn continuation");

            sample=Reactive();s=sample.Session;h=sample.Host;((Combatant)Field(s,"pstat")).status.poison=1;
            s.EndTurn();Check(s.Snapshot.RuleChoice!=null&&s.Snapshot.TurnEndPending&&Attacks(h)==0&&h.Hp==999,"real poison damage did not await the same reactive draw before enemy attacks");
            var stale=((List<Action>)Field(s,"ruleContinuations")).ToArray();
            Check(s.Retract().Ok&&!s.Snapshot.TurnEndPending&&h.Results.Single().Win==null,"forced flee did not clear the owned turn");
            foreach(var action in stale)action();
            Check(h.Results.Count==1&&!s.RuleInputPending&&((ICollection)Field(s,"drawnCasts")).Count==0,"old continuation survived flee");
            s.Start(new BattleStartContext{host=new Host{OwnedCards=new[]{new OwnedCard{uid="new",card=Builtin("tt2-piercearrow")}}},rng=new Rng(123),enemies=new[]{new EnemyInput{id="new",name="新场",hp=10000,atk=3}}});
            string before=((Rng)Field(s,"rng")).SaveState();foreach(var action in stale)action();
            Check(!s.Snapshot.TurnEndPending&&s.Turn==1&&s.Snapshot.PendingTarget==null&&((Rng)Field(s,"rng")).SaveState()==before,"old token continuation changed a new session");
        }
        finally{CardLibrary.Init(()=>original);}
    }
}
