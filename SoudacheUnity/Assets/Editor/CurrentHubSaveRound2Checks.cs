// Explicit round2 native checks. The root driver supplies Play mode and an isolated profile.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Bag;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentHubSaveRound2Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value,string message)
        {
            Assertions++;
            if(!value)throw new InvalidOperationException("hub-save round2: "+message);
        }
        static Button Button(ContainerScreen panel,string name)=>panel.GetComponentsInChildren<Button>().Single(button=>button.name==name);
        static void Submit(Button button)
        {
            Check(button!=null&&button.isActiveAndEnabled&&button.interactable,"available EventSystem submit target");
            ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler);
        }
        static void ClearPanels(){foreach(var panel in UiStack.CapturePanels().Reverse())UiStack.Close(panel);}
        public static IEnumerator Run()
        {
            Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
            var game=GameRuntime.I;
            game.ResetSlot(5);game.NewRun(5,"wu");ClearPanels();
            CapacityCases(game);
            game.NewRun(5,"wu");ClearPanels();
            var pouch=CardDatabase.All.First(card=>card.id==CardContainerCommands.PouchId).Clone();
            var spell=CardDatabase.All.First(card=>card.type=="法术"&&!BaseData.IsSha(card)).Clone();
            game.State.ownedCards=new List<OwnedCard>{new OwnedCard{uid="r2-box",card=pouch},new OwnedCard{uid="r2-a",card=spell},new OwnedCard{uid="r2-b",card=spell}};
            game.State.inventory.Clear();game.State.battleActive=false;game.State.bossCleanupPending=false;
            BagScreen.Open();ContainerScreen.Open("pouch");yield return null;Canvas.ForceUpdateCanvases();
            Check(BagScreen.Current.CoversBoard&&UiStack.CoversBoard,"opaque bag covers board beneath container");
            var panel=(ContainerScreen)UiStack.Top;
            var root=panel.transform.Find("container-store collection-workspace");
            var put=Button(panel,"pouchPut-r2-a");
            var face=put.transform.Find("card-art");
            var scrolls=panel.GetComponentsInChildren<ScrollRect>();
            var oldInspect=Button(panel,"pouchInspect-r2-a").onClick;
            Submit(Button(panel,"containerHelp"));yield return null;
            Check(panel.transform.Find("container-store collection-workspace")==root,"help retains root");
            Check(Button(panel,"pouchPut-r2-a")==put&&put.transform.Find("card-art")==face,"help retains transfer control and card face");
            Check(scrolls.SequenceEqual(panel.GetComponentsInChildren<ScrollRect>()),"help retains scroll owners");
            Submit(put);yield return null;Canvas.ForceUpdateCanvases();
            Check(game.State.ownedCards.Count(card=>card.stored&&card.pouchOf==CardContainerCommands.PouchId)==2,"whole visible stack stored once");
            Check(panel.transform.Find("container-store collection-workspace")==root,"transfer retains root");
            string state=SaveJson.Stringify(game.State),rng=game.Rng.SaveState();
            oldInspect.Invoke(); // Deliberate old UnityEvent replay, distinct from player submit above.
            Check(UiStack.Top==panel&&SaveJson.Stringify(game.State)==state&&game.Rng.SaveState()==rng,"old inspect is inert after rebinding");
            var closedTake=Button(panel,"pouchTake-r2-a").onClick;
            UiStack.Close(panel);closedTake.Invoke();
            Check(SaveJson.Stringify(game.State)==state,"closed event cannot transfer");
            ContainerScreen.Open("pouch");yield return null;
            var replacement=(ContainerScreen)UiStack.Top;state=SaveJson.Stringify(game.State);closedTake.Invoke();
            Check(UiStack.Top==replacement&&SaveJson.Stringify(game.State)==state,"closed event cannot act through replacement");
            Submit(Button(replacement,"pouchTake-r2-a"));yield return null;
            Check(game.State.ownedCards.All(card=>!card.stored&&string.IsNullOrEmpty(card.pouchOf)),"current take still works");
            Check(game.State.ownedCards.Select(card=>card.uid).OrderBy(uid=>uid).SequenceEqual(new[]{"r2-a","r2-b","r2-box"}),"UIDs preserved");
            ClearPanels();yield return null;
        }
        static void CapacityCases(GameRuntime game)
        {
            game.State.inventory.Clear();
            var pearl=new CardDef{id=CardContainerCommands.PearlId,name="容量盒",type="武术"};
            var full=new List<OwnedCard>{new OwnedCard{uid="box",card=pearl}};
            int total=game.Base.BagCap+9;
            for(int i=1;i<total;i++)full.Add(new OwnedCard{uid="resource-"+i,card=new CardDef{id="resource-"+i,name="资源"+i,type="资源"}});
            game.State.ownedCards=full;
            var query=CardContainerCommands.Query(game);
            Check(query.used==query.totalCap&&query.capacityOk,"legal resource-filled bag fixture");
            Check(query.ordinaryFree==0&&query.resourceFree==0,"full bag cannot promise ordinary free slots");
            Check(!CardContainerCommands.CanReceive(game,new CardDef{id="new",name="新牌",type="法术"}),"ordinary grant agrees with zero free slots");
            foreach(string type in new[]{"法术","武术","装备","资源"})
            foreach(int safeCount in new[]{0,2,3,6})
            foreach(int bagCount in new[]{1,3,4})
            foreach(int count in new[]{1,Math.Min(3,bagCount)}.Distinct())
            {
                var card=new CardDef{id="projection",variantKey="a",name="同名",type=type};
                var other=new CardDef{id="projection",variantKey="b",name="同名",type=type};
                var owned=new List<OwnedCard>();
                for(int i=0;i<safeCount;i++)owned.Add(new OwnedCard{uid="safe-"+i,card=card,safe=true});
                owned.Add(new OwnedCard{uid="variant",card=other,safe=true});
                for(int i=0;i<bagCount;i++)owned.Add(new OwnedCard{uid="bag-"+i,card=card});
                owned.Add(new OwnedCard{uid="stored",card=card,stored=true,pouchOf=CardContainerCommands.PouchId});
                game.State.ownedCards=owned;
                string before=SaveJson.Stringify(game.State),rng=game.Rng.SaveState();
                var preview=CardContainerCommands.CreateSafeStoragePreview(game);
                var selected=new HashSet<string>(Enumerable.Range(0,count).Select(i=>"bag-"+i));
                var projected=CardContainerCommands.Query(game,owned.Select(entry=>selected.Contains(entry.uid)?new OwnedCard{uid=entry.uid,card=entry.card,safe=true}:entry));
                bool fits=preview.CanStore(card,count,out int required);
                Check(fits==(projected.capacityOk&&projected.safeUsed<=game.SafeCap),"safe preview agrees with full query");
                Check(required==projected.safeUsed-preview.SafeUsed,"safe preview uses exact split-slot delta");
                var take=CardContainerCommands.Query(game,owned.Select(entry=>entry.uid=="stored"?new OwnedCard{uid=entry.uid,card=entry.card}:entry));
                Check(preview.CanTakeFromContainer(card,1)==take.capacityOk,"container take preview agrees with full query");
                Check(SaveJson.Stringify(game.State)==before&&game.Rng.SaveState()==rng,"previews are read-only");
            }
            Check(!CardContainerCommands.CreateSafeStoragePreview(game).CanStore(CardLibrary.SHA,1,out _),"initial attack cannot enter safe slots");
        }
    }
}
