using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Run;

class Program {
 static void Require(bool value,string text) { if(!value)throw new Exception(text);Console.WriteLine("CHECK "+text); }
 static void Main() {
  var folder=Path.Combine(Environment.CurrentDirectory,"_planning/migration-1029/fresh-scope-audit/data-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff"));
  Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",folder);
  CardLibrary.Init(()=>CardDatabase.All);
  var g=GameRuntime.I;
  g.ResetSlot(1); Require(g.Saves.LastWriteSucceeded,"isolated fresh profile created");
  bool repeated=false;
  for(int attempt=0;attempt<20&&!repeated;attempt++) {
   if(attempt>0){g.ShowTitle();g.ResetSlot(1);}
   g.NewRun(1,"wu");Require(g.State.runActive,"run started");
   var seen=new Dictionary<string,string>();
   for(int layer=0;layer<g.State.mapSnapshot.layers.Count&&!repeated;layer++) {
    foreach(var mapNode in g.State.mapSnapshot.layers[layer].nodes.Where(n=>n.type=="event")) {
     g.EnterLayer(layer,mapNode.idx,false);
     var node=g.ResolveCell();
     var card=node?.Instant?.EventCard;
     if(card==null)continue;
     string key=g.CurrentNodeId;
     if(seen.TryGetValue(card.id,out string previous)) {
      repeated=true;
      Console.WriteLine("OBSERVE duplicate_event seed="+g.State.seed+" previous_node="+previous+" node="+key+" card="+card.id+" name="+card.name+" log_count="+g.State.eventLog.Count);
      g.SaveCurrent(); Require(g.LoadRun(1),"duplicate event run reloads");
      Console.WriteLine("OBSERVE duplicate_event_after_reload="+g.State.eventLog.Count(e=>e.name==card.name));
      break;
     }
     seen[card.id]=key;g.FinishNode();
    }
   }
  }
  Require(repeated,"duplicate at distinct generated event nodes reproduced");
  g.ShowTitle();g.ResetSlot(2);
  var collectible=g.Meta.CollectionPool().First();
  Require(g.TryPersistMutation(()=>g.Base.stash.Add(new StashStack{card=collectible.Clone(),count=1}),out _),"one collectible fixture persisted");
  Require(g.Meta.TryConvertCollection(collectible.id,1,out var reason),"single collectible conversion succeeded: "+reason);
  Console.WriteLine("OBSERVE collection_after_conversion id="+collectible.id+" registered="+g.Base.collection.ContainsKey(collectible.id)+" warehouse_count="+g.Base.stash.Count(s=>s.card.id==collectible.id)+" collection_ui_rows="+g.Base.stash.Count(s=>s.count>0&&g.Meta.IsCollectible(s.card)));
  g.ShowTitle();g.EnterSlot(2);Require(g.Base.Slot==2,"collection profile re-enters (EnterSlot return only indicates a live run)");
  Console.WriteLine("OBSERVE collection_after_reload id="+collectible.id+" registered="+g.Base.collection.ContainsKey(collectible.id)+" warehouse_count="+g.Base.stash.Count(s=>s.card.id==collectible.id));
  Console.WriteLine("PROFILE "+SaveSystem.ProfilePath);
 }
}
