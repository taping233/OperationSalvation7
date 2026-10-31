using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Run
{
    /// <summary>入城补给沿用运行时预留的候选与领取收据，关闭重开不重新抽卡。</summary>
    public sealed class EntrySupplyScreen : NodeShellPanel
    {
        bool _resource;
        public static void Open()
        {
            if (GameRuntime.I.EntrySupplyComplete) return;
            var screen = ScreenMount.Show<EntrySupplyScreen>("EntrySupply");
            screen.Tone = "door"; screen.TitleIcon = "[[icon:archive]]"; screen.Title = "入城补给";
            screen.Build();
        }
        public static void OpenResource()
        {
            if (GameRuntime.I.CurrentNodeReceipt.rewardTaken != null) return;
            var screen = ScreenMount.Show<EntrySupplyScreen>("ResourceReward");
            screen._resource = true;
            screen.Tone = "pickup"; screen.TitleIcon = "[[icon:archive]]"; screen.Title = "发现物资";
            screen.Build();
        }

        protected override void OnPrepare() => Sub = _resource ? "从已发现的两张物资中选择一张；空间不足时可先整理背包"
            : "领取已备好的职业卡后开始探索；背包空间不足时可先整理";

        protected override void OnBody()
        {
            var runtime = GameRuntime.I;
            var cards = _resource ? runtime.GetResourceRewardCards() : runtime.GetEntrySupplyCards();
            for (int i = 0; i < cards.Count; i++)
            {
                int index = i;
                if (cards[i] == null) continue;
                CardFace.Create(cards[i], CardSize.Md, BodyRoot);
                bool taken = _resource ? runtime.CurrentNodeReceipt.rewardTaken != null : runtime.State.entrySupply.taken.Contains(i);
                var button = UIKit.Btn(BodyRoot, taken ? "已领取" : "领取 " + cards[i].name, () =>
                {
                    string reason;
                    bool success = _resource ? runtime.ClaimResourceReward(index, out reason) : runtime.ClaimEntrySupply(index, out reason);
                    if (!success) RunLog.Log(reason, "warn");
                    Rebuild();
                });
                button.interactable = !taken;
            }
            UIKit.Btn(FootRoot, "整理背包", () => runtime.Bus.Emit(new BagOpened()));
            UIKit.Btn(FootRoot, _resource ? "返回地图" : runtime.EntrySupplyComplete ? "开始探索" : "稍后领取", Close);
        }
    }
}
