// Constructed native UI input and controlled production rules. Isolated profile; never OS hardware input.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Boot;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Battle;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentBattleMaterialValidation
    {
        const string Active="Sdt.BattleMaterial.Active";
        static readonly List<object> Records=new List<object>();
        static IEnumerator _flow;static double _start,_next;static string _step;
        static BattleScreen _screen;static BattleSession _session;
        static string Output=>Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static double Now=>EditorApplication.timeSinceStartup;
        static CurrentBattleMaterialValidation(){EditorApplication.update+=Tick;Application.logMessageReceived+=Observe;}
        public static void Run()
        {
            if(string.IsNullOrWhiteSpace(Output))throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT required");
            Directory.CreateDirectory(Output);Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",Path.Combine(Output,"profile-material-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")));
            AssetDatabase.DisallowAutoRefresh();SessionState.SetBool(Active,true);EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity");EditorApplication.EnterPlaymode();
        }
        static void Observe(string message,string stack,LogType type)
        {if(SessionState.GetBool(Active,false)&&(type==LogType.Error||type==LogType.Exception))Finish(new InvalidOperationException(message+"\n"+stack));}
        static void Require(bool pass,string reason){if(!pass)throw new InvalidOperationException(reason);}
        static void Tick()
        {
            if(!SessionState.GetBool(Active,false))return;EditorApplication.QueuePlayerLoopUpdate();
            if(!EditorApplication.isPlaying||EditorApplication.isCompiling||App.Canvas==null||Now<_next)return;_next=Now+.025;if(_start==0)_start=Now;
            try{Require(Now-_start<120,"material timeout: "+_step);if(_flow==null)_flow=Flow().GetEnumerator();if(!_flow.MoveNext())Finish(null);}catch(Exception error){Finish(error);}
        }
        static IEnumerable<object> Until(Func<bool> ready,double seconds=12)
        {double deadline=Now+seconds;while(!ready()){Require(Now<deadline,"wait failed: "+_step);yield return null;}}
        static IEnumerable<object> Frame(){int frame=Time.frameCount;while(Time.frameCount<=frame)yield return null;}
        static bool Ready()=>_screen!=null&&UiStack.Top==_screen&&_screen.GetComponent<BattlePresentationQueue>().Busy==false;
        static CardDef Material(string id)=>new CardDef{id=id,name=id,type="武术",rarity="古朴",cost=0,desc="受控材料",
            rules=RuleValue.Obj("version",1,"battle",RuleValue.Obj("target",RuleValue.Obj("side",null,"area",false)),"triggers",RuleValue.Obj("onPlay",RuleValue.Arr()))};
        static Button Action(string text)=>_screen.GetComponentsInChildren<Button>().Single(button=>button.GetComponentInChildren<Text>()?.text==text);
        static bool OpaqueAt(Graphic graphic,Vector3 worldPoint)
        {
            if(!graphic.isActiveAndEnabled||graphic.canvasRenderer.cull||graphic.canvasRenderer.GetInheritedAlpha()<=.01f)return false;
            var mesh=graphic.canvasRenderer.GetMesh();
            if(mesh==null)return false;
                var points=mesh.vertices;var colors=mesh.colors32;var triangles=mesh.triangles;
                Vector2 point=graphic.rectTransform.InverseTransformPoint(worldPoint);
                float Cross(Vector2 a,Vector2 b,Vector2 c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
                for(int index=0;index<triangles.Length;index+=3)
                {
                    int a=triangles[index],b=triangles[index+1],c=triangles[index+2];
                    if(Mathf.Abs(Cross(points[a],points[b],points[c]))<=.001f)continue;
                    if(colors.Length==points.Length&&Mathf.Max(colors[a].a,Mathf.Max(colors[b].a,colors[c].a))<=2)continue;
                    float ab=Cross(points[a],points[b],point),bc=Cross(points[b],points[c],point),ca=Cross(points[c],points[a],point);
                    if(!((ab<-.001f||bc<-.001f||ca<-.001f)&&(ab>.001f||bc>.001f||ca>.001f)))return true;
                }
                return false;
        }
        static string ObjectPath(Transform target)
        {var parts=new List<string>();for(var node=target;node!=null;node=node.parent)parts.Add(node.name);parts.Reverse();return string.Join("/",parts);}
        static object Describe(Button button)=>button==null?null:new{path=ObjectPath(button.transform),active=button.gameObject.activeInHierarchy,
            button.interactable,effective=button.IsInteractable(),groups=button.GetComponentsInParent<CanvasGroup>(true).Select(group=>new{path=ObjectPath(group.transform),group.interactable,group.blocksRaycasts,group.ignoreParentGroups}).ToArray()};
        static void Submit(Button button)
        {
            Records.Add(new{step=_step,kind="submit",target=Describe(button),selection=_session?.Snapshot.RuleHandSelection});
            Require(button!=null&&button.gameObject.activeInHierarchy&&button.IsInteractable(),"button unavailable: "+JsonConvert.SerializeObject(Describe(button)));
            EventSystem.current.SetSelectedGameObject(button.gameObject);Require(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"submit rejected");
        }
        static void Pick(string uid)
        {
            var card=_screen.GetComponentsInChildren<BattleCard>().Single(item=>item.Uid==uid);
            var input=new PointerEventData(EventSystem.current){button=PointerEventData.InputButton.Left,position=RectTransformUtility.WorldToScreenPoint(App.Canvas.worldCamera,card.CardRt.position)};
            ExecuteEvents.Execute(card.gameObject,input,ExecuteEvents.pointerDownHandler);ExecuteEvents.Execute(card.gameObject,input,ExecuteEvents.pointerUpHandler);
        }
        static IEnumerable<object> Flow()
        {
            _step="isolated battle";foreach(var item in Until(()=>!CurrentRunFilm.Active))yield return item;
            OffscreenCapture.PrepareReference();CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();
            Require(Path.GetFullPath(SaveSystem.Dir).StartsWith(Path.GetFullPath(Output),StringComparison.OrdinalIgnoreCase),"profile escaped evidence");
            var g=GameRuntime.I;g.ResetSlot(5);g.NewRun(5,"wu");CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();
            Require(CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out var error),error);
            g.State.ownedCards.Clear();g.State.usedPocket.Clear();g.State.hp=g.State.maxHp=1000;g.State.atk=0;g.State.Phase="idle";
            g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="pouch",card=CardLibrary.FindById("tt3-crimson-pouch").Clone()});
            g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="staff",card=CardLibrary.FindById("tt7-naturestaff").Clone()});
            var payment=Material("payment");payment.type="法术";payment.rules.Get("battle").Values["requirements"]=RuleValue.Arr(RuleValue.Obj("kind","handCards","count",2));
            g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="payment",card=payment});
            for(int i=0;i<12;i++)
            {
                var candidate=i==10?CardLibrary.SHA.Clone():Material("材料"+(i==1?0:i==4?2:i));
                if(i==11)candidate.type="装备";
                g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="m"+i,card=candidate});
            }
            var infusion=Material("infusion");infusion.type="法术";infusion.infuse=2;
            infusion.rules.Get("triggers").Values["onPlay"]=RuleValue.Arr(RuleValue.Obj("op","armor","n",1));
            g.State.ownedCards.Add(new Sdt.Core.OwnedCard{uid="infusion",card=infusion});
            g.Bus.Emit(new BattleRequested{Request=new BattleRequest{Name="手牌原生验收",Foes=new List<EnemyStats>{new EnemyStats{id="material-foe",name="受控敌人",hp=10000,atk=0}}}});
            foreach(var item in Until(()=>UiStack.Top is BattleScreen&&!CurrentRunFilm.Active))yield return item;
            _screen=(BattleScreen)UiStack.Top;_session=BattleViewApi.Session;
            Require(_session.PlayCard("pouch",-1,false).Ok,"equip pouch failed");foreach(var item in Until(Ready))yield return item;
            Require(_session.PlayCard("staff",-1,false).Ok,"equip staff failed");foreach(var item in Until(Ready))yield return item;

            _step="destroyed focus history before selection";
            var destroyedFocus=new GameObject("material-destroyed-focus");destroyedFocus.transform.SetParent(_screen.transform,false);
            UnityEngine.Object.Destroy(destroyedFocus);foreach(var item in Frame())yield return item;
            Require(destroyedFocus==null&&!ReferenceEquals(destroyedFocus,null),"focus fixture did not retain a destroyed Unity wrapper");
            var eventSystem=EventSystem.current;Require(eventSystem!=null,"EventSystem absent");
            // Recreate the stale reference retained by the preceding Standalone pages.
            // Select a live object first so EventSystem's overloaded-null equality cannot skip the assignment.
            eventSystem.SetSelectedGameObject(_screen.gameObject);eventSystem.SetSelectedGameObject(destroyedFocus);
            Require(ReferenceEquals(eventSystem.currentSelectedGameObject,destroyedFocus),"destroyed focus reference was not installed");
            _step="copy draft pick/remove/cancel";Require(_session.UseEquipment("pouch").Ok,"pouch skill failed after destroyed focus");foreach(var item in Until(Ready))yield return item;
            var selection=_session.Snapshot.RuleHandSelection;int before=_session.Snapshot.Hand.Count;
            Require(new[]{"m0","m1"}.All(uid=>_screen.GetComponentsInChildren<BattleCard>().Any(card=>card.Uid==uid&&card.Uids.Count==1)),"same-face UIDs were visually stacked during ordinary selection");
            var priorCancel=Action("取消");eventSystem.SetSelectedGameObject(priorCancel.gameObject);
            Require(selection.act=="copy"&&selection.canCancel,"source effect not cancellable");Pick("m0");
            var currentCancel=Action("取消");
            Require(currentCancel!=priorCancel&&eventSystem.currentSelectedGameObject==currentCancel.gameObject,"rebuild retained destroyed controls or lost valid cancel focus");
            Require(_session.Snapshot.Hand.Count==before&&_session.Snapshot.RuleHandSelection.selectionId==selection.selectionId,"picking applied effect");
            Require(_screen.GetComponentsInChildren<BattleCard>().Single(card=>card.Uid=="m0").MaterialSelected,"picked UID did not stay selected in its ordinary hand slot");
            Require(!_screen.GetComponentsInChildren<RectTransform>().Any(region=>region.name=="infusion-workspace"),"ordinary hand selection incorrectly opened infusion workspace");
            Require(_screen.GetComponentsInChildren<RectTransform>().Any(region=>region.name=="hand-material-selection"),"centered hand-selection controls missing");
            Pick("m0");
            Require(!Action("确定").IsInteractable()&&_session.Snapshot.Hand.Count==before,"deselection changed hand or kept confirmation enabled");
            var staleCancel=Action("取消").onClick;
            Submit(Action("取消"));Require(_session.Snapshot.RuleHandSelection==null&&_session.Snapshot.Hand.Count==before,"cancel applied copy");Record();
            Require(_session.Snapshot.Equipment.Single(item=>item.uid=="pouch").canUse&&_session.UseEquipment("pouch").Ok,"cancel spent equipment usage");
            var reopenedSelection=_session.Snapshot.RuleHandSelection.selectionId;staleCancel.Invoke();
            Require(_session.Snapshot.RuleHandSelection?.selectionId==reopenedSelection,"stale cancel callback cancelled a newly opened selection");
            Pick("m0");Submit(Action("确定"));Require(!_session.Snapshot.Equipment.Single(item=>item.uid=="pouch").canUse,"confirmed copy did not spend equipment usage");

            _step="zeroNext draft confirm and stale callback";Require(_session.UseEquipment("staff").Ok,"staff skill failed");foreach(var item in Until(Ready))yield return item;
            Pick("m0");var oldConfirm=Action("确定").onClick;Submit(Action("确定"));
            Require(_session.FindCard("m0").card.zeroCostUntilTurn==_session.Turn+1,"confirm did not apply next-turn modifier");
            Require(_session.Snapshot.RuleHandSelection==null,"confirmed effect remained open");Record();

            _step="payment draft pages and no cancel";Require(_session.PlayCard("payment",-2,false).Ok,"payment source failed");foreach(var item in Until(Ready))yield return item;
            var paymentId=_session.Snapshot.RuleHandSelection.selectionId;before=_session.Snapshot.Hand.Count;
            Require(_screen.GetComponentsInChildren<BattleCard>().Any(card=>card.Uid=="payment"&&card.Uids.Count==1&&card.Off),"payment source UID must stay visible but ineligible in ordinary hand");
            oldConfirm.Invoke();Require(_session.Snapshot.RuleHandSelection.selectionId==paymentId&&_session.Snapshot.Hand.Count==before,"old selection callback altered payment");
            Require(!Action("取消").IsInteractable(),"mandatory payment cancel should remain visibly disabled");
            Submit(Action("›"));Require(_screen.GetComponentsInChildren<BattleCard>().Any(card=>card.Uid=="m11"),"material next page inaccessible");Submit(Action("‹"));
            Pick("m0");Require(!Action("确定").IsInteractable()&&_session.Snapshot.Hand.Count==before,"partial payment committed");
            Pick("m1");Require(new[]{"m0","m1"}.All(uid=>_screen.GetComponentsInChildren<BattleCard>().Single(card=>card.Uid==uid).MaterialSelected),"same-face payment UIDs did not select independently");
            Require(Mathf.Approximately(_screen.GetComponentsInChildren<BattleCard>().Single(card=>card.Uid=="m2").GetComponent<CanvasGroup>().alpha,1),"ordinary full hand selection dimmed an eligible unpicked card");
            Pick("m0");Require(!_screen.GetComponentsInChildren<BattleCard>().Single(card=>card.Uid=="m0").MaterialSelected&&_screen.GetComponentsInChildren<BattleCard>().Single(card=>card.Uid=="m1").MaterialSelected
                &&_session.Snapshot.Hand.Count==before,"same-face deselection altered its neighbour or resources");
            Pick("m0");var paymentConfirm=Action("确定").onClick;Submit(Action("确定"));
            Require(_session.Snapshot.Hand.Count==before-3&&!_session.Snapshot.Hand.Contains("m0")&&!_session.Snapshot.Hand.Contains("m1"),"payment did not consume source and two UIDs once");
            int after=_session.Snapshot.Hand.Count;paymentConfirm.Invoke();Require(_session.Snapshot.Hand.Count==after,"stale payment repeated consumption");Record();

            _step="real infusion has its distinct workspace";var infusionStart=_session.PlayCard("infusion",-2,false);Require(!infusionStart.Ok&&infusionStart.Reason=="select infusion","real infusion source did not request selection");foreach(var item in Until(Ready))yield return item;
            Require(_session.Snapshot.Infusing?.Uid=="infusion"&&_session.Snapshot.RuleHandSelection==null,"fixture did not enter actual infusion");
            var sourceFace=_screen.GetComponentsInChildren<RectTransform>().Single(region=>region.name=="infusion-source-card");
            Require(_screen.GetComponentsInChildren<RectTransform>().Any(region=>region.name=="infusion-workspace")
                &&!_screen.GetComponentsInChildren<RectTransform>().Any(region=>region.name=="hand-material-selection"),"actual infusion did not own workspace independently");
            var shortcutUids=HandPanel.InfusionKeys(_session.Snapshot,BattleView.Api);
            var visibleUids=_screen.GetComponentsInChildren<BattleCard>().OrderBy(card=>card.DisplayIndex).Select(card=>card.Uid).ToArray();
            Require(shortcutUids[0]=="m10"&&shortcutUids[1]=="m2"&&shortcutUids[2]=="m4"
                &&visibleUids[0]=="m10"&&visibleUids[1]=="m2","mixed-category visual order and shortcut order do not share source starter/move rank");
            Submit(Action("下一页"));
            var lastPage=_screen.GetComponentsInChildren<BattleCard>().OrderBy(card=>card.DisplayIndex).ToArray();
            Require(lastPage.Last().Uid=="m11"&&shortcutUids.Last()=="m11","equipment candidate was not last in visual and shortcut category order");
            Submit(Action("上一页"));
            BattleView.Commands.SelectInfusion(shortcutUids[2]);Require(_session.Snapshot.Infusing.Picked.SequenceEqual(new[]{"m4"}),"shortcut projection did not select hidden same-face physical UID");
            Require(HandPanel.InfusionKeys(_session.Snapshot,BattleView.Api)[2]=="m4","selected UID lost its original shortcut position");
            BattleView.Commands.SelectInfusion(shortcutUids[2]);Require(_session.Snapshot.Infusing.Picked.Count==0,"original shortcut did not return the selected physical UID");
            Pick("m2");Require(_session.Snapshot.Infusing.Picked.SequenceEqual(new[]{"m2"}),"actual infusion did not select exact UID");
            Require(_screen.GetComponentsInChildren<RectTransform>().Single(region=>region.name=="infusion-source-card")==sourceFace,"picking material rebuilt source card and lost reading state");
            Require(_screen.GetComponentsInChildren<RectTransform>().Any(region=>region.name=="infusion-selected-gold-border")
                &&_screen.GetComponentsInChildren<Text>().Any(text=>text.text=="↙")&&_screen.GetComponentsInChildren<Text>().Any(text=>text.name=="infusion-page-count"),"real infusion source border/return cue/pager absent");
            Require(Action("确认注能").GetComponent<LayoutElement>().minWidth==290&&Action("返回").GetComponent<LayoutElement>().minWidth==154,"actual infusion action sizes differ from source");
            var remove=_screen.GetComponentsInChildren<RectTransform>().Single(region=>region.name=="infusion-selected-cards").GetComponentInChildren<Button>();
            Canvas.ForceUpdateCanvases();
            var selectedBorder=remove.GetComponentsInChildren<RectTransform>().Single(region=>region.name=="infusion-selected-gold-border");
            var centre=selectedBorder.TransformPoint(selectedBorder.rect.center);
            Require(selectedBorder.GetComponentsInChildren<Graphic>().All(graphic=>!OpaqueAt(graphic,centre)),"selected material decoration covers the card centre");
            var selectedPaper=remove.transform.Find("paper-card");
            Require(selectedPaper!=null&&selectedPaper.gameObject.activeInHierarchy
                &&selectedPaper.GetComponentsInChildren<Text>().Any(text=>text.isActiveAndEnabled&&text.text==_session.FindCard("m2").card.name)
                &&selectedPaper.GetComponentsInChildren<Image>().Any(image=>image.isActiveAndEnabled&&image.sprite!=null&&image.color.a>0),"selected material lost its original card face");
            var extraPicked=new List<string>();
            while(_session.Snapshot.Infusing.Picked.Count<_session.Snapshot.Infusing.Need)
            {
                string uid=_screen.GetComponentsInChildren<BattleCard>().First(card=>!card.Off).Uid;extraPicked.Add(uid);BattleView.Commands.SelectInfusion(uid);
            }
            foreach(var candidate in _screen.GetComponentsInChildren<BattleCard>())
            {
                Require(Mathf.Approximately(candidate.GetComponent<CanvasGroup>().alpha,.6f),"full infusion candidate did not dim to source opacity");
                candidate.ApplyPose(1,Vector2.zero);Require(Mathf.Approximately(candidate.GetComponent<CanvasGroup>().alpha,.6f),"hover removed full infusion opacity");candidate.ApplyPose(0,Vector2.zero);
            }
            foreach(string uid in extraPicked)BattleView.Commands.SelectInfusion(uid);
            if(extraPicked.Count>0)Require(_screen.GetComponentsInChildren<BattleCard>().Where(card=>!card.Off).All(card=>Mathf.Approximately(card.GetComponent<CanvasGroup>().alpha,1)),"returning infusion material did not restore eligible candidates");
            remove=_screen.GetComponentsInChildren<RectTransform>().Single(region=>region.name=="infusion-selected-cards").GetComponentInChildren<Button>();
            Submit(remove);Require(_session.Snapshot.Infusing.Picked.Count==0,"actual infusion return did not deselect UID");Submit(Action("返回"));Require(_session.Snapshot.Infusing==null,"actual infusion cancellation failed");Record();

            _step="current atlas and sound policy";
            var slash=BattleArtFx.Cell("slash");var boss=BattleArtFx.Cell("boss");Require(slash!=null&&boss!=null&&slash.texture==boss.texture&&slash.rect.x==0&&boss.rect.x>0&&boss.rect.y==0,"source atlas missing or row mapping wrong");
            Require(CurrentBattleSoundPolicy.HitKey("spell","火箭",false)=="attackFire"&&CurrentBattleSoundPolicy.HitKey("spell","普通法术",false)=="attackPsychic"&&CurrentBattleSoundPolicy.HitKey("attack","火焰",true)=="hurt","source audio precedence changed");
            Require(_screen.GetComponentsInChildren<Text>().All(text=>text.name!="sts-float"),"retired numeric float renderer still active");
            foreach(var item in Frame())yield return item;
            Record();
        }
        static void Record(){Records.Add(new{step=_step,elapsed=Now-_start,hand=_session.Snapshot.Hand.Count});}
        static void Finish(Exception error)
        {
            if(!SessionState.GetBool(Active,false))return;SessionState.SetBool(Active,false);
            File.WriteAllText(Path.Combine(Output,"result.json"),JsonConvert.SerializeObject(new{passed=error==null,error=error?.ToString(),step=_step,records=Records,
                scope="Controlled native production battle; constructed pointer/submit input; ordinary in-place material drafts distinct from real infusion workspace; exact UID payment; current FX atlas and source audio-key policy",
                limitations=new[]{"No OS hardware input or listening claim.","Audio output timing is covered by the presentation queue and AudioService checks.","No standalone or multi-size visual clarity claim."}},Formatting.Indented));EditorApplication.Exit(error==null?0:2);
        }
    }
}
