// Root-only native EventSystem submit/focus probe; no OS input or player profile.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentRewardOrganizerFocusValidation
    {
        const string Active="Sdt.RewardOrganizerFocus.Active";
        static readonly List<object> Records=new List<object>();
        static IEnumerator _flow;static double _start,_next;static string _step;
        static int _claimed;static Panel _owner;
        static string Output=>Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static double Now=>EditorApplication.timeSinceStartup;
        static CurrentRewardOrganizerFocusValidation(){EditorApplication.update+=Tick;Application.logMessageReceived+=Observe;}
        public static void Run()
        {
            if(string.IsNullOrWhiteSpace(Output))throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT required");
            Directory.CreateDirectory(Output);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",Path.Combine(Output,"profile-organizer-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")));
            AssetDatabase.DisallowAutoRefresh();SessionState.SetBool(Active,true);EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity");EditorApplication.EnterPlaymode();
        }
        static void Observe(string message,string stack,LogType type)
        {if(SessionState.GetBool(Active,false)&&(type==LogType.Error||type==LogType.Exception))Finish(new InvalidOperationException(message+"\n"+stack));}
        static void Tick()
        {
            if(!SessionState.GetBool(Active,false))return;EditorApplication.QueuePlayerLoopUpdate();
            if(!EditorApplication.isPlaying||EditorApplication.isCompiling||App.Canvas==null||Now<_next)return;_next=Now+.025;if(_start==0)_start=Now;
            try{Require(Now-_start<90,"organizer focus timeout: "+_step);if(_flow==null)_flow=Flow().GetEnumerator();if(!_flow.MoveNext())Finish(null);}catch(Exception error){Finish(error);}
        }
        static IEnumerable<object> Frame(){int frame=Time.frameCount;while(Time.frameCount<=frame)yield return null;}
        static IEnumerable<object> Flow()
        {
            OffscreenCapture.PrepareReference();Require(Path.GetFullPath(SaveSystem.Dir).StartsWith(Path.GetFullPath(Output),StringComparison.OrdinalIgnoreCase),"profile escaped probe output");
            _step="initial safe return and keep cancellation";Fixture(2,2,2);foreach(var item in Frame())yield return item;
            Focus("organizer-return");int before=GameRuntime.I.State.ownedCards.Count;Submit("organizer-discard-focus-1-0");Focus("organizer-keep");Require(GameRuntime.I.State.ownedCards.Count==before,"request discard mutated cards");
            Submit("organizer-keep");Focus("organizer-discard-focus-1-0");Require(GameRuntime.I.State.ownedCards.Count==before,"keep mutated cards");Record();

            _step="one discard retains same stack decision";Submit("organizer-discard-focus-1-0");Submit("organizer-confirm-focus-1-0");Focus("organizer-discard-focus-1-1");Require(GameRuntime.I.State.ownedCards.Count==before-1,"confirm did not discard exactly one");Record();

            _step="removed middle stack selects next neighbour";Fixture(2,1,2);foreach(var item in Frame())yield return item;
            Submit("organizer-discard-focus-1-0");Submit("organizer-confirm-focus-1-0");Focus("organizer-discard-focus-2-0");Record();

            _step="removed last stack selects previous neighbour";Fixture(2,2,1);foreach(var item in Frame())yield return item;
            Submit("organizer-discard-focus-2-0");Submit("organizer-confirm-focus-2-0");Focus("organizer-discard-focus-1-0");Record();

            _step="empty list selects return without claim or leave";Fixture(1);foreach(var item in Frame())yield return item;
            Submit("organizer-discard-focus-0-0");Submit("organizer-confirm-focus-0-0");Focus("organizer-return");Require(GameRuntime.I.State.ownedCards.Count==0&&UiStack.Top is CurrentRewardCapacityOrganizer&&_claimed==0,"empty list automatically claimed or left");Record();

            _step="moving final stack to safe selects return";Fixture(2);foreach(var item in Frame())yield return item;
            Submit("organizer-safe-focus-0-0");Focus("organizer-return");Require(GameRuntime.I.State.ownedCards.Count==2&&GameRuntime.I.State.ownedCards.All(card=>card.safe==true)&&_claimed==0,"safe move lost cards or claimed reward");Record();

            _step="fresh safe capacity failure selects same discard entry";Fixture(2,2,2);foreach(var item in Frame())yield return item;
            var g=GameRuntime.I;var safeCards=CardLibrary.All().Where(card=>card.type=="装备").Take(g.SafeCap).ToArray();Require(safeCards.Length==g.SafeCap,"safe capacity fixture lacks cards");
            for(int index=0;index<safeCards.Length;index++)g.State.ownedCards.Add(new OwnedCard{uid="focus-full-safe-"+index,card=safeCards[index].Clone(),safe=true});
            g.SaveCurrent();Require(g.Saves.LastWriteSucceeded,"fresh capacity fixture save failed");Submit("organizer-safe-focus-1-0");Focus("organizer-discard-focus-1-0");Require(!Find("organizer-safe-focus-1-0").interactable&&g.State.ownedCards.Single(card=>card.uid=="focus-1-0").safe!=true,"failed safe move changed card or left safe action enabled");Record();

            _step="failed discard keeps its explicit confirmation focus";Fixture(2,2,2);foreach(var item in Frame())yield return item;
            Submit("organizer-discard-focus-1-0");before=GameRuntime.I.State.ownedCards.Count;
            using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read))Submit("organizer-confirm-focus-1-0");
            Focus("organizer-confirm-focus-1-0");Require(GameRuntime.I.State.ownedCards.Count==before&&!GameRuntime.I.Saves.InTransaction,"failed discard lost card or leaked transaction");Record();

            _step="list rebuild preserves reading position";Fixture(Enumerable.Repeat(2,14).ToArray());foreach(var item in Frame())yield return item;
            var scroll=UiStack.Top.GetComponentInChildren<ScrollRect>();Canvas.ForceUpdateCanvases();Require(scroll.content.rect.height>((RectTransform)scroll.viewport).rect.height,"scroll fixture does not overflow");scroll.verticalNormalizedPosition=.37f;float position=scroll.verticalNormalizedPosition;
            Submit("organizer-discard-focus-8-0");Focus("organizer-keep");Submit("organizer-keep");Focus("organizer-discard-focus-8-0");Canvas.ForceUpdateCanvases();Require(Mathf.Abs(scroll.verticalNormalizedPosition-position)<.01f,"decision rebuild jumped list position");Record();

            _step="covered stale keep cannot steal active page focus";Submit("organizer-discard-focus-8-0");var stale=Find("organizer-keep");
            var cover=ScreenMount.Show<CurrentRewardFocusProbeOwner>("organizer-focus-cover");cover.Build();var selected=cover.GetComponentInChildren<Button>();EventSystem.current.SetSelectedGameObject(selected.gameObject);stale.onClick.Invoke();
            Require(EventSystem.current.currentSelectedGameObject==selected.gameObject&&UiStack.Top==cover&&_claimed==0,"covered callback stole active focus or submitted reward");Record();
        }
        static void Fixture(params int[] counts)
        {
            CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();var g=GameRuntime.I;g.ResetSlot(5);g.NewRun(5,"wu");
            for(int index=0;index<g.GetEntrySupplyCards().Count;index++)Require(g.ClaimEntrySupply(index,out var reason),reason);
            CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();g.State.ownedCards.Clear();g.State.inventory.Clear();g.State.usedPocket.Clear();g.State.Phase="idle";_claimed=0;
            var templates=CardLibrary.All().Where(card=>card.type!="装备"&&!BaseData.IsSha(card)).Take(counts.Length).ToArray();Require(templates.Length==counts.Length,"fixture lacks distinct non-equipment cards");
            for(int row=0;row<counts.Length;row++)for(int copy=0;copy<counts[row];copy++)g.State.ownedCards.Add(new OwnedCard{uid="focus-"+row+"-"+copy,card=templates[row].Clone()});
            g.SaveCurrent();Require(g.Saves.LastWriteSucceeded,"fixture save failed");
            _owner=ScreenMount.Show<CurrentRewardFocusProbeOwner>("organizer-focus-owner");_owner.Build();
            CurrentRewardCapacityOrganizer.Open(new CurrentRewardItem{Card=CardLibrary.FindById("tt3-fireball").Clone(),Claim=()=>_claimed++},_owner);
        }
        static Button Find(string name)=>UiStack.Top?.GetComponentsInChildren<Button>().FirstOrDefault(button=>button.name==name);
        static void Focus(string name){var target=Find(name);Require(target!=null&&target.IsInteractable(),"missing or disabled expected focus "+name);Require(EventSystem.current.currentSelectedGameObject==target.gameObject,"expected focus "+name+", actual "+EventSystem.current.currentSelectedGameObject?.name);}
        static void Submit(string name)
        {
            var target=Find(name);Require(target!=null&&target.IsInteractable(),"missing or disabled submit "+name);EventSystem.current.SetSelectedGameObject(target.gameObject);
            Require(ExecuteEvents.Execute(target.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"native submit rejected "+name);
        }
        static void Record(){Records.Add(new{step=_step,selected=EventSystem.current.currentSelectedGameObject?.name,owned=GameRuntime.I.State.ownedCards.Count,claimed=_claimed});}
        static void Require(bool passed,string reason){if(!passed)throw new InvalidOperationException(reason);}
        static void Finish(Exception error)
        {
            if(!SessionState.GetBool(Active,false))return;SessionState.SetBool(Active,false);
            File.WriteAllText(Path.Combine(Output,"result.json"),JsonConvert.SerializeObject(new{passed=error==null,error=error?.ToString(),step=_step,records=Records,dataDirectory=SaveSystem.Dir,input="actual production organizer and EventSystem ISubmitHandler; constructed submit events",osHardwareInput=false,limitations=new[]{"Controlled owner and card fixtures test focus continuity, not reward entry routing, balancing or physical keyboard hardware."}},Formatting.Indented));EditorApplication.Exit(error==null?0:2);
        }
    }
    public sealed class CurrentRewardFocusProbeOwner:Panel
    {
        public override void Build()=>CurrentNodeElements.Button(transform,"probe-covered-focus",()=>{});
    }
}
