using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Run
{
    public partial class EventDialogScreen
    {
        readonly HashSet<string> _eventSelection = new HashSet<string>();
        EventOutcome _outcome;
        string _eventFeedback;
        bool _initializationBlocked, _battleEntryFailed;
        internal override void OnClose() { }
        public override void CloseFromEscape() => LeaveCurrentEvent();

        bool RenderCurrentEvent()
        {
            var runtime = GameRuntime.I;
            if (_outcome == null)
            {
                if (EventDatabase.Find(_card.id) == null) return false;
                _initializationBlocked = true;
                _eventFeedback = "事件初始化未保存，原存档与操作前状态已保留。";
                if (!string.IsNullOrEmpty(runtime.Saves.LastError)) _eventFeedback += "\n" + runtime.Saves.LastError;
                UIKit.Label(BodyRoot, _eventFeedback, 17, UiPalette.Warn);
                EventOptButton.Create(BodyRoot, "重试初始化", "重新尝试保存，成功后继续本次事件", "ok", Rebuild);
                UIKit.Btn(FootRoot, "返回地图", LeaveCurrentEvent);
                return true;
            }
            if (_initializationBlocked) _eventFeedback = null;
            _initializationBlocked = false;

            if (!string.IsNullOrEmpty(_outcome.Message)) UIKit.Label(BodyRoot, _outcome.Message, 16, Theme.Sub);
            if (!string.IsNullOrEmpty(_eventFeedback) && _eventFeedback != _outcome.Message) UIKit.Label(BodyRoot, _eventFeedback, 16, UiPalette.Warn);
            if (_outcome.PreviewCardIds != null && _outcome.PreviewCardIds.Count > 0)
            {
                UIKit.Label(BodyRoot, "本次赌约的奖品", 16, Theme.Sub);
                foreach (var id in _outcome.PreviewCardIds)
                {
                    var preview = CardLibrary.FindById(id);
                    if (preview != null) CardFace.Create(preview, CardSize.Md, BodyRoot);
                }
            }
            if(_outcome.Stage=="dice")
            {
                var progress=runtime.CurrentNodeReceipt.eventProgress;var saved=progress.dice[progress.diceIndex];
                var holder=CurrentNodeElements.Rect(BodyRoot,"event-dice-holder");var centering=UIKit.GetOrAdd<HorizontalLayoutGroup>(holder);centering.childAlignment=TextAnchor.UpperCenter;centering.childForceExpandWidth=centering.childForceExpandHeight=false;centering.childControlWidth=centering.childControlHeight=true;var panel=CurrentNodeElements.Rect(holder,"event-dice-panel");var bounds=UIKit.GetOrAdd<LayoutElement>(panel);bounds.preferredWidth=560;bounds.flexibleWidth=0;var bg=UIKit.GetOrAdd<Image>(panel);bg.color=Theme.HexA("#0b1624",.96f);
                var layout=UIKit.GetOrAdd<VerticalLayoutGroup>(panel);layout.padding=new RectOffset(20,20,16,20);layout.spacing=12;layout.childControlWidth=layout.childControlHeight=true;layout.childForceExpandWidth=true;layout.childForceExpandHeight=false;
                var die=CurrentIllustratedDice.Create(panel,saved.result);
                var result=CurrentNodeElements.Text(panel,"event-dice-result",saved.result.HasValue?_outcome.Message:"D6 · 等待投骰",18,"#ffe1a0",true);result.alignment=TextAnchor.MiddleCenter;
                CurrentNodeElements.Button(panel,(_diceRulesOpen?"▾ ":"▸ ")+"点数与结果",()=>{if(!_eventBusy){_diceRulesOpen=!_diceRulesOpen;Rebuild();}});
                if(_diceRulesOpen&&_outcome.DiceLabels!=null)foreach(var label in _outcome.DiceLabels)CurrentNodeElements.Text(panel,"event-dice-rule",label,16,"#f3f5f7");
                if(!saved.result.HasValue)CurrentNodeElements.Button(panel,"投掷骰子",()=>
                {
                    if(!EventLive||_eventBusy)return;_eventBusy=true;var outcome=runtime.RollCurrentEventDice();var now=runtime.CurrentNodeReceipt.eventProgress.dice[progress.diceIndex];
                    if(!now.result.HasValue){_eventBusy=false;AcceptEventOutcome(outcome);return;}
                    foreach(var button in GetComponentsInChildren<Button>())button.interactable=false;
                    AudioService.I.PlaySfx("scene");die.Roll(now.result.Value,()=>{if(this!=null){_eventBusy=false;AcceptEventOutcome(outcome);}});
                },true);
                else CurrentNodeElements.Button(panel,"确认结果，继续",()=>RunCurrent(()=>runtime.ApplyCurrentEventChoice("__dice_continue")),true);
                CurrentNodeElements.Button(panel,"返回地图",LeaveCurrentEvent);return true;
            }
            if (_outcome.Stage == "complete")
            {
                if (_outcome.Battle != null || (_outcome.Chests != null && _outcome.Chests.Count > 0))
                    EventOptButton.Create(BodyRoot, _outcome.Battle != null ? _battleEntryFailed ? "重试进入战斗" : "进入战斗" : "领取奖励", "继续处理本次事件", "ok", () => AcceptEventOutcome(_outcome));
                else EventOptButton.Create(BodyRoot, "返回地图", "事件已结算", "", LeaveCurrentEvent);
                return true;
            }
            foreach (var choice in _outcome.Choices)
            {
                string key = choice.EffectKey;
                string detail=choice.Detail;bool disabled=choice.Disabled;CardDef capacityCard=null;
                if(_outcome.Stage=="choices")
                {
                    var layers=EventDatabase.Find(_card.id)?.Items("layers");
                    var specs=layers!=null?(layers[Math.Max(0,Math.Min(3,runtime.State.layerIdx))] as object[]??Array.Empty<object>()).OfType<RuleValue>():Enumerable.Empty<RuleValue>();
                    var spec=specs.FirstOrDefault(item=>item.Text("key")==key);
                    if(spec!=null){bool entry=spec.Operations("operations").Any(op=>op.Text("op")=="route"&&op.Text("kind")=="quartermaster");capacityCard=CardLibrary.FindById(spec.Text("capacityCard"));var state=CurrentEventOptionState.Read(runtime.State.hp,runtime.State.coins,spec.Number("healthCost"),spec.Number("coinCost"),entry,capacityCard==null?(bool?)null:runtime.CanReceiveCard(capacityCard));detail=spec.Text("detail","")+(state.note.Length>0?"；"+state.note:"")+(state.state!="ready"?"\n<color=#985e59>"+state.stateLabel+"</color>":"");disabled=state.disabled;}
                }
                var button = EventOptButton.Create(BodyRoot, choice.Label, detail, choice.Tone,
                    ()=>{if(capacityCard!=null&&!runtime.CanReceiveCard(capacityCard))CurrentRewardCapacityOrganizer.Open(new CurrentRewardItem{Card=capacityCard,Claim=()=>RunCurrent(()=>runtime.ApplyCurrentEventChoice(key))},this);else RunCurrent(()=>runtime.ApplyCurrentEventChoice(key));});
                button.interactable = !disabled;
            }
            if (_outcome.CanLeave) UIKit.Btn(FootRoot, "返回地图", LeaveCurrentEvent);
            return true;
        }

        void AcceptEventOutcome(EventOutcome outcome)
        {
            if (!EventLive || outcome == null) return;
            bool changed = _outcome?.Stage != outcome.Stage;
            _outcome = outcome;
            _eventFeedback = outcome.Message;
            if (changed) _eventSelection.Clear();
            var runtime = GameRuntime.I;
            if (outcome.Battle != null)
            {
                if (runtime.StartEventBattle(outcome.Battle)) { _battleEntryFailed = false; Close(); }
                else
                {
                    _battleEntryFailed = true;
                    _eventFeedback = "战斗尚未成功进入，本次事件进度已保留，请重试。";
                    if (!string.IsNullOrEmpty(runtime.Saves.LastError)) _eventFeedback += "\n" + runtime.Saves.LastError;
                    Rebuild();
                }
                return;
            }
            if (outcome.Chests != null && outcome.Chests.Count > 0)
            {
                Close(); ChestOpenScreen.OpenPending(runtime.FinishNode); return;
            }
            if (outcome.Settled) { Close(); return; }
            Rebuild();
        }

        void LeaveCurrentEvent()
        {
            var runtime = GameRuntime.I;
            if(!EventLive||_eventBusy)return;
            if (_poolExhausted)
            {
                if (!runtime.TryPersistMutation(() => runtime.FinishNode(), out var reason))
                { RunLog.Log(reason, "warn"); return; }
                Close();
                return;
            }
            var current = runtime.GetCurrentEventOutcome();
            if (EventDatabase.Find(_card.id) == null)
            {
                if(!runtime.TryPersistMutation(runtime.FinishNode,out var error)){_eventFeedback=error;Rebuild();return;}
                Close();return;
            }
            if (current == null)
            {
                runtime.State.Phase = "idle";
                Close();
                return;
            }
            if (current != null && !current.CanLeave && !current.Settled) return;
            var result = GameRuntime.I.ApplyCurrentEventChoice("__leave");
            if (result == null) return;
            if (!result.Settled) { _eventFeedback = result.Message; Rebuild(); return; }
            Close();
        }
#if UNITY_EDITOR
        public bool ValidationInitializationBlocked => _initializationBlocked;
        public bool ValidationBattleEntryFailed => _battleEntryFailed;
        public string ValidationFeedback => _eventFeedback;
        public void ValidationRetryInitialization() => Rebuild();
        public void ValidationAcceptOutcome(EventOutcome outcome) => AcceptEventOutcome(outcome);
        public void ValidationLeaveEvent() => LeaveCurrentEvent();
#endif
    }
}
