// Production archive preview/submit and catalog projection, in the root driver's isolated profile.
using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Reflection;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentArchiveRound3Checks
    {
        public static int Assertions{get;private set;}
        static void Require(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("Archive round3: "+message);}
        public static IEnumerator Run()
        {
            Assertions=0;CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();
            var game=GameRuntime.I;game.ResetSlot(5);game.NewRun(5,"wu");while(UiStack.Count>0)UiStack.Pop();
            var card=CardLibrary.FindById("tt3-fireball").Clone();card.id="round3-native-archive";card.name="备份中的自定义卡";
            CardLibrary.Upsert(card);game.State.entrySupply=new EntrySupplyReceipt{cardIds=new System.Collections.Generic.List<string>{card.id}};game.SaveCurrent();
            Require(game.Saves.LastWriteSucceeded,"source fixture saved");
            var first=CardLibrary.All();long allocated=GC.GetAllocatedBytesForCurrentThread();
            for(int i=0;i<100;i++)CardLibrary.All();
            Require(GC.GetAllocatedBytesForCurrentThread()-allocated==0,"warmed full native custom catalog has no merge allocations across 100 reads");
            Require(ReferenceEquals(first,CardLibrary.All()),"full native catalog reuses unchanged projection");
            var text=game.Saves.ExportSlotArchive(5);CardLibrary.Remove(card.id);
            Require(CardLibrary.FindById(card.id)==null,"target fixture has no source definition");
            var preview=game.Saves.PreviewSlotArchive(text,4);
            Require(preview.AddedCustomCards==1,"preview reports one needed definition");
            var owner=UiStack.Show<CurrentArchiveRound3Owner>("Round3 archive owner");
            typeof(CurrentSlotArchiveScreen).GetMethod("Confirm",BindingFlags.Static|BindingFlags.NonPublic).Invoke(null,new object[]{preview,owner,(Func<bool>)(()=>owner!=null&&owner.isActiveAndEnabled),(Action)(()=>{})});
            yield return null;
            var dialog=UiStack.Top;
            Require(dialog!=owner&&dialog.GetComponentsInChildren<Text>().Any(label=>label.text.Contains("将补入 1 条")&&label.text.Contains("本机卡牌库")),"actual preview discloses new custom definitions before confirmation");
            Canvas.ForceUpdateCanvases();var message=dialog.GetComponentsInChildren<Text>().Single(label=>label.text.Contains("将补入 1 条"));
            Require(message.preferredHeight<=message.rectTransform.rect.height+.5f,"archive definition disclosure fits the actual native message region");
            var confirm=dialog.GetComponentsInChildren<Button>().Single(button=>button.name=="confirmation-accept");
            Require(confirm.isActiveAndEnabled&&confirm.interactable,"formal import submit is available");
            EventSystem.current.SetSelectedGameObject(confirm.gameObject);
            Require(ExecuteEvents.Execute(confirm.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"actual EventSystem import submit accepted");
            yield return null;
            Require(game.Saves.ReadSlot(4)?.entrySupply.cardIds.Single()==card.id&&CardLibrary.FindById(card.id)!=null,"confirmation writes slot and needed definition together");
            while(UiStack.Count>0)UiStack.Pop();
        }
    }
    public sealed class CurrentArchiveRound3Owner:Panel{public override void Build(){}}
}
