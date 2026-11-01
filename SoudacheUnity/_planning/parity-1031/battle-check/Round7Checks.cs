using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;

static partial class Program
{
    static void CardPresentationChecks()
    {
        var s=Start(Card("round7-permanent","武术",3));
        var host=(Host)Field(s,"G");host.OwnedCards[0].uid="battle-temp:permanent-proof";
        var permanent=s.GetCardPresentation("battle-temp:permanent-proof");
        Check(permanent!=null&&!permanent.Temporary&&permanent.BaseCost==3,"presentation guesses ownership from a temporary-looking UID");
        var granted=(List<OwnedCard>)Field(s,"granted");granted.Add(new OwnedCard{uid="plain-generated-proof",card=host.OwnedCards[0].card.Clone()});
        var temporary=s.GetCardPresentation("plain-generated-proof");
        Check(temporary.Temporary&&temporary.Card.id==permanent.Card.id&&temporary.BaseCost==3,"presentation ignores actual generated ownership without a UID prefix");
        var rng=(Rng)Field(s,"rng");string random=rng.SaveState();
        Check(s.GetCardPresentation("missing")==null&&s.GetCardPresentation("plain-generated-proof").OriginName==temporary.Card.name&&rng.SaveState()==random,"read-only presentation manufactures cards or advances a random stream");

        var imitate=Builtin("tt7-imitate");var martial=Builtin("tt2-piercearrow");
        s=Start(imitate,martial);((Host)Field(s,"G")).MyClass="侠客";var before=s.GetCardPresentation("c0");
        Check(before.Transforming&&!before.Transformed&&before.OriginName==imitate.name,"untransformed real imitate loses its live-state label");
        Check(s.PlayCard("c1",0,false).Ok,"real martial transform trigger rejected");
        var transformed=s.GetCardPresentation("c0");
        Check(transformed.Transforming&&transformed.Transformed&&transformed.OriginName==imitate.name&&transformed.Card.id==martial.id
            &&transformed.BaseCost==CardLibrary.FindById(martial.id).cost&&transformed.EffectiveCost==1,"transformed presentation loses the authoritative original, catalog fee or fixed live fee");
        Check(imitate.id=="tt7-imitate"&&imitate._baseCost==null&&martial._baseCost==null,"presentation writes metadata into a raw definition");

        var zero=Card("round7-zero","法术",0,RuleValue.Obj("op","armor","amount",1),
            RuleValue.Obj("op","acquire","n",1,"dest","discover","act","zeroCost","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball"))));
        s=Start(zero);Check(s.PlayCard("c0",-1,false).Ok&&s.Snapshot.Discovering!=null,"mixed zero-fee discovery did not reach its committed input");
        Check(s.PickDiscover(0).Ok,"zero-fee discovered card rejected");
        var award=PreviewGranted(s).Single();var zeroState=s.GetCardPresentation(award.uid);int printed=Builtin("tt3-fireball").cost;
        Check(zeroState.Temporary&&zeroState.Card.cost==0&&zeroState.BaseCost==printed&&zeroState.EffectiveCost==0
            &&zeroState.Card.Clone()._baseCost==printed,"zero-fee discovery loses original fee across its real clone");

        var decay=Card("round7-decay","法术",0,RuleValue.Obj("op","armor","amount",1),
            RuleValue.Obj("op","acquire","n",1,"dest","discover","act","decay","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball"))));
        s=Start(decay);Check(s.PlayCard("c0",-1,false).Ok&&s.PickDiscover(0).Ok,"decay discovery could not be confirmed");award=PreviewGranted(s).Single();
        Check(s.EndTurn().Ok&&s.EndTurn().Ok,"two real decay turns rejected");
        var decayed=s.GetCardPresentation(award.uid);
        Check(decayed.Card.cost==Math.Max(0,printed-2)&&decayed.BaseCost==printed&&award.card.cost==printed,"repeated decay overwrites its first printed cost or original granted card");

        s=Start(Builtin("tt3eq-mistbox"));Check(s.PlayCard("c0",-1,false).Ok&&s.UseEquipment("c0").Ok,"real fee swap equipment or active skill rejected");
        var first=s.Snapshot.Discovering.options[0];Check(s.PickDiscover(0).Ok,"first swap discovery rejected");
        var second=s.Snapshot.Discovering.options[0];Check(s.PickDiscover(0).Ok,"second swap discovery rejected");
        var pair=PreviewGranted(s).ToArray();var a=s.GetCardPresentation(pair[0].uid);var b=s.GetCardPresentation(pair[1].uid);
        Check(a.BaseCost==first.cost&&b.BaseCost==second.cost&&a.Card.cost==second.cost&&b.Card.cost==first.cost,"both fee-swap awards must retain their own printed fee and exact physical UID");
        Check(CardLibrary.FindById("tt3-fireball")._baseCost==null&&typeof(CardDef).GetField("_baseCost").IsDefined(typeof(NonSerializedAttribute),false),"battle-only fee metadata leaks into the catalog or the persistence contract");
        PresentationShortcutChecks();
        DeckDiscoveryPresentationChecks();
    }
    static void PresentationShortcutChecks()
    {
        var generator=Card("round7-groups","法术",0,RuleValue.Obj("op","armor","amount",1),RuleValue.Obj("op","acquire","n",1,"dest","hand","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball"))));
        var infusion=Card("round7-groups-infusion","法术",0,RuleValue.Obj("op","armor","amount",1));infusion.infuse=1;
        var session=Start(generator,Builtin("tt3-fireball"),Builtin("tt3-fireball"),infusion);
        Check(session.PlayCard("c0",-1,false).Ok,"grouping fixture acquire command rejected");
        string generated=PreviewGranted(session).Single().uid;Set(session,"hand",new List<string>{"c1",generated,"c2","c3"});
        var states=new[]{"c1",generated,"c2"}.Select(session.GetCardPresentation).ToArray();
        Check(BattleHandProjection.StackKey(states[0])==BattleHandProjection.StackKey(states[2])
            &&BattleHandProjection.StackKey(states[0])!=BattleHandProjection.StackKey(states[1]),"authoritative hand key merges temporary/permanent provenance or splits identical permanent copies");
        Check(BattleHandProjection.StackKey(states[0].Card,states[0].EffectiveCost)==BattleHandProjection.StackKey(states[1].Card,states[1].EffectiveCost),"state-free pure hand tool changed its original identity contract");
        session.PlayCard("c3",-1,false);string random=((Rng)Field(session,"rng")).SaveState();
        Check(session.Snapshot.Infusing?.Uid=="c3"&&!session.SelectInfusion("c3").Ok,"formal infusion admits its source UID as a material");
        var keys=BattleHandProjection.InfusionShortcuts(session.Snapshot.Hand.Select(session.GetCardPresentation),"c3");
        Check(keys.SequenceEqual(new[]{"c1","c2",generated}),"provenance grouping does not keep same-source copies adjacent in physical shortcut order");
        Check(session.SelectInfusion("c1").Ok&&session.Snapshot.Infusing.Picked.SequenceEqual(new[]{"c1"})
            &&BattleHandProjection.InfusionShortcuts(session.Snapshot.Hand.Select(session.GetCardPresentation),"c3").SequenceEqual(keys),"selected physical copy loses its original provenance shortcut");
        Check(session.SelectInfusion(keys[0]).Ok&&session.Snapshot.Infusing.Picked.Count==0&&session.CancelInfusion().Ok
            &&session.Snapshot.Hand.SequenceEqual(new[]{"c1",generated,"c2","c3"})&&((Rng)Field(session,"rng")).SaveState()==random,"shortcut withdrawal/cancel changes hand UID order or random streams");
    }
    static void DeckDiscoveryPresentationChecks()
    {
        var generator=Card("round7-bottom-states","法术",0,RuleValue.Obj("op","armor","amount",1),RuleValue.Obj("op","acquire","n",1,"dest","hand","act","zeroCost","pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball"))));
        var session=Start(generator,Builtin("tt7-imitate"),Builtin("tt2-piercearrow"),Builtin("tt3-dig-treasure"),Builtin("tt3-fireball"));
        ((Host)Field(session,"G")).MyClass="侠客";
        Check(session.PlayCard("c2",0,false).Ok&&session.PlayCard("c0",-1,false).Ok,"formal transform and zero-fee generation preconditions rejected");
        string generated=PreviewGranted(session).Single().uid;var tail=session.Snapshot.DrawPile.ToArray();
        // Only locations/order are controlled; costs, temporary ownership and transform come from real commands.
        Set(session,"hand",new List<string>{"c3"});Set(session,"drawPile",new[]{generated,"c1","c4"}.Concat(tail).ToList());
        int energy=session.Snapshot.Energy;string rng=((Rng)Field(session,"rng")).SaveState();var awards=session.GrantedCards.Select(entry=>entry.uid).ToArray();
        Check(session.PlayCard("c3",-1,false).Ok,"real dig-treasure failed to open the prepared original entities");
        var discovery=session.Snapshot.Discovering;
        Check(discovery.kind=="deckBottom"&&discovery.candidateUids.SequenceEqual(new[]{generated,"c1","c4"})&&discovery.candidateUids.Count==discovery.Options.Count,
            "displayed deck-bottom options lose their aligned original physical UIDs");
        var zero=session.GetCardPresentation(discovery.candidateUids[0]);var transformed=session.GetCardPresentation(discovery.candidateUids[1]);
        Check(zero.Temporary&&zero.EffectiveCost==0&&zero.BaseCost==Builtin("tt3-fireball").cost&&transformed.Transforming&&transformed.Transformed
            &&ReferenceEquals(discovery.Options[0],zero.Card)&&ReferenceEquals(discovery.Options[1],transformed.Card),"deck discovery mapping cannot recover temporary/printed-fee/transformed candidate presentation");
        var again=session.Snapshot.Discovering;
        Check(!ReferenceEquals(again.candidateUids,discovery.candidateUids)&&again.candidateUids.SequenceEqual(discovery.candidateUids)
            &&again.Options.Zip(discovery.Options,(a,b)=>ReferenceEquals(a,b)).All(value=>value),"stable snapshot loses UID copy isolation or candidate reference contract");
        Check(session.PickDiscover(0).Ok&&session.Snapshot.Hand.SequenceEqual(new[]{generated})
            &&session.Snapshot.DrawPile.SequenceEqual(new[]{"c1","c4"}.Concat(tail)),"confirming a projected candidate generates a replacement UID or returns unchosen originals out of order");
        Check(session.Snapshot.Energy==energy-1&&session.GrantedCards.Select(entry=>entry.uid).SequenceEqual(awards)
            &&((Rng)Field(session,"rng")).SaveState()==rng,"mapped discovery re-samples, creates an award, or changes the formal source fee");
    }
}
