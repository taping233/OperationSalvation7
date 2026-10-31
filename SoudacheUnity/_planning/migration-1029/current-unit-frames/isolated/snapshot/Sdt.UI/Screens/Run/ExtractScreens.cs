using System.Collections.Generic;
// ported from src/game.run.js doExtract()/renderExtractStash()/showExtractDone() + src/game.session.js doDeath()
//
// 原界面 DOM 结构 → uGUI 控件树映射：
//【ExtractStashScreen .pg.hub#exMain】
//   header.hub-head > h2 + sub + res-chip×2（仓库容量 n/c 张 / 随身币不带回）
//   .dep-body > section.hub-card「背包卡牌」   → .pk-row.dep-row 列表：卡名×n · 收购 n 币/张 + 「入库」mini-btn
//                + .dep-row.locked（初始攻击 ×n · 初始牌不可入库）
//   section.hub-card「自动入库」               → 木材/口粮/其余物资/消耗口袋四行 + 「全部入库」+「完成整理」
//【ExtractDoneScreen nodeShell 'exit'】
//   sub = 用时 mm:ss · 行动 n 次 · 剩余生命 hp/max · 携带 n 币（留在局中） · 物资价值 ¥n
//   body = 两行 ov-note（已运回基地明细 / 下次出发说明）
//   foot = 「回基地」「再出发」
//【DeathScreen overlay】
//   ov-stats = 生命归零，价值 ¥n 的物资与未保护的卡牌全部掉落
//   ov-note  = 安全格保护 n 张…（或空安全格提示文案） + 「回基地」「再出发」
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;

using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    /// <summary>撤离成功 · 整理入库（extractLeft 暂存堆 [{card,count}]，逐项入库，未入库丢失）。</summary>
    public class ExtractStashScreen : Panel
    {
        static ExtractStashScreen Current;
        public override bool CanCloseWithEscape => false;
        System.Collections.Generic.List<StashStack> _left;

        public sealed class StashStack { public CardDef card; public int count; }

        public static void Open(System.Collections.Generic.List<StashStack> left)
        {
            if (Current != null) { Current._left = left; Current.Rebuild(); return; }
            var s = ScreenMount.Show<ExtractStashScreen>("ExtractStash");
            Current = s;
            s._left = left;
            s.Build();
        }
        internal override void OnClose() { if (Current == this) Current = null; }
        public static void Present(ExtractResult result)
        {
            if (result == null) return;
            if (result.Done)
            {
                if (Current != null) UiStack.Close(Current);
                if (!(UiStack.Top is ExtractDoneScreen)) ExtractDoneScreen.Open(result);
                return;
            }
            if (Current == null) while (UiStack.Count > 0) UiStack.Pop();
            Open(result.Left.Select(entry => new StashStack { card = entry.card, count = entry.count }).ToList());
        }

        static int CountItem(string name)
        {
            var inv = GameRuntime.I.State.inventory;
            return inv == null ? 0 : inv.Where(i => i.name == name).Sum(i => i.count);
        }

        public override void Build()
        {
            var st = GameRuntime.I.State;
            var B = GameRuntime.I.Base;
            int woodN = CountItem("木材"), ratN = CountItem("口粮");
            int shaN = st.ownedCards.Count(o => BaseData.IsSha(o.card));
            int otherN = st.inventory.Where(i => i.name != "木材" && i.name != "口粮").Sum(i => i.count);
            int room = B.StashRoom;
            int totalLeft = _left.Sum(s => s.count);

            var root = UIKit.Panel("exMain", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#0B1822", 0.96f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 10; vl.padding = new RectOffset(24, 24, 18, 18);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            // header.hub-head
            var head = UiExt.Row(root.transform);
            var hHl = head.AddComponent<HorizontalLayoutGroup>();
            hHl.spacing = 14; hHl.childAlignment = TextAnchor.MiddleLeft;
            var h2 = UIKit.IconText(head.transform, "[[icon:exit]] 撤离成功 · 整理入库");
            h2.fontSize = 26; h2.fontStyle = FontStyle.Bold; h2.color = Color.white;
            UiExt.Chip(head.transform, "[[icon:archive]] 仓库容量 <b>" + B.StashUsed + "/" + B.StashCap + "</b> 张");
            UiExt.Chip(head.transform, "[[icon:coin]] 随身币不带回（<b>" + st.coins + "</b> 币留在局中）");
            var sub = UIKit.Label(root.transform, "把背包中的物品放回仓库——未入库的卡牌将在撤离中丢失", 14, UiPalette.Dim);
            var leSub = sub.gameObject.AddComponent<LayoutElement>(); leSub.minHeight = 20; leSub.flexibleHeight = 0;

            // .dep-body 两栏
            var body = UiExt.Row(root.transform);
            var bHl = body.AddComponent<HorizontalLayoutGroup>();
            bHl.spacing = 14; bHl.childForceExpandWidth = true; bHl.childForceExpandHeight = true;
            bHl.childControlWidth = true; bHl.childControlHeight = true;
            var leB = body.AddComponent<LayoutElement>(); leB.flexibleHeight = 1;

            // section 1：背包卡牌
            var sec1 = SectionCard(body.transform, "[[icon:bag]] 背包卡牌", 1.4f);
            if (_left.Count == 0 && shaN == 0)
                UIKit.Label(sec1, "背包里没有可入库的卡牌。", 14, UiPalette.Dim);
            for (int i = 0; i < _left.Count; i++)
            {
                var s = _left[i]; var idx = i;
                var row = UiExt.Row(sec1);
                var hl = row.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 8; hl.childAlignment = TextAnchor.MiddleLeft;
                hl.childForceExpandWidth = true; hl.childForceExpandHeight = false;
                var fits = s.count <= Math.Max(0, room);
                var name = UIKit.Label(row.transform, "[[icon:cards]] <b>" + s.card.name + "</b>" + (s.count > 1 ? " ×" + s.count : "")
                    + " · 收购 " + CardLibrary.SellPrice(s.card) + " 币/张", 15, Color.white);
                var le = name.gameObject.AddComponent<LayoutElement>(); le.minHeight = 26; le.flexibleWidth = 1;
                var btn = UIKit.Btn(row.transform, "[[icon:archive]] 入库", () => StashOne(idx));
                btn.interactable = fits;
                ((RectTransform)btn.transform).sizeDelta = new Vector2(110, 30);
            }
            if (shaN > 0)
            {
                var locked = UIKit.Label(sec1, "[[icon:cards]] [[icon:lock]] <b>初始攻击</b> ×" + shaN +
                    " · 初始牌不可入库（每局自动携带 " + GameRules.StarterSha + " 张）    遗落", 14, UiPalette.Dim);
            }

            // section 2：自动入库
            var sec2 = SectionCard(body.transform, "[[icon:archive]] 自动入库", 1f);
            PkRow(sec2, "[[icon:wood]] 木材 ×<b>" + woodN + "</b>", "已入库（扩建背包/仓库用）");
            PkRow(sec2, "[[icon:bread]] 口粮 ×<b>" + ratN + "</b>", "已入库（升级安全格用）");
            if (otherN > 0) PkRow(sec2, "[[icon:bag]] 其余物资 ×<b>" + otherN + "</b>", "未能带出 · 价值已计入本局得分");
            PkRow(sec2, "[[icon:pocket]] 消耗口袋", "已自动回收（基地可复原）");
            if (_left.Count > 0)
            {
                var all = UIKit.Btn(sec2, "[[icon:archive]] 全部入库（" + Math.Min(totalLeft, room) + "/" + totalLeft + " 张可入）", () => StashAll());
                all.interactable = room > 0;
                var leA = all.gameObject.AddComponent<LayoutElement>(); leA.minHeight = 36; leA.flexibleWidth = 1;
            }
            var finish = UIKit.Btn(sec2, "[[icon:check]] 完成整理" + (_left.Count > 0 ? "（" + totalLeft + " 张将丢失）" : ""),
                () => GameRuntime.I.FinishExtract());
            var leF = finish.gameObject.AddComponent<LayoutElement>(); leF.minHeight = 36; leF.flexibleWidth = 1;
        }

        static Transform SectionCard(Transform parent, string title, float flex)
        {
            var go = new GameObject("hub-card", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = UiExt.Box(go.transform, UiPalette.HexA("#12222E", 0.92f));
            UiExt.Stretch(img.rectTransform);
            var vl = go.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 6; vl.padding = new RectOffset(12, 12, 10, 10);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;
            var le = go.AddComponent<LayoutElement>(); le.flexibleWidth = flex; le.flexibleHeight = 1;
            UiExt.SectionLabel(go.transform, title);
            return go.transform;
        }

        static void PkRow(Transform parent, string left, string right)
        {
            var row = UiExt.Row(parent);
            var hl = row.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 8; hl.childAlignment = TextAnchor.MiddleLeft;
            hl.childForceExpandWidth = true; hl.childForceExpandHeight = false;
            var l = UIKit.Label(row.transform, left, 15, Color.white);
            var leL = l.gameObject.AddComponent<LayoutElement>(); leL.minHeight = 24; leL.flexibleWidth = 1;
            UIKit.Label(row.transform, right, 13, UiPalette.Dim);
        }

        void StashOne(int idx)
        {
            var result = GameRuntime.I.ExtractStashOne(idx);
            if (result == null) return;
            _left = result.Left.Select(entry => new StashStack { card = entry.card, count = entry.count }).ToList();
            Rebuild();
        }

        void StashAll()
        {
            var result = GameRuntime.I.ExtractStashAll();
            if (result == null) return;
            _left = result.Left.Select(entry => new StashStack { card = entry.card, count = entry.count }).ToList();
            Rebuild();
        }

        void Rebuild()
        {
            for (int i = transform.childCount - 1; i >= 0; i--) Destroy(transform.GetChild(i).gameObject);
            Build();
        }
    }

    /// <summary>撤离结算（回基地/再出发，两键都回基地 Hub）。</summary>
    public class ExtractDoneScreen : NodeShellPanel
    {
        public static void Open()
        {
            var result = GameRuntime.I.FinishExtract();
            if (result != null && !(UiStack.Top is ExtractDoneScreen)) Open(result);
        }
        public static void Open(ExtractResult result)
        {
            var screen = ScreenMount.Show<ExtractDoneScreen>("ExtractDone");
            screen.Tone = "exit"; screen.TitleIcon = "[[icon:exit]]"; screen.Title = "撤离成功";
            screen._sub = "用时 " + result.TimeStr + " · 行动 " + result.Actions + " 次 · 剩余生命 " + result.Hp + "/" + result.MaxHp;
            screen._note1 = "已运回基地：木材 ×" + result.WoodN + " · 口粮 ×" + result.RatN + " · 仓库 " + result.StashUsed + "/" + result.StashCap + " 张";
            screen._note2 = "返回基地可继续整备与整理仓库，准备下一次远征。";
            screen.Build();
        }

        string _sub, _note1, _note2;

        protected override void OnPrepare()
        {
            Sub = _sub;
        }

        protected override void OnBody()
        {
            var n1 = UIKit.Label(BodyRoot, _note1, 16, UiPalette.Hex("#D8E4EC"));
            n1.alignment = TextAnchor.UpperLeft;
            var le1 = n1.gameObject.AddComponent<LayoutElement>(); le1.minHeight = 52; le1.flexibleHeight = 0;
            var n2 = UIKit.Label(BodyRoot, _note2, 16, UiPalette.Hex("#D8E4EC"));
            n2.alignment = TextAnchor.UpperLeft;
            var le2 = n2.gameObject.AddComponent<LayoutElement>(); le2.minHeight = 40; le2.flexibleHeight = 0;

            var b1 = UIKit.Btn(FootRoot, "[[icon:home]] 回基地", () => { Close(); GameRuntime.I.OpenHub("deploy"); });
            ((RectTransform)b1.transform).sizeDelta = new Vector2(150, 40);
            var b2 = UIKit.Btn(FootRoot, "[[icon:runner]] 再出发", () => { Close(); GameRuntime.I.OpenHub("deploy"); });
            ((RectTransform)b2.transform).sizeDelta = new Vector2(150, 40);
        }
    }

    /// <summary>死亡结算（game.session.js doDeath）：安全格卡牌抢运回基地，其余全丢。</summary>
    public class DeathScreen : Panel
    {
        public override bool CanCloseWithEscape => false;
        public static void Open(int savedCount, string savedNames, long lostValue)
        {
            RunLog.Log(savedCount > 0
                ? "<b>[[icon:skull]] 你倒下了……</b>[[icon:lock]] 宠物抢运回安全格中的 <b>" + savedCount + "</b> 张卡牌，其余全部丢失"
                : "<b>[[icon:skull]] 你倒下了……</b>安全格里没有卡牌，全部战利品丢失", "warn");

            var s = ScreenMount.Show<DeathScreen>("Death");
            s._savedCount = savedCount; s._savedNames = savedNames; s._lostValue = lostValue;
            s.Build();
        }

        int _savedCount; string _savedNames; long _lostValue;

        public override void Build()
        {
            var root = UIKit.Panel("death", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#1A0E10", 0.95f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 14; vl.padding = new RectOffset(60, 60, 60, 60);
            vl.childAlignment = TextAnchor.MiddleCenter;
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            var title = UIKit.IconText(root.transform, "[[icon:skull]] 撤离失败");
            title.fontSize = 36; title.fontStyle = FontStyle.Bold; title.color = Color.white;
            var leT = title.gameObject.AddComponent<LayoutElement>(); leT.minHeight = 46; leT.flexibleHeight = 0;

            var reason = GameRuntime.I.State.hp > 0 ? "主动撤离，当前冒险结束" : "生命归零";
            var stats = UIKit.Label(root.transform, reason + "，价值 <b>¥" + _lostValue.ToString("N0") + "</b> 的物资与未保护的卡牌全部掉落", 18, UiPalette.Gold);
            stats.alignment = TextAnchor.MiddleCenter;
            var leS = stats.gameObject.AddComponent<LayoutElement>(); leS.minHeight = 28; leS.flexibleHeight = 0;

            if (_savedCount > 0)
            {
                var note = UIKit.Label(root.transform, "[[icon:lock]] 安全格保护了 <b>" + _savedCount + "</b> 张卡牌并运回基地：" + _savedNames, 16, UiPalette.Hex("#D8E4EC"));
                note.alignment = TextAnchor.MiddleCenter;
                var leN = note.gameObject.AddComponent<LayoutElement>(); leN.minHeight = 48; leN.flexibleHeight = 0;
            }
            else
            {
                var note = UIKit.Label(root.transform, "提示：把卡牌存入背包的<b>安全格</b>（容量随携带伙伴等级提升），撤离失败时才能保住它们。", 16, UiPalette.Hex("#D8E4EC"));
                note.alignment = TextAnchor.MiddleCenter;
                var leN = note.gameObject.AddComponent<LayoutElement>(); leN.minHeight = 48; leN.flexibleHeight = 0;
            }

            var btns = UiExt.Row(root.transform);
            var bHl = btns.AddComponent<HorizontalLayoutGroup>();
            bHl.spacing = 14; bHl.childAlignment = TextAnchor.MiddleCenter;
            bHl.childForceExpandWidth = false; bHl.childForceExpandHeight = false;
            UIKit.Btn(btns.transform, "[[icon:home]] 回基地", () => { Close(); GameRuntime.I.OpenHub("deploy"); });
            UIKit.Btn(btns.transform, "再出发", () => { Close(); GameRuntime.I.OpenHub("deploy"); });
        }
    }
}
