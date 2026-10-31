using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Reflection;
using System.Diagnostics;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;

class Program
{
    static int checks;
    static void Check(bool ok,string message){checks++;if(!ok)throw new Exception(message);}
    static void Main()
    {
        string directory=Path.GetFullPath("_planning/parity-1031/run-check/profile-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));
        Directory.CreateDirectory(directory);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",directory);
        CardLibrary.Init(()=>CardDatabase.All);var g=GameRuntime.I;
        void Start(){g.ResetSlot(1);g.NewRun(1,"wu");Check(g.Saves.LastWriteSucceeded,"isolated new run saved");}
        void Fault(Func<bool> action,string message)
        {
            g.SaveCurrent();string disk=File.ReadAllText(SaveSystem.ProfilePath),state=SaveJson.Stringify(g.State),rng=g.Rng.SaveState();
            Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
            Check(!action(),message+" reports write failure");
            Check(SaveJson.Stringify(g.State)==state&&g.Rng.SaveState()==rng&&File.ReadAllText(SaveSystem.ProfilePath)==disk,message+" preserves run, random and disk");
            Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-"+checks);
        }
        Start();Check(g.State.classCard==null,"class card stays unset before entry supply claim");
        Check(g.State.entrySupply.cardIds.Count>0,"entry supply contains actual class cards");
        Fault(()=>g.ClaimEntrySupply(0,out _),"entry supply");
        Check(g.ClaimEntrySupply(0,out _),"entry supply claim succeeds after write recovery");
        string first=g.State.entrySupply.cardIds[0];var entry=g.State.ownedCards.Last(o=>o.card.id==first);
        Check(entry.brought==1&&g.State.classCard?.id==first,"entry class card uses source brought marker and first claimed identity");
        Check(!g.ClaimEntrySupply(0,out _),"entry supply cannot claim twice");
        Check(CardContainerCommands.TryMoveSafe(g,new[]{entry.uid},true,out _),"entry card can be moved into safe slot");
        g.ShowTitle();Check(g.LoadRun(1),"entry supply saved run reloads");
        Check(g.State.ownedCards.Single(o=>o.uid==entry.uid).brought==1,"entry supply brought marker survives save/reload");
        var abandoned=g.AbandonRun();Check(abandoned!=null&&abandoned.KeptN==0,"abandon does not rescue brought entry cards from safe slot");

        Start();g.State.entrySupply=null;g.State.ownedCards.Clear();var altar=g.Map.Nodes.First(n=>n.type=="altar");
        g.State.layerIdx=altar.layerIdx;g.State.trackPos=altar.idx;g.State.Phase="modal";g.State.altarActivated=true;
        var receipt=g.CurrentNodeReceipt;receipt.altarRewardKind="loot";receipt.rewardCardIds=new List<string>{"tt2-apollo"};
        var pool=CardLibrary.All().Where(c=>CardLibrary.IsRandomObtainable(c)&&c.id!="tt2-apollo").ToArray();
        var expectedRng=new Rng(1);expectedRng.LoadState(g.Rng.SaveState());string expectedBonus=pool[(int)(expectedRng.Random("loot","reward")*pool.Length)].id;
        Fault(()=>g.TryClaimAltarReward(0,out _),"altar acquisition bonus");
        Check(g.TryClaimAltarReward(0,out var why),"altar gift claim succeeds: "+why);
        receipt=g.CurrentNodeReceipt;
        Check(receipt.rewardCardIds.SequenceEqual(new[]{"tt2-apollo",expectedBonus})&&receipt.altarTaken.SequenceEqual(new[]{0})&&!receipt.completed,"altar gift reserves exact source random bonus as separately pending reward");
        Check(g.Rng.SaveState()==expectedRng.SaveState(),"altar gift consumes source reward stream once");
        Check(!g.TryClaimAltarReward(0,out _),"repeated altar gift callback cannot grant or redraw");
        g.ShowTitle();Check(g.LoadRun(1),"altar gift pending reward survives reload");
        Check(g.GetAltarRewardCards()[1].id==expectedBonus,"altar bonus candidate remains frozen after reload");
        Check(g.TryClaimAltarReward(1,out _)&&g.CurrentNodeReceipt.completed,"bonus claim completes altar receipt");

        Start();g.State.entrySupply=null;g.State.altarActivated=true;g.State.bossDefeated=true;g.State.Phase="idle";
        var path=typeof(GameRuntime).GetMethod("TravelPath",BindingFlags.Instance|BindingFlags.NonPublic);
        int travelCases=0;
        foreach(string seed in new[]{"0","42","source-parity-1031"})
        {
            g.State.mapSnapshot=LayeredMapGenerator.Generate(seed);g.BuildDerived();
            foreach(var start in g.Map.Nodes.Where(n=>n.type=="entrance"||n.type=="fire"||n.type=="shop"||n.type=="door"))
            foreach(int state in new[]{0,1,2})
            {
                g.State.layerIdx=start.layerIdx;g.State.trackPos=start.idx;g.State.revealed.Clear();g.State.closed.Clear();g.State.settled.Clear();g.State.nodeRewards.Clear();
                if(state==1)g.State.revealed.UnionWith(g.Map.Nodes.Where(n=>n.layerIdx==start.layerIdx&&n.idx%2==0).Select(n=>n.id));
                if(state==2){g.State.revealed.UnionWith(g.Map.Nodes.Select(n=>n.id));g.State.closed.UnionWith(g.Map.Nodes.Where(n=>n.idx%3!=0).Select(n=>n.id));g.State.settled.UnionWith(g.State.closed);}
                var expected=g.Map.Nodes.Where(n=>n.id!=g.CurrentNodeId&&path.Invoke(g,new object[]{n.id})!=null).Select(n=>n.id);
                Check(g.GetReachableNodeIds().SequenceEqual(expected),"single traversal matches per-target path at "+seed+":"+start.id+":"+state);travelCases++;
            }
        }
        g.State.entrySupply=new EntrySupplyReceipt{cardIds=new List<string>{first}};Check(g.GetReachableNodeIds().Count==0,"pending entry supply blocks all destinations");

        var random=new Random(1031);var catalog=CardLibrary.All().Where(c=>c.type!="事件").ToArray();int capacityCases=0;
        for(int sample=0;sample<200;sample++)
        {
            var owned=new List<OwnedCard>();
            for(int i=0;i<sample+1;i++){var card=catalog[random.Next(catalog.Length)].Clone();card.variantKey=i%4==0?"variant:"+(i%3):null;bool stored=i%7==0;owned.Add(new OwnedCard{uid=i.ToString(),card=card,safe=!stored&&i%5==0,stored=stored,pouchOf=stored&&i%2==0?CardContainerCommands.PouchId:null});}
            var inventory=new[]{new InvSlot{count=sample%8+1},new InvSlot{count=3}};
            var normal=CardContainerCommands.ZoneStacks(owned,false);int supplies=inventory.Sum(i=>(Math.Max(1,i.count)+2)/3),bonus=CardContainerCommands.ResourceBonus(owned);
            var actual=CardContainerCommands.Query(g,owned,inventory);
            Check(actual.used==normal.Count+supplies&&actual.resourceSlots==normal.Count(s=>s.card.type=="资源")&&actual.ordinarySlots==actual.used-actual.resourceSlots&&actual.safeUsed==CardContainerCommands.ZoneStacks(owned,true).Count&&actual.resourceBonus==bonus&&actual.totalCap==g.Base.BagCap+bonus,"capacity projection matches prior formal stack expansion at "+sample);capacityCases++;
        }
        var result=new{passed=true,assertions=checks,travelCases,capacityCases,directory};
        File.WriteAllText(Path.Combine(directory,"result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));
    }
}
