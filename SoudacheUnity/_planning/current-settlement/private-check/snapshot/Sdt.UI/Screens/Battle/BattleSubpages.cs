// ported from src/battle.view.js renderDeckSelection()/renderGrave()/discovering 段
// 战斗子页（UI.showOverlay(true) 变体 → UiStack 压栈的全屏 Panel + 遮罩）：
//   DeckSelectionPanel —— BOSS 编组牌库（selectDeckCard/confirmDeck/cancelDeck）
//   DiscoverPanel      —— 发现三选一（pickDiscover）
//   GravePanel         —— 墓地查看（openGrave/closeGrave）
// 文案逐字照抄源码模板串。
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    /// <summary>子页公共接口（BattleScreen.SetPage 驱动）。</summary>
    public interface IBattleSubpage
    {
        void SetSnapshot(BattleSnapshot s);   // 快照更新 → 内容重建
        void Dismiss();                       // 随状态消失（UiStack Pop）
    }

    /// <summary>子页基座：#overlay 遮罩 + .card 容器（header/ovBody/ov-btns）。</summary>
    public abstract class BattleSubpageBase : Panel, IBattleSubpage
    {
        protected RectTransform CardRoot;
        protected Transform BodyRoot;
        protected Transform BtnsRoot;

        public override void Build()
        {
            var root = UIKit.Panel("subpage", transform);
            var dimGo = new GameObject("dim", typeof(RectTransform));
            dimGo.transform.SetParent(root.transform, false);
            UiExt.Stretch(dimGo.GetComponent<RectTransform>());
            var dim = dimGo.AddComponent<Image>();
            dim.color = UiPalette.HexA("#05080C", 0.6f);
            // .card（battle 尺寸 1280×880 近似）
            var card = new GameObject("card", typeof(RectTransform));
            card.transform.SetParent(root.transform, false);
            var rt = card.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.015f, 0.025f); rt.anchorMax = new Vector2(0.985f, 0.975f);
            var img = card.AddComponent<Image>(); img.sprite = BtSprites.White();
            img.color = BtColors.HexA("#10232B", 0.98f);
            var ol = card.AddComponent<Outline>(); ol.effectColor = BtColors.BorderDark; ol.effectDistance = new Vector2(2, -2);
            var vl = card.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 8; vl.padding = new RectOffset(0, 0, 0, 12);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;
            CardRoot = rt;
            BodyRoot = BuildHeader(card.transform);
            var bodyGo = new GameObject("ovBody", typeof(RectTransform));
            bodyGo.transform.SetParent(card.transform, false);
            var leB = bodyGo.AddComponent<LayoutElement>(); leB.flexibleHeight = 1; leB.flexibleWidth = 1;
            BodyRoot = UIKit.Scroll(bodyGo.transform).transform;
            var btns = new GameObject("ov-btns", typeof(RectTransform));
            btns.transform.SetParent(card.transform, false);
            var hl = btns.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 10; hl.padding = new RectOffset(16, 16, 4, 4); hl.childAlignment = TextAnchor.MiddleCenter;
            hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
            hl.childControlWidth = true; hl.childControlHeight = true;
            var leF = btns.AddComponent<LayoutElement>(); leF.minHeight = 88; leF.flexibleHeight = 0;
            BtnsRoot = btns.transform;
            OnBody();
        }

        /// <summary>子类标题行（ovTitle）。</summary>
        private Transform BuildHeader(Transform card)
        {
            var head = new GameObject("ovTitle", typeof(RectTransform));
            head.transform.SetParent(card, false);
            var himg = head.AddComponent<Image>(); himg.sprite = BtSprites.White();
            himg.color = BtColors.HexA("#0A0A0A", 0.62f);
            var hl = head.AddComponent<HorizontalLayoutGroup>();
            hl.padding = new RectOffset(18, 8, 8, 8); hl.spacing = 4;
            hl.childForceExpandWidth = true; hl.childForceExpandHeight = false;
            hl.childControlWidth = true; hl.childControlHeight = true;
            var t = UIKit.IconText(head.transform, TitleText());
            t.fontSize = 34; t.color = BtColors.Hex("#F0E0B8");
            var le = head.AddComponent<LayoutElement>(); le.minHeight = 88; le.flexibleHeight = 0;
            return head.transform;
        }

        protected abstract string TitleText();
        protected abstract void OnBody();

        public void Dismiss() { Close(); }

        /// <summary>清掉 ovBody 与 ov-btns 内容再重建（innerHtml 重绘）。</summary>
        protected void ClearBody()
        {
            for (int i = BodyRoot.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(BodyRoot.GetChild(i).gameObject);
            for (int i = BtnsRoot.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(BtnsRoot.GetChild(i).gameObject);
        }

        public virtual void SetSnapshot(BattleSnapshot s)
        {
            ClearBody();
            OnBody();
        }
    }

    // ================= renderDeckSelection =================
    public sealed class DeckSelectionPanel : BattleSubpageBase
    {
        protected override string TitleText() => "[[icon:demon]] BOSS战 · 编组牌库";

        protected override void OnBody()
        {
            var s = GameSnapshotRef.Current;
            var api = BattleView.Api; var cmd = BattleView.Commands;
            if (s == null || s.DeckSelection == null || api == null || cmd == null) return;
            var ds = s.DeckSelection;
            int selected = ds.Selected.Count;
            int need = Math.Min(ds.Need, ds.Cards.Count);

            // ov-stats
            UIKit.Label(BodyRoot, (ds.Boss?.Name ?? "首脑战") + "    已选 " + selected + " / " + ds.Maximum, 30, BtColors.Hex("#F2E4C3"));
            UIKit.Label(BodyRoot, "从背包选 " + ds.Need + "～" + ds.Maximum + " 张可编入卡牌，与 " + ds.StarterCount +
                " 张初始攻击组成牌库 · 开局抽 " + api.BattleStartDraw + " 张 · 每回合开始抽 " + api.BattleTurnDraw +
                " 张 · 每回合固定 " + api.BattleEnergy + " 费", 20, Color.white);
            // 词缀 ov-note
            var aff = ds.Boss != null && !string.IsNullOrEmpty(ds.Boss.Affix) ? api.AffixMeta(ds.Boss.Affix) : null;
            if (aff != null)
                UIKit.IconText(BodyRoot, "[[icon:question]] " + ds.Boss.Name + " 词缀【" + aff.Icon + " " + aff.Name + "】" + aff.Desc)
                    .color = UiPalette.Dim;
            // 固定编入 ov-note
            UIKit.IconText(BodyRoot, "[[icon:lock]] 固定编入：初始攻击 ×" + ds.StarterCount +
                "（不足时补齐本场临时初始攻击）" +
                " · [[icon:cross]] 道具 / 资源 / 事件卡与初始攻击不可选入").color = UiPalette.Dim;
            // set-h
            var h = UIKit.Row(BodyRoot);
            var hhl = h.AddComponent<HorizontalLayoutGroup>();
            hhl.childForceExpandWidth = true; hhl.childForceExpandHeight = false;
            hhl.childControlWidth = true; hhl.childControlHeight = true;
            var sh = UIKit.IconText(h.transform, "可选卡牌  已选 " + selected + " · 最少 " + ds.Need + " / 上限 " + ds.Maximum);
            sh.fontSize = 18; sh.color = UiPalette.AkMint;
            // bt-hand 可选卡
            if (ds.Cards.Count > 0)
            {
                var row = UIKit.Row(BodyRoot);
                var grid = row.AddComponent<GridLayoutGroup>();
                grid.cellSize = new Vector2(260,390); grid.spacing = new Vector2(18,24); grid.padding = new RectOffset(16,16,18,24);
                grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                grid.constraintCount = Math.Max(1, Mathf.FloorToInt((((RectTransform)transform).rect.width * .97f - 80) / 278));
                int rows = Mathf.CeilToInt(ds.Cards.Count / (float)grid.constraintCount);
                row.AddComponent<LayoutElement>().preferredHeight = rows * 414 + 42;
                foreach (var entry in ds.Cards)
                {
                    var cardGo = CardFace.Create(entry.Card, CardSize.Xl, row.transform);
                    var paper = cardGo.transform.Find("paper-card") as RectTransform; if (paper != null) paper.sizeDelta = new Vector2(260,390);
                    bool sel = ds.Selected.Contains(entry.Uid);
                    var ol = cardGo.AddComponent<Outline>();
                    ol.effectColor = sel ? BtColors.Silver : Color.clear;
                    ol.effectDistance = new Vector2(2, -2);
                    var uid = entry.Uid;
                    var btn = cardGo.AddComponent<Button>(); btn.targetGraphic = cardGo.GetComponent<Image>();
                    btn.onClick.AddListener(() => { Sdt.Run.AudioService.I.PlaySfx("click"); cmd.SelectDeckCard(uid); });
                }
            }
            else UIKit.Label(BodyRoot, "背包里没有可编入的非道具卡牌……", 14, UiPalette.Dim);

            bool ready = selected >= need && selected <= ds.Maximum;
            BtBtn.Create(BtnsRoot, ready
                    ? "[[icon:swords]] 开始战斗（牌库 " + (selected + ds.StarterCount) + " 张）"
                    : "还需选择 " + (need - selected) + " 张…",
                cmd.ConfirmDeck, "ok", enabled: ready);
            BtBtn.Create(BtnsRoot, "↩ 放弃挑战", cmd.CancelDeck);
        }
    }

    // ================= discovering 段（发现三选一） =================
    public sealed class DiscoverPanel : BattleSubpageBase
    {
        int _selected = -1;
        float _readyAt;
        string _options;
        protected override string TitleText()
        {
            var s = GameSnapshotRef.Current;
            bool boss = s != null && s.Opts != null && s.Opts.IsBoss;
            return (boss ? "[[icon:demon]] BOSS战" : "[[icon:swords]] 遭遇战") +
                   " · 第 " + (s != null ? s.Turn : 0) + " 回合 · [[icon:question]] 发现";
        }

        protected override void OnBody()
        {
            var s = GameSnapshotRef.Current;
            var cmd = BattleView.Commands;
            if (s == null || s.Discovering == null || cmd == null) return;
            string options = s.Discovering.n + ":" + string.Join("|", s.Discovering.Options.Select(c => c.id + c.desc));
            if (_options != options) { _options = options; _selected = -1; _readyAt = Time.unscaledTime + .35f; }
            UIKit.Label(BodyRoot, "从随机 " + s.Discovering.Options.Count + " 张卡牌中选择 1 张置入手牌",
                24, Color.white);
            var row = UIKit.Row(BodyRoot);
            var hl = row.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 64; hl.padding = new RectOffset(32, 32, 28, 22); hl.childAlignment = TextAnchor.MiddleCenter;
            hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
            hl.childControlWidth = true; hl.childControlHeight = true;
            for (int i = 0; i < s.Discovering.Options.Count; i++)
            {
                var c = s.Discovering.Options[i];
                var cardGo = CardFace.Create(c, CardSize.Xl, row.transform);
                var idx = i;
                var btn = cardGo.AddComponent<Button>(); btn.targetGraphic = cardGo.GetComponent<Image>();
                var outline = cardGo.AddComponent<Outline>(); outline.effectColor = _selected == i ? BtColors.Hex("#E0C98E") : Color.clear; outline.effectDistance = new Vector2(3,-3);
                btn.onClick.AddListener(() => { if (Time.unscaledTime < _readyAt) return; _selected = idx; SetSnapshot(GameSnapshotRef.Current); });
            }
            UIKit.Label(BodyRoot, "发现的卡是战斗内临时卡，战后消散、不进背包。", 12, UiPalette.Dim);
            BtBtn.Create(BtnsRoot, "确认选择", () => { if (_selected >= 0 && Time.unscaledTime >= _readyAt) { int index = _selected; _selected = -1; cmd.PickDiscover(index); } }, "ok", _selected >= 0);
        }
    }

    // ================= renderGrave =================
    public sealed class GravePanel : BattleSubpageBase
    {
        protected override string TitleText()
        {
            var s = GameSnapshotRef.Current;
            bool boss = s != null && s.Opts != null && s.Opts.IsBoss;
            return (boss ? "[[icon:demon]] BOSS战" : "[[icon:swords]] 遭遇战") +
                   " · 第 " + (s != null ? s.Turn : 0) + " 回合 · [[icon:skull]] 墓地";
        }

        protected override void OnBody()
        {
            var s = GameSnapshotRef.Current;
            var cmd = BattleView.Commands;
            var api = BattleView.Api;
            if (s == null || cmd == null || api == null) return;
            var cards = new List<CardDef>();
            foreach (var uid in s.Grave)
            {
                var e = api.FindCard(uid);
                if (e != null) cards.Add(e.Card);
            }
            // ov-stats：类型统计
            var byType = cards.GroupBy(c => c.type).OrderByDescending(g => g.Count()).ToList();
            string stat = byType.Count > 0
                ? string.Join(" · ", byType.Select(g => g.Key + " " + g.Count()))
                : "（墓地还是空的——注能等效果消耗的牌会进入这里）";
            UIKit.Label(BodyRoot, "被消耗的牌共 " + cards.Count + " 张 —— " + stat, 14, Color.white);
            // bt-gy-list：按名聚合
            foreach (var g in cards.GroupBy(c => c.name))
            {
                var first = g.First();
                var rowGo = new GameObject("bt-gy-row", typeof(RectTransform));
                rowGo.transform.SetParent(BodyRoot, false);
                var hl = rowGo.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 10; hl.padding = new RectOffset(8, 8, 3, 3); hl.childAlignment = TextAnchor.MiddleLeft;
                hl.childForceExpandWidth = true; hl.childForceExpandHeight = false;
                hl.childControlWidth = true; hl.childControlHeight = true;
                var img = rowGo.AddComponent<Image>(); img.sprite = BtSprites.White();
                img.color = BtColors.HexA("#131A21", 0.9f);
                UIKit.IconText(rowGo.transform, "[[icon:cards]] " + first.name + (g.Count() > 1 ? " ×" + g.Count() : ""))
                    .fontSize = 14;
                UIKit.Label(rowGo.transform, first.type + " · " + first.cost + "费 · " + (first.rarity ?? ""),
                    12, UiPalette.Dim);
                var le = rowGo.AddComponent<LayoutElement>(); le.minHeight = 26;
            }
            UIKit.Label(BodyRoot,
                "消耗牌堆不会自动洗回；卡牌效果可以复原其中的牌。战后按结算结果进入消耗区。",
                12, UiPalette.Dim);
            BtBtn.Create(BtnsRoot, "↩ 返回战斗", cmd.CloseGrave);
        }
    }
}
