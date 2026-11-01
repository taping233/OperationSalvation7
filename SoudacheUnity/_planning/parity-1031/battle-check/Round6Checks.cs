using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using Sdt.Core;
using Sdt.Core.Battle;

static partial class Program
{
    static BattleSession DigCase()
    {
        var s=Start(Builtin("tt3-dig-treasure"),Builtin("tt3-fireball"),Builtin("tt2-piercearrow"),Builtin("tt3-petal"),Builtin("tt3-blue-potion"));
        Set(s,"hand",new List<string>{"c0"});Set(s,"drawPile",new List<string>{"c1","c2","c3","c4"});return s;
    }
    static void DiscoveryCancellation()
    {
        var s=DigCase();
        // Explicit prior-acquisition fact isolates the stale priceArmor dependency; it is not a second obtaining-flow test.
        Set(s,"lastAcquired",Builtin("tt3-magic-lamp"));
        Check(s.PlayCard("c0",-1,false).Ok,"real dig-treasure source rejected");
        var first=s.Snapshot.Discovering;string token=s.Snapshot.BattleToken,random=((Rng)Field(s,"rng")).SaveState();int energy=s.Snapshot.Energy;
        Check(first.kind=="deckBottom"&&first.sourceCommit=="committed"&&first.selectionId>0&&s.Snapshot.DrawPile.SequenceEqual(new[]{"c4"})&&energy==99,"deck-bottom discover lost explicit source kind, reserved UIDs or paid source cost");
        Check(!s.CancelDiscover(token,first.selectionId+1).Ok&&s.Snapshot.Discovering.selectionId==first.selectionId,"stale discover cancellation touched current round");
        Check(s.CancelDiscover(token,first.selectionId).Ok&&s.Snapshot.Discovering==null&&!s.RuleInputPending,"current deck-bottom cancellation did not finish its input");
        Check(s.Snapshot.DrawPile.SequenceEqual(new[]{"c1","c2","c3","c4"})&&!s.Snapshot.Hand.Any(),"deck-bottom cancellation must restore exact original UID order without new hand cards");
        Check(s.Snapshot.Pdef.Armor==0&&s.Snapshot.Energy==energy&&((Rng)Field(s,"rng")).SaveState()==random,"cancellation awarded stale acquired price, refunded source cost or changed RNG");
        Check(!s.CancelDiscover(token,first.selectionId).Ok&&!s.PickDiscover(0,token,first.selectionId).Ok,"completed cancellation accepted duplicate or late pick");

        s=DigCase();Check(s.PlayCard("c0",-1,false).Ok,"second real dig rejected");first=s.Snapshot.Discovering;token=s.Snapshot.BattleToken;
        random=((Rng)Field(s,"rng")).SaveState();
        Check(s.PickDiscover(1,token,first.selectionId).Ok&&s.Snapshot.Hand.SequenceEqual(new[]{"c2"}),"deck discovery did not move selected original physical UID into hand");
        Check(s.Snapshot.DrawPile.SequenceEqual(new[]{"c1","c3","c4"})&&s.Snapshot.Pdef.Armor>0&&((Rng)Field(s,"rng")).SaveState()==random,"confirmed dig lost unchosen order, price armor or deterministic RNG");

        var bottomFive=Card("round6-bottom-five","法术",1,RuleValue.Obj("op","acquire","n",5,"pool",RuleValue.Obj("kind","牌库底")));
        s=Start(bottomFive,Builtin("tt3-fireball"),Builtin("tt2-piercearrow"),Builtin("tt3-petal"),Builtin("tt3-blue-potion"),Builtin("tt3-magic-lamp"));
        Set(s,"hand",new List<string>{"c0"});Set(s,"drawPile",new List<string>{"c1","c2","c3","c4","c5"});
        Check(s.PlayCard("c0",-2,false).Ok&&s.Snapshot.Discovering.Options.Count==3&&s.Snapshot.DrawPile.Count==0,"explicit Source deck-bottom selection shows only first three while reserving the requested originals");
        first=s.Snapshot.Discovering;token=s.Snapshot.BattleToken;
        Check(!s.PickDiscover(3,token,first.selectionId).Ok&&s.CancelDiscover(token,first.selectionId).Ok
            &&s.Snapshot.DrawPile.SequenceEqual(new[]{"c1","c2","c3","c4","c5"}),"deck-bottom cancellation also restores reserved originals outside the first-three candidate cap");

        // Explicit structured acquisition fixture exercises ordinary generated multi-pick cancellation.
        var multi=Card("round6-generated-discover","法术",0,RuleValue.Obj("op","acquire","n",2,"pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-fireball")),"dest","discover"));
        s=Start(multi);Check(s.PlayCard("c0",-2,false).Ok,"multi-pick acquisition fixture rejected");first=s.Snapshot.Discovering;token=s.Snapshot.BattleToken;
        Check(first.kind=="hand"&&s.PickDiscover(0,token,first.selectionId).Ok,"first ordinary generated selection rejected");
        var second=s.Snapshot.Discovering;var acquired=s.Snapshot.Hand.ToArray();
        Check(second!=null&&second.selectionId!=first.selectionId&&second.Options.Select(card=>card.id).SequenceEqual(first.Options.Select(card=>card.id))&&acquired.Length==1,"identical next options reused discovery identity or lost the confirmed reward");
        random=((Rng)Field(s,"rng")).SaveState();
        Check(!s.PickDiscover(0,token,first.selectionId).Ok&&!s.CancelDiscover(token,first.selectionId).Ok,"old identical-option round can act on its successor");
        Check(s.CancelDiscover(token,second.selectionId).Ok&&s.Snapshot.Discovering==null&&s.Snapshot.Hand.SequenceEqual(acquired)
            &&((Rng)Field(s,"rng")).SaveState()==random,"cancelling remainder lost a confirmed reward, added another card or advanced RNG");
        var next=Start(multi);next.PlayCard("c0",-2,false);var live=next.Snapshot.Discovering;var nextToken=next.Snapshot.BattleToken;
        Check(!next.CancelDiscover(token,second.selectionId).Ok&&!next.PickDiscover(0,token,first.selectionId).Ok
            &&next.Snapshot.Discovering.selectionId==live.selectionId,"old battle owner can cancel or confirm a new session");
        typeof(BattleSession).GetMethod("Finish",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(next,new object[]{(bool?)false});
        Check(!next.CancelDiscover(nextToken,live.selectionId).Ok&&!next.PickDiscover(0,nextToken,live.selectionId).Ok&&next.Snapshot.Over,"terminal battle accepted late discovery input");

        var catalog=CardLibrary.All().ToArray();
        var bounded=new[]{"tt13-stellar-divination","tt13-scale-armor","tt3-magic-lamp","tt2-jianghu","tt7-bloodpoison","tt2-piercearrow","tt3-crimson-pouch","tt3-blue-potion"}.Select(Builtin).ToArray();
        CardLibrary.Init(()=>bounded);
        try
        {
            var reactive=Reactive();s=reactive.Session;
            Check(s.EndTurn().Ok&&s.Snapshot.RuleChoice!=null&&s.ChooseRuleOption(0).Ok,"legal stellar/scale/lamp discover continuation absent");
            var discover=s.Snapshot.Discovering;token=s.Snapshot.BattleToken;random=((Rng)Field(s,"rng")).SaveState();
            Check(discover!=null&&s.Snapshot.TurnEndPending&&Attacks(reactive.Host)==1,"owned enemy turn did not pause at actual generated discover");
            Check(s.CancelDiscover(token,discover.selectionId).Ok&&!s.Snapshot.TurnEndPending&&!s.RuleInputPending&&s.Turn==2&&reactive.Host.Hp==997
                &&Attacks(reactive.Host)==1,"discover cancellation failed to resume its original enemy owner exactly once");
            Check(((Rng)Field(s,"rng")).SaveState()==random&&!s.CancelDiscover(token,discover.selectionId).Ok&&s.Turn==2,"late cancellation repeated owner or consumed extra RNG");

            // Real hero dispatches two explicit martial rule fixtures; each discovery owns only its own input.
            var automatic=Card("round6-automatic-discover","武术",0,RuleValue.Obj("op","acquire","n",1,"pool",RuleValue.Obj("kind","ids","ids",RuleValue.Arr("tt3-magic-lamp")),"dest","discover"));
            s=Start(Builtin("tt8-hero-sword"),automatic,automatic.Clone());Set(s,"hand",new List<string>{"c0"});Set(s,"drawPile",new List<string>{"c2","c1"});
            Check(s.PlayCard("c0",-1,false).Ok&&s.Snapshot.Discovering!=null,"actual castDrawn hero did not stop on first structured discover");
            first=s.Snapshot.Discovering;token=s.Snapshot.BattleToken;
            Check(s.CancelDiscover(token,first.selectionId).Ok&&s.Snapshot.Discovering!=null&&s.Snapshot.Discovering.selectionId!=first.selectionId,"cancel did not advance automatic batch to next source exactly once");
            second=s.Snapshot.Discovering;
            Check(!s.CancelDiscover(token,first.selectionId).Ok&&s.Snapshot.Discovering.selectionId==second.selectionId,"old first cancellation cleared the automatic batch's next discovery");
            Check(s.CancelDiscover(token,second.selectionId).Ok&&s.Snapshot.Discovering==null&&!s.RuleInputPending,"second discovery cancellation did not finish automatic batch");
        }
        finally{CardLibrary.Init(()=>catalog);}
        MistBoxDiscoveryOracle();
    }
    static void SameOracleCards(IEnumerable<CardDef> cards,JsonElement expected,string label)
    {
        var actual=cards.Select(card=>card.id+"|"+(card.variantKey??"")+"|"+card.cost).ToArray();
        var wanted=expected.EnumerateArray().Select(card=>card.GetProperty("id").GetString()+"|"+(card.GetProperty("variantKey").GetString()??"")+"|"+card.GetProperty("cost").GetInt32()).ToArray();
        Check(actual.SequenceEqual(wanted),label+": "+string.Join(",",actual)+" expected "+string.Join(",",wanted));
    }
    static void SameOracleRandom(BattleSession session,JsonElement expected,string label)
    {
        // Native Rng.SaveState is seed=<uint>;v=<int>[;s=key:<uint>,...], not JSON.
        var actual=((Rng)Field(session,"rng")).SaveState().Split(';');
        Check((actual.Length==2||actual.Length==3)
            &&actual[0]=="seed="+expected.GetProperty("seed").GetUInt32().ToString(CultureInfo.InvariantCulture)
            &&actual[1]=="v="+expected.GetProperty("version").GetInt32().ToString(CultureInfo.InvariantCulture)
            &&(actual.Length==2||actual[2].StartsWith("s=",StringComparison.Ordinal)),label+" native layout and exact seed/version");
        var a=(actual.Length==3?actual[2].Substring(2).Split(','):Array.Empty<string>()).OrderBy(entry=>entry,StringComparer.Ordinal);
        var b=expected.GetProperty("streams").EnumerateObject().Select(entry=>entry.Name+":"+entry.Value.GetUInt32().ToString(CultureInfo.InvariantCulture)).OrderBy(entry=>entry,StringComparer.Ordinal);
        Check(a.SequenceEqual(b,StringComparer.Ordinal),label+" exact complete stream key/value state");
    }
    static void MistBoxDiscoveryOracle()
    {
        string file=Environment.GetEnvironmentVariable("SDT_DISCOVER_SOURCE_VECTORS");
        Check(!string.IsNullOrEmpty(file)&&File.Exists(file),"Root must generate actual Source discover-source-oracle.mjs vectors before the unified domain run");
        using var vectors=JsonDocument.Parse(File.ReadAllText(file));
        var original=CardLibrary.All().ToArray();
        try
        {
            foreach(var sample in vectors.RootElement.GetProperty("cases").EnumerateArray())
            {
                var catalog=JsonSerializer.Deserialize<CardDef[]>(sample.GetProperty("catalog").GetRawText(),new JsonSerializerOptions{IncludeFields=true});
                CardLibrary.Init(()=>catalog);
                var s=Start(Builtin("tt3eq-mistbox"));Check(s.PlayCard("c0",-1,false).Ok,"real mist-box equipment rejected");
                int seed=sample.GetProperty("seed").GetInt32();Set(s,"rng",new Rng(seed));
                int granted=((List<OwnedCard>)Field(s,"granted")).Count;
                Check(s.UseEquipment("c0").Ok,"real mist-box active skill rejected");
                var rounds=sample.GetProperty("rounds");
                if(rounds.GetArrayLength()==0)
                {
                    Check(s.Snapshot.Discovering==null&&!s.RuleInputPending,"Source 0/1 random-obtainable moves must not open mist-box discovery");
                    SameOracleRandom(s,sample.GetProperty("finalRandom"),"mist empty preflight");continue;
                }
                var first=s.Snapshot.Discovering;string token=s.Snapshot.BattleToken;
                Check(first!=null&&first.kind=="swap"&&first.Options.Count<=3,"mist-box must use its source-specific three-option round");
                SameOracleCards(first.Options,rounds[0].GetProperty("options"),"mist first Source candidates");SameOracleRandom(s,rounds[0].GetProperty("random"),"mist first Source RNG");
                Check(s.PickDiscover(0,token,first.selectionId).Ok,"mist first real confirmation rejected");
                var chosen=((List<OwnedCard>)Field(s,"granted")).Skip(granted).ToArray();
                Check(chosen.Length==1&&s.Snapshot.Hand.Contains(chosen[0].uid)&&chosen[0].card.cost==first.Options[0].cost,"first confirmed mist card must enter hand immediately at original cost");
                var second=s.Snapshot.Discovering;
                SameOracleCards(second.Options,rounds[1].GetProperty("options"),"mist second Source candidates including legal repeated IDs");SameOracleRandom(s,rounds[1].GetProperty("random"),"mist second Source RNG");
                int sequence=(int)Field(s,"tmpSeq");
                if(sample.GetProperty("cancelSecond").GetBoolean())
                {
                    Check(s.CancelDiscover(token,second.selectionId).Ok&&(int)Field(s,"tmpSeq")==sequence,"mist second-round cancellation creates no unconfirmed UID");
                    Check(s.Snapshot.Hand.Contains(chosen[0].uid)&&s.FindCard(chosen[0].uid).card.cost==first.Options[0].cost,"mist cancellation retains first physical UID and original fee");
                }
                else Check(s.PickDiscover(sample.GetProperty("secondIndex").GetInt32(),token,second.selectionId).Ok,"mist second confirmation rejected");
                var final=((List<OwnedCard>)Field(s,"granted")).Skip(granted).Select(entry=>s.FindCard(entry.uid).card).ToArray();
                Check(final.Length==sample.GetProperty("generatedCount").GetInt32()&&s.Snapshot.Discovering==null,"mist final generated count/input differs from Source");
                SameOracleCards(final,sample.GetProperty("finalCards"),"mist exact Source final variants/fees");SameOracleRandom(s,sample.GetProperty("finalRandom"),"mist final Source RNG");
            }
        }
        finally{CardLibrary.Init(()=>original);}
        var a=Builtin("tt3-fireball");a.cost=1;a.variantKey="deck-a";
        var b=a.Clone();b.cost=2;b.variantKey="deck-b";
        var deck=Start(Builtin("tt3-dig-treasure"),a,b,Builtin("tt2-piercearrow"));Set(deck,"hand",new List<string>{"c0"});Set(deck,"drawPile",new List<string>{"c1","c2","c3"});
        Check(deck.PlayCard("c0",-1,false).Ok,"same-ID deck discovery source rejected");var discovery=deck.Snapshot.Discovering;
        Check(deck.PickDiscover(1,deck.Snapshot.BattleToken,discovery.selectionId).Ok&&deck.Snapshot.Hand.SequenceEqual(new[]{"c2"})
            &&deck.FindCard("c2").card.variantKey=="deck-b"&&deck.FindCard("c2").card.cost==2,"same-ID deck variant must retain selected original UID/face/fee");
    }
}
