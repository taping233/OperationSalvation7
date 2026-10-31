using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.Core;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Hub
{
    public sealed class CollectionConversionScreen : NodeShellPanel
    {
        string _cardId;
        int _count = 1;
        public static void Open(string id)
        {
            var screen = ScreenMount.Show<CollectionConversionScreen>("CollectionConversion");
            screen._cardId = id; screen.Tone = "event"; screen.Title = "人物培养 · 转化确认"; screen.TitleIcon = "[[icon:medal]]";
            screen.Build();
        }
        protected override void OnBody()
        {
            var runtime = GameRuntime.I;
            var card = CardLibrary.FindById(_cardId);
            var stack = runtime.Base.stash.SingleOrDefault(item => item.card.id == _cardId);
            if (card == null || stack == null) { UIKit.Label(BodyRoot, "库存已变化，请返回重新选择", 18, Theme.Sub); UIKit.Btn(FootRoot, "返回", Close); return; }
            int lv = runtime.Meta.ClassLv(card.cls), xp = runtime.Meta.ClassXP(card.cls), required = -xp;
            for (int level = lv; level < MetaProgress.LevelMax; level++) required += MetaProgress.XpForNext(level);
            required = Math.Max(0, required);
            int perCard = card.type == "能力卡" ? 50 : 10;
            bool registered = runtime.Base.IsCollected(card);
            int maximum = lv >= MetaProgress.LevelMax ? registered ? 0 : 1 : Math.Min(stack.count, (required + perCard - 1) / perCard);
            _count = Math.Max(1, Math.Min(_count, Math.Max(1, maximum)));
            int gained = Math.Min(required, _count * perCard), overflow = lv >= MetaProgress.LevelMax ? 0 : _count * perCard - gained;
            int afterLevel = lv, afterXp = xp + gained;
            while (afterLevel < MetaProgress.LevelMax && afterXp >= MetaProgress.XpForNext(afterLevel)) { afterXp -= MetaProgress.XpForNext(afterLevel); afterLevel++; }
            CardFace.Create(card, CardSize.Md, BodyRoot);
            UIKit.Label(BodyRoot, "消耗 " + _count + " 张 → " + CharacterTable.Name(card.cls) + "\n实际经验 +" + gained
                + " · 末张溢出 " + overflow + "\nLv." + lv + " → Lv." + afterLevel + (registered ? "\n图鉴保持已收录" : "\n首次登记图鉴"), 18, Theme.Txt);
            var controls = UIKit.Row(BodyRoot); controls.AddComponent<HorizontalLayoutGroup>().spacing = 12;
            UIKit.Btn(controls.transform, "−", () => { _count = Math.Max(1, _count - 1); Rebuild(); });
            UIKit.Btn(controls.transform, "+", () => { _count = Math.Min(maximum, _count + 1); Rebuild(); });
            UIKit.Btn(controls.transform, "所需最大 " + maximum, () => { _count = maximum; Rebuild(); });
            var confirm = UIKit.BtnOk(FootRoot, "确认消耗并转化", () =>
            {
                bool ok = runtime.Meta.TryConvertCollection(_cardId, _count, out var reason);
                runtime.Bus.Emit(new ToastRequested(ok ? "人物培养完成，图鉴进度已保存" : reason));
                if (ok) { Close(); HubScreen.Open("collection"); }
            });
            confirm.interactable = maximum > 0 && !runtime.Base.IsProtected(card);
            UIKit.Btn(FootRoot, "取消", Close);
        }
    }
}
