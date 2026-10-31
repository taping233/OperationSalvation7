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
        static int _displayedLayer;
        public static void Install()
        {
            if (_installed) return;
            _installed = true;
            var g = GameRuntime.I;
            _displayedLayer = g.State.layerIdx;
            var narrativeJson = Sdt.Res.Res.NarrativeJson;
            if (narrativeJson != null) _narrative = new NarrativeService(narrativeJson.text);
            g.Bus.On<NodeEntered>(e => PresentNode(g, e != null ? e.Node : null));
            g.Bus.On<ClassChoiceOpened>(_ => ClassChoiceScreen.Open());
            g.Bus.On<BagOpened>(_ => Sdt.UI.Screens.Bag.BagScreen.Open());
            g.Bus.On<HubOpened>(e =>
            {
                Sdt.UI.Screens.Hub.HubScreen.Open(e?.Tab);
                var owner = UiStack.Top;
                CurrentRunFilm.Play("camp", isCurrent: () => owner != null && UiStack.Top == owner, blocking: false);
            });
            g.Bus.On<RunStarted>(_ => { CurrentRunFilm.CancelActive(); _displayedLayer = g.State.layerIdx; });
            g.Bus.On<RunLoaded>(_ =>
            {
                _displayedLayer = g.State.layerIdx; var seed = g.State.seed; var slot = g.ActiveSlot;
                // The synchronous restoration keeps the cover while its destination gets two native paint opportunities.
                CurrentRunFilm.Play("resume", isCurrent: () => g.State.seed == seed && g.ActiveSlot == slot,
                    allowOwnerChange: true, durationMs: 0, exitMs: 680);
            });
            g.Bus.On<NodeMovementCompleted>(e =>
            {
                int from = _displayedLayer; _displayedLayer = e.LayerIdx;
                if (from != e.LayerIdx) CurrentRunFilm.Passage(from, e.LayerIdx);
            });
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
            if (CurrentRunFilm.AfterPassage(() => PresentNode(g, node))) return;
            var seed = g.State.seed; var slot = g.ActiveSlot; var key = g.CurrentNodeId;
            System.Func<bool> current = () => g.State.runActive && g.State.seed == seed && g.ActiveSlot == slot && g.CurrentNodeId == key;
            void Enter(string kind, System.Action next) => CurrentRunFilm.Play(kind, next, current);
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
                    Enter("emergencyExit", FinalExtractionModal.Open);
                    break;

                case NodeKind.Shop:
                    Enter("shop", () => ShopScreen.Open());
                    break;

                case NodeKind.Fire:
                    // Current flow opens the fire room directly; there is no separate narrated fire interlude.
                    FireRestScreen.Open();
                    break;

                case NodeKind.Event:
                    if (node.Instant?.EventPoolExhausted == true) { EventDialogScreen.OpenPoolExhausted(); break; }
                    // RunEventDeck：随机事件已内部结算回待机（无屏）；抽到事件卡时开事件对话
                    if (node.Instant != null && node.Instant.EventCard != null)
                        Enter("event", () => EventDialogScreen.Open(node.Instant.EventCard, _narrative));
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
                        Enter("door", () => DoorModal.Open(new Sdt.UI.Screens.Run.DoorInfo
                        {
                            toLayerName = node.Door.TargetLayerName,
                            exit = node.Door.Exit,
                            reverse = node.Door.Reverse,
                            toLayer = node.Door.ToLayer,
                            arriveAt = node.Door.ArriveAt,
                        }, node.Door.ShopOnCell));
                    else g.FinishNode();
                    break;

                case NodeKind.Altar:
                    Enter("altar", () => AltarEntranceModal.Open(node.AltarEntrance != null ? node.AltarEntrance.Pair : null,
                        node.AltarEntrance != null && node.AltarEntrance.ShopOnCell));
                    break;

                case NodeKind.EmergencyExit:
                    Enter("emergencyExit", EmergencyModal.Open);
                    break;

                case NodeKind.Boss:
                    CurrentBossGateScreen.Open();
                    break;

                default:
                    if(node.Kind==NodeKind.Coin){PickupScreen.Open(node.KindRaw,node.Instant?.GainText,null);break;}
                    if(node.Kind==NodeKind.Wood||node.Kind==NodeKind.Rations||node.Kind==NodeKind.Key){ChestOpenScreen.OpenPending(null);break;}
                    // No legacy title/random-line screen is inserted for plain map cells.
                    g.FinishNode();
                    break;
            }
        }
    }
}
