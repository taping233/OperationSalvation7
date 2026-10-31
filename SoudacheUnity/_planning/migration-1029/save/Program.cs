using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.Core.Battle;
namespace UnityEngine {
 public static class Application { public static string persistentDataPath=>Path.GetTempPath(); }
 public static class Debug { public static void LogException(Exception e){Console.WriteLine("listener-error: "+e.Message);} }
 public sealed class TextAsset {public string text;}
 public static class Resources {public static T Load<T>(string name)where T:class=>new TextAsset{text=File.ReadAllText(Path.Combine(Environment.CurrentDirectory,"Assets/Resources",name+".json"))} as T;}
}
namespace Sdt.Run { public sealed class AudioService { public static AudioService I {get;}=new AudioService();public void PlaySfx(string key){}public void PlayBgm(string key){} } }
sealed class RuleHost : BattleHost {
 public int Hp{get;set;}=30;public int MaxHp=>30;public int Atk=>4;public int SpellPower=>0;public string MyClass=>"法师";public string CharacterId=>"baita";public IReadOnlyList<OwnedCard> OwnedCards{get;set;}
 public void Log(string text,string kind=null){}public void Heal(int n){Hp=Math.Min(MaxHp,Hp+n);}public void OnBattleEnd(BattleResult result){}
}
class Program {
 static int assertions;
 static void Assert(bool ok,string message){assertions++;if(!ok)throw new Exception(message);}
 static void Main(){
  string dir=Path.GetFullPath("_planning/migration-1029/save/data-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss-fff"));Directory.CreateDirectory(dir);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",dir);
  var g=GameRuntime.I;string ch=CharacterTable.All[0].id;int events=0;g.Bus.On<RunEnded>(e=>events++);
  CardDef card=CardDatabase.All.First(c=>c.rarity=="古朴"&&c.type=="资源");
  void Start(int slot){g.NewRun(slot,ch);g.State.entrySupply=null;g.State.ownedCards.Clear();g.State.ownedCards.Add(new OwnedCard{uid="safe",card=card,safe=true});g.State.ownedCards.Add(new OwnedCard{uid="normal",card=card});g.State.inventory.Clear();g.State.inventory.Add(new InvSlot{name="木材",count=3,value=5});g.SaveCurrent();Assert(g.Saves.LastWriteSucceeded,"开局保存");}
  int fault=0;void Fail(Action action){string before=File.ReadAllText(SaveSystem.ProfilePath);Directory.CreateDirectory(SaveSystem.ProfilePath+".writing");action();Assert(File.ReadAllText(SaveSystem.ProfilePath)==before,"失败保留旧文件");Directory.Move(SaveSystem.ProfilePath+".writing",SaveSystem.ProfilePath+".fault-"+(fault++));}
  Start(1);int wood=g.Base.wood,extracts=g.Base.stats.extracts;
  Fail(()=>Assert(g.DoExtract()==null,"撤离失败返回空"));Assert(g.State.runActive&&g.State.Phase=="idle"&&g.Base.wood==wood&&g.Base.stats.extracts==extracts&&events==0,"撤离失败完整回滚");
  Assert(g.DoExtract()!=null,"撤离成功");Assert(g.Base.wood==wood+3&&g.Base.stats.extracts==extracts+1,"撤离只结算一次");g.DoExtract();Assert(g.Base.wood==wood+3&&g.Base.stats.extracts==extracts+1,"重复撤离幂等");
  int stash=g.Base.StashUsed;Fail(()=>Assert(g.ExtractStashAll()==null,"入库失败返回空"));Assert(g.Base.StashUsed==stash,"入库失败不重复");
  Assert(g.ExtractStashAll()!=null&&g.Base.StashUsed==stash+2,"两张入库");g.ExtractStashAll();Assert(g.Base.StashUsed==stash+2,"重复全部入库幂等");
  Fail(()=>Assert(g.FinishExtract()==null,"完成撤离失败返回空"));Assert(g.Saves.HasRun(1),"失败仍可续整理");
  var reloaded=new SaveSystem();Assert(reloaded.ReadSlot(1)!=null&&reloaded.GetSettlement(1).status=="sorting","新存储实例恢复待整理");g.ShowTitle();Assert(g.LoadRun(1)&&g.State.Phase=="settlement","运行时恢复待整理");
  Assert(g.FinishExtract()?.Done==true&&!g.Saves.HasRun(1)&&events==1,"完成撤离原子清对局");g.FinishExtract();Assert(events==1,"重复完成不重发事件");
  Start(2);int deaths=g.Base.stats.deaths;stash=g.Base.StashUsed;g.State.hp=0;
  Fail(()=>Assert(g.DoDeath()==null,"死亡保存失败返回空"));Assert(g.State.runActive&&g.Base.stats.deaths==deaths&&g.Base.StashUsed==stash,"死亡失败回滚");
  Assert(g.DoDeath()!=null&&g.Base.stats.deaths==deaths+1&&g.Base.StashUsed==stash+1,"死亡抢运一次");g.DoDeath();Assert(g.Base.stats.deaths==deaths+1&&g.Base.StashUsed==stash+1,"重复死亡幂等");
  Start(3);stash=g.Base.StashUsed;g.State.ownedCards[0].brought=1;
  Fail(()=>Assert(g.AbandonRun()==null,"放弃保存失败返回空"));Assert(g.State.runActive&&g.Base.StashUsed==stash,"放弃失败回滚");
  Assert(g.AbandonRun()!=null&&g.Base.StashUsed==stash,"放弃不抢运带入卡");g.AbandonRun();Assert(g.Base.StashUsed==stash,"重复放弃幂等");
  Start(4);var other=CardDatabase.All.First(c=>c.rarity=="古朴"&&c.type=="资源"&&c.id!=card.id);g.State.ownedCards[1].card=other;g.SaveCurrent();stash=g.Base.StashUsed;Assert(g.DoExtract()!=null,"第四档撤离");
  Fail(()=>Assert(g.ExtractStashOne(0)==null,"单堆入库失败返回空"));Assert(g.Base.StashUsed==stash,"单堆失败回滚");Assert(g.ExtractStashOne(0)!=null&&g.Base.StashUsed==stash+1,"单堆成功入库");
  reloaded=new SaveSystem();Assert(reloaded.GetSettlement(4).left.Sum(x=>x.count)==1,"重启保留剩余一张");g.ExtractStashAll();Assert(g.Base.StashUsed==stash+2,"单堆后剩余入库");g.FinishExtract();
  Start(5);stash=g.Base.StashUsed;Assert(g.AbandonRun()!=null&&g.Base.StashUsed==stash+1,"放弃抢运非带入安全卡");g.AbandonRun();Assert(g.Base.StashUsed==stash+1,"放弃抢运幂等");
  Start(5);int owned=g.State.ownedCards.Count,coins=g.State.coins,kills=g.Base.stats.kills;int granted=0;g.Bus.On<CardGranted>(e=>granted++);
  Fail(()=>Assert(!g.TryPersistMutation(()=>{g.GrantCard(other);g.State.coins+=10;g.Meta.Track("kill",new MetaProgress.TrackData{cls=g.State.myClass});},out var why)&&!string.IsNullOrEmpty(why),"公共复合变更失败返回原因"));Assert(g.State.ownedCards.Count==owned&&g.State.coins==coins&&g.Base.stats.kills==kills&&granted==0,"复合奖励回滚且不发成功事件");
  Assert(g.TryPersistMutation(()=>{g.GrantCard(other);g.State.coins+=10;g.Meta.Track("kill",new MetaProgress.TrackData{cls=g.State.myClass});},out _)&&granted==1&&g.Base.stats.kills==kills+1,"复合奖励单次提交");
  g.State.coins+=7;Fail(()=>g.SaveCurrent());Assert(g.State.coins==coins+17,"普通保存失败保留内存待重试");g.SaveCurrent();Assert(new SaveSystem().ReadSlot(5).coins==coins+17,"普通保存重试成功");
  g.Base.stash.Add(new StashStack{card=card,count=2});g.Base.Save();int available=g.Base.stash.Where(x=>x.card.id==card.id).Sum(x=>x.count);int started=0;g.Bus.On<RunStarted>(e=>started++);int oldSeed=g.State.seed.Value;
  Fail(()=>g.NewRun(5,ch,"standard",new Dictionary<string,int>{{card.name,1}}));Assert(g.State.seed==oldSeed&&g.Base.stash.Where(x=>x.card.id==card.id).Sum(x=>x.count)==available&&started==0,"新局失败不扣携带且不发开局事件");
  g.NewRun(5,ch,"standard",new Dictionary<string,int>{{card.name,1}});Assert(g.Base.stash.Where(x=>x.card.id==card.id).Sum(x=>x.count)==available-1&&g.State.ownedCards.Any(o=>o.card.id==card.id&&o.brought==1)&&started==1,"新局扣仓和携带同时提交");
  HubChecks.Run(g,Assert);
  var ruleCard=new CardDef{id="save-rule-fixture",name="结构化护甲验证",cost=0,type="法术",rarity="古朴",desc="验证存档后规则执行",rules=RuleValue.Obj("triggers",RuleValue.Obj("onPlay",RuleValue.Arr(RuleValue.Obj("op","armor","amount",7))))};
  int Armor(CardDef c){var host=new RuleHost{OwnedCards=new[]{new OwnedCard{uid="rule",card=c}}};var battle=new BattleSession();battle.Start(new BattleStartContext{host=host,enemies=new[]{new EnemyInput{id="test",name="测试目标",hp=99,atk=0}},rng=new Rng(123)});Assert(battle.PlayCard("rule",0,false).Ok,"结构化牌可提交");return battle.Snapshot.pdef.Armor;}
  Assert(Armor(ruleCard)==7,"原规则护甲7");g.State.ownedCards.Add(new OwnedCard{uid="rule",card=ruleCard});g.SaveCurrent();var restored=new SaveSystem().ReadSlot(5).ownedCards.First(o=>o.uid=="rule").card;
  Assert(restored.rules.Get("triggers") is RuleValue&&restored.rules.Get("triggers").Operations("onPlay").First().Number("amount")==7,"读档嵌套规则保持RuleValue");Assert(Armor(restored)==7,"读档实际牌效护甲7");
  string beforeReplace=File.ReadAllText(SaveSystem.ProfilePath);int beforeCoin=g.State.coins;
  using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.None))Assert(!g.TryPersistMutation(()=>g.State.coins+=99,out _),"原子替换受锁失败");
  Assert(File.ReadAllText(SaveSystem.ProfilePath)==beforeReplace&&g.State.coins==beforeCoin,"临时文件完成后替换失败仍保留原档与内存");
  Assert(File.Exists(SaveSystem.ProfilePath+".previous"),"保留上一份成功快照");
  string valid=File.ReadAllText(SaveSystem.ProfilePath);void RejectProfile(Action<JObject> mutate){var document=JObject.Parse(valid);mutate(document);string invalid=document.ToString();File.WriteAllText(SaveSystem.ProfilePath,invalid);var check=new SaveSystem();Assert(check.ReadSlot(5)==null&&check.HasReadError,"损坏库存结构拒绝读取");Assert(!check.WriteSlot(5,new RunSaveData{slot=5})&&File.ReadAllText(SaveSystem.ProfilePath)==invalid,"损坏库存原文保留");File.WriteAllText(SaveSystem.ProfilePath,valid);}
  RejectProfile(d=>d["runs"]["5"]["ownedCards"][0]=JValue.CreateNull());RejectProfile(d=>d["runs"]["5"]["ownedCards"][0]["pouchOf"]="bad-container");RejectProfile(d=>d["runs"]["5"]["inventory"]=new JArray(new JObject{{"name","木材"},{"count",-1}}));
  File.WriteAllText(SaveSystem.ProfilePath,"{broken");var corrupt=new SaveSystem();Assert(corrupt.ReadSlot(1)==null&&corrupt.HasReadError&&!string.IsNullOrEmpty(corrupt.LastError),"坏档可见错误");Assert(!corrupt.WriteSlot(1,new RunSaveData{slot=1})&&File.ReadAllText(SaveSystem.ProfilePath)=="{broken","坏档禁止覆盖");
  File.WriteAllText(Path.Combine(dir,"profile-valid-before-corruption.json"),valid);
  var result=new{passed=true,assertions,realWriteFailures=fault+1,scope="production SaveSystem/BaseData/MetaProgress/GameRuntime; audio/platform adapters stubbed",directory=dir};File.WriteAllText(Path.Combine(dir,"result.json"),JsonConvert.SerializeObject(result,Formatting.Indented));Console.WriteLine(JsonConvert.SerializeObject(result));
 }
}



