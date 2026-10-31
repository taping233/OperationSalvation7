using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using Sdt.Core;
using Sdt.Run;

namespace Sdt.Run {
 public class GameRuntime { public static GameRuntime I; public Rng Rng; public BaseData Base=new BaseData(); }
 public class BaseData { public Pet CarriedPet; }
 public class Pet { public PetEffect effect=new PetEffect(); }
 public class PetEffect { public bool shopFree; }
}
class Program {
 static CardDef ReadCard(JsonNode card)=>new CardDef{id=(string)card["id"],name=(string)card["name"],rarity=(string)card["rarity"],type=(string)card["type"],cls=(string)card["cls"],unrandom=(bool?)card["unrandom"]??false,hero=(bool?)card["hero"],tokenOf=(string)card["tokenOf"]};
 static object Card(CardDef card)=>new{card.id,card.name,card.rarity,card.type,cls=card.cls??"",card.unrandom};
 static JsonNode State(Rng rng){var parts=rng.SaveState().Split(';');var streams=new JsonObject();foreach(var part in parts.Where(p=>p.StartsWith("s=")))foreach(var field in part.Substring(2).Split(',')){var pair=field.Split(':');streams[pair[0]]=uint.Parse(pair[1]);}return new JsonObject{["seed"]=rng.Seed,["version"]=rng.Version,["streams"]=streams};}
 static void Main(string[] args){
  string mode=args.Length>0?args[0]:"native";var source=JsonNode.Parse(File.ReadAllText("source-results.json"));var rows=new List<object>();var catalogChecks=new Dictionary<string,bool>();
  var catalogs=source["catalogs"].AsObject().ToDictionary(pair=>pair.Key,pair=>pair.Value.AsArray().Select(ReadCard).ToList());
  CardLibrary.Init(()=>CardDatabase.All);CardLibrary.ResetCustomsCache();
  var actualCatalog=CardLibrary.All().Select(Card).ToArray();var expectedCatalog=catalogs["baseline"].Select(Card).ToArray();
  bool catalogEqual=JsonNode.DeepEquals(JsonSerializer.SerializeToNode(actualCatalog),JsonSerializer.SerializeToNode(expectedCatalog));
  foreach(var row in source["rows"].AsArray()){
   string kind=(string)row["kind"];CardLibrary.ResetCustomsCache();CardLibrary.CustomsLoader=null;CardLibrary.CustomsSaver=null;
   if(kind=="baseline"||kind=="upsert"){CardLibrary.Init(()=>CardDatabase.All);if(kind=="upsert")foreach(var edit in source["edits"].AsArray())CardLibrary.Upsert(ReadCard(edit));}
   else CardLibrary.Init(()=>catalogs[kind]);
   if(!catalogChecks.ContainsKey(kind))catalogChecks[kind]=JsonNode.DeepEquals(JsonSerializer.SerializeToNode(CardLibrary.All().Select(Card).ToArray()),JsonSerializer.SerializeToNode(catalogs[kind].Select(Card).ToArray()));
   var initial=row["initial"];var rng=new Rng(0);rng.LoadState("seed="+(uint)initial["seed"]+";v="+(int)initial["version"]+";s="+string.Join(",",initial["streams"].AsObject().Select(p=>p.Key+":"+(uint)p.Value)));
   var runtime=new GameRuntime{Rng=rng};if((bool)row["catFree"])runtime.Base.CarriedPet=new Pet{effect=new PetEffect{shopFree=true}};GameRuntime.I=runtime;
   var generated=ShopScreen.GenerateStock();bool shaCloned=!ReferenceEquals(generated[7].card,CardLibrary.SHA);string shaName=CardLibrary.SHA.name;
   generated[7].card.name="clone-independence-probe";bool shaCloneIndependent=CardLibrary.SHA.name==shaName;generated[7].card.name=shaName;
   var stock=generated.Select(slot=>new{cardId=slot.card?.id,slot.price,slot.sold,slot.empty,slot.mystery,slot.free,slot.label,slot.shaReplenish}).ToArray();
   var after=State(rng);var drops=new List<string>();for(int i=0;i<4;i++)drops.Add(CardLibrary.RandomDropCard(rng,new HashSet<string>(drops.Where(id=>id!=null)))?.id);
   rows.Add(new{id=(string)row["id"],stock,shaCloned,shaCloneIndependent,after,drops,afterDrops=State(rng)});
  }
  File.WriteAllText(mode+"-results.json",JsonSerializer.Serialize(new{catalogEqual,catalogChecks,actualCatalogCount=actualCatalog.Length,expectedCatalogCount=expectedCatalog.Length,rows},new JsonSerializerOptions{WriteIndented=true}));
  Console.WriteLine($"catalogEqual={catalogEqual}; cases={rows.Count}; mode={mode}");
 }
}
