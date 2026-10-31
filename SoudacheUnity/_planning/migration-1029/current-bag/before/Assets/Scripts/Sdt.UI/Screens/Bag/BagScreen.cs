// ported from src/game.bag.js showBackpack()/bindBagDrag()/moveStackSafe()/syncCardOrder()/moveStackOrder()
//
// 原界面 DOM 结构 → uGUI 控件树映射（.bag-view，mode='bagpage'）：
//   header.bag-head > .bag-head-info（h2 + .bag-chips×4）+ button.bag-close
//     → 顶部行：标题 + 4 个 chip（格数/总值/安全格/消耗口袋）+ 右上关闭按钮（B）
//   .bag-layout > .bag-main（h3 背包格 + .bag-grid；h3 安全格 + .bag-grid.safe-grid）
//     → 左列两个 GridLayoutGroup：物资格/卡牌格（flip3d 卡槽）/空格
//   aside.bag-side > .bag-side-card（h3 消耗口袋 n 张 + .pk-list）
//     → 右侧口袋列表：卡名 ×n + 「n费 · 无法使用」
// 卡槽 .bag-slot.card-slot.flip3d[data-stack] → BagCell（MonoBehaviour）：
//   .flip-inner（旋转枢轴）→ .flip-face.flip-front（CardFace + ×n 计数）/.flip-face.flip-back（CardBack）
//   双击 → 翻面动画（绕 Y 轴 0↔180°，前/后两张面片按角度切换显隐）
//   按住拖动 → BagCell 实现 IPointerDown/IDrag/IPointerUpHandler：浮影 ghost（真卡面 + 速度倾斜），
//   落点判定：安全格 → moveStackSafe(true)；背包卡格 → moveStackOrder(插到其前)；空格/物资格 → 移到末尾；
//   页面外 → 丢弃确认（BagCardDetail.ShowDiscardConfirm）。
using System;
using Sdt.Run;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using Sdt.Core;

namespace Sdt.UI.Screens.Bag
{
    /// <summary>背包页主界面。Open() 呼出（B 键切换）；Refresh() 对应 showBackpack(true)。</summary>
    public class BagScreen : Panel
    {
        public static BagScreen Current;

        public static void Open()
        {
            var st = GameRuntime.I.State;
            if (st == null || !st.runActive) return;   // 只有对局中才有背包
            if (st.battleActive || st.bossCleanupPending)
            {
                RunLog.Log(st.battleActive
                    ? "[[icon:lock]] 战斗中无法打开背包；请使用手牌完成战斗或撤退"
                    : "[[icon:bag]] 请先完成 BOSS 战后的「整理背包」", "warn");
                return;
            }
            if (Current != null) { Current.CloseBag(); return; }   // B 再按一次 = 关闭
            var s = ScreenMount.Show<BagScreen>("Bag");
            s.Build();
            App.RegisterKey(KeyCode.B, ToggleFromKey);
        }

        static void ToggleFromKey() { if (Current != null) Current.CloseBag(); else Open(); }

        // ---------- cardStacks / 容量（game.core.js 语义） ----------
        public sealed class Stack { public CardDef card; public int count; public List<string> uids = new List<string>(); }
        public static List<Stack> CardStacks(RunState st, bool safe)
        {
            var result = new List<Stack>();
            foreach (var group in st.ownedCards.Where(entry => (entry.safe == true) == safe && !entry.stored && string.IsNullOrEmpty(entry.pouchOf)).GroupBy(entry => entry.card.name))
            {
                var cards = group.ToList(); int cap = CardContainerCommands.StackCap(cards[0].card);
                for (int index = 0; index < cards.Count; index += cap)
                {
                    var entries = cards.Skip(index).Take(cap).ToList();
                    result.Add(new Stack { card = entries[0].card, count = entries.Count, uids = entries.Select(entry => entry.uid).ToList() });
                }
            }
            return result;
        }
        static int UsedSlots(RunState st) => GameRuntime.I.UsedSlots();

        // cardOrder 排序（syncCardOrder/sortStacksByOrder/moveStackOrder）
        public static void SyncCardOrder(RunState st)
        {
            var known = new List<string>();
            CardStacks(st, false).ForEach(s => known.Add(s.card.name));
            CardStacks(st, true).ForEach(s => known.Add(s.card.name));
            var ord = (st.cardOrder ?? new List<string>()).Where(known.Contains).ToList();
            foreach (var n in known) if (!ord.Contains(n)) ord.Add(n);
            st.cardOrder = ord;
        }
        static List<Stack> SortedByOrder(RunState st, List<Stack> stacks)
        {
            var ord = st.cardOrder ?? new List<string>();
            return stacks.OrderBy(s => { var i = ord.IndexOf(s.card.name); return i < 0 ? int.MaxValue : i; }).ToList();
        }
        public static void MoveStackOrder(RunState st, string srcName, string beforeName)
        {
            SyncCardOrder(st);
            var ord = st.cardOrder.Where(n => n != srcName).ToList();
            int di = beforeName != null ? ord.IndexOf(beforeName) : -1;
            ord.Insert(di < 0 ? ord.Count : di, srcName);
            st.cardOrder = ord;
        }

        /// <summary>moveStackSafe：背包格 ⇄ 安全格（同名整堆移动 + 容量/初始牌校验，文案照抄）。</summary>
        public static void MoveStackSafe(string name, bool toSafe, IEnumerable<string> sourceUids = null)
        {
            var runtime = GameRuntime.I;
            var ids = sourceUids ?? CardStacks(runtime.State, !toSafe).FirstOrDefault(stack => stack.card.name == name)?.uids;
            if (!CardContainerCommands.TryMoveSafe(runtime, ids, toSafe, out var reason)) RunLog.Log(reason, "warn");
            Refresh();
        }

        public static void Refresh()
        {
            var c = Current;
            if (c == null) return;
            c.CancelInteractions();
            for (int i = c.transform.childCount - 1; i >= 0; i--)
            {
                var old = c.transform.GetChild(i).gameObject;
                old.SetActive(false);
                Destroy(old);
            }
            c.Build();
        }

        void CancelInteractions()
        {
            foreach (var cell in GetComponentsInChildren<BagCell>(true)) cell.CancelInteraction();
            BagCell.BagCellHover.Current = null;
            DropZoneHover.Current = null;
        }

        public void CloseBag()
        {
            Close();
        }

        internal override void OnClose()
        {
            CancelInteractions();
            App.UnregisterKey(KeyCode.B);
            Current = null;
        }

        public override void Build()
        {
            Current = this;
            var st = GameRuntime.I.State;
            SyncCardOrder(st);
            int cap = GameRuntime.I.BagCap, sCap = GameRuntime.I.SafeCap;
            int total = st.inventory.Sum(i => i.value * (i.count > 0 ? i.count : 1));
            int pkN = st.usedPocket.Sum(p => p.count);

            var root = UIKit.Panel("bag-view", transform);
            var bg = UiExt.Box(root.transform, UiPalette.HexA("#0B1822", 0.96f));
            UiExt.Stretch(bg.rectTransform);
            var vl = root.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 8; vl.padding = new RectOffset(24, 24, 16, 16);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;

            // header.bag-head：标题 + chips + 关闭
            var head = UiExt.Row(root.transform);
            var hHl = head.AddComponent<HorizontalLayoutGroup>();
            hHl.spacing = 12; hHl.childAlignment = TextAnchor.MiddleLeft;
            var h2 = UIKit.IconText(head.transform, "[[icon:bag]] 背包");
            h2.fontSize = 24; h2.fontStyle = FontStyle.Bold; h2.color = Color.white;
            var chips = UiExt.Row(head.transform);
            var cHl = chips.AddComponent<HorizontalLayoutGroup>();
            cHl.spacing = 8; cHl.childForceExpandWidth = false;
            UiExt.Chip(chips.transform, "格数 <b>" + UsedSlots(st) + "/" + cap + "</b>");
            UiExt.Chip(chips.transform, "总值 <b>¥" + total.ToString("N0") + "</b>");
            UiExt.Chip(chips.transform, "[[icon:lock]] 安全格 <b>" + CardStacks(st, true).Count + "/" + sCap + "</b>");
            UiExt.Chip(chips.transform, "[[icon:pocket]] 消耗口袋 <b>" + pkN + "</b> 张");
            var spacer = new GameObject("spacer", typeof(RectTransform));
            spacer.transform.SetParent(head.transform, false);
            var leSp = spacer.AddComponent<LayoutElement>(); leSp.flexibleWidth = 1;
            UIKit.Btn(head.transform, "×", () => CloseBag());
            if (CardContainerCommands.Capacity(GameRuntime.I, "pouch") > 0)
                UIKit.Btn(head.transform, "锦囊", () => ContainerScreen.Open("pouch"));
            if (CardContainerCommands.Capacity(GameRuntime.I, "pearl") > 0)
                UIKit.Btn(head.transform, "珍珠盒", () => ContainerScreen.Open("pearl"));

            // .bag-layout：左主区（背包格+安全格） + 右侧口袋
            var layout = UiExt.Row(root.transform);
            var lHl = layout.AddComponent<HorizontalLayoutGroup>();
            lHl.spacing = 16; lHl.childForceExpandWidth = true; lHl.childForceExpandHeight = true;
            lHl.childControlWidth = true; lHl.childControlHeight = true;
            var leL = layout.AddComponent<LayoutElement>(); leL.flexibleHeight = 1;

            var main = UiExt.Col(layout.transform);
            var mVl = main.AddComponent<VerticalLayoutGroup>();
            mVl.spacing = 6; mVl.childForceExpandWidth = true; mVl.childForceExpandHeight = false;
            var leM = main.AddComponent<LayoutElement>(); leM.flexibleWidth = 2.4f;

            UiExt.SectionLabel(main.transform, "[[icon:bag]] 背包格");
            var bagScroll = UIKit.Scroll(main.transform);
            var leBS = bagScroll.AddComponent<LayoutElement>(); leBS.minHeight = 320; leBS.flexibleHeight = 1.4f;
            // Scroll returns content; the viewport receives raycasts in the empty space around its cells.
            bagScroll.GetComponentInParent<ScrollRect>().gameObject.AddComponent<DropZone>().kind = DropZoneKind.BagArea;
            var bagGrid = UIKit.Grid(bagScroll.transform, 8, new Vector2(104, 144), new Vector2(8, 8));

            UiExt.SectionLabel(main.transform, "[[icon:lock]] 安全格");
            var safeScroll = UIKit.Scroll(main.transform);
            var leSS = safeScroll.AddComponent<LayoutElement>(); leSS.minHeight = 160; leBS.flexibleHeight = 1f;
            safeScroll.GetComponentInParent<ScrollRect>().gameObject.AddComponent<DropZone>().kind = DropZoneKind.Safe;
            var safeGrid = UIKit.Grid(safeScroll.transform, 6, new Vector2(104, 144), new Vector2(8, 8));

            // 背包格：物资在前，卡堆随后，剩余空格
            var stacks = SortedByOrder(st, CardStacks(st, false));
            var supplies = st.inventory;
            for (int i = 0; i < cap; i++)
            {
                if (i < supplies.Count)
                {
                    var it = supplies[i];
                    var cell = new GameObject("bag-slot.item", typeof(RectTransform));
                    cell.transform.SetParent(bagGrid.transform, false);
                    var img = UiExt.Box(cell.transform, UiPalette.HexA("#12222E", 0.9f));
                    img.raycastTarget = true;
                    UiExt.Stretch(img.rectTransform);
                    var cvl = cell.AddComponent<VerticalLayoutGroup>();
                    cvl.padding = new RectOffset(6, 6, 6, 6); cvl.spacing = 2; cvl.childAlignment = TextAnchor.MiddleCenter;
                    UIKit.Label(cell.transform, it.name + (it.count > 1 ? " ×" + it.count : ""), 14, Color.white).alignment = TextAnchor.MiddleCenter;
                    UIKit.Label(cell.transform, "¥" + it.value * it.count, 13, UiPalette.Gold).alignment = TextAnchor.MiddleCenter;
                    UIKit.Label(cell.transform, it.tier ?? "C", 12, UiPalette.Dim).alignment = TextAnchor.MiddleCenter;
                    cell.AddComponent<DropZone>().kind = DropZoneKind.BagArea;
                }
                else if (i - supplies.Count < stacks.Count)
                {
                    var s = stacks[i - supplies.Count];
                    BagCell.Create(bagGrid.transform, this, s, safe: false);
                }
                else
                {
                    var cell = new GameObject("bag-slot.empty", typeof(RectTransform));
                    cell.transform.SetParent(bagGrid.transform, false);
                    var img = UiExt.Box(cell.transform, UiPalette.HexA("#0E1A24", 0.6f));
                    img.raycastTarget = true;
                    UiExt.Stretch(img.rectTransform);
                    cell.AddComponent<DropZone>().kind = DropZoneKind.BagArea;
                }
            }

            // 安全格
            var safeStacks = SortedByOrder(st, CardStacks(st, true));
            for (int i = 0; i < sCap; i++)
            {
                if (i < safeStacks.Count) BagCell.Create(safeGrid.transform, this, safeStacks[i], safe: true);
                else
                {
                    var cell = new GameObject("safe-slot.empty", typeof(RectTransform));
                    cell.transform.SetParent(safeGrid.transform, false);
                    var img = UiExt.Box(cell.transform, UiPalette.HexA("#101C2A", 0.6f));
                    img.raycastTarget = true;
                    UiExt.Stretch(img.rectTransform);
                    cell.AddComponent<DropZone>().kind = DropZoneKind.Safe;
                }
            }

            // aside.bag-side：消耗口袋
            var side = UiExt.Col(layout.transform);
            var sVl = side.AddComponent<VerticalLayoutGroup>();
            sVl.spacing = 6; sVl.childForceExpandWidth = true; sVl.childForceExpandHeight = false;
            var leSide = side.AddComponent<LayoutElement>(); leSide.flexibleWidth = 1;
            UiExt.SectionLabel(side.transform, "[[icon:pocket]] 消耗口袋 " + pkN + " 张");
            var pkScroll = UIKit.Scroll(side.transform);
            var lePk = pkScroll.AddComponent<LayoutElement>(); lePk.flexibleHeight = 1;
            if (st.usedPocket.Count > 0)
            {
                foreach (var p in st.usedPocket)
                {
                    var row = UiExt.Row(pkScroll.transform);
                    var hl = row.AddComponent<HorizontalLayoutGroup>();
                    hl.spacing = 6; hl.childAlignment = TextAnchor.MiddleLeft;
                    var n = UIKit.Label(row.transform, "[[icon:cards]] <b>" + p.card.name + "</b>" + (p.count > 1 ? " ×" + p.count : ""), 14, Color.white);
                    var leN = n.gameObject.AddComponent<LayoutElement>(); leN.flexibleWidth = 1;
                    UIKit.Label(row.transform, p.card.cost + "费 · 无法使用", 12, UiPalette.Dim);
                }
            }
            else
            {
                UIKit.Label(pkScroll.transform, "（空——对小怪使用过的卡牌会进入这里）", 13, UiPalette.Dim);
            }
        }

        protected override void OnDestroy()
        {
            CancelInteractions();
            if (Current == this) { Current = null; App.UnregisterKey(KeyCode.B); }
        }
    }

    /// <summary>
    /// 卡牌格（.bag-slot.card-slot.flip3d[data-stack]）：双击翻面 + 按住拖拽排序/入安全格 + 点击详情。
    /// 拖拽浮影 ghost：真卡面 + 跟随速度的倾斜（uGUI 平面内 z 轴旋转近似 CSS rotateX/rotateY 立体姿态）。
    /// </summary>
    public class BagCell : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler, IPointerClickHandler,
        IPointerEnterHandler, IPointerExitHandler
    {
        BagScreen _owner; BagScreen.Stack _stack; bool _safe;
        Transform _inner;            // .flip-inner
        GameObject _front, _back;
        bool _flipped;
        float _targetRot;            // 0 / 180
        float _curRot;
        bool _down; Vector2 _downPos; bool _moved;
        GameObject _ghost; RectTransform _ghostRt;
        Vector2 _last; float _vx, _vy;
        float _lastClickTime = float.NegativeInfinity;
        Coroutine _detailRoutine;

        public static BagCell Create(Transform parent, BagScreen owner, BagScreen.Stack stack, bool safe)
        {
            var cell = new GameObject("card-slot", typeof(RectTransform));
            cell.transform.SetParent(parent, false);
            var rt = cell.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(104, 144);
            var img = UiExt.Box(cell.transform, UiPalette.HexA("#0E1A24", 0.7f));
            img.raycastTarget = true;
            UiExt.Stretch(img.rectTransform);

            // .flip-inner：旋转枢轴
            var inner = new GameObject("flip-inner", typeof(RectTransform));
            inner.transform.SetParent(cell.transform, false);
            UiExt.Stretch(inner.GetComponent<RectTransform>());

            var c = cell.AddComponent<BagCell>();
            c._owner = owner; c._stack = stack; c._safe = safe; c._inner = inner.transform;

            // 正面：卡面 + ×n 计数（安全格加 [[icon:lock]]，初始攻击加 [[icon:pen]]）
            c._front = new GameObject("flip-front", typeof(RectTransform));
            c._front.transform.SetParent(inner.transform, false);
            UiExt.Stretch(c._front.GetComponent<RectTransform>());
            var isSha = stack.card.id == CardLibrary.SHA.id;
            CardFace.Create(stack.card, CardSize.Sm, c._front.transform);
            var cnt = UIKit.Label(c._front.transform, "×" + stack.count + (safe ? " · [[icon:lock]]" : isSha ? " · [[icon:pen]]" : ""), 13, Color.white);
            cnt.alignment = TextAnchor.UpperCenter;
            var le = cnt.gameObject.AddComponent<LayoutElement>(); le.minHeight = 16; le.flexibleHeight = 0;
            cnt.rectTransform.anchorMin = new Vector2(0, 1); cnt.rectTransform.anchorMax = new Vector2(1, 1);
            cnt.rectTransform.pivot = new Vector2(0.5f, 1); cnt.rectTransform.anchoredPosition = Vector2.zero;

            // 背面：卡背
            c._back = CardFace.CardBack(CardSize.Sm, inner.transform);
            UiExt.Stretch(c._back.GetComponent<RectTransform>());
            c._back.SetActive(false);
            return c;
        }

        void Update()
        {
            // flip3d 翻面动画：绕 Y 轴 0↔180°（简化为水平缩放模拟旋转 + 面片切换）
            if (Mathf.Abs(_curRot - _targetRot) > 0.5f)
            {
                _curRot = Mathf.Lerp(_curRot, _targetRot, Time.deltaTime * 12f);
                ApplyFlip(_curRot);
            }
        }

        void ApplyFlip(float angle)
        {
            // 翻面 = 前后两张面片绕 Y 轴旋转切换（水平缩放模拟旋转，90° 处切面）
            var scale = Mathf.Max(0.08f, Mathf.Abs(Mathf.Cos(Mathf.Deg2Rad * angle)));
            _inner.localScale = new Vector3(scale, 1, 1);
            _front.SetActive(angle < 90f);
            _back.SetActive(angle >= 90f);
        }

        public void OnPointerDown(PointerEventData e)
        {
            if (e.button != PointerEventData.InputButton.Left || !isActiveAndEnabled || _owner != BagScreen.Current) return;
            StopPendingDetail();
            _down = true; _moved = false; _downPos = e.position; _last = e.position; _vx = _vy = 0;
        }

        public void OnDrag(PointerEventData e)
        {
            if (!_down) return;
            if (!_moved)
            {
                if (Vector2.Distance(e.position, _downPos) < 5) return;
                _moved = true;
                MakeGhost(e.position);
                AudioService.I.PlaySfx("pick");
            }
            // 速度平滑 → 倾角（vx*0.72+dx*0.9 语义）
            var dx = e.position.x - _last.x; var dy = e.position.y - _last.y;
            _vx = _vx * 0.72f + dx * 0.9f; _vy = _vy * 0.72f + dy * 0.9f;
            _last = e.position;
            if (_ghostRt != null)
            {
                _ghostRt.position = e.position;
                var ry = Mathf.Clamp(_vx * 1.5f, -30f, 30f);
                var rx = Mathf.Clamp(-_vy * 1.4f, -22f, 22f);
                // CSS rotateX/rotateY 的平面近似：z 轴旋转 + 微放大
                _ghostRt.localRotation = Quaternion.Euler(0, 0, (rx + ry) * 0.5f);
                _ghostRt.localScale = Vector3.one * 1.07f;
            }
        }

        void MakeGhost(Vector2 pos)
        {
            var ghost = new GameObject("bag-ghost", typeof(RectTransform));
            var canvas = GetComponentInParent<Canvas>();
            ghost.transform.SetParent(canvas != null ? canvas.transform : _owner.transform, false);
            _ghostRt = ghost.GetComponent<RectTransform>();
            _ghostRt.sizeDelta = CardFace.SizeOf(CardSize.Sm);
            _ghostRt.position = pos;
            var cg = ghost.AddComponent<CanvasGroup>(); cg.blocksRaycasts = false; cg.alpha = 0.95f;
            CardFace.Create(_stack.card, CardSize.Sm, ghost.transform);
            _ghost = ghost;
        }

        public void OnPointerUp(PointerEventData e)
        {
            if (!_down) return;
            _down = false;
            ClearGhost();
            if (!_moved) return;   // 原地按住未拖动 = 无操作
            AudioService.I.PlaySfx("drop");
            var st = GameRuntime.I.State;
            // 落点判定（bagDropTarget）：卡格(具体堆) > 安全格区 > 背包格区(空格/物资格=末尾) > 页面外(丢弃确认)
            var over = BagCellHover.Current;
            var zone = DropZoneHover.Current;
            BagCellHover.Current = null; DropZoneHover.Current = null;
            if (over == this) over = null;
            if (over != null && !over._safe)
            {
                if (_safe)
                {
                    BagScreen.MoveStackOrder(st, _stack.card.name, over._stack != null ? over._stack.card.name : null);
                    BagScreen.MoveStackSafe(_stack.card.name, false, _stack.uids);
                    return;
                }
                BagScreen.MoveStackOrder(st, _stack.card.name, over._stack != null ? over._stack.card.name : null);
            }
            else if (over != null && over._safe)
            {
                if (!_safe) BagScreen.MoveStackSafe(_stack.card.name, true, _stack.uids);
                return;
            }
            else if (zone == DropZoneKind.Safe)
            {
                if (!_safe) BagScreen.MoveStackSafe(_stack.card.name, true, _stack.uids);
                return;
            }
            else if (zone == DropZoneKind.BagArea)
            {
                if (_safe)
                {
                    BagScreen.MoveStackOrder(st, _stack.card.name, null);
                    BagScreen.MoveStackSafe(_stack.card.name, false, _stack.uids);
                    return;
                }
                BagScreen.MoveStackOrder(st, _stack.card.name, null);   // 空格/物资格 = 移到末尾
            }
            else
            {
                BagCardDetail.ShowDiscardConfirm(_stack.card.name, _safe);   // 拖到背包外 = 申请丢弃
                return;
            }
            GameRuntime.I.SaveCurrent();
            BagScreen.Refresh();
        }

        public void OnPointerClick(PointerEventData e)
        {
            if (_moved || e.button != PointerEventData.InputButton.Left || !isActiveAndEnabled || _owner != BagScreen.Current) return;
            if (Time.unscaledTime - _lastClickTime < 0.35f)
            {
                // 双击翻面：正面 ⇄ 卡背
                _flipped = !_flipped;
                _targetRot = _flipped ? 180f : 0f;
                AudioService.I.PlaySfx("click");
                _lastClickTime = 0;
            }
            else
            {
                _lastClickTime = Time.unscaledTime;
                // The pending detail belongs to this live cell and is cancelled when its page closes or rebuilds.
                _detailRoutine = StartCoroutine(DetailIfNotDouble(_stack.card.name, _safe, _lastClickTime));
            }
        }

        System.Collections.IEnumerator DetailIfNotDouble(string name, bool safe, float stamp)
        {
            yield return new WaitForSecondsRealtime(.37f);
            _detailRoutine = null;
            if (_lastClickTime == stamp && _owner != null && BagScreen.Current == _owner && UiStack.Top == _owner)
                BagCardDetail.Show(name, safe);
        }

        void StopPendingDetail()
        {
            if (_detailRoutine == null) return;
            StopCoroutine(_detailRoutine);
            _detailRoutine = null;
        }

        void ClearGhost()
        {
            if (_ghost != null)
            {
                _ghost.SetActive(false);
                Destroy(_ghost);
            }
            _ghost = null;
            _ghostRt = null;
        }

        internal void CancelInteraction()
        {
            StopPendingDetail();
            ClearGhost();
            _down = false;
            _moved = false;
            _lastClickTime = float.NegativeInfinity;
            if (BagCellHover.Current == this) BagCellHover.Current = null;
        }

        void OnDisable() => CancelInteraction();
        void OnDestroy() => CancelInteraction();

        /// <summary>拖拽落点悬停标记（elementFromPoint 的 uGUI 对应物）。</summary>
        public static class BagCellHover { public static BagCell Current; }

        public void OnPointerEnter(PointerEventData e) { BagCellHover.Current = this; }
        public void OnPointerExit(PointerEventData e) { if (BagCellHover.Current == this) BagCellHover.Current = null; }
    }

    public enum DropZoneKind { BagArea, Safe }

    public static class DropZoneHover { public static DropZoneKind? Current; }

    /// <summary>网格区域落点（空格/物资格 → BagArea；安全格区 → Safe）。</summary>
    public class DropZone : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
    {
        public DropZoneKind kind;
        public void OnPointerEnter(PointerEventData e) { DropZoneHover.Current = kind; }
        public void OnPointerExit(PointerEventData e) { if (DropZoneHover.Current == kind) DropZoneHover.Current = null; }
    }
}
