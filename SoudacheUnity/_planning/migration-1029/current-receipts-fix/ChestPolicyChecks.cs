using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
using Sdt.Core;
using Sdt.UI.Screens.Run;

static class ChestPolicyChecks
{
    static int Main(string[] args)
    {
        var root=JsonDocument.Parse(File.ReadAllText(args[0])).RootElement;
        var differences=new List<object>(); int count=0,assertions=0;
        foreach(var input in root.GetProperty("cases").EnumerateArray())
        {
            var boxes=new List<ChestVisitReceipt>();
            foreach(var b in input.GetProperty("boxes").EnumerateArray())
                boxes.Add(new ChestVisitReceipt {kind=b.GetProperty("kind").GetString(),claimMode=b.GetProperty("claimMode").GetString(),
                    coins=b.GetProperty("coins").GetInt32(),coinsTaken=b.GetProperty("coinsTaken").GetBoolean(),completed=b.GetProperty("completed").GetBoolean(),
                    cardIds=Enumerable.Range(0,b.GetProperty("n").GetInt32()).Select(i=>i.ToString()).ToList(),
                    taken=b.GetProperty("taken").EnumerateArray().Select(v=>v.GetInt32()).ToHashSet(),lost=b.GetProperty("lost").EnumerateArray().Select(v=>v.GetInt32()).ToHashSet()});
            int current=input.TryGetProperty("index",out var index)?index.GetInt32():0;
            var node=new NodeVisitReceipt {chestQueue=boxes,chestIndex=current,battleWon=input.TryGetProperty("battle",out var battle)&&battle.GetBoolean()};
            bool resolved=CurrentChestProgress.Resolved(boxes[current]); int pending=CurrentChestProgress.PendingIndex(boxes);
            bool automatic=CurrentChestProgress.AutomaticSingle(node,boxes[current],input.GetProperty("receivedIndex").GetInt32());
            int closeIndex=current;bool closedToNext=false,finished=false;
            if(!(input.TryGetProperty("skipClose",out var skip)&&skip.GetBoolean()))
            {
                boxes[current].completed=CurrentChestProgress.Resolved(boxes[current]);
                int next=CurrentChestProgress.PendingIndex(boxes);if(next>=0){closeIndex=next;closedToNext=true;}
                if(CurrentChestProgress.Resolved(boxes[closeIndex]))
                {boxes[closeIndex].completed=true;finished=CurrentChestProgress.PendingIndex(boxes)<0;}
            }
            var actual=new Dictionary<string,object> {{"resolved",resolved},{"pending",pending},{"automatic",automatic},{"closeIndex",closeIndex},{"closedToNext",closedToNext},{"finished",finished}};
            var expected=input.GetProperty("expected");
            foreach(var pair in actual)
            {
                assertions++;
                if(JsonSerializer.Serialize(pair.Value)!=expected.GetProperty(pair.Key).GetRawText())
                    differences.Add(new {name=input.GetProperty("name").GetString(),field=pair.Key,actual=pair.Value,expected=expected.GetProperty(pair.Key).ToString()});
            }
            count++;
        }
        var result=new {passed=differences.Count==0,cases=count,assertions,differences};
        File.WriteAllText(args[1],JsonSerializer.Serialize(result,new JsonSerializerOptions {WriteIndented=true}));
        Console.WriteLine(JsonSerializer.Serialize(result)); return differences.Count==0?0:1;
    }
}
