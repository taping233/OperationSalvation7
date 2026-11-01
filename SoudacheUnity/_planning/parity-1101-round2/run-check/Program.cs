using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;

class Program
{
    static int checks, saves;
    static IReadOnlyList<CardDef> catalog = CardDatabase.All;
    static GameRuntime Game;
    static void Check(bool value,string message)
    { checks++; if(!value)throw new InvalidOperationException(message); }
    static void Start()
    {
        catalog=CardDatabase.All;CardLibrary.Init(()=>catalog);
        Game.ResetSlot(1);Game.NewRun(1,"wu");
        Game.State.ownedCards.Clear();Game.State.inventory.Clear();Game.State.usedPocket.Clear();Game.State.classCard=null;
    }
    static CardDef Fireball()=>CardLibrary.FindById("tt3-fireball").Clone();
    static void BlockWrite(Func<bool> command,string label)
    {
        Game.SaveCurrent();string state=SaveJson.Stringify(Game.State),rng=Game.Rng.SaveState(),disk=File.ReadAllText(SaveSystem.ProfilePath);
        saves=0;Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
        Check(!command(),label+" reports failed checkpoint");
        Check(SaveJson.Stringify(Game.State)==state&&Game.Rng.SaveState()==rng&&File.ReadAllText(SaveSystem.ProfilePath)==disk,
            label+" atomically restores state, RNG and disk");
        Check(saves==0&&!Game.Saves.InTransaction,label+" emits no save and closes transaction");
        Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-"+checks);
    }
    static void RestoreFixture()
    {
        Start();var first=Fireball();first.variantKey="first";var second=Fireball();second.variantKey="second";
        Game.State.usedPocket.Add(new PocketStack{card=first,count=2});Game.State.usedPocket.Add(new PocketStack{card=second,count=1});
        Game.CurrentNodeReceipt.type="event";
        Game.CurrentNodeReceipt.eventProgress=new EventProgress{eventId="cmtn7qttxqo4",stage="restore",need=1};
    }
    static List<string> ExpectedResources(IReadOnlyList<CardDef> pool,Rng rng,string mode)
    {
        var names=new HashSet<string>();var ids=new List<string>();
        for(int pick=0;pick<2;pick++)
        {
            var tiers=CardLibrary.DropWeights.Select(pair=>new{
                cards=pool.Where(card=>card.type=="资源"&&CardLibrary.IsRandomObtainable(card)&&!names.Contains(card.name)&&card.rarity==pair.Key).ToArray(),
                weight=pair.Value*(mode=="elite"&&pair.Key!="古朴"?1.2:1)}).Where(tier=>tier.cards.Length>0&&tier.weight>0).ToArray();
            if(tiers.Length==0)break;
            double roll=rng.Random("loot","reward")*tiers.Sum(tier=>tier.weight);var selected=tiers.Last();
            foreach(var tier in tiers){roll-=tier.weight;if(roll<=0){selected=tier;break;}}
            var card=selected.cards[(int)(rng.Random("loot","reward")*selected.cards.Length)];ids.Add(card.id);names.Add(card.name);
        }
        return ids;
    }
    static void Main()
    {
        string output=Path.GetFullPath("_planning/parity-1101-round2/run-check/profile-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));
        Directory.CreateDirectory(output);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",output);
        CardLibrary.Init(()=>catalog);Game=GameRuntime.I;Game.Bus.On<SaveCompleted>(_=>saves++);
        foreach(string mode in new[]{"standard","elite"})
        {
            Start();Game.State.mode=mode;
            var custom=new[]{new CardDef{id="round2-resource-a",name="现行资源甲",type="资源",rarity="古朴"},
                new CardDef{id="round2-resource-b",name="现行资源乙",type="资源",rarity="稀有"}};
            catalog=CardDatabase.All.Where(card=>card.type!="资源").Concat(custom).ToArray();
            var reference=new Rng(1);reference.LoadState(Game.Rng.SaveState());var expected=ExpectedResources(catalog,reference,mode);
            var receipt=new NodeVisitReceipt{type="resource"};
            var reserve=typeof(GameRuntime).GetMethod("ReserveResourceReward",BindingFlags.Instance|BindingFlags.NonPublic);
            reserve.Invoke(Game,new object[]{receipt});
            Check(receipt.rewardCardIds.SequenceEqual(expected),"resource uses live catalog with source weighted order in "+mode);
            Check(Game.Rng.SaveState()==reference.SaveState(),"resource preserves rarity/card RNG draws in "+mode);
            string rng=Game.Rng.SaveState();reserve.Invoke(Game,new object[]{receipt});
            Check(receipt.rewardCardIds.SequenceEqual(expected)&&Game.Rng.SaveState()==rng,"reserved resource candidates never reroll");
        }

        Start();string firstId=Fireball().id,secondId=CardLibrary.All().First(card=>card.type=="装备").id;
        Game.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{firstId,secondId,firstId}};
        saves=0;Check(Game.ClaimAllEntrySupply(out _),"all entry supply claims succeed");
        Check(saves==1&&Game.State.entrySupply.taken.SequenceEqual(new[]{0,1,2}),"batch commits exactly one complete ordered receipt");
        Check(Game.State.ownedCards.Select(entry=>entry.card.id).SequenceEqual(new[]{firstId,secondId,firstId})
            &&Game.State.ownedCards.All(entry=>entry.brought==1)&&ReferenceEquals(Game.State.classCard,Game.State.ownedCards[0].card),
            "batch preserves source order, brought flags and first claimed class card identity");
        var loaded=Game.Saves.ReadSlot(1);
        Check(loaded.entrySupply.taken.SequenceEqual(new[]{0,1,2})&&loaded.ownedCards.All(entry=>entry.brought==1),"batch receipt and brought cards survive saved read");
        string afterBatch=SaveJson.Stringify(Game.State);Check(!Game.ClaimAllEntrySupply(out _)&&saves==1&&SaveJson.Stringify(Game.State)==afterBatch,"batch cannot be claimed again");

        Start();Game.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{secondId,firstId,firstId}};
        Game.State.ownedCards.Add(new OwnedCard{uid="existing-fire",card=Fireball()});
        for(int i=1;i<Game.Base.BagCap;i++)Game.State.ownedCards.Add(new OwnedCard{uid="fill-"+i,card=new CardDef{id="fill-"+i,name="占位装备"+i,type="装备"}});
        saves=0;Check(Game.ClaimAllEntrySupply(out _),"full bag still accepts later same-name stack copies");
        Check(saves==1&&Game.State.entrySupply.taken.SequenceEqual(new[]{1,2})&&Game.State.ownedCards.Count(entry=>entry.card.id==firstId)==3,
            "batch skips blocked first card and keeps sequential capacity accounting");
        Check(Game.State.classCard.id==firstId&&!Game.EntrySupplyComplete,"first accepted card owns class identity and blocked supply stays pending");

        Start();Game.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{firstId,secondId}};
        BlockWrite(()=>Game.ClaimAllEntrySupply(out _),"batch entry supply");
        saves=0;Check(Game.ClaimAllEntrySupply(out _)&&saves==1&&Game.State.ownedCards.Count==2,"failed batch retries once without duplicate cards");

        RestoreFixture();string before=SaveJson.Stringify(Game.State),beforeRng=Game.Rng.SaveState();var choices=Game.GetCurrentEventOutcome();
        Check(choices.CardKeys.Count==2&&choices.CardKeys.Distinct().Count()==2,"same ID variants produce unique restore rows");
        Check(choices.CardFaces.Select(card=>card.variantKey).SequenceEqual(new[]{"first","second"})
            &&!ReferenceEquals(choices.CardFaces[1],Game.State.usedPocket[1].card)&&((ICollection<CardDef>)choices.CardFaces).IsReadOnly,
            "restore exposes independent read-only real card faces");
        Check(SaveJson.Stringify(Game.State)==before&&Game.Rng.SaveState()==beforeRng,"restore projection mutates no receipt or RNG");
        string chosen=choices.CardKeys[1];var restored=Game.SubmitEventSelection(new List<string>{chosen});
        Check(restored.Settled&&Game.State.ownedCards.Single().card.variantKey=="second"&&Game.State.usedPocket.Single().card.variantKey=="first"
            &&Game.State.usedPocket[0].count==2,"second restore row grants the exact selected variant");
        before=SaveJson.Stringify(Game.State);Game.SubmitEventSelection(new List<string>{chosen});
        Check(SaveJson.Stringify(Game.State)==before,"resolved restore cannot grant twice");

        foreach(string change in new[]{"count","variant","seed","index"})
        {
            RestoreFixture();chosen=Game.GetCurrentEventOutcome().CardKeys[1];
            if(change=="count")Game.State.usedPocket[1].count++;
            else if(change=="variant")Game.State.usedPocket[1].card.variantKey="changed";
            else if(change=="seed")Game.State.seed++;
            else Game.State.usedPocket.Insert(0,new PocketStack{card=Fireball(),count=1});
            before=SaveJson.Stringify(Game.State);Game.SubmitEventSelection(new List<string>{chosen});
            Check(SaveJson.Stringify(Game.State)==before&&Game.State.ownedCards.Count==0,"stale restore "+change+" rejects without consuming another row");
        }
        RestoreFixture();chosen=Game.GetCurrentEventOutcome().CardKeys[1];
        BlockWrite(()=>Game.SubmitEventSelection(new List<string>{chosen}).Settled,"event restore");
        Check(Game.GetCurrentEventOutcome().CardKeys[1]==chosen,"failed restore preserves same current candidate key");
        Check(Game.SubmitEventSelection(new List<string>{chosen}).Settled&&Game.State.ownedCards.Single().card.variantKey=="second","failed restore retries the same variant once");
        var result=new{passed=true,assertions=checks,output};File.WriteAllText(Path.Combine(output,"result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));
        Console.WriteLine(JsonConvert.SerializeObject(result));
    }
}
