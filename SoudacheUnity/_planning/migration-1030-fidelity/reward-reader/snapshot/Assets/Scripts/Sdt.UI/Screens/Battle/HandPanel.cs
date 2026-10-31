// Current runtime: battle.hand.js stable slots + battle.hand-layout.js + battle-stage.css.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    public class BattleCard : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler,
        IPointerDownHandler, IPointerUpHandler, IDragHandler, IBeginDragHandler, ISelectHandler, IDeselectHandler
    {
        public string Uid, Side, FaceSignature;
        public bool Off, Targeting, Lift;
        public bool Infusion;
        public Vector2 FanPos;
        public float FanRotDeg;
        public int DisplayIndex;
        public Action<BattleCard> OnCardClick, OnCardAimCancel;
        public Func<BattleCard, bool> OnCardAimBegin;
        public Action<BattleCard, PointerEventData> OnCardDrag;
        public Action<BattleCard, PointerEventData, bool> OnCardAimEnd;
        public RectTransform CardRt { get; private set; }
        public List<string> Uids = new List<string>();
        bool _aiming, _moved, _reading;
        bool _poseInitialized;
        Vector2 _poseFrom, _poseTarget;
        float _poseTime, _poseDuration;
        public bool Reading => _reading;
        Vector2 _downPos;
        CanvasGroup _group;
        Text _count;
        public static BattleCard Create(CardDef card, Transform parent, CardFaceOptions options = null)
        {
            var slot = new GameObject("bt-slot", typeof(RectTransform));
            slot.transform.SetParent(parent, false);
            var bc = slot.AddComponent<BattleCard>();
            bc.CardRt = (RectTransform)slot.transform;
            bc.CardRt.anchorMin = bc.CardRt.anchorMax = new Vector2(.5f, 1);
            bc.CardRt.pivot = new Vector2(.5f, 1);
            bc.CardRt.sizeDelta = new Vector2(HandPanel.CardW, HandPanel.CardH);
            slot.AddComponent<Image>().color = Color.clear;
            bc._group = slot.AddComponent<CanvasGroup>();
            bc.RebuildFace(card, options);
            return bc;
        }
        public void RebuildFace(CardDef card, CardFaceOptions options)
        {
            foreach (Transform child in transform) { child.gameObject.SetActive(false); Destroy(child.gameObject); }
            var face = CardFace.Create(card, CardSize.Xl, transform, options: options);
            var rt = (RectTransform)face.transform; rt.sizeDelta = new Vector2(260, 390);
            rt.anchorMin = rt.anchorMax = new Vector2(.5f, .5f);
            var paper = face.transform.Find("paper-card") as RectTransform;
            if (paper != null) paper.sizeDelta = new Vector2(260, 390);
            foreach (var graphic in face.GetComponentsInChildren<Graphic>()) graphic.raycastTarget = false;
            _count = UIKit.Label(transform, "", 14, BtColors.Hex("#F3DFB4"));
            _count.name = "bt-count"; _count.alignment = TextAnchor.MiddleCenter;
            _count.rectTransform.anchorMin = _count.rectTransform.anchorMax = new Vector2(0, 1);
            _count.rectTransform.pivot = new Vector2(0, 1); _count.rectTransform.anchoredPosition = new Vector2(48, -12);
            _count.rectTransform.sizeDelta = new Vector2(50, 24); _count.raycastTarget = false;
        }
        public void SetCount(int count) { _count.text = count > 1 ? "×" + count : ""; }
        public void ApplyPose(float hoverK, Vector2 parentSize)
        {
            _reading = hoverK > 0;
            float drop = Infusion || Lift || Targeting ? 0 : _reading ? -30 : HandPanel.RestDrop;
            var position = FanPos + new Vector2(0, -drop);
            if (!_poseInitialized || Lift || Infusion) { CardRt.anchoredPosition = position; _poseInitialized = true; _poseTarget = position; _poseDuration = 0; }
            else if (_poseTarget != position || (_poseDuration <= 0 && CardRt.anchoredPosition != position)) { _poseFrom = CardRt.anchoredPosition; _poseTarget = position; _poseTime = 0; _poseDuration = _reading ? .3f : .42f; }
            CardRt.localRotation = Quaternion.identity; CardRt.localScale = Vector3.one * (Infusion ? 204f / 260 : 1);
            if (Lift || _reading || Targeting) transform.SetAsLastSibling();
            else transform.SetSiblingIndex(DisplayIndex);
            _group.alpha = Off ? (_reading ? .96f : .72f) : 1;
        }
        void Update()
        {
            if (Lift || _poseDuration <= 0) return;
            _poseTime += Time.unscaledDeltaTime;
            float progress = Mathf.Clamp01(_poseTime / _poseDuration), low = 0, high = 1;
            // CSS cubic-bezier(.25,.1,.25,1): invert X, then evaluate Y.
            for (int i = 0; i < 12; i++) { float t = (low + high) / 2, u = 1-t; float x = 3*u*u*t*.25f + 3*u*t*t*.25f + t*t*t; if (x < progress) low = t; else high = t; }
            float a = (low + high) / 2, b = 1-a, ease = 3*b*b*a*.1f + 3*b*a*a + a*a*a;
            CardRt.anchoredPosition = Vector2.LerpUnclamped(_poseFrom, _poseTarget, ease);
            if (progress >= 1) { CardRt.anchoredPosition = _poseTarget; _poseDuration = 0; }
        }
        public void OnPointerEnter(PointerEventData e) { if (!_aiming) ApplyPose(1, Vector2.zero); }
        public void OnPointerExit(PointerEventData e) { if (!_aiming) ApplyPose(0, Vector2.zero); }
        public void OnSelect(BaseEventData e) { ApplyPose(1, Vector2.zero); }
        public void OnDeselect(BaseEventData e) { ApplyPose(0, Vector2.zero); }
        public void OnPointerDown(PointerEventData e)
        {
            if (e.button != PointerEventData.InputButton.Left) return;
            _downPos = e.position; _moved = false;
            if (!Off && OnCardAimBegin?.Invoke(this) == true)
            { _aiming = true; Lift = true; ApplyPose(1, Vector2.zero); }
        }
        public void OnBeginDrag(PointerEventData e) { }
        public void OnDrag(PointerEventData e)
        {
            if (!_aiming || (!_moved && (e.position - _downPos).magnitude < 6)) return;
            _moved = true; OnCardDrag?.Invoke(this, e);
        }
        public void OnPointerUp(PointerEventData e)
        {
            if (e.button != PointerEventData.InputButton.Left) return;
            bool aiming = _aiming, moved = _moved; _aiming = _moved = Lift = false;
            ApplyPose(0, Vector2.zero);
            if (aiming) OnCardAimEnd?.Invoke(this, e, moved);
            else OnCardClick?.Invoke(this);
        }
        public void CancelGesture() { _aiming = _moved = Lift = false; ApplyPose(0, Vector2.zero); }
        public void SetOff(bool off) { Off = off; _group.alpha = off ? .72f : 1; }
        public void SetTargeting(bool on)
        {
            Targeting = on;
            var image = GetComponentsInChildren<Image>().FirstOrDefault(i => i.name.StartsWith("frame-"));
            if (image == null) return;
            var outline = Sdt.UI.Kit.UIKit.GetOrAdd<Outline>(image);
            outline.effectColor = on ? BtColors.Hex("#C8E8F0") : Color.clear;
            outline.effectDistance = new Vector2(2, -2);
            ApplyPose(_reading ? 1 : 0, Vector2.zero);
        }
    }
    public sealed class HandGroup
    {
        public CardDef Card; public List<string> Uids; public string Key; public bool Self; public int Slot;
        public int Rank => Self ? 5 : Card.id == "starter-attack" || Card.name == "初始攻击" ? 0
            : Card.type == "武术" || Card.type == "法术" ? 1 : Card.type == "装备" ? 4 : 2;
    }
    public class HandPanel
    {
        public const float CardW = 260, CardH = 390, PreferredStep = 190, RestDrop = 64;
        public const int PageSize = 9;
        public readonly List<BattleCard> Cards = new List<BattleCard>();
        readonly List<HandGroup> _slots = new List<HandGroup>();
        readonly List<BattleCard> _retained = new List<BattleCard>();
        readonly HashSet<string> _seen = new HashSet<string>();
        int _turn = -1;
        string _token;
        public int Page, Pages = 1, NewOnOtherPages, VisibleCount;
        public static List<HandGroup> Group(BattleSnapshot s, IBattleViewApi api)
        {
            var result = new List<HandGroup>();
            foreach (string uid in s.Hand)
            {
                var entry = api.FindCard(uid); if (entry == null) continue;
                bool individual = s.Infusing != null || s.RuleHandSelection != null;
                var c = entry.Card;
                string key = individual ? "uid:" + uid : c.id + "|" + c.cost + "|" + c.desc + "|" + api.EffCostOf(c);
                var group = result.Find(g => g.Key == key);
                if (group == null) result.Add(group = new HandGroup { Card = c, Key = key, Uids = new List<string>(), Self = s.Infusing?.Uid == uid });
                group.Uids.Add(uid);
            }
            return s.Infusing != null || s.RuleHandSelection != null ? result : result.OrderBy(g => g.Rank).ToList();
        }
        public List<BattleCard> Sync(Transform parent, BattleSnapshot s, IBattleViewApi api)
        {
            if (_token != s.BattleToken)
            {
                _token = s.BattleToken; _slots.Clear(); _seen.Clear(); Page = NewOnOtherPages = 0; _turn = -1;
                foreach (var card in _retained) { card.gameObject.SetActive(false); UnityEngine.Object.Destroy(card.gameObject); }
                _retained.Clear();
            }
            if (_turn != s.Turn) { _slots.Clear(); _turn = s.Turn; }
            var groups = Group(s, api); var assigned = new HashSet<int>();
            bool temporaryProjection = s.Infusing != null || s.RuleHandSelection != null;
            if (!temporaryProjection) foreach (var g in groups)
            {
                int slot = _slots.FindIndex(old => old.Key == g.Key || old.Uids.Any(g.Uids.Contains));
                if (slot < 0 || assigned.Contains(slot)) { slot = _slots.Count; _slots.Add(g); }
                else _slots[slot] = g;
                assigned.Add(slot); g.Slot = slot;
            }
            if (!temporaryProjection)
            {
                var order = _slots.Select((g, i) => new { Group = g, Index = i }).OrderBy(x => x.Group.Rank).ThenBy(x => x.Index).ToList();
                foreach (var g in groups) g.Slot = order.FindIndex(x => x.Index == g.Slot);
            }
            else for (int i = 0; i < groups.Count; i++) groups[i].Slot = i;
            bool infusing = s.Infusing != null;
            if (infusing)
            {
                groups = groups.Where(g => !g.Self && !s.Infusing.Picked.Contains(g.Uids[0]))
                    .GroupBy(g => g.Card.id + "|" + g.Card.desc + "|" + api.EffCostOf(g.Card))
                    .Select(stack => new HandGroup { Card = stack.First().Card, Key = stack.Key, Uids = stack.SelectMany(g => g.Uids).ToList() }).ToList();
                for (int i = 0; i < groups.Count; i++) groups[i].Slot = i;
            }
            int count = temporaryProjection ? groups.Count : _slots.Count;
            int pageSize = infusing ? Mathf.Max(1, Mathf.FloorToInt((((RectTransform)parent).rect.width - 24) / 226)) : PageSize;
            Pages = Mathf.Max(1, Mathf.CeilToInt(count / (float)pageSize)); Page = Mathf.Clamp(Page, 0, Pages - 1);
            var visible = groups.Where(g => g.Slot / pageSize == Page).ToList();
            if (_seen.Count > 0) NewOnOtherPages += groups.Where(g => g.Slot / pageSize != Page).Sum(g => g.Uids.Count(uid => !_seen.Contains(uid)));
            foreach (string uid in s.Hand) _seen.Add(uid);
            Cards.Clear();
            foreach (var g in visible)
            {
                int cost = api.EffCostOf(g.Card), spell = s.Player?.spellPower ?? 0;
                if (s.Pstat?.status != null && s.Pstat.status.TryGetValue("spellUp", out int bonus)) spell += bonus;
                var options = new CardFaceOptions { HideCost = false, ScrollDescription = false, CostOverride = cost, SpellDamageBonus = spell, DescriptionContext=CardFace.BattleDescription(s,g.Uids[0]) };
                var card = _retained.Find(c => c.Uids.Any(g.Uids.Contains));
                string signature = g.Card.id + "|" + g.Card.name + "|" + Sdt.Res.CurrentCardPresentation.Description(g.Card,options.DescriptionContext) + "|" + cost + "|" + spell;
                if (card == null) { card = BattleCard.Create(g.Card, parent, options); _retained.Add(card); }
                else if (card.FaceSignature != signature) card.RebuildFace(g.Card, options);
                card.FaceSignature = signature; card.Uid = g.Uids[0]; card.Uids = new List<string>(g.Uids);
                card.gameObject.SetActive(true); card.SetCount(g.Uids.Count); card.DisplayIndex = g.Slot % pageSize; card.Infusion = infusing;
                card.Side = infusing ? null : api.TargetSide(g.Card);
                card.SetOff(infusing ? g.Card.rules?.Get("battle")?.Value("fuelAllowed") is bool allowed && !allowed : s.Busy || s.over || cost > s.Energy || api.UnplayableReason(g.Card) != null);
                card.SetTargeting(!infusing && s.PendingTarget?.Uid == card.Uid);
                Cards.Add(card);
            }
            foreach (var card in _retained.ToArray())
            {
                if (!groups.Any(g => g.Uids.Any(card.Uids.Contains))) { _retained.Remove(card); card.gameObject.SetActive(false); UnityEngine.Object.Destroy(card.gameObject); }
                else if (!Cards.Contains(card)) card.gameObject.SetActive(false);
            }
            VisibleCount = Mathf.Min(pageSize, count - Page * pageSize);
            Pose(Cards, parent, VisibleCount);
            return Cards;
        }
        public static void Pose(List<BattleCard> cards, Transform root, int count = -1)
        {
            int n = count < 0 ? cards.Count : count; if (n == 0) return;
            float width = Mathf.Max(CardW, ((RectTransform)root).rect.width);
            float step = n > 1 ? Mathf.Min(PreferredStep, (width - CardW) / (n - 1)) : 0;
            foreach (var card in cards)
            {
                card.FanPos = card.Infusion ? new Vector2(-width / 2 + 114 + card.DisplayIndex * 226, 0)
                    : new Vector2(Mathf.Floor((card.DisplayIndex - (n - 1) / 2f) * step + .5f), 0);
                card.FanRotDeg = 0; card.ApplyPose(card.Reading ? 1 : 0, Vector2.zero);
            }
        }
    }
}
