// Central native driver only. Real controls/transactions; constructed input is not OS input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Hub;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentHubRound7Checks
    {
        const BindingFlags Instance=BindingFlags.Instance|BindingFlags.NonPublic|BindingFlags.Public;
        const BindingFlags Static=BindingFlags.Static|BindingFlags.NonPublic;
        public static int Assertions {get;private set;}
        static void Check(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("Hub round7: "+message);}
        static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
        static void View(string field,object value)=>typeof(HubScreen).GetField(field,Static).SetValue(null,value);
        static T View<T>(string field)=>(T)typeof(HubScreen).GetField(field,Static).GetValue(null);
        static HubScreen Open(string tab){HubScreen.Open(tab);CurrentRunFilm.CancelActive();return (HubScreen)UiStack.Top;}
        static void Rebuild(HubScreen page)=>typeof(HubScreen).GetMethod("Rebuild",BindingFlags.Instance|BindingFlags.NonPublic|BindingFlags.DeclaredOnly).Invoke(page,null);
        static Button Button(Panel page,string name)=>page.GetComponentsInChildren<Button>().Single(button=>button.name==name);
        static Transform Named(Panel page,string name)=>page.GetComponentsInChildren<Transform>().Single(node=>node.name==name);
        static bool Text(Panel page,string value)=>page.GetComponentsInChildren<Text>().Any(text=>text.text.Contains(value));
        static bool Detail(Panel page,string value)=>Named(page,"av3-medal-detail").GetComponentsInChildren<Text>().Any(text=>text.text==value);
        static void Submit(Button button)
        {Check(button!=null&&button.isActiveAndEnabled&&button.interactable,"available real production Submit target");ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler);}
        static long SoundSequence()=>(long)typeof(AudioService).GetField("_sequence",Instance).GetValue(AudioService.I);
        static void ResetView()
        {View("_achievementQuery","");View("_achievementFilter","");View("_achievement","");View("_warehouseQuery","");View("_warehouseType","");View("_warehouseRarity","");View("_warehouseCharacter","");View("_warehouseView","cards");}
        static IEnumerator StatusAndOwners()
        {
            var game=GameRuntime.I;Clear();game.ResetSlot(5);game.State.entrySupply=null;ResetView();
            var data=game.Base;data.stats=new BaseStats{extracts=1,bestRunCoins=30};data.collection.Clear();data.runes.Clear();data.achClaimed.Clear();data.achClaimed["kill10"]=true;
            data.bagUp=data.safeUp=0;foreach(var progress in data.characters.Values)progress.lv=1;data.pets.Clear();data.pets["dog"]=new PetProgress();data.Save();
            Check(MetaProgress.Achievements.Count==26,"current source has 26 achievement targets");
            string unchanged=SaveJson.Stringify(data);game.Meta.AchievementStatuses();Check(SaveJson.Stringify(data)==unchanged,"achievement projection is read-only");
            var predicates=MetaProgress.Achievements.ToDictionary(a=>a.id,a=>a.done);int reads=0;
            try
            {
                foreach(var a in MetaProgress.Achievements){var predicate=a.done;a.done=(stats,owner)=>{reads++;return predicate(stats,owner);};}
                var page=Open("ach");View("_archiveView","achievements");reads=0;Rebuild(page);
                Check(reads==26,"one predicate evaluation per target supplies status, counts, rows and navigation");
                Check(Button(page,"achievement-filter-all").GetComponentInChildren<Text>().text=="全部 26"
                    &&Button(page,"achievement-filter-ready").GetComponentInChildren<Text>().text=="可领取 2"
                    &&Button(page,"achievement-filter-claimed").GetComponentInChildren<Text>().text=="已领取 1"
                    &&Button(page,"achievement-filter-locked").GetComponentInChildren<Text>().text=="未达成 23","exclusive source status counts, including claimed with a now-false predicate");
                var rows=Named(page,"av3-medals").GetComponentsInChildren<Button>().Where(b=>b.name.StartsWith("achievement-item-",StringComparison.Ordinal)).ToArray();
                Check(rows[0].name=="achievement-item-firstExtract"&&rows[1].name=="achievement-item-rich30"&&rows[25].name=="achievement-item-kill10","stable source claimable/progress/claimed ordering");
                var root=Named(page,"hubMain base-frame-v7 base-subpage");var list=Named(page,"av3-medals");var search=page.GetComponentsInChildren<InputField>().Single(field=>field.name=="搜索成就或目标");
                Submit(Button(page,"achievement-item-runeFan"));Check(Detail(page,"0 / 5"),"runeFan exposes its existing progress");
                Submit(Button(page,"achievement-item-beautifulVase"));Check(Detail(page,"0 / 1"),"rainbow-rune target exposes its existing progress");
                Submit(Button(page,"achievement-item-savior"));Check(Detail(page,"0 / 2"),"existing nest counter is displayed without adding nest gameplay");
                EventSystem.current.SetSelectedGameObject(search.gameObject);search.ActivateInputField();search.text=" 花瓶 ";
                Check(ReferenceEquals(root,Named(page,"hubMain base-frame-v7 base-subpage"))&&ReferenceEquals(list,Named(page,"av3-medals"))
                    &&ReferenceEquals(search,page.GetComponentsInChildren<InputField>().Single())&&EventSystem.current.currentSelectedGameObject==search.gameObject,"local search retains mounted root/list/input and focus");
                Check(rows.Count(b=>b.gameObject.activeInHierarchy)==1&&Button(page,"achievement-item-beautifulVase")!=null,"trimmed search filters existing targets");
                search.text="";Submit(Button(page,"achievement-filter-locked"));Check(rows.Count(b=>b.gameObject.activeInHierarchy)==23,"filter updates mounted rows without re-evaluating predicates");
                Submit(Button(page,"achievement-filter-all"));Submit(Button(page,"achievement-item-firstExtract"));var oldClaim=Button(page,"领取奖励").onClick;
                Submit(Button(page,"achievement-item-rich30"));int wood=data.wood,rations=data.rations;oldClaim.Invoke();
                Check(!game.Meta.IsClaimed("firstExtract")&&data.wood==wood&&data.rations==rations,"old detail claim becomes inert after local selection");
                Check(reads==26&&rows.All(row=>row!=null)&&ReferenceEquals(list,Named(page,"av3-medals")),"selection/filter/search reuse the single data projection and mounted list");
                var staleInput=search.onValueChanged;Rebuild(page);int version=View<int>("_renderSequence");staleInput.Invoke("stale-render");
                Check(View<string>("_achievementQuery")==""&&View<int>("_renderSequence")==version,"old input event cannot rebuild or change the new render");
            }
            finally{foreach(var a in MetaProgress.Achievements)a.done=predicates[a.id];}
            var changedPage=(HubScreen)UiStack.Top;var changedRoot=Named(changedPage,"hubMain base-frame-v7 base-subpage");
            data.runes.Add(new JObject{{"kind","rainbow"},{"attrs",new JArray("fire","ice")}});data.Save();
            changedPage.GetComponentsInChildren<InputField>().Single().text="花瓶";
            Check(!ReferenceEquals(changedRoot,Named(changedPage,"hubMain base-frame-v7 base-subpage"))
                &&Detail(changedPage,"1 / 1"),"saved Base changes invalidate the presentation snapshot before local filtering");
            var ordinary=CardLibrary.FindById("tt3-fireball");data.stash.Add(new StashStack{card=ordinary.Clone(),count=1});data.Save();var oldPage=Open("stash");
            var oldInput=oldPage.GetComponentsInChildren<InputField>().Single().onValueChanged;var oldFilter=oldPage.GetComponentsInChildren<Dropdown>().First().onValueChanged;
            UiStack.Close(oldPage);var current=Open("stash");int currentVersion=View<int>("_renderSequence");oldInput.Invoke("stale-closed");oldFilter.Invoke(0);
            Check(View<string>("_warehouseQuery")==""&&View<int>("_renderSequence")==currentVersion,"same-frame closed input/dropdown callbacks preserve current Hub ownership");
            var dropdown=current.GetComponentsInChildren<Dropdown>().First();dropdown.onValueChanged.Invoke(int.MaxValue);Check(View<int>("_renderSequence")==currentVersion,"invalid current dropdown index is rejected");
            Submit(Button(current,"hub-tab deploy"));Check(View<string>("_tab")=="deploy","new Hub buttons still operate after stale event replay");
            Clear();yield return null;
        }
        static IEnumerator Claims()
        {
            var game=GameRuntime.I;game.ResetSlot(5);game.State.entrySupply=null;ResetView();var data=game.Base;
            data.stats.extracts=1;data.wood=100;data.rations=100;data.coins=100;data.Save();View("_archiveView","achievements");View("_achievement","firstExtract");var page=Open("ach");
            var input=page.GetComponentsInChildren<InputField>().Single();EventSystem.current.SetSelectedGameObject(input.gameObject);input.ActivateInputField();
            var root=Named(page,"hubMain base-frame-v7 base-subpage");var claim=Button(page,"领取奖励");string disk=File.ReadAllText(SaveSystem.ProfilePath),before=SaveJson.Stringify(data),random=game.Rng.SaveState();long sequence=SoundSequence();
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))Submit(claim);
            Check(!game.Meta.IsClaimed("firstExtract")&&SaveJson.Stringify(data)==before&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&game.Rng.SaveState()==random,"failed real claim preserves Base/profile/RNG and eligibility");
            Check(ReferenceEquals(root,Named(page,"hubMain base-frame-v7 base-subpage"))&&EventSystem.current.currentSelectedGameObject==input.gameObject&&Text(page,"尚未领取")&&SoundSequence()==sequence,"failed receipt preserves mounted input/focus and has no success cue");
            var failedClose=Button(page,"reward-receipt-close").onClick;yield return new WaitForSecondsRealtime(.12f);int wood=data.wood;Submit(claim);
            Check(game.Meta.IsClaimed("firstExtract")&&data.wood==wood+2&&Text(page,"木材 ×2  ·  基地资源")&&SoundSequence()==sequence+1,"persisted firstExtract reports its actual two wood and one ding");
            failedClose.Invoke();Check(Text(page,"已领取 · 初出茅庐"),"old failed-receipt close cannot dismiss a later success receipt");
            Submit(Button(page,"reward-receipt-close"));Check(EventSystem.current.currentSelectedGameObject==Button(page,"achievement-item-firstExtract").gameObject,"receipt close returns focus to the mounted selected target");

            data.stats.kills=10;data.achClaimed.Remove("kill10");data.backs.Remove("wolf");data.Save();View("_achievement","kill10");page=Open("ach");
            var handlers=(IDictionary)typeof(EventBus).GetField("_handlers",Instance).GetValue(game.Bus);bool hadLog=handlers.Contains(typeof(LogRequested));var oldLog=handlers[typeof(LogRequested)];
            try
            {
                game.Bus.On<LogRequested>(_=>throw new InvalidOperationException("round7 post-commit log fixture"));wood=data.wood;Submit(Button(page,"领取奖励"));
                Check(game.Meta.IsClaimed("kill10")&&data.wood==wood+2&&data.IsBackUnlocked("wolf")&&Text(page,"卡背 · "+CardLibrary.CardBacks.Single(back=>back.id=="wolf").name),"post-commit log exception still produces the actual committed card-back receipt");
            }
            finally{if(hadLog)handlers[typeof(LogRequested)]=oldLog;else handlers.Remove(typeof(LogRequested));}
            string backSelected=data.BackSel;Submit(Button(page,"查看卡背"));Check(View<string>("_archiveView")=="backs"&&View<string>("_backId")=="wolf"&&data.BackSel==backSelected,"receipt locates its real back without applying it");

            var collectible=game.Meta.CollectionPool();Check(collectible.Count>=45,"current authoritative catalog can reach the real m45 target");
            data.collection.Clear();foreach(var card in collectible)data.collection[card.id]=new CollectionEntry{name=card.name,rarity=card.rarity};
            foreach(var m in HubCatalog.Current.milestones)data.collClaimed[m.id]=m.id!="m45";
            foreach(var a in MetaProgress.Achievements)data.achClaimed[a.id]=true;
            data.stash.Clear();data.Save();View("_archiveView","classes");View("_milestoneRecord","m45");page=Open("ach");claim=Button(page,"领取奖励");
            disk=File.ReadAllText(SaveSystem.ProfilePath);before=SaveJson.Stringify(data);random=game.Rng.SaveState();sequence=SoundSequence();
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))Submit(claim);
            Check(!game.Meta.MilestoneClaimed("m45")&&SaveJson.Stringify(data)==before&&game.Rng.SaveState()==random&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&SoundSequence()==sequence,"failed m45 restores both random draws, inventory and claimed state without success sound");
            yield return new WaitForSecondsRealtime(.12f);var old=claim.onClick;Submit(claim);
            Check(game.Meta.MilestoneClaimed("m45")&&data.stash.Sum(stack=>stack.count)==2&&data.stash.Select(stack=>stack.card.id).Distinct().Count()==2&&data.stash.All(stack=>stack.card.rarity=="传说"),"real m45 grants exactly two different authoritative legendary cards");
            Check(data.stash.All(stack=>Text(page,stack.card.name+" ×"+stack.count+"  ·  后勤 · 卡牌仓库")),"m45 receipt shows both actual rolled names and quantities");
            random=game.Rng.SaveState();before=SaveJson.Stringify(data);old.Invoke();Check(before==SaveJson.Stringify(data)&&game.Rng.SaveState()==random,"old m45 callback cannot redraw or re-award random rewards");
            Submit(Button(page,"查看仓库"));Check(View<string>("_tab")=="stash"&&data.stash.All(stack=>Text(page,stack.card.name)),"real receipt navigation opens the awarded warehouse cards");
            data.collClaimed["m45"]=false;data.stash.Clear();data.stash.Add(new StashStack{card=CardLibrary.FindById("tt3-fireball").Clone(),count=data.StashCap-1});data.Save();
            View("_archiveView","classes");page=Open("ach");before=SaveJson.Stringify(data);random=game.Rng.SaveState();Submit(Button(page,"领取奖励"));
            Check(!game.Meta.MilestoneClaimed("m45")&&before==SaveJson.Stringify(data)&&random==game.Rng.SaveState()&&Text(page,"尚未领取"),"one remaining warehouse place defers the complete two-card reward");
            Submit(Button(page,"扩建仓库"));Check(View<string>("_tab")=="upgrade"&&View<string>("_facility")=="stash","capacity failure uses the existing warehouse expansion destination");
            data.stash.Clear();data.collClaimed["m30"]=false;data.collClaimed["m45"]=true;data.Save();View("_archiveView","classes");View("_milestoneRecord","m30");page=Open("ach");int keys=data.keys;Submit(Button(page,"领取奖励"));
            Check(data.keys==keys+10&&Text(page,"钥匙 ×10  ·  基地资源"),"existing m30 key grant has its actual resource receipt");
            data.collClaimed["mAll"]=false;data.Save();View("_milestoneRecord","mAll");page=Open("ach");Submit(Button(page,"领取奖励"));
            Check(data.stash.Sum(stack=>stack.count)==1&&data.stash[0].card.id==PetCatalog.Current.eggId&&Text(page,data.stash[0].card.name+" ×1"),"full current collection produces the actual egg receipt");
            Clear();yield return null;
        }
        static IEnumerator Partner()
        {
            var game=GameRuntime.I;game.ResetSlot(5);game.State.entrySupply=null;ResetView();View("_personGroup","pets");View("_hatch",false);View("_pet","dog");
            Check(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",false,out _),"motion fixture uses the formal preference entry");var page=Open("classes");
            var component=page.GetComponentsInChildren<MonoBehaviour>().Single(value=>value.GetType().Name=="HubPartnerPlay");var type=component.GetType();
            var tick=(Action<float>)Delegate.CreateDelegate(typeof(Action<float>),component,type.GetMethod("Advance",Instance));
            var art=(RectTransform)type.GetField("Art",Instance).GetValue(component);var reply=(Text)type.GetField("Reply",Instance).GetValue(component);var button=component.GetComponent<Button>();
            Check(!component.enabled,"idle companion component has no Update callback before interaction");
            float End()=>(float)type.GetField("_until",Instance).GetValue(component);
            var origin=art.anchoredPosition;Submit(button);tick(End()-1.2f);Check(reply.text=="歪头看着你。"&&art.localEulerAngles.z!=0,"first real companion response tilts its portrait");
            tick(End()-.77f);Check(art.anchoredPosition==origin&&art.localScale==Vector3.one&&art.localEulerAngles==Vector3.zero&&reply.text!="","620ms visual finishes while the 1400ms reply remains");
            art.hasChanged=false;tick(End()-.2f);Check(!art.hasChanged,"completed animation tail does not rewrite transforms");
            Submit(button);float sample=End()-1.2f;tick(sample);Check(reply.text=="开心地晃了晃。"&&art.anchoredPosition!=origin,"second real response hops and replaces the old reply");
            for(int i=0;i<32;i++)tick(sample);long allocated=GC.GetAllocatedBytesForCurrentThread();for(int i=0;i<128;i++)tick(sample);allocated=GC.GetAllocatedBytesForCurrentThread()-allocated;
            Check(allocated==0,"warmed actual companion advance has no managed curve-array allocation; not a whole-frame benchmark");
            tick(End()-.83f);Check(art.anchoredPosition==origin&&art.localScale==Vector3.one&&reply.text!="","560ms hop ends independently of its reply timeout");
            Submit(button);tick(End()-1.2f);Check(reply.text=="又凑近了一点。"&&art.anchoredPosition.x>origin.x,"third real response nuzzles");tick(End()+.01f);Check(reply.text==""&&art.anchoredPosition==origin,"1400ms timeout clears the reply and remaining animation");
            yield return null;Check(!component.enabled,"expired companion reaction stops its Update callback");
            Check(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out _),"reduced-motion preference persists");Submit(button);art.hasChanged=false;tick(End()-1.2f);
            Check(!art.hasChanged&&reply.text=="歪头看着你。","reduced motion retains text without animation writes");
            type.GetMethod("OnApplicationFocus",Instance).Invoke(component,new object[]{false});Check(reply.text=="","focus loss clears the current reaction");
            Clear();yield return null;
        }
        public static IEnumerator Run()
        {
            Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
            bool reduced=CurrentUiPreferences.ReducedMotion,muted=AudioService.I.Muted,sfx=AudioService.I.SfxMuted;
            try
            {
                AudioService.I.Mute(false);AudioService.I.SetSfxMuted(false);
                yield return StatusAndOwners();yield return Claims();yield return Partner();
            }
            finally{Clear();CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",reduced,out _);AudioService.I.Mute(muted);AudioService.I.SetSfxMuted(sfx);}
        }
    }
}
