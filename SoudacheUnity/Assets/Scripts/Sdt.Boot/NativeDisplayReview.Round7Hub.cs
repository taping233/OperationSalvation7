// Opt-in normal Standalone review: isolated setup, real Hub commands/raycast clicks, no OS input.
using System;
using System.Collections;
using System.Linq;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Hub;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Boot
{
    public sealed partial class NativeDisplayReview
    {
        Button Round7HubButton(string caption)=>UiStack.Top.GetComponentsInChildren<Button>().Single(button=>button.GetComponentsInChildren<Text>().Any(text=>text.text==caption));
        IEnumerator Round7HubStable(string buttonName)
        {
            yield return Round6WaitForButton(buttonName);if(_failed)yield break;
            float deadline=Time.realtimeSinceStartup+3;
            bool Moving()=>UiStack.Top!=null&&UiStack.Top.GetComponentsInChildren<MonoBehaviour>().Any(component=>component.enabled&&component.GetType().Name=="HubRegionMotion");
            while(Moving()&&Time.realtimeSinceStartup<deadline)yield return null;
            if(!Guard(()=>{if(Moving())throw new TimeoutException("Hub source movement did not finish.");}))yield break;
            yield return new WaitForEndOfFrame();yield return null;
        }
        IEnumerator ReviewRound7Hub()
        {
            bool reduced=CurrentUiPreferences.ReducedMotion;
            try
            {
                if(!Guard(()=>
                {
                    NewPresentationFixture();var game=GameRuntime.I;game.State.entrySupply=null;game.State.runActive=false;game.State.battleActive=false;game.State.Phase="modal";
                    var data=game.Base;data.wood=100;data.rations=100;data.coins=100;data.stash.Clear();data.collection.Clear();
                    foreach(var card in game.Meta.CollectionPool())data.collection[card.id]=new CollectionEntry{name=card.name,rarity=card.rarity};
                    if(data.collection.Count<45)throw new InvalidOperationException("Current collection fixture cannot reach the real m45 target.");
                    foreach(var item in HubCatalog.Current.milestones)data.collClaimed[item.id]=item.id!="m45";
                    data.runes.Clear();data.runes.Add(new JObject{{"kind","rainbow"},{"attrs",new JArray("fire","ice")}});data.Save();
                    if(!CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",false,out var reason))throw new InvalidOperationException(reason);
                    HubScreen.Open("deploy");
                }))yield break;
                yield return Round7HubStable("hub-tab ach");if(_failed)yield break;
                if(!Guard(()=>ClickNamed("hub-tab ach")))yield break;
                yield return Round7HubStable("hub-tab ach");if(_failed)yield break;
                if(!Guard(()=>ClickButton(Round7HubButton("成就目标"))))yield break;
                yield return Round7HubStable("achievement-filter-all");if(_failed)yield break;
                if(!Guard(()=>UiStack.Top.GetComponentsInChildren<InputField>().Single(field=>field.name=="搜索成就或目标").text="符文"))yield break;
                yield return Round7HubStable("achievement-item-runeFan");if(_failed)yield break;
                if(!Guard(()=>ClickNamed("achievement-item-runeFan")))yield break;
                yield return new WaitForEndOfFrame();yield return null;
                if(!Guard(()=>{if(!UiStack.Top.GetComponentsInChildren<Text>().Any(text=>text.text=="2 / 5"))throw new InvalidOperationException("Real rune target did not show 2 / 5.");}))yield break;
                yield return Capture("player-r7-hub-rune-progress",false);
                if(!Guard(()=>ClickNamed("achievement-item-beautifulVase")))yield break;
                yield return new WaitForEndOfFrame();yield return null;
                if(!Guard(()=>{if(!UiStack.Top.GetComponentsInChildren<Text>().Any(text=>text.text=="1 / 1"))throw new InvalidOperationException("Real rainbow target did not show 1 / 1.");}))yield break;
                yield return Capture("player-r7-hub-rainbow-progress",false);

                if(!Guard(()=>ClickButton(Round7HubButton("收藏里程碑"))))yield break;
                yield return Round7HubStable("hub-tab ach");if(_failed)yield break;
                if(!Guard(()=>ClickButton(UiStack.Top.GetComponentsInChildren<Button>().Single(button=>button.GetComponentsInChildren<Text>().Any(text=>text.text.Contains("收藏里程碑 04"))))))yield break;
                yield return Round7HubStable("领取奖励");if(_failed)yield break;
                if(!Guard(()=>
                {
                    ClickNamed("领取奖励");var data=GameRuntime.I.Base;
                    if(!GameRuntime.I.Meta.MilestoneClaimed("m45")||data.stash.Sum(stack=>stack.count)!=2||data.stash.Select(stack=>stack.card.id).Distinct().Count()!=2||data.stash.Any(stack=>stack.card.rarity!="传说"))throw new InvalidOperationException("Real m45 did not persist its two distinct legendary cards.");
                    if(!data.stash.All(stack=>UiStack.Top.GetComponentsInChildren<Text>().Any(text=>text.text.Contains(stack.card.name+" ×"+stack.count))))throw new InvalidOperationException("Real claim receipt omitted an actual rolled card.");
                    _records.Add(new{kind="actual-player-hub-reward",id="m45",cards=data.stash.Select(stack=>new{stack.card.id,stack.card.name,stack.count}).ToArray(),saved=GameRuntime.I.Saves.LastWriteSucceeded,osHardwareInput=false});
                }))yield break;
                yield return Round7HubStable("查看仓库");if(_failed)yield break;
                yield return Capture("player-r7-hub-collection-receipt",false);
                if(!Guard(()=>ClickNamed("查看仓库")))yield break;
                yield return Round7HubStable("hub-tab stash");if(_failed)yield break;
                if(!Guard(()=>{if(!GameRuntime.I.Base.stash.All(stack=>UiStack.Top.GetComponentsInChildren<Text>().Any(text=>text.text==stack.card.name)))throw new InvalidOperationException("Receipt warehouse destination did not display the awarded cards.");}))yield break;
                yield return Capture("player-r7-hub-reward-warehouse",false);

                if(!Guard(()=>ClickNamed("hub-tab classes")))yield break;
                yield return Round7HubStable("hub-tab classes");if(_failed)yield break;
                if(!Guard(()=>ClickButton(Round7HubButton("伙伴"))))yield break;
                yield return Round7HubStable("hub-tab classes");if(_failed)yield break;
                if(!Guard(()=>
                {
                    string dog=BaseData.PetsCatalog.Single(pet=>pet.id=="dog").name;
                    ClickButton(UiStack.Top.GetComponentsInChildren<Button>().Single(button=>button.GetComponentsInChildren<Text>().Any(text=>text.text.StartsWith(dog+" · ",StringComparison.Ordinal))));
                }))yield break;
                yield return Round7HubStable("hub-tab classes");if(_failed)yield break;
                if(!Guard(()=>
                {
                    var interaction=UiStack.Top.GetComponentsInChildren<MonoBehaviour>().Single(component=>component.GetType().Name=="HubPartnerPlay");ClickButton(interaction.GetComponent<Button>());
                }))yield break;
                yield return new WaitForEndOfFrame();yield return null;
                if(!Guard(()=>{if(!UiStack.Top.GetComponentsInChildren<Text>().Any(text=>text.text=="歪头看着你。"))throw new InvalidOperationException("Real companion response is not visible.");}))yield break;
                yield return Capture("player-r7-hub-partner-reply",false);
            }
            finally
            {
                if(!CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",reduced,out var reason))Fail(new InvalidOperationException(reason));
                try{NewPresentationFixture();}catch(Exception error){Fail(error);}
            }
        }
    }
}
