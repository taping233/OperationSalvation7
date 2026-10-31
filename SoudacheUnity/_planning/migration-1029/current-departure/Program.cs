using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
class Program
{
 static List<string> checks=new List<string>();
 static void Check(bool value,string label){if(!value)throw new Exception(label);checks.Add(label);}
 static void Main(){
  string evidence="_planning/migration-1029/current-departure";var dir=Path.GetFullPath(evidence+"/test-profile-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff"));Directory.CreateDirectory(dir);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",dir);
  CardLibrary.Init(()=>CardDatabase.All);var g=GameRuntime.I;g.ResetSlot(1);
  var source=JObject.Parse(File.ReadAllText("_planning/migration-1029/ui/source-hub-vectors.json"));
  foreach(var item in source["previews"]){
   SaveJson.Populate(item["base"].ToString(),g.Base);var actual=g.Base.PreviewPreparation(SaveJson.Read<PreparationPreset>(item["preset"]));var expected=item["result"];
   Check(actual.canStart==expected.Value<bool>("canStart")&&actual.capacity.used==expected["costs"].Value<int>("slotsUsed")&&actual.capacity.ordinarySlots==expected["costs"].Value<int>("ordinarySlots")&&actual.capacity.resourceSlots==expected["costs"].Value<int>("resourceSlots")&&actual.stashCards==expected["costs"].Value<int>("stashCards"),"authoritative JS preset eligibility/capacity vector "+item["preset"]?["petId"]);
   for(int i=0;i<actual.resolvedPicks.Count;i++){var got=actual.resolvedPicks[i];var wanted=expected["resolvedPicks"][i];Check(got.status==wanted.Value<string>("status")&&got.availableCount==wanted.Value<int>("availableCount")&&got.appliedCount==wanted.Value<int>("appliedCount"),"authoritative JS resolved preset pick "+i);}
  }
  g.ResetSlot(1);
  var a=CardLibrary.FindById("tt3-fireball").Clone();a.variantKey="red";
  var b=a.Clone();b.variantKey="blue";
  g.Base.stash=new List<StashStack>{new StashStack{card=a,count=4},new StashStack{card=b,count=5,variantKey="blue",stackKey="custom-blue"}};g.Base.Save();
  string red=GameRuntime.DepartureStackKey(g.Base.stash[0]),blue=GameRuntime.DepartureStackKey(g.Base.stash[1]);
  Check(red=="card:tt3-fireball:red"&&blue=="custom-blue","stable source keys use explicit stackKey then card:id:variant");
  Check(g.FindDepartureStack(red).count==4&&g.FindDepartureStack(blue).count==5,"same id and name retain separate variant stacks");
  var picks=new Dictionary<string,int>{{blue,2},{red,1}};string disk=File.ReadAllText(SaveSystem.ProfilePath),state=SaveJson.Stringify(g.State),data=SaveJson.Stringify(g.Base),rng=g.Rng.SaveState();
  var preview=g.ProjectDeparture(picks);var recommendation=g.RecommendDeparture(picks);
  Check(disk==File.ReadAllText(SaveSystem.ProfilePath)&&state==SaveJson.Stringify(g.State)&&data==SaveJson.Stringify(g.Base)&&rng==g.Rng.SaveState(),"draft, capacity and recommendation do not write base/run or consume random state");
  Check(preview.extraCount==3&&preview.cells.Where(c=>c.card.name==a.name).Sum(c=>c.count)==3,"display cells merge names while keeping exact source slices");
  Check(preview.cells.Where(c=>c.card.name==a.name).SelectMany(c=>c.sources).Distinct().Count()==2,"merged bag cells retain both variant removal identities");
  Check(preview.starterCount==g.DepartureStarterCount&&preview.cells.Sum(c=>c.fixedCount)==g.DepartureStarterCount,"fixed starter count remains pet-derived and cannot be removed by draft");
  var preset=new PreparationPreset{id="preset-1",name="Variant",characterId="wu",picks=new List<PreparationPick>{new PreparationPick{card=new PreparationCardRef{cardId=a.id,variantKey="blue"},count=2}}};
  var plan=g.Base.PreviewPreparation(preset);Check(plan.canStart&&plan.deploymentPicks[blue]==2,"existing preset preview preserves exact variant identity");
  Check(g.Base.TrySavePreparationPreset(preset,out _)&&g.Base.PreparationPresets().Count==2,"two fixed preset slots persist without duplicate preset system");
  g.NewRun(1,"wu",picks:picks);Check(g.Saves.LastWriteSucceeded&&g.State.characterId=="wu"&&g.State.myClass=="侠客","final confirmation starts selected character directly");
  Check(g.Base.stash.Single(s=>GameRuntime.DepartureStackKey(s)==blue).count==3&&g.Base.stash.Single(s=>GameRuntime.DepartureStackKey(s)==red).count==3,"final commit deducts exact variant stack amounts");
  Check(g.State.ownedCards.Count(o=>o.card.variantKey=="blue")==2&&g.State.ownedCards.Count(o=>o.card.variantKey=="red")==1,"carried card snapshots preserve warehouse variant identities");
  g.ShowTitle();Check(g.LoadRun(1)&&g.State.characterId=="wu"&&g.State.ownedCards.Count(o=>o.card.variantKey=="blue")==2&&g.Base.stash.Single(s=>s.stackKey==blue).count==3,"variant snapshots and remaining exact stack survive save/reload");
  g.ResetSlot(2);g.Base.stash=new List<StashStack>{new StashStack{card=a.Clone(),count=1}};g.Base.Save();
  disk=File.ReadAllText(SaveSystem.ProfilePath);state=SaveJson.Stringify(g.State);data=SaveJson.Stringify(g.Base);rng=g.Rng.SaveState();
  g.NewRun(2,"wu",picks:new Dictionary<string,int>{{red,2}});Check(!g.Saves.LastWriteSucceeded&&!g.State.runActive&&disk==File.ReadAllText(SaveSystem.ProfilePath)&&data==SaveJson.Stringify(g.Base)&&state==SaveJson.Stringify(g.State)&&rng==g.Rng.SaveState(),"stale stock rejects NewRun and preserves run/base/disk/random state");
  Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");
  bool ok=g.TryPersistMutation(()=>g.NewRun(2,"wu",picks:new Dictionary<string,int>{{red,1}}),out var reason);
  Check(!ok&&!g.State.runActive&&disk==File.ReadAllText(SaveSystem.ProfilePath)&&data==SaveJson.Stringify(g.Base)&&state==SaveJson.Stringify(g.State)&&rng==g.Rng.SaveState(),"write failure rolls back final departure without consuming selected stock");
  Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".simulated-failure");
  Check(g.TryPersistMutation(()=>g.NewRun(2,"wu",picks:new Dictionary<string,int>{{red,1}}),out _)&&g.State.ownedCards.Count(o=>o.card.variantKey=="red")==1,"same draft can retry successfully after persistence recovery");
  g.ResetSlot(3);g.Base.stash=new List<StashStack>{new StashStack{card=a,count=1},new StashStack{card=a.Clone(),count=2}};
  Check(g.FindDepartureStack(red)==null,"duplicate stable stack identity is rejected instead of guessing");
  var pet=BaseData.PetsCatalog.FirstOrDefault(p=>p.effect.shaToFireball);if(pet!=null)Check(g.ProjectDeparture(new Dictionary<string,int>(),pet.id).starter.id=="tt3-fireball","pet starter replacement is visible before final commit");
  File.WriteAllText(evidence+"/domain-checks.json",new JObject{["status"]="passed",["checks"]=new JArray(checks),["nativeUiValidated"]=false}.ToString());Console.WriteLine("PASS "+checks.Count+" departure domain assertions");
 }
}
