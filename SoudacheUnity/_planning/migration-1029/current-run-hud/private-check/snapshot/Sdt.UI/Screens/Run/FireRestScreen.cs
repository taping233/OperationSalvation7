// 营火操作只调用领域命令；界面重建不回血、不重掷职业卡、不直接修改消耗区。
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    /// <summary>营火的回血与随机复原分别领取；结果与次数由当前节点收据保存。</summary>
    public class FireRestScreen : NodeShellPanel
    {
        Action _done;

        public static void Open()
        {
            OpenPocketRestore(2, null);
        }

        public static void OpenPocketRestore(int picks, Action done)
        {
            var s = ScreenMount.Show<FireRestScreen>("FireRest");
            s._done = done;
            s.Tone = "fire"; s.TitleIcon = "[[icon:fire]]"; s.Title = "营火休整";
            s.Build();
        }

        protected override void OnPrepare()
        {
            var state = GameRuntime.I.State;
            Sub = "当前生命 " + state.hp + "/" + state.maxHp + "；回血与复原可分别使用，离开此地点后机会作废";
        }

        protected override void OnBody()
        {
            var st = GameRuntime.I.State;
            var receipt = GameRuntime.I.CurrentNodeReceipt;
            var heal = EventOptButton.Create(BodyRoot, receipt.healUsed ? "回血已使用" : "回复生命",
                receipt.healUsed ? "已回复 " + receipt.healAmount + " 点生命" : "最多回复 " + GameRules.FireHeal + " 点生命", "ok", () =>
                {
                    if (!GameRuntime.I.TryFireHeal(out var reason)) RunLog.Log(reason, "warn");
                    Rebuild();
                });
            heal.interactable = !receipt.healUsed && st.hp < st.maxHp;
            var restore = EventOptButton.Create(BodyRoot, receipt.restoreUsed ? "复原已使用" : "复原消耗卡牌",
                "随机复原最多两张可复原卡牌；装备与道具不参与", "ok", () =>
                {
                    if (!GameRuntime.I.TryFireRestore(out var reason)) RunLog.Log(reason, "warn");
                    Rebuild();
                });
            restore.interactable = !receipt.restoreUsed;
            foreach (var id in receipt.restoredIds)
                UIKit.Label(BodyRoot, "已复原：" + (CardLibrary.FindById(id)?.name ?? id), 16, UiPalette.Ok);
            if (receipt.bonusReceived)
                UIKit.Label(BodyRoot, "余烬中的职业卡：" + (CardLibrary.FindById(receipt.classCardId)?.name ?? receipt.classCardId), 16, UiPalette.Gold);

            // footer.node-foot：继续旅程
            var doneBtn = UIKit.Btn(FootRoot, "[[icon:runner]] 继续旅程", () => Finish());
            ((RectTransform)doneBtn.transform).sizeDelta = new Vector2(180, 38);
        }

        void Finish()
        {
            var cb = _done; _done = null;
            Close();
            GameRuntime.I.FireRestoreDone();
            cb?.Invoke();
        }
    }
}
