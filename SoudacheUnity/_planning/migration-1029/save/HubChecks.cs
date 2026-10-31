using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
static class HubChecks
{
 public static void Run(GameRuntime g,Action<bool,string> check)
 {
  CardLibrary.Init(()=>CardDatabase.All);g.ShowTitle();g.EnterSlot(4);
  var vectors=JObject.Parse(File.ReadAllText("_planning/migration-1029/ui/hub-reference-vectors.json"));var catalog=HubCatalog.Current;var actualGoods=catalog.goods;
  catalog.goods=new List<HubShopGood>{new HubShopGood{material="wood",price=4},new HubShopGood{id="tt7-throwblade",price=6}};
  var filler=CardDatabase.All.First(c=>c.type=="资源"&&c.rarity=="古朴");int purchases=0,conversions=0;
  foreach(var vector in vectors["purchases"]){
   var b=g.Base;b.coins=(int)vector["before"]["coins"];b.wood=0;b.rations=0;b.keys=0;b.stash=new List<StashStack>();int room=(int)vector["before"]["room"];if(room==0)b.stash.Add(new StashStack{card=filler,count=b.StashCap});else if(room<b.StashCap)b.stash.Add(new StashStack{card=filler,count=b.StashCap-room});b.Save();int before=b.StashUsed;
   string key=(string)vector["input"]["material"]??(string)vector["input"]["card"]?["id"];bool success=b.TryPurchase(key,out var reason);bool expected=(bool)vector["result"]["ok"];
   check(success==expected,(string)vector["name"]+" source outcome "+reason);check(b.coins==(int)vector["after"]["coins"]&&b.wood==(int)vector["after"]["wood"]&&b.rations==(int)vector["after"]["rations"],"purchase balances");check(b.StashUsed==before+(success&&vector["input"]["card"]!=null?1:0),"purchase inventory atomically changed");purchases++;
  }
  catalog.goods=actualGoods;
  foreach(var vector in vectors["conversions"]){
   var input=vector["input"];var expected=vector["expected"];var card=CardLibrary.FindById((string)input["card"]["id"]);var b=g.Base;b.characters=SaveJson.Read<Dictionary<string,ClassProgress>>(input["baseSnapshot"]["characters"]);b.classes.Clear();b.collection=new Dictionary<string,CollectionEntry>();b.collectionProtection.Clear();
   foreach(var property in ((JObject)input["baseSnapshot"]["collection"]).Properties()){b.collection[property.Name]=new CollectionEntry{name=card.name,rarity=card.rarity};b.collectionProtection[property.Name]=(bool?)property.Value["protected"]!=false;}
   int available=(int)input["availableCount"];b.stash=new List<StashStack>{new StashStack{card=card,count=available}};b.Save();bool ok=g.Meta.TryConvertCollection(card.id,(int)input["count"],out var reason);bool wanted=(bool)expected["canConvert"];
   check(ok==wanted,(string)vector["name"]+" conversion source outcome "+reason);check(b.stash.Sum(s=>s.count)==available-(ok?(int)input["count"]:0),"conversion exact consumption");string character=(string)expected["characterId"];var progress=b.characters[character];var expectedProgress=ok?expected["after"]:expected["before"];check(progress.lv==(int)expectedProgress["lv"]&&progress.xp==(int)expectedProgress["xp"],"conversion exact source XP boundary");if(ok)check(b.collection.ContainsKey(card.id),"conversion keeps permanent registration");conversions++;
  }
  var pool=g.Meta.CollectionPool();check(pool.Count>=45,"collection reward test catalog has45");
  var data=g.Base;data.collection=pool.Take(45).ToDictionary(c=>c.id,c=>new CollectionEntry{name=c.name,rarity=c.rarity});data.collectionProtection.Clear();data.collClaimed.Clear();data.wood=10;data.keys=2;data.stash=new List<StashStack>{new StashStack{card=filler,count=data.StashCap}};data.Save();
  check(g.Meta.TryClaimCollection("m5",out _)&&data.wood==13,"material milestone full warehouse allowed");check(!g.Meta.TryClaimCollection("m5",out _)&&data.wood==13,"material reward no duplicate");
  check(!g.Meta.TryClaimCollection("m45",out _)&&!g.Meta.MilestoneClaimed("m45")&&data.StashUsed==data.StashCap,"full warehouse preserves card reward eligibility");data.stash[0].count-=2;data.Save();int beforeCards=data.StashUsed;
  check(g.Meta.TryClaimCollection("m45",out _)&&g.Meta.MilestoneClaimed("m45")&&data.StashUsed==beforeCards+2,"legend reward succeeds after room");var legends=data.stash.Where(s=>s.card.rarity=="传说").Select(s=>s.card).ToList();check(legends.Count==2&&legends.Select(c=>c.id).Distinct().Count()==2&&legends.All(CardLibrary.IsRandomObtainable),"legend reward eligible and distinct");check(!g.Meta.TryClaimCollection("m45",out _)&&data.StashUsed==beforeCards+2,"legend reward no duplicate");
  check(g.Meta.TryClaimCollection("m30",out _)&&data.keys==12&&data.KeyCount>=12,"material keys reward counted");
  data.collection=pool.ToDictionary(c=>c.id,c=>new CollectionEntry{name=c.name,rarity=c.rarity});data.stash[0].count--;data.Save();check(g.Meta.TryClaimCollection("mAll",out _)&&data.stash.Any(s=>s.card.id=="pet-egg"),"all collection egg reward");check(!g.Meta.TryClaimCollection("mAll",out _),"egg reward no duplicate");
  var skin=catalog.skins.First();g.ShowTitle();g.EnterSlot(1);var old=g.Base;check(old.TrySelectSkin(skin.characterId,skin.id,out _),"skin selection persisted");g.ShowTitle();g.EnterSlot(2);check(g.Base.SelectedSkin(skin.characterId)=="default","skin isolated by slot");var reloaded=new SaveSystem();check(BaseData.Use(reloaded,1).SelectedSkin(skin.characterId)==skin.id,"skin restored with new storage instance");
  check(!old.TrySelectSkin(skin.characterId,"default",out _),"stale base callback cannot edit old slot");
  var noteId=catalog.baseNotes.Keys.First(id=>CardLibrary.FindById(id)!=null);var noteCard=CardLibrary.FindById(noteId);string desc=noteCard.desc,baseNote=catalog.baseNotes[noteId];check(g.Base.TrySavePhotoNote(noteId,"  手写备注  ",out _)&&g.Base.PhotoNote(noteId)=="手写备注"&&noteCard.desc==desc,"photo note trims without altering card text");check(g.Base.TrySavePhotoNote(noteId,"",out _)&&g.Base.PhotoNote(noteId)==baseNote&&noteCard.desc==desc,"clear note reveals distributed original");
  var snapshot=File.ReadAllText(SaveSystem.ProfilePath);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");check(!g.Base.TrySavePhotoNote(noteId,"失败备注",out _)&&g.Base.PhotoNote(noteId)==baseNote&&File.ReadAllText(SaveSystem.ProfilePath)==snapshot,"photo write failure preserves original");Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".photo-fault");
  g.NewRun(5,CharacterTable.All[0].id);g.State.entrySupply=null;g.SaveCurrent();
  File.WriteAllText(Path.Combine(SaveSystem.Dir,"hub-result.json"),JsonConvert.SerializeObject(new{passed=true,purchaseSourceVectors=purchases,conversionSourceVectors=conversions,scope="production base/meta partials; actual archive and platform stubs from shared save harness"},Formatting.Indented));
 }
}
