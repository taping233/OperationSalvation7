// Current battle.view/stage-view/layers adapter. Permanent shell and keyed units survive snapshots.
using UnityEngine.EventSystems;
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
    public partial class BattleScreen : Panel
    {
        public override bool CanCloseWithEscape => false;
        private RectTransform _stageRoot, _fxLayer, _selfFigure, _selfRoot, _hoverFoe;
        private AimArrow _arrow;
        private readonly List<RectTransform> _foeRoots = new List<RectTransform>();
        private readonly List<RectTransform> _foeFigures = new List<RectTransform>();
        readonly List<RectTransform> _fieldPreviews=new List<RectTransform>();
        readonly List<RaycastResult> _dropHits=new List<RaycastResult>();
        BattleSnapshot _fieldPreviewSnapshot;string _fieldPreviewUid;
        private List<BattleCard> _cards = new List<BattleCard>();
        private DeckSelectionPanel _deckPage;
        private DiscoverPanel _discoverPage;
        private GravePanel _gravePage;
        public override void Build()
        {
            _stageRoot = BattleRect("battle-stage sts battle-sts", transform);
            UiExt.Stretch(_stageRoot);
            _stageRoot.gameObject.AddComponent<RectMask2D>();
            _fxLayer = BattleRect("fx", transform); UiExt.Stretch(_fxLayer);
            _arrow = _fxLayer.gameObject.AddComponent<AimArrow>();
            BuildPermanentStage();
            _presentation = gameObject.AddComponent<BattlePresentationQueue>(); _presentation.Init(this);
            BattleEvents.SnapshotChanged += OnSnapshot;
            AttachBattleLog();
        }
        internal override void OnClose()
        {
            BattleEvents.SnapshotChanged -= OnSnapshot;
            CancelAim(); ReleaseActorFrames(); DetachBattleLog();
            _presentation?.Release();
        }
        protected override void OnDestroy() { BattleEvents.SnapshotChanged -= OnSnapshot; ReleaseActorFrames(); _presentation?.Release(); DetachBattleLog(); }
        private void OnSnapshot(BattleSnapshot s)
        {
            if (s == null) return;
            GameSnapshotRef.Current = s;
            if (_presentation?.Capture(s) == true) { DrainPresentationFloats(); return; }
            if (s.Busy || s.over || s.DeckSelection != null || s.Discovering != null || s.ViewingGrave) CancelAim();
            BuildStage(s);
            UpdateSubpages(s);
        }
        private void UpdateSubpages(BattleSnapshot s)
        {
            SetPage(ref _deckPage, s.DeckSelection != null, s);
            SetPage(ref _discoverPage, s.Discovering != null, s);
            SetPage(ref _gravePage, s.ViewingGrave, s);
        }
        private void SetPage<T>(ref T page, bool active, BattleSnapshot s) where T : Component, IBattleSubpage
        {
            if (active && page == null)
            {
                var go = new GameObject(typeof(T).Name, typeof(RectTransform));
                UiExt.Stretch(go.GetComponent<RectTransform>());
                page = go.AddComponent<T>(); UiStack.Push(page as Panel); (page as Panel).Build();
            }
            else if (active) page.SetSnapshot(s);
            else if (page != null) { page.Dismiss(); page = null; }
        }
        private void BuildStage(BattleSnapshot s)
        {
            var api = BattleView.Api; var cmd = BattleView.Commands;
            if (api == null || cmd == null) return;
            SyncUnits(s, api);
            BuildHud(_stageRoot, s, api, cmd);
            BuildEquipment(s, cmd);
            BuildBattleItems(s, cmd);
            SyncPrompt(s, api, cmd);
            BuildRuleInputs(s, api, cmd);
            _retry.gameObject.SetActive(s.over && BattleEvents.SettlementPending);
            if (s.Opts != null && s.Opts.IsBoss && !s.DreadShown) { api.MarkDreadShown(); BattleDread.Play(_fxLayer); }
            SpawnFloats(s, api);
        }
        // ---------------- 卡牌事件接线（btPlay + startAim/moveAim/endAim） ----------------
        private void WireCardEvents(BattleSnapshot s, IBattleViewApi api, IBattleCommands cmd)
        {
            foreach (var c in _cards)
            {
                var card = c;
                card.OnCardClick = bc => OnCardClick(bc, s, api, cmd);
                card.OnCardAimBegin = bc => CanStartAim(bc, api);
                card.OnCardDrag = (bc, e) => OnCardDrag(bc, e, api);
                card.OnCardAimEnd = (bc, e, moved) => OnCardAimEnd(bc, e, moved, cmd);
                card.OnCardAimCancel = bc => CancelAim();
            }
        }

        /// <summary>data-act="btPlay"：注能中点组 = 选燃料；非指向卡点击出牌；指向卡点击 = 锁定。</summary>
        private void OnCardClick(BattleCard bc, BattleSnapshot s, IBattleViewApi api, IBattleCommands cmd)
        {
            _itemTargetUid = null;
            var snap = GameSnapshotRef.Current ?? s;
            if (PresentationBusy || snap.Busy || snap.over || snap.RuleChoice != null || snap.Discovering != null || UiStack.Top != this) return;
            if (snap.RuleHandSelection != null) { if (snap.RuleHandSelection.candidateUids.Contains(bc.Uid)) cmd.SelectRuleHand(bc.Uid); return; }
            if (snap.Infusing != null) { cmd.SelectInfusion(bc.Uid); return; }   // toggleInfusePick
            if (bc.Off) { cmd.SetPendingHint(api.UnplayableReason(api.FindCard(bc.Uid)?.Card) ?? "能量不足，暂时无法打出"); return; }
            if (bc.Side != null) { cmd.LockPendingTarget(bc.Uid); return; }     // play(uid) 对指向卡内定锁定
            cmd.PlayCard(bc.Uid, -2, false);                                    // -2 = 未指定目标（JS play(uid) 无 target）
        }

        /// <summary>startAim 前置校验：busy/infusing/discovering/已有 aim/费不足。</summary>
        private bool CanStartAim(BattleCard bc, IBattleViewApi api)
        {
            var s = GameSnapshotRef.Current;
            if (s == null || InputLocked(s) || UiStack.Top != this) return false;
            var entry = api.FindCard(bc.Uid);
            if (entry == null || api.UnplayableReason(entry.Card) != null) return false;
            if (api.EffCostOf(entry.Card) > s.Energy) return false;             // 能量不足：不进入指向
            Sdt.Run.AudioService.I.PlaySfx("hover");
            return true;
        }

        /// <summary>moveAim：算 hover 目标（aimHoverAt）→ 更新箭头 + 伤害预估。</summary>
        private void OnCardDrag(BattleCard bc, PointerEventData e, IBattleViewApi api)
        {
            var s = GameSnapshotRef.Current;
            if (s == null||InputLocked(s)||UiStack.Top!=this||CurrentInputBindings.SuppressGameplayInput) { CancelAim();return; }
            RectTransformUtility.ScreenPointToLocalPointInRectangle(_hand, e.position, e.pressEventCamera, out var cardPoint);
            bc.CardRt.anchoredPosition = cardPoint + new Vector2(0, 32);
            var hit = TryPickTarget(e.position, bc.Side, s,bc);
            if(CurrentBattleDropProjection.FieldPlayable(bc.CardDef(),bc.Side))
            {
                _arrow.Hide();if(hit==null||bc.Side!="enemy")ClearFieldPreviews();
                else if(_fieldPreviewSnapshot!=s||_fieldPreviewUid!=bc.Uid){ClearFieldPreviews();for(int i=0;i<_foeRoots.Count&&i<s.Foes.Count;i++)if(!s.Foes[i].Dead){BattleFoePreview.Show(_foeRoots[i],s.Foes[i],bc.CardDef());_fieldPreviews.Add(_foeRoots[i]);}_fieldPreviewSnapshot=s;_fieldPreviewUid=bc.Uid;}
                return;
            }
            ClearFieldPreviews();
            if (bc.Side == null) { _arrow.Hide(); return; }
            if (_hoverFoe != null && (hit == null || hit.Value.Root != _hoverFoe))
            {
                BattleFoePreview.Clear(_hoverFoe);
                _hoverFoe = null;
            }
            Vector2 end;
            if (hit != null)
            {
                end = CenterIn(hit.Value.Root);
                if (hit.Value.Kind == "enemy")
                {
                    _hoverFoe = hit.Value.Root;
                    BattleFoePreview.Show(_hoverFoe, s.Foes[hit.Value.Index], bc.CardDef());
                }
            }
            else end = ScreenToLocal(e.position);
            var start = CardTopInFxLayer(bc);
            _arrow.Show(start, end, hit != null ? (hit.Value.Kind == "enemy" ? BtColors.AimEnemy : BtColors.AimSelf)
                : (bc.Side == "enemy" ? BtColors.AimEnemy : BtColors.AimSelf));
        }

        /// <summary>endAim：拖到目标松手打出；拖了没目标 = 保持锁定可再指；轻点 = 锁定。</summary>
        private void OnCardAimEnd(BattleCard bc, PointerEventData e, bool moved, IBattleCommands cmd)
        {
            var s = GameSnapshotRef.Current;
            if(s==null||InputLocked(s)||UiStack.Top!=this||CurrentInputBindings.SuppressGameplayInput){CancelAim();return;}
            var hit = moved ? TryPickTarget(e.position, bc.Side, s,bc) : (HoverTarget?)null;
            _arrow.Hide();
            ClearFieldPreviews();
            if (_hoverFoe != null) { BattleFoePreview.Clear(_hoverFoe); _hoverFoe = null; }
            if (moved && hit != null)
            {
                int target=CurrentBattleDropProjection.SubmitTarget(bc.Side,hit.Value.Kind,hit.Value.Index,s.Foes);
                if(bc.Side=="enemy"&&target<0){bc.ApplyPose(0,Vector2.zero);return;}
                cmd.PlayCard(bc.Uid,target,false);
                return;
            }
            if (bc.Side != null) cmd.LockPendingTarget(bc.Uid);                 // 轻点=锁定 / 拖空=保持锁定
            else if (!moved) OnCardClick(bc, s, BattleView.Api, cmd);
            bc.ApplyPose(0, Vector2.zero);
        }

        /// <summary>cancelAim：重渲染或销毁时中止。</summary>
        private void CancelAim()
        {
            ClearFieldPreviews();
            if (_arrow != null) _arrow.Hide();
            if (_hoverFoe != null) { BattleFoePreview.Clear(_hoverFoe); _hoverFoe = null; }
            if (_cards != null) foreach (var c in _cards) c.CancelGesture();
        }

        /// <summary>aimHoverAt(x,y,side)：enemy 找活敌人 / self 找自己立绘。</summary>
        void ClearFieldPreviews(){foreach(var root in _fieldPreviews)BattleFoePreview.Clear(root);_fieldPreviews.Clear();_fieldPreviewSnapshot=null;_fieldPreviewUid=null;}
        bool DropReadingSurface(Vector2 screenPos,BattleCard source)
        {
            var events=EventSystem.current;if(events==null)return false;var pointer=new PointerEventData(events){position=screenPos};_dropHits.Clear();events.RaycastAll(pointer,_dropHits);
            foreach(var ray in _dropHits){var target=ray.gameObject.transform;if(source!=null&&target.IsChildOf(source.transform))continue;
                if(!target.IsChildOf(_stageRoot))return true;
                if(target.GetComponentInParent<CurrentBattleStatuses>()!=null||target.GetComponentInParent<CurrentBattleNameplate>()!=null||target.GetComponentInParent<BattleHoverInfo>()!=null)return true;
                if(target.IsChildOf(_hand)||target.IsChildOf(_dock)||target.IsChildOf(_items))return true;
                var button=target.GetComponentInParent<Button>();if(button!=null&&button.transform!=_selfRoot&&!_foeRoots.Contains(button.transform as RectTransform))return true;
                return false;
            }return false;
        }
        private HoverTarget? TryPickTarget(Vector2 screenPos, string side, BattleSnapshot s,BattleCard source=null)
        {
            if(DropReadingSurface(screenPos,source))return null;
            bool aboveHand=screenPos.y>RectTransformUtility.WorldToScreenPoint(null,_hand.TransformPoint(new Vector3(0,_hand.rect.yMax,0))).y;
            if(source!=null&&CurrentBattleDropProjection.FieldPlayable(source.CardDef(),side))
                return aboveHand&&RectTransformUtility.RectangleContainsScreenPoint(_stageRoot,screenPos,null)?new HoverTarget{Kind="any",Index=-2,Root=_arena}:(HoverTarget?)null;
            if (side == "enemy")
            {
                for (int i = 0; i < _foeRoots.Count && i < s.Foes.Count; i++)
                {
                    if (s.Foes[i].Dead) continue;
                    if (RectTransformUtility.RectangleContainsScreenPoint(_foeRoots[i], screenPos, null))
                        return new HoverTarget { Kind = "enemy", Index = i, Root = _foeRoots[i] };
                }
                return null;
            }
            if (side == "self" && _selfRoot != null &&
                RectTransformUtility.RectangleContainsScreenPoint(_selfRoot, screenPos, null))
                return new HoverTarget { Kind = "self", Index = -1, Root = _selfRoot };
            if (side == null && aboveHand&&RectTransformUtility.RectangleContainsScreenPoint(_stageRoot,screenPos,null))
                return new HoverTarget { Kind = "any", Index = -2, Root = _arena };
            return null;
        }

        private struct HoverTarget { public string Kind; public int Index; public RectTransform Root; }

        private Vector2 ScreenToLocal(Vector2 screenPos)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(_fxLayer, screenPos, null, out var lp);
            return lp;
        }

        private Vector2 CenterIn(RectTransform rt)
        {
            return _fxLayer.InverseTransformPoint(rt.TransformPoint(rt.rect.center));
        }

        private Vector2 CardTopInFxLayer(BattleCard bc)
        {
            var rt = bc.CardRt;
            var top = rt.TransformPoint(new Vector3(rt.rect.center.x, rt.rect.yMax, 0));
            return _fxLayer.InverseTransformPoint(top) + new Vector3(0, 6, 0);   // ay = cardTop + 6
        }

        // ---------------- 敌/我点击（纠正提示，照抄 render() 末段监听） ----------------
        private void OnFoeClick(BattleSnapshot s, int idx)
        {
            if (PresentationBusy) return;
            var cmd = BattleView.Commands;
            if (!string.IsNullOrEmpty(_itemTargetUid))
            {
                var result = cmd.UseItem(_itemTargetUid, idx);
                if (result.Ok) _itemTargetUid = null; else RunLog.Log(result.Reason, "warn");
                return;
            }
            if (_skillTargeting)
            {
                _skillTargeting = false;
                var result = cmd.UseHeroSkill(idx);
                if (!result.Ok) RunLog.Log(result.Reason, "warn");
                return;
            }
            var cur = GameSnapshotRef.Current ?? s;
            if (cur.PendingTarget == null) return;
            var api = BattleView.Api;
            string side = api != null ? api.TargetSide(cur.PendingTarget.Card) : null;
            if (side == "enemy" && idx >= 0 && idx < cur.Foes.Count && !cur.Foes[idx].Dead) cmd.PlayCard(cur.PendingTarget.Uid, idx, false);
            else if (side == "self") cmd.SetPendingHint("[[icon:heart]] 治疗 / 净化卡要拖到左侧「你」的立绘上");
        }

        private void OnSelfClick(BattleSnapshot s)
        {
            if (PresentationBusy) return;
            var cmd = BattleView.Commands;
            var cur = GameSnapshotRef.Current ?? s;
            if (cur.PendingTarget == null) return;
            var api = BattleView.Api;
            string side = api != null ? api.TargetSide(cur.PendingTarget.Card) : null;
            if (side == "self") { cmd.PlayCard(cur.PendingTarget.Uid, -1, false); return; }
            cmd.SetPendingHint("[[icon:heart]] 这是治疗 / 净化类卡牌——请拖到「你」的立绘上");
        }

        // ---------------- spawnFloats ----------------
        private void SpawnFloats(BattleSnapshot s, IBattleViewApi api)
        {
            var list = api.TakeFloats();
            if (list == null) return;
            PresentFloats(list.Where(f=>f.PresentationSequence==0));
        }
        private void PresentFloats(IEnumerable<FloatSpec> list)
        {
            var s=GameSnapshotRef.Current;
            foreach (var f in list)
            {
                RectTransform fig;
                if (f.IsSelf) fig = _selfFigure;
                else fig = (f.Unit >= 0 && f.Unit < _foeFigures.Count) ? _foeFigures[f.Unit] : null;
                if (fig == null) continue;
                string feedbackClass=f.Cls??"";
                bool damage=!f.Warm&&!feedbackClass.Contains("stk")&&!feedbackClass.Contains("block")&&!feedbackClass.Contains("windupfx");
                bool framesPlayed = _self?.Frames?.Hurt(f) == true;
                bool enemyMotion=!f.IsSelf&&damage
                    && f.Unit>=0 && f.Unit<s.Foes.Count && BattleEnemyFrameMotion.Play(fig,s.Foes[f.Unit].Id,"hurt");
                if (damage&&!framesPlayed&&!enemyMotion) BattleHitFx.Play(fig, f.IsSelf, false);
                if (f.IsSelf&&damage) BattleHurtFlash.Play(_fxLayer);
                var world = fig.TransformPoint(fig.rect.center);
                var local = (Vector2)_fxLayer.InverseTransformPoint(world);
                local.y += fig.rect.height * ((f.Cls ?? "").Contains("stk") ? 0.48f : 0.18f);  // 头顶/胸前
                BattleFloatText.Spawn(_fxLayer, local, f.Text, f.Cls, f.Warm);
            }
        }

        private static void Anchor(RectTransform rt, float xMin, float yMin, float xMax, float yMax)
        {
            rt.anchorMin = new Vector2(xMin, yMin); rt.anchorMax = new Vector2(xMax, yMax);
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
        }
    }

    /// <summary>BattleCard → CardDef 便捷取卡（经 viewApi.findCard）。</summary>
    internal static class BattleCardExt
    {
        public static CardDef CardDef(this BattleCard bc)
        {
            var e = BattleView.Api != null ? BattleView.Api.FindCard(bc.Uid) : null;
            return e != null ? e.Card : null;
        }
    }
}
