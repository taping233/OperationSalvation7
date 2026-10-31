// 掷骰主循环桥（game.run.js resolveCell 的 UI 呈现侧；主会话 2026-09-06）
//   NodeEntered 分发到各节点屏：战斗格→开战、商店/火堆→过场屏进店/休息、即时格→拾取过场、
//   门/祭坛入口/紧急撤离→节点模态、事件卡→事件对话。
//   收尾链：NodeShellPanel.Close / ShopScreen 离开 / 过场屏 onDone → GameRuntime.FinishNode()（回待机并存档）。
// 当前四层节点地图通过 NodeMovementCompleted 通知 View 更新位置。
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.Narrative;
using System.Linq;

namespace Sdt.Boot
{
    /// <summary>落脚呈现：按 NodeResult.Kind 分发到对应屏（Present(node) 的消费端）。</summary>
    public static class RunLoopBridge
    {
        static bool _installed;
        static NarrativeService _narrative;
        public static void Install()
        {
            if (_installed) return;
            _installed = true;
            var g = GameRuntime.I;
            var narrativeJson = Sdt.Res.Res.NarrativeJson;
            if (narrativeJson != null) _narrative = new NarrativeService(narrativeJson.text);
            g.Bus.On<NodeEntered>(e => PresentNode(g, e != null ? e.Node : null));
            g.Bus.On<ClassChoiceOpened>(_ => ClassChoiceScreen.Open());
            g.Bus.On<BagOpened>(_ => Sdt.UI.Screens.Bag.BagScreen.Open());
            g.Bus.On<HubOpened>(e => Sdt.UI.Screens.Hub.HubScreen.Open(e?.Tab));
            g.Bus.On<RunEnded>(e =>
            {
                if (e?.Reason != "dead" || g.ActiveSlot == null) return;
                var result = g.Saves.GetSettlement(g.ActiveSlot.Value)?.death;
                if (result == null) return;
                while (UiStack.Count > 0) UiStack.Pop();
                DeathScreen.Open(result.SavedN, string.Join("、", result.SavedStacks.Select(stack => stack.card.name + " ×" + stack.count)), result.LostValue);
            });
        }

        static void PresentNode(GameRuntime g, NodeResult node)
        {
            if (node == null) return;
            switch (node.Kind)
            {
                case NodeKind.Battle:
                    // 战斗格的开战由 BattleRequested 事件通道驱动（BattleNode 内部已 Emit，BattleBridge 消费），
                    // 这里若再 OpenBattle 会双开两场战斗
                    break;

                case NodeKind.Resource:
                    EntrySupplyScreen.OpenResource();
                    break;

                case NodeKind.Extraction:
                    FinalExtractionModal.Open();
                    break;

                case NodeKind.Shop:
                    // 先过场（「看看货品」）→ 进商店；离开商店时 FinishNode（ShopScreen 内已接）
                    SceneTransitionScreen.OpenScene("shop", () => ShopScreen.Open(), btn: "看看货品");
                    break;

                case NodeKind.Fire:
                    // 「坐下歇脚」→ 火堆屏；火堆关闭 FinishNode（NodeShellPanel.Close 已接）
                    SceneTransitionScreen.OpenScene("fire", () => FireRestScreen.Open(), btn: "坐下歇脚");
                    break;

                case NodeKind.Event:
                    if (node.Instant?.EventPoolExhausted == true) { EventDialogScreen.OpenPoolExhausted(); break; }
                    // RunEventDeck：随机事件已内部结算回待机（无屏）；抽到事件卡时开事件对话
                    if (node.Instant != null && node.Instant.EventCard != null)
                        EventDialogScreen.Open(node.Instant.EventCard, _narrative);
                    else g.FinishNode();
                    break;

                case NodeKind.Chest:
                    if (g.CurrentNodeReceipt.battleWon) { BattleBridge.ResumeRewards(g); break; }
                    // 宝箱格 / 事件选择开箱（openChestsOnCell）：逐箱开取，收尾 FinishNode 回待机
                    ChestOpenScreen.Open(node.Instant != null ? node.Instant.Chests : null, () => g.FinishNode());
                    break;

                case NodeKind.Door:
                    // UI 侧 DoorInfo（NodeModals 自有形状）≠ Sdt.Run.DoorInfo，做字段映射
                    if (node.Door != null)
                        DoorModal.Open(new Sdt.UI.Screens.Run.DoorInfo
                        {
                            toLayerName = node.Door.TargetLayerName,
                            exit = node.Door.Exit,
                            reverse = node.Door.Reverse,
                            toLayer = node.Door.ToLayer,
                            arriveAt = node.Door.ArriveAt,
                        }, node.Door.ShopOnCell);
                    else g.FinishNode();
                    break;

                case NodeKind.Altar:
                    AltarEntranceModal.Open(node.AltarEntrance != null ? node.AltarEntrance.Pair : null,
                        node.AltarEntrance != null && node.AltarEntrance.ShopOnCell);
                    break;

                case NodeKind.EmergencyExit:
                    EmergencyModal.Open();
                    break;

                case NodeKind.Boss:
                    // 首脑会话已由 BattleRequested 建立；战后奖励结束才结算节点。
                    break;

                default:
                    // 即时格（coin/wood/rations/key/chest）：收益已在 RunInstant 入账，过场屏呈现收下
                    var gain = node.Instant != null ? node.Instant.GainText : null;
                    SceneTransitionScreen.OpenScene(node.KindRaw, () => g.FinishNode(), gain: gain);
                    break;
            }
        }
    }
}
