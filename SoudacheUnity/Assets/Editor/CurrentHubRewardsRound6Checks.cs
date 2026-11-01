// Central native driver only: real Hub controls, isolated profile, no OS input or FPS claim.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
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
    public static class CurrentHubRewardsRound6Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("Hub round6: "+message);}
        static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
        static void View(string field,object value)=>typeof(HubScreen).GetField(field,BindingFlags.Static|BindingFlags.NonPublic).SetValue(null,value);
        static HubScreen Open(string tab){HubScreen.Open(tab);CurrentRunFilm.CancelActive();return (HubScreen)UiStack.Top;}
        static Button Button(Panel page,string name)=>page.GetComponentsInChildren<Button>().Single(button=>button.name==name);
        static bool Text(Panel page,string value)=>page.GetComponentsInChildren<Text>().Any(text=>text.text==value);
        static void Submit(Button button)
        {Check(button!=null&&button.isActiveAndEnabled&&button.interactable,"available production Submit target");ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler);}
        static void Badge(HubScreen page,int count)
        {var texts=Button(page,"hub-tab ach").GetComponentsInChildren<Text>();Check(count==0?texts.Length==1:texts.Count(text=>text.text==count.ToString())==1,"current navigation reward badge "+count);}
        static long Sequence()=> (long)typeof(AudioService).GetField("_sequence",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(AudioService.I);
        static void StopAudio()=>typeof(AudioService).GetMethod("StopSfx",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(AudioService.I,null);
        static bool LastCue(string key)
        {
            var flags=BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic;
            var cues=(IDictionary)typeof(AudioService).GetField("_currentCues",flags).GetValue(AudioService.I);
            var clips=(AudioClip[])cues[key].GetType().GetField("clips",flags).GetValue(cues[key]);
            var voices=(Array)typeof(AudioService).GetField("_voices",flags).GetValue(AudioService.I);
            foreach(var voice in voices)if((long)voice.GetType().GetField("sequence",flags).GetValue(voice)==Sequence())
                return clips.Contains(((AudioSource)voice.GetType().GetField("source",flags).GetValue(voice)).clip);
            return false;
        }
        static void AtomicSound(Button button,string cue)
        {
            var game=GameRuntime.I;StopAudio();long sequence=Sequence();
            string disk=File.ReadAllText(SaveSystem.ProfilePath),before=SaveJson.Stringify(game.Base),rng=game.Rng.SaveState();
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))
            {Submit(button);Check(!game.Saves.LastWriteSucceeded&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&SaveJson.Stringify(game.Base)==before&&game.Rng.SaveState()==rng,"failed action preserves profile/Base/RNG");Check(Sequence()==sequence,"failed action has no success audio");}
            StopAudio();sequence=Sequence();Submit(button);
            Check(game.Saves.LastWriteSucceeded&&Sequence()==sequence+1&&LastCue(cue),"one persisted success cue: "+cue);
        }
        public static IEnumerator Run()
        {
            Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
            Clear();var game=GameRuntime.I;game.ResetSlot(5);game.State.entrySupply=null;game.State.battleActive=false;
            var sourceField=typeof(CardLibrary).GetField("_source",BindingFlags.Static|BindingFlags.NonPublic);
            var original=(Func<IReadOnlyList<CardDef>>)sourceField.GetValue(null);var customs=CardLibrary.CustomsLoader;
            bool muted=AudioService.I.Muted,sfx=AudioService.I.SfxMuted;
            try
            {
                var priest=CardDatabase.All.Single(card=>card.id=="tt13-stellar-divination");
                var warrior=CardDatabase.All.Single(card=>card.id=="tt7-armup");var ordinary=CardDatabase.All.Single(card=>card.id=="tt3-fireball");
                var fixture=new List<CardDef>{priest,warrior,warrior.Clone(),ordinary};int reads=0;
                CardLibrary.CustomsLoader=()=>Array.Empty<CardDef>();CardLibrary.ResetCustomsCache();CardLibrary.Init(()=>{reads++;return fixture;});
                game.Base.collection.Clear();game.Base.collection[priest.id]=new CollectionEntry{name=priest.name,rarity=priest.rarity};
                game.Base.collection["removed-round6-record"]=new CollectionEntry{name="removed"};
                var summary=game.Meta.CollectionSummary();Check(summary.total==2&&summary.progress==1&&reads==1,"one catalog query, stable-ID dedupe and current-definition progress");
                fixture[1]=fixture[2]=ordinary;reads=0;summary=game.Meta.CollectionSummary();
                Check(summary.total==1&&summary.progress==1&&reads==1,"same-length definition replacement is reflected immediately");
                fixture.Add(warrior);reads=0;summary=game.Meta.CollectionSummary();
                Check(summary.total==2&&summary.progress==1&&reads==1,"catalog append is reflected without cross-build cache");
                var claimed=game.Base.collClaimed;
                try
                {
                    game.Base.collClaimed=HubCatalog.Current.milestones.ToDictionary(m=>m.id,m=>true);
                    reads=0;var completed=Open("deploy");
                    Check(reads==0,"all-claimed home does not query the unused collection catalog");
                    View("_person","wu");View("_personSection","profile");View("_personGroup","people");View("_previewSkin","");
                    reads=0;completed=Open("classes");
                    Check(reads==0,"all-claimed person profile does not query collection or unused class pools");
                    View("_archiveView","classes");reads=0;completed=Open("ach");
                    Check(reads==1&&Text(completed,"1 / 2"),"all-claimed milestone page derives actual progress/total exactly once");
                }
                finally{game.Base.collClaimed=claimed;Clear();}
                CardLibrary.CustomsLoader=customs;CardLibrary.ResetCustomsCache();CardLibrary.Init(original);

                game.Base.collection.Clear();
                string[] ids={"tt7-armup","tt13-stellar-divination","tt8-hero-assassin","tt8-hero-sword","tt8-hero-warlock"};
                foreach(string id in ids){var card=CardLibrary.FindById(id);Check(card!=null&&game.Meta.IsCollectible(card),"real collection fixture "+id);game.Base.collection[id]=new CollectionEntry{name=card.name,rarity=card.rarity};}
                game.Base.wood=200;game.Base.rations=100;game.Base.coins=200;game.Base.Save();
                var page=Open("deploy");Badge(page,2);Check(Text(page,"待领取  2"),"home affairs and navigation use identical readiness");
                View("_archiveView","rewards");page=Open("ach");
                var list=page.GetComponentsInChildren<Transform>().Single(node=>node.name=="av12-record-list");
                Check(list.GetComponentsInChildren<Button>().Count(button=>button.name.StartsWith("<size=16>",StringComparison.Ordinal))==2,"reward inbox shows the same two ready records");Badge(page,2);
                View("_archiveView","classes");View("_milestoneRecord","m5");page=Open("ach");var claim=Button(page,"领取奖励");
                string disk=File.ReadAllText(SaveSystem.ProfilePath);int wood=game.Base.wood;
                using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))
                {Submit(claim);Check(!game.Meta.MilestoneClaimed("m5")&&game.Base.wood==wood&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"failed collection claim retains qualification and reward");}
                var held=game.Base.collection[ids[0]];game.Base.collection.Remove(ids[0]);game.Base.Save();disk=File.ReadAllText(SaveSystem.ProfilePath);
                Submit(claim);Check(!game.Meta.MilestoneClaimed("m5")&&game.Base.wood==wood&&File.ReadAllText(SaveSystem.ProfilePath)==disk,"ready control rechecks changed collection at commit");
                game.Base.collection[ids[0]]=held;game.Base.Save();var old=claim.onClick;Submit(claim);
                Check(game.Meta.MilestoneClaimed("m5")&&game.Base.wood==wood+HubCatalog.Current.milestones.Single(m=>m.id=="m5").reward.wood,"current claim grants once");
                wood=game.Base.wood;old.Invoke();Check(game.Base.wood==wood,"old claim callback cannot grant twice");page=Open("deploy");Badge(page,1);Check(Text(page,"待领取  1"),"next build reflects claimed milestone");

                game.Base.characters["wu"]=new ClassProgress{lv=2,xp=7};View("_person","wu");View("_personSection","profile");View("_personGroup","people");View("_previewSkin","");
                reads=0;CardLibrary.Init(()=>{reads++;return original();});page=Open("classes");
                Check(reads==1,"single-person page uses one shared collection query, no all-character card-pool summaries");
                Check(Text(page,"Lv.2")&&Text(page,"7 / "+MetaProgress.XpForNext(2)+" XP"),"selected character level/XP stay correct");CardLibrary.Init(original);

                AudioService.I.Mute(false);AudioService.I.SetSfxMuted(false);Check(AudioService.I.IsSubpageOpen?.Invoke()==true,"Hub suppresses generic click audio");
                View("_facility","bag");page=Open("upgrade");int bag=game.Base.bagUp;AtomicSound(page.GetComponentsInChildren<Button>().Single(button=>button.name.StartsWith("确认扩建",StringComparison.Ordinal)),"levelup");Check(game.Base.bagUp==bag+1,"bag expanded once");
                View("_facility","stash");page=Open("upgrade");int stash=game.Base.stashUp;AtomicSound(page.GetComponentsInChildren<Button>().Single(button=>button.name.StartsWith("确认扩建",StringComparison.Ordinal)),"levelup");Check(game.Base.stashUp==stash+1,"warehouse expanded once");
                View("_personGroup","pets");View("_hatch",false);View("_pet","dog");page=Open("classes");int level=game.Base.PetLevel("dog");AtomicSound(Button(page,"培养伙伴"),"levelup");Check(game.Base.PetLevel("dog")==level+1,"pet upgraded once");
                var egg=CardLibrary.FindById(PetCatalog.Current.eggId);game.Base.stash.RemoveAll(stack=>stack.card.id==egg.id);game.Base.stash.Add(new StashStack{card=egg.Clone(),count=2});game.Base.Save();
                View("_hatch",true);page=Open("classes");int pets=game.Base.pets.Count;AtomicSound(Button(page,"孵化伙伴"),"eggHatch");Check(game.Base.pets.Count==pets+1,"personnel hatch grants one new pet");
                var stack=game.Base.stash.Single(item=>item.card.id==egg.id);HubScreen.HubInventoryCardScreen.Open(stack.card,null,stackKey:GameRuntime.DepartureStackKey(stack));
                var detail=(HubScreen.HubInventoryCardScreen)UiStack.Top;pets=game.Base.pets.Count;
                AtomicSound(detail.GetComponentsInChildren<Button>().Single(button=>button.name.StartsWith("孵化伙伴 ·",StringComparison.Ordinal)),"eggHatch");
                Check(game.Base.pets.Count==pets+1&&!game.Base.stash.Any(item=>item.card.id==egg.id),"inventory hatch consumes only the final egg and avoids extra ding");
            }
            finally
            {CardLibrary.CustomsLoader=customs;CardLibrary.ResetCustomsCache();CardLibrary.Init(original);Clear();AudioService.I.Mute(muted);AudioService.I.SetSfxMuted(sfx);}
            yield return null;
        }
    }
}
