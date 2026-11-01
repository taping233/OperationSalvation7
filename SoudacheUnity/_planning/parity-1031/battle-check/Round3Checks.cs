using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Core.Battle;

static partial class Program
{
    static object Call(BattleSession session,string method,params object[] arguments) =>
        typeof(BattleSession).GetMethod(method,BindingFlags.NonPublic|BindingFlags.Instance).Invoke(session,arguments);
    static List<BattleFoe> Foes(BattleSession session) => (List<BattleFoe>)Field(session,"foes");
    static List<string> Played(BattleSession session) => (List<string>)Field(session,"played");
    static List<string> Consumed(BattleSession session) => (List<string>)Field(session,"consumed");
    static BattleSession DrawnBloodpoison()
    {
        // Real built-ins and physical UIDs; only hand/pile order and a second durable enemy are controlled.
        var session=Start(CardLibrary.FindById("tt8-hero-sword").Clone(),CardLibrary.FindById("tt7-bloodpoison").Clone(),
            CardLibrary.FindById("tt7-bloodpoison").Clone(),Card("filler-3","法术"),Card("filler-4","法术"),Card("filler-5","法术"));
        Set(session,"hand",new List<string>{"c0"});Set(session,"drawPile",new List<string>{"c5","c4","c3","c2","c1"});
        Foes(session).Add(new BattleFoe{id="second",name="第二目标",hp=10000,maxHp=10000,atk=0});
        return session;
    }
    static void AutomaticCastSelections()
    {
        var session=DrawnBloodpoison();var rng=(Rng)Field(session,"rng");string randomBefore=rng.SaveState();
        Check(session.PlayCard("c0",-2,false).Ok,"real castDrawn command rejected");
        var first=session.Snapshot.PendingTarget;var foes=Foes(session);
        Check(first?.Kind=="rulePick"&&first.uid=="c1"&&session.RuleInputPending,"first physical automatic cast did not own its next target");
        Check(session.Snapshot.Hand.Contains("c2")&&Played(session).SequenceEqual(new[]{"c0","c1"}),"next automatic UID released before the current target");
        Check((int)Field(session,"rulePlayedMartial")==1&&(int)Field(session,"energy")==98,"deferred target changed current-card counting or free automatic cost");
        session.LockPendingTarget(new PendingTargetSnapshot{uid="c3"});
        Check(session.Snapshot.PendingTarget.SelectionId==first.SelectionId,"another hand card overwrote a deferred automatic target");
        Check(!session.SelectRuleTarget(1,first.BattleToken,first.SelectionId+1).Ok&&!session.SelectRuleTarget(99,first.BattleToken,first.SelectionId).Ok,"stale or invalid target accepted");
        foes[1].dead=true;
        Check(!session.SelectRuleTarget(1,first.BattleToken,first.SelectionId).Ok&&session.Snapshot.PendingTarget.SelectionId==first.SelectionId,"dead target consumed the current selection");
        foes[1].dead=false;
        Check(session.SelectRuleTarget(1,first.BattleToken,first.SelectionId).Ok,"owned next target rejected by the input wait predicate");
        var second=session.Snapshot.PendingTarget;
        Check(second?.uid=="c2"&&second.SelectionId!=first.SelectionId&&Played(session).SequenceEqual(new[]{"c0","c1","c2"}),"second automatic UID did not resume exactly once");
        Check(foes[0].status.bleed==2&&foes[1].status.poison==1&&foes[1].hp==9999,"different target lost bloodpoison context or effect order");
        Check(!session.SelectRuleTarget(0,first.BattleToken,first.SelectionId).Ok,"previous cast callback modified the next selection");
        Check(session.SelectRuleTarget(0,second.BattleToken,second.SelectionId).Ok,"same-enemy second target rejected");
        Check(!session.RuleInputPending&&session.Snapshot.PendingTarget==null&&session.Snapshot.Phase=="player","automatic batch left unresolved input or resolution phase");
        Check((int)Field(session,"rulePlayedMartial")==2&&foes[0].status.poison==1&&Played(session).Distinct().Count()==3,"automatic completion duplicated counts or UID execution");
        Check(rng.SaveState()==randomBefore,"nonrandom automatic target chain advanced RNG");

        session=DrawnBloodpoison();session.PlayCard("c0",-2,false);first=session.Snapshot.PendingTarget;
        Check(session.CancelPendingTarget().Ok&&session.Snapshot.PendingTarget?.uid=="c2","cancel did not continue the remaining physical batch");
        second=session.Snapshot.PendingTarget;
        Check(!session.SelectRuleTarget(0,first.BattleToken,first.SelectionId).Ok&&Foes(session).All(foe=>foe.status.poison==0),"cancelled second effect or its stale callback still applied");
        session.CancelPendingTarget();
        Check(session.Snapshot.Phase=="player"&&!session.RuleInputPending&&(int)Field(session,"rulePlayedMartial")==2,"cancelled automatic batch did not finish exactly once");

        // The unclassed legendary can release the warrior's own bloodpoison without a cross-class inventory premise.
        session=Start(CardLibrary.FindById("tt3-frostfall").Clone(),CardLibrary.FindById("tt7-bloodpoison").Clone());
        Check(session.PlayCard("c0",0,false).Ok&&session.Snapshot.RuleHandSelection!=null,"real frostfall did not request a martial hand card");
        Check(session.SelectRuleHand("c1").Ok&&session.Snapshot.PendingTarget?.uid=="c1"&&session.RuleInputPending,"real hand release did not wait for bloodpoison's next target");
        first=session.Snapshot.PendingTarget;
        Check(session.SelectRuleTarget(0,first.BattleToken,first.SelectionId).Ok&&!session.RuleInputPending&&session.Snapshot.Phase=="player"&&(int)Field(session,"rulePlayedMartial")==2,"real hand release did not complete its dependent target and parent exactly once");

        session=DrawnBloodpoison();Foes(session).RemoveAt(1);Foes(session)[0].hp=2;
        session.PlayCard("c0",-2,false);first=session.Snapshot.PendingTarget;
        Check(session.SelectRuleTarget(0,first.BattleToken,first.SelectionId).Ok,"terminal target command rejected");
        var host=(Host)Field(session,"G");var result=host.Results.Single();
        Check(result.Win==true&&result.Played.SequenceEqual(new[]{"c0","c1"})&&result.Consumed.Count==0,"target victory released a later UID or changed consumption");
        Check(((List<Action>)Field(session,"ruleContinuations")).Count==0&&Field(session,"deferredTargetAction")==null,"terminal battle retained automatic continuations");
        Check(!session.SelectRuleTarget(0,first.BattleToken,first.SelectionId).Ok&&host.Results.Count==1&&host.OwnedCards.Count==6,"terminal callback replayed or removed permanent ownership");

        session=DrawnBloodpoison();session.PlayCard("c0",-2,false);first=session.Snapshot.PendingTarget;
        session.Start(new BattleStartContext{host=new Host{OwnedCards=new[]{new OwnedCard{uid="new-card",card=Card("new-card")}}},
            rng=new Rng(1031),enemies=new[]{new EnemyInput{id="new-enemy",name="新场",hp=10000,atk=0}}});
        Check(!session.SelectRuleTarget(0,first.BattleToken,first.SelectionId).Ok&&Played(session).Count==0&&!session.RuleInputPending,"old automatic callback crossed the battle token");
    }
    static void AutomaticCastDrawSelections()
    {
        // Constructed structured rules exercise release.eachDraw -> onDraw.choice; no fake command handlers.
        var release=Card("release-arrows","法术",0,RuleValue.Obj("op","release","source","hand","key","箭","eachDraw",1));
        var drawChoice=Card("draw-choice","法术");
        drawChoice.rules.Get("triggers").Values["onDraw"]=RuleValue.Arr(RuleValue.Obj("op","choice","options",RuleValue.Arr(
            RuleValue.Obj("label","继续","ops",RuleValue.Arr(RuleValue.Obj("op","energy","n",3))))));
        var session=Start(release,Card("箭一"),Card("箭二"),drawChoice,Card("draw-tail","法术"));
        Set(session,"hand",new List<string>{"c0","c1","c2"});Set(session,"drawPile",new List<string>{"c4","c3"});
        Check(session.PlayCard("c0",-2,false).Ok&&session.Snapshot.RuleChoice!=null,"eachDraw did not expose its real structured choice");
        Check(Played(session).SequenceEqual(new[]{"c0","c1"})&&session.Snapshot.Hand.Contains("c2")&&session.Snapshot.DrawPile.SequenceEqual(new[]{"c4"}),"eachDraw interaction did not pause before the next UID");
        Check(session.ChooseRuleOption(0).Ok&&Played(session).SequenceEqual(new[]{"c0","c1","c2"}),"eachDraw completion lost or repeated the next cast");
        Check(session.Snapshot.DrawPile.Count==0&&session.Snapshot.Hand.Count(uid=>uid=="c4")==1&&(int)Field(session,"energy")==103,"eachDraw repeated a draw or lost the selected effect");
        Check(session.Snapshot.Phase=="player"&&!session.RuleInputPending,"eachDraw continuation did not return to player phase");

        session=Start(release,Card("箭一"),Card("箭二"),drawChoice);
        Set(session,"hand",new List<string>{"c0","c1","c2"});Set(session,"drawPile",new List<string>{"c3"});
        session.PlayCard("c0",-2,false);
        Check(session.Snapshot.RuleChoice!=null&&session.Retract().Ok,"controlled pending-choice finish was not reached");
        Check(!session.ChooseRuleOption(0).Ok&&!session.RuleInputPending&&((Host)Field(session,"G")).Results.Count==1,"settled choice callback mutated the finished batch");

        // A fleeing child ends the same batch immediately; outer completion cannot mutate the settled result.
        var flee=Card("箭逃","武术",0,RuleValue.Obj("op","flee"));
        session=Start(release,flee,Card("箭后"));
        Check(session.PlayCard("c0",-2,false).Ok,"fleeing batch source rejected");
        var host=(Host)Field(session,"G");
        Check(host.Results.Count==1&&host.Results[0].Win==null&&host.Results[0].Played.SequenceEqual(new[]{"c0","c1"}),"fleeing automatic child did not stop its parent batch");
        Check(((List<Action>)Field(session,"ruleContinuations")).Count==0&&(int)Field(session,"rulePlayedMoves")==0,"settlement executed queued or outer completion after flee");
    }
    static void AutomaticGeneratedSelections()
    {
        // Directly invoke the production generator batch with a deterministic supplier to inspect demand, not a replacement resolver.
        var session=Start(Card("idle"));var blood=CardLibrary.FindById("tt7-bloodpoison").Clone();int generated=0;
        Func<CardDef> next=()=>{generated++;return blood;};
        Call(session,"CastRuleGeneratedBatch",next,2,Foes(session)[0],true);
        var first=session.Snapshot.PendingTarget;
        Check(generated==1&&first?.Kind=="rulePick","generated batch requested another card while a target was pending");
        Check(session.SelectRuleTarget(0,first.BattleToken,first.SelectionId).Ok&&generated==2,"generated batch did not resume one request after target completion");
        session.CancelPendingTarget();
        Check(generated==2&&!session.RuleInputPending&&Played(session).Distinct().Count()==2,"generated batch cancel repeated generation or left pending input");
    }
    static void NecromancerFeedback()
    {
        var session=Start(Enumerable.Range(0,6).Select(i=>Card("torn-"+i)).ToArray());
        Set(session,"hand",new List<string>());Set(session,"drawPile",Enumerable.Range(0,6).Select(i=>"c"+i).ToList());
        var foe=Foes(session)[0];foe.behavior="necromancer";var host=(Host)Field(session,"G");
        var rng=(Rng)Field(session,"rng");string randomBefore=rng.SaveState();
        var cues=new List<BattleActorCue>();Action<BattleActorCue> capture=cue=>{if(cue.BattleToken==session.BattleToken)cues.Add(cue);};
        BattleSession.ActorPresentation+=capture;
        try
        {
            for(int i=0;i<3;i++)
            {
                Set(session,"turn",3+i*3);int before=host.Logs.Count;Call(session,"ApplyCurrentBossTurnStart");
                Check(foe.status.necroticExposure==1<<(i+1)&&host.Logs.Last().Contains("顶 2 张牌")&&host.Logs.Last().Contains("×"+(1<<(i+1))),"necromancer trigger omitted exact tear count or multiplier feedback");
                Call(session,"ApplyCurrentBossTurnStart");
                Check(host.Logs.Count==before+1&&cues.Count(cue=>cue.SoundKey=="burn")==i+1,"same-turn necromancer repeated state or feedback");
            }
            Check(session.Snapshot.Grave.SequenceEqual(new[]{"c4","c5","c2","c3","c0","c1"})&&session.Snapshot.DrawPile.Count==0,"necromancer tore the wrong physical pile order");
            Check(Consumed(session).Count==0&&Played(session).Count==0&&host.OwnedCards.Count==6&&rng.SaveState()==randomBefore,"necromancer tear consumed ownership, card execution or RNG");
            Set(session,"turn",6);foe.status.silence=1;int logs=host.Logs.Count;Call(session,"ApplyCurrentBossTurnStart");
            Check(host.Logs.Count==logs&&foe.status.necroticExposure==8,"silenced necromancer changed state or feedback");
            foe.status.silence=0;Call(session,"ApplyCurrentBossTurnStart");
            Check(host.Logs.Last().Contains("顶 0 张牌")&&foe.status.necroticExposure==16&&cues.Count(cue=>cue.SoundKey=="burn")==3,"empty pile feedback invented a burn or lost exposure growth");

            // Multiple concrete enemies in one turn-start presentation still emit a single burn sound.
            session=Start(Card("multi-0"),Card("multi-1"),Card("multi-2"));
            Set(session,"hand",new List<string>());Set(session,"drawPile",new List<string>{"c0","c1","c2"});Set(session,"turn",3);
            Foes(session)[0].behavior="necromancer";
            Foes(session).Add(new BattleFoe{id="second-necromancer",name="第二死灵",hp=100,maxHp=100,behavior="necromancer"});
            cues.Clear();Call(session,"ApplyCurrentBossTurnStart");
            Check(cues.Count(cue=>cue.SoundKey=="burn")==1&&Foes(session).All(enemy=>enemy.status.necroticExposure==2),"same-batch necromancers duplicated burn audio or omitted exposure");
            Check(session.Snapshot.Grave.SequenceEqual(new[]{"c1","c2","c0"})&&((Host)Field(session,"G")).Logs.TakeLast(2).Any(text=>text.Contains("顶 1 张牌")),"partial top-pile tear lost its UID order or actual count feedback");
        }
        finally { BattleSession.ActorPresentation-=capture; }
    }
}
