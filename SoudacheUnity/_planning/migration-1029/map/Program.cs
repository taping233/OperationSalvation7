using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Sdt.Core;
class Program
{
    static void Assert(bool condition,string message){if(!condition)throw new Exception(message);}
    static void Main(string[] args)
    {
        var options=new JsonSerializerOptions{IncludeFields=true};int validated=0;
        foreach(string seed in args.Length>0?args:new[]{"0","1","42","1029"}){
            var map=LayeredMapGenerator.Generate(seed);
            Assert(LayeredMapGenerator.ValidateSnapshot(map,out var why),why);
            var view=MapModel.FromSnapshot(map);
            Assert(view.Nodes.Count==50&&view.Layers.Count==4,"地图适配节点数");
            Assert(view.Nodes.All(n=>view.CellDefs[n.id]==n&&view.NodePos[n.layerIdx][n.idx].x==n.x),"几何与索引一致");
            File.WriteAllText(Path.Combine(AppContext.BaseDirectory,seed+".json"),JsonSerializer.Serialize(map,options));validated++;
        }
        var original=LayeredMapGenerator.Generate("1029");string json=JsonSerializer.Serialize(original,options);int rejected=0;
        void Reject(Action<MapSnapshot> mutate){var map=JsonSerializer.Deserialize<MapSnapshot>(json,options);mutate(map);Assert(!LayeredMapGenerator.ValidateSnapshot(map,out _),"损坏地图应拒绝");rejected++;}
        Reject(m=>m.generatorVersion=99);Reject(m=>m.layers[0].entry=-1);Reject(m=>m.layers[0].nodes[0].idx=100);
        Reject(m=>m.layers[0].nodes[0].next.Add(new MapLink(3,0)));Reject(m=>m.layers[0].nodes[0].next.Clear());
        Reject(m=>m.layers[0].nodes[1].id=m.layers[0].nodes[0].id);Reject(m=>m.layers[0].nodes[0].next.Add(new MapLink(0,999)));
        Reject(m=>m.layers[0].nodes[0].type="unknown");Reject(m=>m.layers[0].doors[0].exit=true);
        var result=new{passed=true,validatedSeeds=validated,rejectedCorruptSnapshots=rejected,nodeCounts=new[]{7,11,16,16},nodes=50};
        File.WriteAllText(Path.Combine(AppContext.BaseDirectory,"map-check-result.json"),JsonSerializer.Serialize(result,options));
        Console.WriteLine(JsonSerializer.Serialize(result,options));
    }
}
