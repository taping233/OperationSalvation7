// ported from src/game.run.js openDoorModal()/openAltarEntranceModal()/openAltarModal()/openEmergencyModal()
//
// 原界面 DOM 结构 → uGUI 控件树映射（全部是 nodeShell 卡片风）：
//   nodeShell(tone/icon/title/sub) + body = nodeOpt(...) 选项条列表（.evt-opt 同款）
// 【DoorModal】  tone=door：进入/返回目标环 + 就此撤离(exit) + 逛商队(shop 格) + 留下
// 【AltarEntranceModal】 tone=altar：深入污染区 + 逛商队 + 留下
// 【AltarModal】 tone=altar：三 BOSS 选项条（.evt-opt.danger.withart：立绘 Image + 名（atk-hp）+ 词缀说明）
//                + 撤离污染区
// 【EmergencyModal】 tone=exit：花币撤离(ok，币不足降级为普通) + 留下
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    /// <summary>环间门。doorInfo：{ toLayerName, exit, reverse, toLayer, arriveAt }（EnterNode 结果对象字段）。</summary>
    public class DoorModal : NodeShellPanel
    {
        DoorInfo _door; bool _cellIsShop;

        public static void Open(DoorInfo door, bool cellIsShop)
        {
            var s = ScreenMount.Show<DoorModal>("DoorModal");
            s._door = door; s._cellIsShop = cellIsShop;
            s.Tone = "door"; s.TitleIcon = "[[icon:door]]"; s.Title = "隔离闸门";
            s.Build();
        }

        protected override void OnPrepare()
        {
            Sub = "隔离闸门通向 <b>" + _door.toLayerName + "</b>；穿过后继续深入";
        }

        protected override void OnBody()
        {
            EventOptButton.Create(BodyRoot, (_door.reverse ? "返回" : "进入") + _door.toLayerName, "穿过闸门，继续深入", "ok",
                () =>
                {
                    if (!GameRuntime.I.TryUseDoor(_door.toLayer, _door.arriveAt, out var reason)) { RunLog.Log(reason, "warn"); return; }
                    Close();
                });
            if (_door.exit)
                EventOptButton.Create(BodyRoot, "就此撤离", "带着背包立即结算撤离", "ok",
                    () => { Close(); GameRuntime.I.DoExtract(); });
            if (_cellIsShop)
                EventOptButton.Create(BodyRoot, "逛商队", "闸门旁的拾荒商队还在营业", "",
                    () => { Close(); ShopScreen.Open(); });
            EventOptButton.Create(BodyRoot, "留下", "留在当前格子，稍后再决定", "", () => { Close(); GameRuntime.I.StayHere(); });
        }
    }

    /// <summary>污染核心入口。</summary>
    public class AltarEntranceModal : NodeShellPanel
    {
        string _pair; bool _cellIsShop;

        public static void Open(string pair, bool cellIsShop)
        {
            AltarRitualScreen.Open();
        }

        protected override void OnPrepare()
        {
            Sub = GameRuntime.I.State.altarActivated ? "祭坛已经激活，首脑通路已开启" : "献祭 3 张随身卡牌激活祭坛，开启首脑通路";
        }

        protected override void OnBody()
        {
            if (!GameRuntime.I.State.altarActivated)
                EventOptButton.Create(BodyRoot, "选择献祭卡牌", "从安全格以外选择 3 张卡牌", "ok", () => { Close(); CardSacrificeScreen.Open(false); });
            EventOptButton.Create(BodyRoot, "返回地图", "继续探索", "", Close);
        }
    }

    /// <summary>BOSS 三选一（MAP.altar.bosses 经 GameRuntime.AltarBosses 供给）。</summary>
    public class AltarModal : NodeShellPanel
    {
        public static void Open()
        {
            AltarRitualScreen.Open();
        }

        protected override void OnPrepare()
        {
            Sub = GameRuntime.I.State.altarActivated ? "祭坛已经激活" : "献祭 3 张随身卡牌，开启首脑通路";
        }

        protected override void OnBody()
        {
            if (!GameRuntime.I.State.altarActivated)
                EventOptButton.Create(BodyRoot, "选择献祭卡牌", "安全格中的卡牌不参与献祭", "ok", () => { Close(); CardSacrificeScreen.Open(false); });
            EventOptButton.Create(BodyRoot, "返回地图", "前往首脑地点挑战", "", Close);
        }
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

    /// <summary>祭坛 BOSS 条目（MAP.altar.bosses 投影）。</summary>
    [Serializable]
    public sealed class BossInfo
    {
        public string id, name, affixDesc;
        public int atk, hp;
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
