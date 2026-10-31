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
        bool _poolExhausted,_eventBusy,_diceRulesOpen=true;
        string _node;int? _seed;
        CurrentRewardScene _reward;
        bool EventLive=>GameRuntime.I.State.runActive&&GameRuntime.I.State.seed==_seed&&GameRuntime.I.CurrentNodeId==_node&&UiStack.Top==this;
        void Bind(){_node=GameRuntime.I.CurrentNodeId;_seed=GameRuntime.I.State.seed;}
        void RunCurrent(Func<EventOutcome> command)
        {
            if(!EventLive||_eventBusy)return;_eventBusy=true;var runtime=GameRuntime.I;var state=runtime.State;int before=state.hp,maxBefore=state.maxHp,fragments=state.fragments;var parent=transform.parent;string node=_node,source=_card?.name;
            try
            {
                AcceptEventOutcome(command());
                if(parent!=null&&state.runActive&&state.Phase=="idle"&&state.hp>before)
                {
                    string extra=string.Join(" · ",new[]{state.maxHp>maxBefore?"生命上限 +"+(state.maxHp-maxBefore):null,state.fragments>fragments?"员工通行证A碎片 +"+(state.fragments-fragments):null}.Where(text=>text!=null));
                    CurrentOutcomeFeedback.Play(parent,"heal",before,state.hp,state.maxHp,new CardDef[0],null,source,extra,()=>runtime.State==state&&state.runActive&&state.Phase=="idle"&&runtime.CurrentNodeId==node);
                }
            }
            finally{_eventBusy=false;}
        }
        public override void Build()
        {
            var runtime=GameRuntime.I;
            if(!_poolExhausted&&_card!=null){runtime.GetEventChoices(_card.id);_outcome=runtime.GetCurrentEventOutcome();}
            if(TryRenderRecodeResult())return;
            bool cards=_outcome?.CardIds!=null&&_outcome.CardIds.Count>0&&_outcome.CardKeys!=null;
            if(cards)
            {
                if(_illustrated!=null)_illustrated.gameObject.SetActive(false);
                if(_reward==null)_reward=CurrentRewardScene.Create(transform);_reward.gameObject.SetActive(true);_reward.OnResume=()=>{runtime.State.Phase="modal";Build();};
                BuildCardChoices();return;
            }
            if(_reward!=null)_reward.gameObject.SetActive(false);if(_illustrated!=null)_illustrated.gameObject.SetActive(true);base.Build();
        }
        void BuildCardChoices()
        {
            var runtime=GameRuntime.I;var state=_outcome;
            _eventSelection.IntersectWith(state.CardKeys);
            string source=_card.id=="ev19-potions"?"应急药品站":_card.id=="ev19-quartermaster"?"转运军需":Title;
            string rule=_card.id=="ev19-potions"?"庇护所的存量有限——从 3 瓶随机药水中选择 1 瓶。":_card.id=="ev19-quartermaster"?"已支付 3 币转运费。从货位上的 3 件装备中选择 1 件。":state.Message;
            _reward.Set("选择 "+state.Need+" 张",source,_eventFeedback,rule);_reward.ClearActions();
            var items=new List<CurrentRewardItem>();
            for(int i=0;i<Math.Min(state.CardIds.Count,state.CardKeys.Count);i++)
            {
                string key=state.CardKeys[i];var card=CardLibrary.FindById(state.CardIds[i]);if(card==null)continue;
                string route=runtime.CurrentNodeReceipt.eventProgress?.route;bool acquiring=state.Stage!="sources"&&route!="trade"&&route!="recode";
                items.Add(new CurrentRewardItem{Key=key+":"+card.id,Card=card,Choice=true,ExplicitMode=false,Organize=_card.id=="ev19-potions"||_card.id=="ev19-quartermaster",Fits=!acquiring||card.id=="tt2-apollo"&&_card.id=="ev19-quartermaster"||runtime.CanReceiveCard(card),ClaimLabel=state.Need>1?(_eventSelection.Contains(key)?"✓ 已选择":"选择"):null,Claim=()=>
                {
                    if(!EventLive||_eventBusy)return;
                    if(state.Need==1)RunCurrent(()=>runtime.SubmitEventSelection(new List<string>{key}));
                    else {if(!_eventSelection.Remove(key)&&_eventSelection.Count<state.Need)_eventSelection.Add(key);Build();}
                }});
            }
            _reward.Sync(items);CurrentNodeElements.Text(_reward.Info,"event-capacity","[[icon:bag]] "+runtime.UsedSlots()+"/"+runtime.BagCap+" 格",18,"#becbc9");
            CurrentNodeElements.Button(_reward.Info,"整理背包",()=>{if(EventLive&&!_eventBusy)runtime.Bus.Emit(new BagOpened());});
            if(state.Need>1){var confirm=CurrentNodeElements.Button(_reward.Actions,"确认选择 "+_eventSelection.Count+"/"+state.Need,()=>RunCurrent(()=>runtime.SubmitEventSelection(_eventSelection.ToList())),true);confirm.interactable=_eventSelection.Count==state.Need;}
            CurrentNodeElements.Button(_reward.Actions,"返回地图",LeaveCurrentEvent);
        }

        public static void OpenPoolExhausted()
        {
            var s = ScreenMount.Show<EventDialogScreen>("EventPoolExhausted");
            s.Bind();s._poolExhausted = true; s.Tone = "event";
            s.TitleIcon = "[[icon:notes]]"; s.Title = "此处已无新的见闻";
            s.Build();
        }

        public static void Open(CardDef card, NarrativeService service)
        {
            var st = GameRuntime.I.State;
            st.eventLog = st.eventLog ?? new System.Collections.Generic.List<EventLogEntry>();
            var encounter=Sdt.Res.CurrentNodeAssets.EncounterText(card.id,st.characterId??st.myClass);
            string encounterName=string.IsNullOrEmpty(encounter.name)?card.name:encounter.name;
            if (!st.eventLog.Any(entry => entry.id == card.id && entry.turn == st.turn))
                st.eventLog.Add(new EventLogEntry { id = card.id, name = encounterName, desc = card.desc ?? "", turn = st.turn });
            RunLog.Log("[[icon:dice]] 触发事件【<b>" + card.name + "</b>】" + (string.IsNullOrEmpty(card.desc) ? "" : "· " + card.desc), "sys");
            AudioService.I.PlaySfx("scene");

            var s = ScreenMount.Show<EventDialogScreen>("EventDialog");
            s.Bind();s._card = card; s._service = service;
            s._narrative = service != null && service.HasEvent(card.id) ? service.OpenEvent(card.id) : null;
            s.Tone = "event";
            // SceneCopy.EVENT_SCENE_META 是 KeyValuePair 数组（无 TryGetValue）：find card.id 取 meta[2]，找不到回落 scene-event-custom
            var metaKv = SceneCopy.EVENT_SCENE_META.FirstOrDefault(kv => kv.Key == card.id);
            s.AssetKey = metaKv.Key != null && metaKv.Value != null ? metaKv.Value[2] : "scene-event-custom";
            s.TitleIcon = "[[icon:dice]]"; s.Title = encounterName;
            s.AssetKey=Sdt.Res.CurrentNodeAssets.EventAsset(card.id);
            s.Build();
        }

        protected string _intro;

        protected override void OnPrepare()
        {
            if (_poolExhausted) { Sub = "本局的事件已经全部遇见。"; return; }
            // sub：narrative.intro（首段）或卡描述兜底
            _intro = _narrative != null && _narrative.Paragraphs.Count > 0 ? _narrative.Paragraphs[0] : (_card.desc ?? "神秘事件发生了……");
            var encounter=Sdt.Res.CurrentNodeAssets.EncounterText(_card.id,GameRuntime.I.State.characterId??GameRuntime.I.State.myClass);
            if(!string.IsNullOrEmpty(encounter.name))Title=encounter.name;
            if(!string.IsNullOrEmpty(encounter.intro))_intro=encounter.intro;
            Sub = _intro;
            var progress=GameRuntime.I.CurrentNodeReceipt.eventProgress;
            if(progress?.stage=="dice")
            {
                Title=_card.name;
                if(progress.drawPools!=null)
                {
                    string route=progress.route;string heading=route=="potions"?"应急药品站":route=="quartermaster"?"转运军需":route=="gamble"?"暗巷赌约":_card.name;
                    var layers=EventDatabase.Find(_card.id)?.Items("layers");var specs=layers==null?Enumerable.Empty<RuleValue>():(layers[Math.Max(0,Math.Min(3,GameRuntime.I.State.layerIdx))] as object[]??Array.Empty<object>()).OfType<RuleValue>();
                    var draw=specs.FirstOrDefault(spec=>spec.Text("key")==progress.choiceKey)?.Operations("operations").FirstOrDefault(op=>op.Text("op")=="drawCards");if(draw!=null&&!string.IsNullOrEmpty(draw.Text("title")))heading=draw.Text("title");
                    Title=heading+" · 第 "+(progress.drawn.Count+1)+"/"+progress.drawPools.Count+" 张";
                }
                Sub="当前节点可返回重进，投骰结果不变；前往下一节点后事件结束。";
            }
        }

        protected override void OnBody()
        {
            if (_poolExhausted)
            {
                EventOptButton.Create(BodyRoot, "继续前进", "返回地图", "", LeaveCurrentEvent);
                return;
            }
            CurrentEncounterOpening.Create(BodyRoot, _card?.id);
            if (RenderCurrentEvent()) return;

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
