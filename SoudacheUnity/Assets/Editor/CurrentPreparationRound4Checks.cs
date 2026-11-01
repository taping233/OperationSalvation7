// Central-driver native preparation checks; isolated profile, constructed events, no OS input.
using System;
using System.Collections;
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
    public static class CurrentPreparationRound4Checks
    {
        public static int Assertions{get;private set;}
        static void Check(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("preparation round4: "+message);}
        static T Find<T>(PreparationScreen page,string name)where T:Component=>page.GetComponentsInChildren<T>().Single(control=>control.name==name);
        static void Submit(PreparationScreen page,string name)
        {
            var button=Find<Button>(page,name);Check(button.IsActive()&&button.IsInteractable(),"current button available: "+name);
            EventSystem.current.SetSelectedGameObject(button.gameObject);
            Check(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"EventSystem submit: "+name);
        }
        static string Base(GameRuntime game)=>SaveJson.Stringify(game.Base);
        static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
        public static IEnumerator Run()
        {
            Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
            Clear();var game=GameRuntime.I;game.ResetSlot(5);game.State.entrySupply=null;
            Check(game.Saves.LastWriteSucceeded&&!game.State.runActive,"neutral base fixture saved");
            var catalog=CardLibrary.All().GroupBy(card=>card.id).Select(group=>group.First()).ToArray();Check(catalog.Length>3,"goal fixture catalog");
            string first=catalog[0].id,second=catalog[1].id;
            Check(game.Base.TrySetTrackedGoals(new[]{first},out var reason),reason);
            PreparationScreen.Open();yield return null;Canvas.ForceUpdateCanvases();var page=(PreparationScreen)UiStack.Top;
            var closed=Find<Button>(page,"goal-remove-"+first).onClick;
            Submit(page,"preparationBack");Check(UiStack.Top is HubScreen,"normal back returns to base");
            string state=Base(game),disk=File.ReadAllText(SaveSystem.ProfilePath),rng=game.Rng.SaveState();
            closed.Invoke();Check(Base(game)==state&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&game.Rng.SaveState()==rng,"closed goal callback cannot write same slot");
            PreparationScreen.Open();page=(PreparationScreen)UiStack.Top;closed.Invoke();Check(Base(game)==state&&UiStack.Top==page,"closed callback cannot target same-slot replacement");

            var oldRemove=Find<Button>(page,"goal-remove-"+first).onClick;
            var picker=Find<Dropdown>(page,"prep-goal-select");var oldSelect=picker.onValueChanged;
            picker.value=Array.FindIndex(catalog,card=>card.id==second)+1;Submit(page,"goal-add");
            Check(game.Base.PreparationTracked().SequenceEqual(new[]{first,second}),"current goal submit persists selected ID");
            state=Base(game);disk=File.ReadAllText(SaveSystem.ProfilePath);
            oldRemove.Invoke();oldSelect.Invoke(3);
            var goal=typeof(PreparationScreen).GetField("_goal",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(page);
            Check(Base(game)==state&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&(string)goal==second,"old rendered button/dropdown cannot alter current goals or draft selection");

            Submit(page,"prep-preset-editor preset-1");yield return null;Canvas.ForceUpdateCanvases();
            var input=Find<InputField>(page,"prep-name-preset-1");var oldEdit=input.onEndEdit;
            var oldPreview=Find<Button>(page,"preset-preview-preset-1").onClick;
            Submit(page,"preset-preview-preset-1");yield return null;
            state=Base(game);oldEdit.Invoke("旧输入不可保存");oldPreview.Invoke();
            Check(Base(game)==state&&UiStack.Top==page,"old input and preview cannot act after redraw");

            input=Find<InputField>(page,"prep-name-preset-1");var coveredEdit=input.onEndEdit;
            var cover=ScreenMount.Show<CurrentPreparationRound4Cover>("preparation-cover");cover.Build();
            coveredEdit.Invoke("覆盖期间不可保存");Check(Base(game)==state&&UiStack.Top==cover,"covered input cannot write or navigate");UiStack.Close(cover);

            input=Find<InputField>(page,"prep-name-preset-1");input.text="保存失败保留编辑";EventSystem.current.SetSelectedGameObject(input.gameObject);
            state=Base(game);disk=File.ReadAllText(SaveSystem.ProfilePath);rng=game.Rng.SaveState();
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))input.onEndEdit.Invoke(input.text);
            Check(!game.Saves.LastWriteSucceeded&&Base(game)==state&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&game.Rng.SaveState()==rng,"failed preset save preserves base disk and RNG");
            Check(Find<InputField>(page,"prep-name-preset-1")==input&&input.text=="保存失败保留编辑"&&EventSystem.current.currentSelectedGameObject==input.gameObject,"failed save retains input object value and focus");
            Check(!string.IsNullOrEmpty(Find<Text>(page,"preparation-notice").text),"failed save has local error receipt");
            var failedEdit=input.onEndEdit;page.Build();yield return null;yield return null;Canvas.ForceUpdateCanvases();
            input=Find<InputField>(page,"prep-name-preset-1");
            Check(input.text=="保存失败保留编辑"&&Base(game)==state,"redraw keeps failed draft without publishing it");
            Check(EventSystem.current.currentSelectedGameObject==input.gameObject,"redraw restores same edit focus");
            var staleInputFocus=EventSystem.current.currentSelectedGameObject;failedEdit.Invoke("旧失败回调不可重试");Check(Base(game)==state&&EventSystem.current.currentSelectedGameObject==staleInputFocus,"expired failed edit cannot save or steal focus");
            input.onEndEdit.Invoke(input.text);Check(game.Saves.LastWriteSucceeded&&game.Base.PreparationPresets().Single(preset=>preset.id=="preset-1").name=="保存失败保留编辑","current input retries through authoritative save");
            yield return null;yield return null;
            var notice=page.GetComponentsInChildren<Text>(true).Single(text=>text.name=="preparation-notice");Check(string.IsNullOrEmpty(notice.text),"successful retry clears error receipt");
            input=Find<InputField>(page,"prep-name-preset-1");closed=Find<Button>(page,"goal-remove-"+first).onClick;var closedEdit=input.onEndEdit;
            Submit(page,"preparationBack");state=Base(game);disk=File.ReadAllText(SaveSystem.ProfilePath);closed.Invoke();closedEdit.Invoke("关闭后不可保存");
            Check(Base(game)==state&&File.ReadAllText(SaveSystem.ProfilePath)==disk&&UiStack.Top is HubScreen,"normal leave invalidates button and editor events");
            PreparationScreen.Open();page=(PreparationScreen)UiStack.Top;closedEdit.Invoke("新页仍不可保存");Check(Base(game)==state&&UiStack.Top==page,"old editor cannot target new same-slot page");
            Clear();yield return null;
        }
    }
    public sealed class CurrentPreparationRound4Cover:Panel{public override void Build(){} }
}
