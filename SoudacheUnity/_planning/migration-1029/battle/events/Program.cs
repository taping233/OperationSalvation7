using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;

static class Program
{
    static int checks,branches,stages;
    static GameRuntime g;
    static void Assert(bool ok,string message){checks++;if(!ok)throw new Exception(message);}
    static void Start(string eventId,int layer=0)
    {
        g.NewRun(1,CharacterTable.All[0].id);g.State.entrySupply=null;g.State.layerIdx=layer;g.State.trackPos=0;g.State.nodeRewards.Clear();g.State.settled.Clear();g.State.closed.Clear();
        g.State.hp=25;g.State.maxHp=35;g.State.coins=100;g.State.fragments=0;g.State.ownedCards.Clear();g.State.inventory.Clear();g.State.usedPocket.Clear();
        string[] ids={"tt-wood","tt3-fireball","tt2-pearlbox"};
        foreach(string id in ids)g.State.ownedCards.Add(new OwnedCard{uid=id,card=CardLibrary.FindById(id)});
        foreach(var card in CardDatabase.All.Where(c=>c.type=="装备"&&CardLibrary.IsRandomObtainable(c)).Take(2))g.State.ownedCards.Add(new OwnedCard{uid="extra-"+card.id,card=card});
        g.State.usedPocket.Add(new PocketStack{card=CardLibrary.FindById("tt3-fireball"),count=1});
        g.GetEventChoices(eventId);Assert(g.GetCurrentEventOutcome()?.Stage=="choices","event initialized "+eventId);
    }
    static void RoundTrip(string name)
    {
        g.SaveCurrent();string before=SaveJson.Stringify(g.CurrentNodeReceipt.eventProgress);g.ShowTitle();Assert(g.LoadRun(1),"reload "+name+" / "+g.Saves.LastError);
        Assert(SaveJson.Stringify(g.CurrentNodeReceipt.eventProgress)==before,"event stage survives restart "+name);stages++;
    }
    static void Drive(string eventId,string key,int layer)
    {
        Start(eventId,layer);var o=g.ApplyCurrentEventChoice(key);Assert(o!=null,"choice result");RoundTrip(eventId+":"+key);
        for(int guard=0;guard<50;guard++){
            o=g.GetCurrentEventOutcome();var p=g.CurrentNodeReceipt.eventProgress;
            if(o.Settled||p.stage=="battle"||p.stage=="chests")break;
            if(p.stage=="dice"){
                string before=SaveJson.Stringify(p.dice[p.diceIndex]);g.RollCurrentEventDice();var die=g.CurrentNodeReceipt.eventProgress.dice.Last();int result=die.result.Value;
                g.RollCurrentEventDice();Assert(g.CurrentNodeReceipt.eventProgress.dice.Last().result==result,"repeat roll stable");RoundTrip("rolled "+eventId);
                g.ApplyCurrentEventChoice("__dice_continue");
            }else if(p.stage=="sources"||p.stage=="selection"||p.stage=="rewards"||p.stage=="restore"){
                var keys=o.CardKeys.Take(o.Need).ToList();o=g.SubmitEventSelection(keys);Assert(!string.IsNullOrEmpty(o.Stage),"selection returns state");
            }else if(p.stage=="gamble")g.ApplyCurrentEventChoice("__gamble");
            else if(p.stage=="recodeConfirm")g.ApplyCurrentEventChoice("__recode_confirm");
            else throw new Exception("unhandled stage "+p.stage+" / "+o.Message);
        }
        var final=g.CurrentNodeReceipt.eventProgress;
        Assert(final.settled||final.stage=="battle"||final.stage=="chests","choice completes "+key+" / "+final.stage+" "+g.GetCurrentEventOutcome().Message);
        if(final.stage=="battle")Assert(final.enemies.Count==Math.Min(5,3+layer),"current source bandit count");
        if(final.stage=="chests"){
            string queue=SaveJson.Stringify(g.CurrentNodeReceipt.chestQueue);RoundTrip("event chests");
            g.ApplyCurrentEventChoice(key);Assert(queue==SaveJson.Stringify(g.CurrentNodeReceipt.chestQueue),"repeated choice cannot reroll chest");
        }
        branches++;
    }
    static void Main()
    {
        string dir=Path.GetFullPath("_planning/migration-1029/battle/events/data-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(dir);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",dir);CardLibrary.Init(()=>CardDatabase.All);g=GameRuntime.I;
        var source=JArray.Parse(File.ReadAllText("_planning/migration-1029/battle/current-events.json"));
        File.WriteAllText(Path.Combine(dir,"actual-events.json"),SaveJson.Token(EventDatabase.All).ToString()); Assert(JToken.DeepEquals(source,SaveJson.Token(EventDatabase.All)),"generated 19 event / 44 choice / 4 layer tables equal actual source export");
        foreach(var e in EventDatabase.All)for(int layer=0;layer<4;layer++)foreach(var spec in ((object[])e.Items("layers")[layer]).OfType<RuleValue>())Drive(e.Text("id"),spec.Text("key"),layer);
        Start("ev19-vital");g.ApplyCurrentEventChoice("ev19-vital:0");Assert(g.State.maxHp==38&&g.State.hp==28,"source vital adds maxHp+hp");
        g.ApplyCurrentEventChoice("ev19-vital:0");Assert(g.State.maxHp==38&&g.State.hp==28,"vital idempotent");
        Start("tt6-systemsupply");g.ApplyCurrentEventChoice("tt6-systemsupply:1");Assert(g.State.fragments==1&&g.State.coins==102,"source lightweight supplies scalar fragment and coins");RoundTrip("fragments");Assert(g.State.fragments==1,"fragment scalar restart");
        Start("tt6-goldmine");g.ApplyCurrentEventChoice("tt6-goldmine:2");Assert(g.State.coins==106&&!g.State.ownedCards.Any(c=>c.card.id=="tt-wood"),"source wood trade consumes card and gives6");
        Start("tt6-mystery");g.ApplyCurrentEventChoice("tt6-mystery:0");string candidates=SaveJson.Stringify(g.CurrentNodeReceipt.eventProgress.dice);g.RollCurrentEventDice();int fixedResult=g.CurrentNodeReceipt.eventProgress.dice[0].result.Value;
        Assert(g.ApplyCurrentEventChoice("__leave").Settled&&g.State.Phase=="idle"&&!g.CurrentNodeReceipt.completed,"temporarily leave pending event");RoundTrip("leave dice");Assert(g.CurrentNodeReceipt.eventProgress.dice[0].result==fixedResult,"leave/reenter fixed die");
        int fault=0;void Fail(Action action){string previous=File.ReadAllText(SaveSystem.ProfilePath),before=SaveJson.Stringify(g.State);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");action();Assert(File.ReadAllText(SaveSystem.ProfilePath)==previous,"failure preserves file");Assert(SaveJson.Stringify(g.State)==before,"failure preserves full memory");Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-"+fault++);}
        Start("ev19-vital");Fail(()=>g.ApplyCurrentEventChoice("ev19-vital:0"));Assert(!g.CurrentNodeReceipt.completed&&g.State.maxHp==35,"failed event retryable");g.ApplyCurrentEventChoice("ev19-vital:0");Assert(g.State.maxHp==38,"retry effect exactly once");
        Start("tt6-chestdraw");g.ApplyCurrentEventChoice("tt6-chestdraw:0");Fail(()=>g.RollCurrentEventDice());Assert(!g.CurrentNodeReceipt.eventProgress.dice[0].result.HasValue,"failed roll not committed");
        Start("ev19-quartermaster");Fail(()=>g.ApplyCurrentEventChoice("ev19-quartermaster:0"));Assert(g.State.coins==100,"failed paid choice no coins lost");
        Start("tt6-goldhammer");g.ApplyCurrentEventChoice("tt6-goldhammer:1");var stock=new List<ShopOfferReceipt>{new ShopOfferReceipt{cardId="starter-attack",price=1},new ShopOfferReceipt{cardId="tt3-fireball",price=5},new ShopOfferReceipt{mystery=true,price=3},new ShopOfferReceipt{cardId="tt-wood",price=2}};
        g.TryPersistMutation(()=>{g.CurrentNodeReceipt.shopStock=stock;g.ApplyEventCommission(stock);},out _);Assert(stock.All(s=>!s.free),"commission requires two player rolls");
        g.RollCommissionDice();RoundTrip("first commission roll");g.ConfirmCommissionDice();g.RollCommissionDice();Fail(()=>g.ConfirmCommissionDice());
        Assert(g.CurrentNodeReceipt.shopStock.All(s=>!s.free),"failed commission retains prices and pending dice");g.ConfirmCommissionDice();stock=g.CurrentNodeReceipt.shopStock;
        Assert(stock.Count(s=>s.free)==2&&!stock[0].free&&!stock[2].free,"commission2 slots excludes starter and empty mystery");g.ApplyEventCommission(stock);Assert(stock.Count(s=>s.free)==2,"commission not consumed twice");
        int checkpointAssertions=CheckpointChecks.Run(),itemAssertions=ItemChecks.Run(),bossAssertions=BossChecks.Run(),poolAssertions=PoolChecks.Run();
        var result=new{passed=true,checks,branches,stageRestarts=stages,realSaveFailures=fault,checkpointAssertions,itemAssertions,bossAssertions,poolAssertions,source="actual Vite eventChoiceSpec 19 events/44 choices/4 layers; production C# runtime with platform/audio adapters",directory=dir};File.WriteAllText(Path.Combine(dir,"result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));
    }
}
