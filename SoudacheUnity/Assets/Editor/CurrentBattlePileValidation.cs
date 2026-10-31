// Native UI path and display-copy checks. Controlled battle/profile; no OS input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentBattlePileValidation
    {
        const string Active="Sdt.CurrentBattlePile.Active";
        static readonly List<object> Records=new List<object>();
        static IEnumerator _flow;static double _start,_next;static string _milestone;
        static string Output=>Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static double Now=>EditorApplication.timeSinceStartup;
        static CurrentBattlePileValidation(){EditorApplication.update+=Tick;Application.logMessageReceived+=Observe;}
        public static void Run()
        {
            if(string.IsNullOrWhiteSpace(Output))throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT required");
            Directory.CreateDirectory(Output);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",Path.Combine(Output,"profile-pile-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")));
            AssetDatabase.DisallowAutoRefresh();SessionState.SetBool(Active,true);EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity");EditorApplication.EnterPlaymode();
        }
        static void Observe(string message,string stack,LogType type)
        {if(SessionState.GetBool(Active,false)&&(type==LogType.Error||type==LogType.Exception))Finish(new InvalidOperationException(message+"\n"+stack));}
        static void Require(bool pass,string reason){if(!pass)throw new InvalidOperationException(reason);}
        static void Tick()
        {
            if(!SessionState.GetBool(Active,false))return;EditorApplication.QueuePlayerLoopUpdate();
            if(!EditorApplication.isPlaying||EditorApplication.isCompiling||App.Canvas==null||Now<_next)return;
            _next=Now+.025;if(_start==0)_start=Now;
            try{Require(Now-_start<150,"pile validation timeout: "+_milestone);if(_flow==null)_flow=Flow().GetEnumerator();if(!_flow.MoveNext())Finish(null);}
            catch(Exception error){Finish(error);}
        }
        static IEnumerable<object> Until(Func<bool> ready,double limit=10)
        {double deadline=Now+limit;while(!ready()){Require(Now<deadline,"wait failed: "+_milestone);yield return null;}}
        static IEnumerable<object> Frame()
        {int frame=Time.frameCount;while(Time.frameCount<=frame)yield return null;}
        static IEnumerable<object> Flow()
        {
            _milestone="isolated battle fixture";
            foreach(var step in Until(()=>!CurrentRunFilm.Active))yield return step;
            OffscreenCapture.PrepareReference();Clear();
            Require(Path.GetFullPath(SaveSystem.Dir).StartsWith(Path.GetFullPath(Output),StringComparison.OrdinalIgnoreCase),"profile escaped evidence");
            var g=GameRuntime.I;g.ResetSlot(5);g.NewRun(5,"wu");CurrentRunFilm.CancelActive();Clear();
            Require(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out var preferenceError),preferenceError);
            g.State.ownedCards.Clear();g.State.usedPocket.Clear();g.State.hp=g.State.maxHp=1000;g.State.atk=0;g.State.Phase="idle";
            var uids=new List<string>();
            for(int index=0;index<24;index++)
            {
                var card=CardLibrary.SHA.Clone();card.name=index<4?"牌堆相同实例":"牌堆条目"+index.ToString("D2");card.cost=0;card.dmg=0;card.rules=null;
                string uid="pile-native-"+index.ToString("D2");uids.Add(uid);g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid=uid,card=card});
            }
            // Observe before Start: the real encounter warning is emitted before the
            // BattleScreen subscribes, and a delayed image can miss the four-second notice.
            var observedLogs=new List<LogRequested>();g.Bus.On<LogRequested>(entry=>observedLogs.Add(entry));
            g.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name="牌堆原生验收受控战斗",Foes=new List<EnemyStats>{new EnemyStats{id="pile-native-foe",name="受控敌人",hp=10000,atk=0}}}});
            foreach(var step in Until(()=>UiStack.Top is BattleScreen&&!CurrentRunFilm.Active))yield return step;
            var encounterLog=observedLogs.SingleOrDefault(entry=>entry.Tone=="warn"&&entry.Text.Contains("遭遇战")&&entry.Text.Contains("受控敌人"));
            Require(encounterLog!=null&&encounterLog.SuppressNotice,"actual StartNormal encounter warning was not retained as a silent battle log");
            var normalLog=observedLogs.SingleOrDefault(entry=>entry.Tone=="sys"&&entry.Text.Contains("临时初始攻击牌库"));
            Require(normalLog!=null&&normalLog.SuppressNotice,"actual BeginNormal system log was not retained as a silent battle log");
            Record("actual-start-log-routing",new{encounter=new{encounterLog.Text,encounterLog.Tone,encounterLog.SuppressNotice},normal=new{normalLog.Text,normalLog.Tone,normalLog.SuppressNotice}});
            var battle=(BattleScreen)UiStack.Top;var session=Sdt.Boot.BattleViewApi.Session;
            foreach(var actor in battle.GetComponentsInChildren<BattleUnitFrames>())UIKit.GetOrAdd<CanvasGroup>(actor).alpha=.73f;
            var foregroundSprite=Sdt.Res.Res.BattleLayer("foreground");Require(foregroundSprite!=null,"foreground asset absent");
            foreach(var image in battle.GetComponentsInChildren<Image>().Where(image=>image.sprite==foregroundSprite))UIKit.GetOrAdd<CanvasGroup>(image).alpha=.61f;
            var draw=session.Snapshot.DrawPile.ToArray();
            _milestone="actual deck HUD entrance";
            foreach(var step in ClickWhenReady(()=>Hud(battle,"[[icon:cards]] 牌库")))yield return step;
            var deck=UiStack.Top as BattlePileScreen;Require(deck!=null&&deck.Kind=="deck","deck HUD did not open current pile");
            Require(deck.Stacks.Count==draw.Length&&deck.Stacks.All(stack=>stack.Count==1),"deck instances were grouped");
            Require(session.Snapshot.DrawPile.SequenceEqual(draw),"opening deck changed true draw order");
            foreach(var step in Frame())yield return step;CheckBackdrop(battle,deck);Shot("pile-deck");
            CheckTitle(deck);
            Require(deck.Scroll.verticalScrollbar!=null&&!deck.Scroll.verticalScrollbar.gameObject.activeInHierarchy,"non-overflow deck scrollbar did not auto-hide");
            foreach(var step in ClickWhenReady(()=>Named("btDeckBack")))yield return step;
            foreach(var step in Until(()=>UiStack.Top==battle))yield return step;
            Require(battle.GetComponentsInChildren<BattleUnitFrames>().All(actor=>Mathf.Abs(actor.GetComponent<CanvasGroup>().alpha-.73f)<.001f),"closing deck did not restore original actor alpha");
            Require(battle.GetComponentsInChildren<Image>().Where(image=>image.sprite==foregroundSprite).All(image=>Mathf.Abs(image.GetComponent<CanvasGroup>().alpha-.61f)<.001f),"closing deck did not restore original foreground alpha");
            _milestone="real card commands populate consumed pile";
            foreach(string uid in uids){Require(session.PlayCard(uid,0,false).Ok,"fixture card command rejected: "+uid);foreach(var step in Frame())yield return step;}
            foreach(var step in Until(()=>Hud(battle,"[[icon:cards]] 消耗牌堆")?.IsInteractable()==true,30))yield return step;
            _milestone="actual consumed HUD entrance";
            foreach(var step in ClickWhenReady(()=>Hud(battle,"[[icon:cards]] 消耗牌堆")))yield return step;
            var pile=UiStack.Top as BattlePileScreen;Require(pile!=null&&pile.Kind=="grave","consumed HUD did not open current pile");
            Require(pile.Stacks.Sum(stack=>stack.Count)==24&&pile.Stacks.Count==21&&pile.Stacks.Single(stack=>stack.Card.name=="牌堆相同实例").Count==4,"effective identical cards did not group");
            Require(session.Snapshot.DrawPile.SequenceEqual(draw),"consumed display changed hidden draw order");
            foreach(var step in Frame())yield return step;CheckBackdrop(battle,pile);Canvas.ForceUpdateCanvases();
            CheckTitle(pile);
            Require(pile.Scroll.content.rect.height>pile.Scroll.viewport.rect.height,"pile fixture did not overflow");
            Require(pile.Scroll.verticalScrollbar!=null&&pile.Scroll.verticalScrollbar.gameObject.activeInHierarchy&&pile.Scroll.verticalScrollbar.size<1,"overflow pile thin scrollbar missing");
            Shot("pile-consumed-top");
            for(int wheel=0;wheel<32&&pile.Scroll.verticalNormalizedPosition>=.01f;wheel++)
            {
                var before=pile.Scroll.content.anchoredPosition;float beforeNormalized=pile.Scroll.verticalNormalizedPosition;
                Wheel(pile.Scroll,-3);foreach(var step in Frame())yield return step;Canvas.ForceUpdateCanvases();
                var after=pile.Scroll.content.anchoredPosition;float normalized=pile.Scroll.verticalNormalizedPosition;
                Record("native-wheel-progress",new{wheel=wheel+1,delta=-3,sensitivity=pile.Scroll.scrollSensitivity,beforeY=before.y,afterY=after.y,distance=after.y-before.y,beforeNormalized,normalized,contentHeight=pile.Scroll.content.rect.height,viewportHeight=pile.Scroll.viewport.rect.height,thumbSize=pile.Scroll.verticalScrollbar.size});
                Require(normalized<beforeNormalized&&after.y>before.y,"native wheel made no downward progress");
            }
            Require(pile.Scroll.verticalNormalizedPosition<.01f,"native wheel did not reach pile bottom");Shot("pile-consumed-bottom");
            var position=pile.Scroll.content.anchoredPosition;int last=pile.Stacks.Count-1;
            _milestone="native inspection retains parent and browses";
            foreach(var step in ClickWhenReady(()=>Named("btDecisionInspect-"+last)))yield return step;
            foreach(var step in Frame())yield return step;
            Require(UiStack.Top!=pile&&UiStack.CapturePanels().Contains(pile),"inspection destroyed parent pile");
            Require(UiStack.Top.GetComponentsInChildren<Text>().Single(text=>text.name=="zoom-index").text==(last+1)+" / "+pile.Stacks.Count,"reader index missing");
            Require(Named("zoom-next")==null,"reader should hide next at final item");Shot("pile-reader-last");
            foreach(var step in ClickWhenReady(()=>Named("zoom-prev")))yield return step;
            foreach(var step in Frame())yield return step;
            Require(UiStack.Top.GetComponentsInChildren<Text>().Single(text=>text.name=="zoom-index").text==last+" / "+pile.Stacks.Count,"reader browse did not update index");
            foreach(var step in ClickWhenReady(()=>Named("zoom-close")))yield return step;
            foreach(var step in Frame())yield return step;
            Require(UiStack.Top==pile&&Vector2.Distance(position,pile.Scroll.content.anchoredPosition)<.1f,"reader return changed parent scroll");
            Require(EventSystem.current.currentSelectedGameObject?.name=="btDecisionInspect-"+(last-1),"reader did not return focus to current inspected item");
            foreach(var step in ClickWhenReady(()=>Named("btDecisionInspect-"+last)))yield return step;
            foreach(var step in Frame())yield return step;
            ClickAt(new Vector2(24,540),UiStack.Top.transform.Find("cardZoom").gameObject);
            foreach(var step in Frame())yield return step;Require(UiStack.Top==pile,"reader backdrop click did not close");
            foreach(var step in ClickWhenReady(()=>Named("btGraveBack")))yield return step;
            foreach(var step in Frame())yield return step;Require(UiStack.Top==battle,"pile return did not retain battle");
            Require(session.Snapshot.DrawPile.SequenceEqual(draw),"whole pile inspection mutated draw order");
            _milestone="real UI warning keeps operation feedback";
            const string warning="原生验收：能量不足，操作未执行";
            RunLog.Log(warning,"warn");
            var uiWarning=observedLogs.SingleOrDefault(entry=>entry.Text==warning);
            Require(uiWarning!=null&&uiWarning.Tone=="warn"&&!uiWarning.SuppressNotice,"UI warning inherited silent battle-log routing");
            foreach(var step in Frame())yield return step;
            var notice=App.UiRoot.Find("OperationNotice");
            Require(notice!=null&&notice.gameObject.activeInHierarchy,"UI operation failure feedback disappeared");
            var noticeText=notice.Find("message").GetComponent<Text>();
            Require(noticeText.text==warning&&noticeText.color==Theme.Hex("#f0b78d"),"UI warning did not reach the existing visible warning consumer");
            Shot("pile-ui-warning-feedback");
            Record("complete",new{draw=draw.Length,consumed=24,stacks=21,parentScrollPreserved=true,returnedFocus=true,sourceBackdrop=7,suppressedActualEncounterWarning=true,suppressedActualNormalSystemLog=true,uiWarningFeedbackPreserved=true});
        }
        static Button Hud(BattleScreen battle,string prefix)=>battle.GetComponentsInChildren<Button>().FirstOrDefault(button=>button.GetComponentInChildren<Text>()?.text.StartsWith(prefix)==true);
        static Button Named(string name)=>UiStack.Top?.GetComponentsInChildren<Button>().FirstOrDefault(button=>button.name==name);
        static IEnumerable<object> ClickWhenReady(Func<Button> find)
        {
            foreach(var step in Frame())yield return step;double deadline=Now+10;
            while(find()==null||!find().IsInteractable()||Receiver(Center(find()))!=find().gameObject){Require(Now<deadline,"button not raycastable: "+_milestone);yield return null;}
            var button=find();ClickAt(Center(button),button.gameObject);
        }
        static Vector2 Center(Button button)=>RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,button.transform.TransformPoint(((RectTransform)button.transform).rect.center));
        static GameObject Receiver(Vector2 point)
        {Canvas.ForceUpdateCanvases();var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(new PointerEventData(EventSystem.current){position=point},hits);return hits.Count==0?null:ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject);}
        static void ClickAt(Vector2 point,GameObject target)
        {
            Require(Receiver(point)==target,"native pointer blocked: "+target.name);var input=new PointerEventData(EventSystem.current){position=point,button=PointerEventData.InputButton.Left};
            ExecuteEvents.Execute(target,input,ExecuteEvents.pointerDownHandler);ExecuteEvents.Execute(target,input,ExecuteEvents.pointerUpHandler);Require(ExecuteEvents.Execute(target,input,ExecuteEvents.pointerClickHandler),"pointer click rejected");Record("constructed-native-pointer",new{target=target.name,point.x,point.y});
        }
        static void Wheel(ScrollRect scroll,float delta)
        {
            var point=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,scroll.viewport.TransformPoint(scroll.viewport.rect.center));
            var input=new PointerEventData(EventSystem.current){position=point,scrollDelta=new Vector2(0,delta)};var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(input,hits);
            var target=hits.Count==0?null:ExecuteEvents.GetEventHandler<IScrollHandler>(hits[0].gameObject);Require(target==scroll.gameObject,"pile wheel routed outside its viewport");ExecuteEvents.Execute(target,input,ExecuteEvents.scrollHandler);Record("constructed-native-wheel",new{delta});
        }
        static void CheckBackdrop(BattleScreen battle,BattlePileScreen pile)
        {
            var material=pile.transform.Find("battle-pile-stage-filter").GetComponent<Image>().material;
            Require(material!=null&&material.shader.isSupported&&Mathf.Abs(material.GetFloat("_Blur")-7)<.001f&&Mathf.Abs(material.GetColor("_Tint").a-.28f)<.001f,"source blur/opacity material missing");
            Require(battle.GetComponentsInChildren<BattleUnitFrames>().All(actor=>actor.GetComponent<CanvasGroup>().alpha==0),"animated frame layer was not hidden");
            var foreground=Sdt.Res.Res.BattleLayer("foreground");Require(battle.GetComponentsInChildren<Image>().Where(image=>image.sprite==foreground).All(image=>image.GetComponent<CanvasGroup>().alpha==0),"foreground was not hidden");
        }
        static void CheckTitle(BattlePileScreen pile)
        {
            Canvas.ForceUpdateCanvases();
            var title=pile.GetComponentsInChildren<Text>().Single(text=>text.name=="battle-pile-title");
            Require(!title.canvasRenderer.cull&&title.text.Contains(pile.Kind=="deck"?"剩余牌库":"消耗牌堆"),"pile title missing or culled");
            var vertices=title.cachedTextGenerator.verts;float largest=0;
            for(int index=0;index+3<vertices.Count;index+=4)
                largest=Mathf.Max(largest,Mathf.Abs(vertices[index].position.y-vertices[index+2].position.y));
            Require(largest>title.fontSize*title.pixelsPerUnit*.5f,"pile title has no full-height glyph geometry");
            var notice=App.UiRoot.Find("OperationNotice");
            Require(notice==null||!notice.gameObject.activeInHierarchy,"ordinary battle system log covered pile title as a global notice");
            Record("title-visible",new{title=title.text,largestGlyph=largest,pile.Kind});
        }
        static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
        static void Shot(string name)=>Record("capture",new{name,capture=OffscreenCapture.Write(Path.Combine(Output,name+".png"))});
        static void Record(string kind,object detail){Records.Add(new{kind,milestone=_milestone,elapsed=Now-_start,detail});File.WriteAllText(Path.Combine(Output,"trace.json"),JsonConvert.SerializeObject(Records,Formatting.Indented));}
        static void Finish(Exception error)
        {
            if(!SessionState.GetBool(Active,false))return;SessionState.SetBool(Active,false);
            File.WriteAllText(Path.Combine(Output,"result.json"),JsonConvert.SerializeObject(new{passed=error==null,error=error?.ToString(),milestone=_milestone,records=Records,
                scope="Real HUD pointer path; controlled native battle and real card commands; native pointer/wheel dispatch; retained pile/reader return",
                limitations=new[]{"No OS hardware input claim.","Fixed editor reference captures do not prove standalone clarity.","Fixture uses reduced motion to drain card presentation; movie timing is not covered here."}},Formatting.Indented));EditorApplication.Exit(error==null?0:2);
        }
    }
}
