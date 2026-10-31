// ported from src/game.bag.js showBossPackCleanup()
//
// 原界面 DOM 结构 → uGUI 控件树映射：
//   p.ov-stats = 点击卡牌切换「带走 / 丢弃」 · 已选带走 n 张 · 将丢弃 n 张
//   p.ov-note  = [[icon:skull]] 本场墓地可回收 n 张，已与原背包及 BOSS 宝箱新牌一起列出。未选中的牌确认后永久丢弃，无法从火堆取回。
//   .bt-hand   → 卡网格（.bt-card：CardFace(sm) + 右下角标 bt-tt = 墓地[[icon:skull]]/安全格[[icon:lock]]/背包[[icon:bag]]；sel 态高亮）
//   .ov-btns   → 全部带走 / 全部丢弃 / 「[[icon:check]] 带走 n 张 · 丢弃 n 张」
using System;
using Sdt.Run;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.Core;

namespace Sdt.UI.Screens.Bag
{
    /// <summary>BOSS 战后整理背包：默认全带走，点卡切换，确认后未选中的永久丢弃。</summary>
    public class BossPackCleanup : Panel
    {
        public override bool CanCloseWithEscape => false;
        List<OwnedCard> _candidates;
        HashSet<string> _graveSet;
        HashSet<string> _keep;
        Action _done;

        public static void Open(string[] consumedUids, Action done)
        {
            var st = GameRuntime.I.State;
            var s = ScreenMount.Show<BossPackCleanup>("BossPackCleanup");
            s._candidates = st.ownedCards.ToList();
            s._graveSet = new HashSet<string>(consumedUids ?? Array.Empty<string>());
            s._keep = new HashSet<string>(s._candidates.Select(o => o.uid)); // 安全默认：先全部带走
            s._done = done;
            st.bossCleanupPending = true;
            s.Build();
        }

        public override void Build()
        {
            var st = GameRuntime.I.State;
            int keptN = _candidates.Count(o => _keep.Contains(o.uid));
            int dropN = _candidates.Count - keptN;
            int graveN = _candidates.Count(o => _graveSet.Contains(o.uid));

            var root = UIKit.Panel("bossCleanup", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#0B1822", 0.96f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 10; vl.padding = new RectOffset(24, 24, 18, 18);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            var title = UIKit.IconText(root.transform, "[[icon:bag]] 击败 BOSS · 整理背包");
            title.fontSize = 26; title.fontStyle = FontStyle.Bold; title.color = Color.white;
            var stats = UIKit.Label(root.transform, "点击卡牌切换「带走 / 丢弃」 · 已选带走 <b>" + keptN + "</b> 张 · 将丢弃 <b>" + dropN + "</b> 张", 16, Color.white);
            var note = UIKit.Label(root.transform, "[[icon:skull]] 本场墓地可回收 <b>" + graveN + "</b> 张，已与原背包及 BOSS 宝箱新牌一起列出。<b>未选中的牌确认后永久丢弃，无法从火堆取回。</b>", 14, UiPalette.Dim);
            var leN = note.gameObject.AddComponent<LayoutElement>(); leN.minHeight = 36; leN.flexibleHeight = 0;

            var scroll = UIKit.Scroll(root.transform);
            var leS = scroll.AddComponent<LayoutElement>(); leS.flexibleHeight = 1; leS.flexibleWidth = 1;
            var grid = UIKit.Grid(scroll.transform, 8, new Vector2(110, 160), new Vector2(10, 10));

            if (_candidates.Count == 0)
            {
                UIKit.Label(scroll.transform, "没有可整理的卡牌。", 15, UiPalette.Dim);
            }
            foreach (var o in _candidates)
            {
                var owned = o;
                var kept = _keep.Contains(o.uid);
                var fromGrave = _graveSet.Contains(o.uid);

                var card = new GameObject("bt-card", typeof(RectTransform));
                card.transform.SetParent(grid.transform, false);
                var img = card.AddComponent<Image>();
                img.color = kept ? UiPalette.HexA("#12332A", 0.9f) : UiPalette.HexA("#1A1214", 0.9f);
                var ol = card.AddComponent<Outline>();
                ol.effectColor = kept ? UiPalette.Ok : UiPalette.Danger; ol.effectDistance = new Vector2(2, -2);
                var cvl = card.AddComponent<VerticalLayoutGroup>();
                cvl.padding = new RectOffset(4, 4, 4, 4); cvl.spacing = 2;
                cvl.childForceExpandWidth = false; cvl.childForceExpandHeight = false;
                CardFace.Create(owned.card, CardSize.Sm, card.transform);
                var tag = fromGrave ? "[[icon:skull]]" : owned.safe == true ? "[[icon:lock]]" : "[[icon:bag]]";
                var tt = UIKit.IconText(card.transform, tag);
                tt.fontSize = 12; tt.alignment = TextAnchor.MiddleCenter;
                var leT = tt.gameObject.AddComponent<LayoutElement>(); leT.minHeight = 16; leT.flexibleHeight = 0;

                var btn = card.AddComponent<Button>(); btn.targetGraphic = img;
                btn.onClick.AddListener(() =>
                {
                    if (_keep.Contains(owned.uid)) _keep.Remove(owned.uid); else _keep.Add(owned.uid);
                    Rebuild();
                });
            }

            var btns = UiExt.Row(root.transform);
            var hl = btns.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 12; hl.childAlignment = TextAnchor.MiddleCenter;
            UIKit.Btn(btns.transform, "全部带走", () => { _candidates.ForEach(o => _keep.Add(o.uid)); Rebuild(); });
            UIKit.Btn(btns.transform, "全部丢弃", () => { _keep.Clear(); Rebuild(); });
            UIKit.Btn(btns.transform, "[[icon:check]] 带走 " + keptN + " 张 · 丢弃 " + dropN + " 张", () => Confirm());
        }

        void Confirm()
        {
            var runtime = GameRuntime.I;
            var discarded = _candidates.Where(o => !_keep.Contains(o.uid)).ToList();
            var discardedUids = new HashSet<string>(discarded.Select(o => o.uid));
            int recovered = _candidates.Count(o => _graveSet.Contains(o.uid) && _keep.Contains(o.uid));
            if (!runtime.TryPersistMutation(() =>
            {
                var st = runtime.State;
                var kept = st.ownedCards.Where(o => !discardedUids.Contains(o.uid)).ToList();
                var query = CardContainerCommands.Query(runtime, kept);
                if (!query.capacityOk || query.safeUsed > runtime.SafeCap) throw new InvalidOperationException("带走的卡牌超过容量，请继续整理");
                if (kept.Any(o => o.stored) && !kept.Any(o => o.card.id == CardContainerCommands.PearlId)) throw new InvalidOperationException("请保留珍珠盒，或同时丢弃其中的物资");
                if (kept.Any(o => !string.IsNullOrEmpty(o.pouchOf)) && !kept.Any(o => o.card.id == CardContainerCommands.PouchId)) throw new InvalidOperationException("请保留锦囊，或同时丢弃其中的卡牌");
                st.ownedCards = kept; st.bossCleanupPending = false; BagScreen.SyncCardOrder(st);
            }, out var reason)) { RunLog.Log(reason, "warn"); return; }
            RunLog.Log("[[icon:bag]] 整理完成：带走 <b>" + _keep.Count + "</b> 张（其中墓地回收 <b>" + recovered + "</b> 张），丢弃 <b>" + discarded.Count + "</b> 张",
                discarded.Count > 0 ? "warn" : "ok");
            var cb = _done; _done = null;
            Close();
            cb?.Invoke();
        }

        void Rebuild()
        {
            for (int i = transform.childCount - 1; i >= 0; i--) Destroy(transform.GetChild(i).gameObject);
            Build();
        }
    }
}
