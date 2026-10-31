using System.Collections.Generic;
// ported from src/game.run.js triggerEventCard()/eventChoiceSpec() + src/narrative.js
//
// 原界面 DOM 结构 → uGUI 控件树映射（nodeShell 'event' 变体 + .evt-opt）：
//   nodeShell(tone=event, asset=EVENT_SCENE_META[card.id][2], icon=[[icon:dice]], title=card.name)
//     span.sub = narrative.intro || card.desc       → 面板副标题
//     .node-main = ink 段落列表（EventNarrative.Paragraphs，逐段 Label）
//                  + 选项条按钮列表（.evt-opt，tone meta 影响样式：ok→薄荷 / danger→朱红）
//                  无选项时单个「继 续」按钮（evtNext → applyEventEffect）
//   选择后：NarrativeService.Choose 推进 → 结果文本走 ToastRequested 日志 → effect 结算表。
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;
using Sdt.Narrative;

using Sdt.Run;
using EventChoice = Sdt.Narrative.EventChoice;
namespace Sdt.UI.Screens.Run
{
    /// <summary>
    /// ink 事件对话页：消费 NarrativeService（契约签名见 NarrativeService.cs）。
    /// 选项 meta 的 effect 命中 eventChoiceSpec 的 effects 表则按源码结算，未命中仅 narrate 后收尾。
    /// </summary>
    public partial class EventDialogScreen : NodeShellPanel
    {
        CardDef _card;
        EventNarrative _narrative;
        NarrativeService _service;
        bool _poolExhausted;

        public static void OpenPoolExhausted()
        {
            var s = ScreenMount.Show<EventDialogScreen>("EventPoolExhausted");
            s._poolExhausted = true; s.Tone = "event";
            s.TitleIcon = "[[icon:notes]]"; s.Title = "此处已无新的见闻";
            s.Build();
        }

        public static void Open(CardDef card, NarrativeService service)
        {
            var st = GameRuntime.I.State;
            st.eventLog = st.eventLog ?? new System.Collections.Generic.List<EventLogEntry>();
            if (!st.eventLog.Any(entry => entry.name == card.name && entry.turn == st.turn))
                st.eventLog.Add(new EventLogEntry { id = card.id, name = card.name, desc = card.desc ?? "", turn = st.turn });
            RunLog.Log("[[icon:dice]] 触发事件【<b>" + card.name + "</b>】" + (string.IsNullOrEmpty(card.desc) ? "" : "· " + card.desc), "sys");
            AudioService.I.PlaySfx("scene");

            var s = ScreenMount.Show<EventDialogScreen>("EventDialog");
            s._card = card; s._service = service;
            s._narrative = service != null && service.HasEvent(card.id) ? service.OpenEvent(card.id) : null;
            s.Tone = "event";
            // SceneCopy.EVENT_SCENE_META 是 KeyValuePair 数组（无 TryGetValue）：find card.id 取 meta[2]，找不到回落 scene-event-custom
            var metaKv = SceneCopy.EVENT_SCENE_META.FirstOrDefault(kv => kv.Key == card.id);
            s.AssetKey = metaKv.Key != null && metaKv.Value != null ? metaKv.Value[2] : "scene-event-custom";
            s.TitleIcon = "[[icon:dice]]"; s.Title = card.name;
            s.Build();
        }

        protected string _intro;

        protected override void OnPrepare()
        {
            if (_poolExhausted) { Sub = "本局的事件已经全部遇见。"; return; }
            // sub：narrative.intro（首段）或卡描述兜底
            _intro = _narrative != null && _narrative.Paragraphs.Count > 0 ? _narrative.Paragraphs[0] : (_card.desc ?? "神秘事件发生了……");
            Sub = _intro;
        }

        protected override void OnBody()
        {
            if (_poolExhausted)
            {
                EventOptButton.Create(BodyRoot, "继续前进", "返回地图", "", LeaveCurrentEvent);
                return;
            }
            if (RenderCurrentEvent()) return;

            var line = UIKit.Label(BodyRoot, _intro, 16, UiPalette.Hex("#D8E4EC"));
            line.alignment = TextAnchor.UpperLeft;
            var le = line.gameObject.AddComponent<LayoutElement>(); le.minHeight = 44; le.flexibleHeight = 0;

            if (_narrative != null && _narrative.Choices.Count > 0)
            {
                // ink 选项条：tone meta → 按钮样式；detail → 后果说明行
                foreach (var choice in _narrative.Choices)
                {
                    var tone = choice.Tone == "ok" || choice.Tone == "danger" ? choice.Tone : "";
                    var c = choice;
                    EventOptButton.Create(BodyRoot, c.Label, string.IsNullOrEmpty(c.Detail) ? null : c.Detail, tone, () => OnChoose(c));
                }
            }
            else
            {
                EventOptButton.Create(BodyRoot, "继 续", null, "ok", () => { Close(); ApplyEventEffect(_card); });
            }
        }

        void OnChoose(EventChoice choice)
        {
            // narrate()：推进 ink，结果文本进日志
            string resultText = null;
            var next = _service.Choose(_narrative, choice.ChoiceIndex);
            if (next != null && next.Paragraphs.Count > 0) resultText = string.Join("\n", next.Paragraphs);
            _narrative = next != null && next.Choices.Count > 0 ? next : null;
            if (!string.IsNullOrEmpty(resultText)) RunLog.Log("[[icon:notes]] " + resultText, "sys");

            RunEffect(choice.Effect, resultText);
        }

        // 效果结算统一走数据层 ApplyEventChoice（= 真源 eventChoiceSpec effects 表）：
        // settle 分支回待机并存档；宝箱走 OpenChestsOnCell→NodeEntered；战斗走 BattleRequested
        void RunEffect(string effect, string narrateResult)
        {
            Close();
            GameRuntime.I.ApplyEventChoice(effect);
        }

        // applyEventEffect：未迁移/自定义事件卡的兜底
        void ApplyEventEffect(CardDef card)
        {
            LeaveCurrentEvent();
        }
    }
}
