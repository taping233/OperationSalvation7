// Current layered-map gate, altar and extraction entry points.
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    /// <summary>Current game.run.altar.js openDoorModal. Layer gates do not offer extraction.</summary>
    public class DoorModal : NodeShellPanel
    {
        DoorInfo _door; bool _cellIsShop, _entering; int? _seed; string _node, _error;
        bool Current => this != null && UiStack.Top == this && GameRuntime.I.State.runActive && GameRuntime.I.State.seed == _seed && GameRuntime.I.CurrentNodeId == _node;
        public override bool CanCloseWithEscape => !_entering;

        public static void Open(DoorInfo door, bool cellIsShop)
        {
            var s = ScreenMount.Show<DoorModal>("DoorModal");
            s._door = door; s._cellIsShop = cellIsShop;
            s._seed = GameRuntime.I.State.seed; s._node = GameRuntime.I.CurrentNodeId;
            s.Tone = "door"; s.TitleIcon = "[[icon:door]]"; s.Title = "层间闸门";
            s.Build();
        }

        protected override void OnPrepare()
        {
            Sub = _door.reverse ? "这条通路返回已探索的区域。" : "穿过闸门后进入下一层。确认前可返回当前层检查遗漏，或先整理背包。";
        }

        protected override void OnBody()
        {
            if (!string.IsNullOrEmpty(_error)) CurrentNodeElements.Text(BodyRoot,"door-error",_error,18,"#e4b79d");
            var go = EventOptButton.Create(BodyRoot, (_door.reverse ? "返回" : "进入") + _door.toLayerName, "", "ok",
                () =>
                {
                    if (!Current || _entering) return; _entering = true;
                    if (!GameRuntime.I.TryUseDoor(_door.toLayer, _door.arriveAt, out _error)) { _entering = false; Rebuild(); return; }
                    Close();
                });
            go.name = "goDoor"; go.interactable = !_entering;
            if (_cellIsShop && ShopScreen.CanOpen(GameRuntime.I))
                EventOptButton.Create(BodyRoot, "逛商队", "闸门旁的拾荒商队还在营业", "",
                    () => { if (Current && !_entering && ShopScreen.CanOpen(GameRuntime.I)) ShopScreen.Open(); }).name = "doorShop";
            CurrentNodeElements.Button(FootRoot,"整理背包",() => { if (Current && !_entering) GameRuntime.I.Bus.Emit(new BagOpened()); }).name = "doorBag";
            CurrentNodeElements.Button(FootRoot,"返回当前层",Return).name = "doorBack";
        }
        void Return()
        {
            if (!Current || _entering) return;
            if (!GameRuntime.I.TryPersistMutation(() => GameRuntime.I.FinishNode(), out _error)) { Rebuild(); return; }
            Close();
        }
        public override void CloseFromEscape() => Return();
    }

    /// <summary>紧急撤离点（emergencyExitCost 币）。</summary>
    public class EmergencyModal : NodeShellPanel
    {
        public static void Open()
        {
            var s = ScreenMount.Show<EmergencyModal>("EmergencyModal");
            s.Tone = "exit"; s.TitleIcon = "[[icon:cross]]"; s.Title = "紧急撤离点";
            s.Build();
        }

        protected override void OnPrepare()
        {
            Sub = "献祭 3 张安全格以外的随身卡牌，立即结算撤离";
        }

        protected override void OnBody()
        {
            EventOptButton.Create(BodyRoot, "选择献祭卡牌", "确认后消耗 3 张所选卡牌并撤离", "ok", () => { Close(); CardSacrificeScreen.Open(true); });
            EventOptButton.Create(BodyRoot, "返回地图", "继续探索", "", Close);
        }
    }
    /// <summary>环间门信息（EnterNode 结果对象中 door 字段的 UI 侧投影；W3 定型后由协调者对齐）。</summary>
    [Serializable]
    public sealed class DoorInfo
    {
        public string toLayerName; public bool exit; public bool reverse;
        public int toLayer; public int arriveAt;
    }

    public sealed class FinalExtractionModal : NodeShellPanel
    {
        public static void Open()
        {
            var screen = ScreenMount.Show<FinalExtractionModal>("FinalExtraction");
            screen.Tone = "exit"; screen.TitleIcon = "[[icon:runner]]"; screen.Title = "终局撤离";
            screen.Build();
        }
        protected override void OnPrepare() => Sub = "确认撤离后，带着本次远征的收获返回基地";
        protected override void OnBody()
        {
            var confirm = EventOptButton.Create(BodyRoot, "确认撤离", "结算本次远征并整理带回物资", "ok", () =>
            {
                if (!GameRuntime.I.TryFinalExtract(out var reason)) { RunLog.Log(reason, "warn"); return; }
                Close();
            });
            confirm.interactable = GameRuntime.I.State.bossDefeated;
            EventOptButton.Create(BodyRoot, "返回地图", "留在当前地点", "", Close);
        }
    }
}
