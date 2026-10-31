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
            var choices = runtime.GetEventChoices(_card.id);
            _outcome = runtime.GetCurrentEventOutcome();
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
            if (!string.IsNullOrEmpty(_outcome.Title)) UIKit.Label(BodyRoot, _outcome.Title, 21, Theme.Txt);
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
            if (_outcome.Stage == "complete")
            {
                if (_outcome.Battle != null || (_outcome.Chests != null && _outcome.Chests.Count > 0))
                    EventOptButton.Create(BodyRoot, _outcome.Battle != null ? _battleEntryFailed ? "重试进入战斗" : "进入战斗" : "领取奖励", "继续处理本次事件", "ok", () => AcceptEventOutcome(_outcome));
                else EventOptButton.Create(BodyRoot, "返回地图", "事件已结算", "", Close);
                return true;
            }
            if (_outcome.Stage == "dice" && !_outcome.Choices.Any(choice => choice.EffectKey == "__dice_continue"))
            {
                if (_outcome.DiceLabels != null) foreach (var label in _outcome.DiceLabels) UIKit.Label(BodyRoot, label, 17, Theme.Txt);
                EventOptButton.Create(BodyRoot, "投掷骰子", "投骰后保存已确定的结果", "ok", () => AcceptEventOutcome(runtime.RollCurrentEventDice()));
            }
            if (_outcome.CardIds != null && _outcome.CardIds.Count > 0 && _outcome.CardKeys != null)
            {
                _eventSelection.IntersectWith(_outcome.CardKeys);
                UIKit.Label(BodyRoot, "已选 " + _eventSelection.Count + "/" + _outcome.Need, 17, Theme.Sub);
                for (int index = 0; index < Math.Min(_outcome.CardIds.Count, _outcome.CardKeys.Count); index++)
                {
                    var card = CardLibrary.FindById(_outcome.CardIds[index]);
                    string key = _outcome.CardKeys[index];
                    if (card != null) CardFace.Create(card, CardSize.Md, BodyRoot);
                    UIKit.Btn(BodyRoot, (_eventSelection.Contains(key) ? "[已选] " : "选择 ") + (card?.name ?? _outcome.CardIds[index]), () =>
                    {
                        if (!_eventSelection.Remove(key) && _eventSelection.Count < _outcome.Need) _eventSelection.Add(key);
                        Rebuild();
                    });
                }
                var confirm = UIKit.BtnOk(BodyRoot, "确认选择", () => AcceptEventOutcome(runtime.SubmitEventSelection(_eventSelection.ToList())));
                confirm.interactable = _eventSelection.Count == _outcome.Need;
            }
            var shownChoices = _outcome.Choices != null && _outcome.Choices.Count > 0 ? _outcome.Choices
                : _outcome.Stage == "choices" ? choices : new List<Sdt.Run.EventChoice>();
            foreach (var choice in shownChoices)
            {
                string key = choice.EffectKey;
                var button = EventOptButton.Create(BodyRoot, choice.Label, choice.Detail, choice.Tone,
                    () => AcceptEventOutcome(runtime.ApplyCurrentEventChoice(key)));
                button.interactable = !choice.Disabled;
            }
            if (_outcome.CanLeave) UIKit.Btn(FootRoot, "返回地图", LeaveCurrentEvent);
            return true;
        }

        void AcceptEventOutcome(EventOutcome outcome)
        {
            if (outcome == null) return;
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
            if (_poolExhausted)
            {
                if (!runtime.TryPersistMutation(() => runtime.FinishNode(), out var reason))
                { RunLog.Log(reason, "warn"); return; }
                Close();
                return;
            }
            var current = runtime.GetCurrentEventOutcome();
            if (current == null && EventDatabase.Find(_card.id) != null)
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
