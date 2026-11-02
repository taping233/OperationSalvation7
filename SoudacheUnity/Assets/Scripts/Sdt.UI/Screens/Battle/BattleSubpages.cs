// ported from src/battle.view.js renderDeckSelection()/renderGrave()/discovering 段
// 战斗子页（UI.showOverlay(true) 变体 → UiStack 压栈的全屏 Panel + 遮罩）：
//   DeckSelectionPanel —— BOSS 编组牌库（selectDeckCard/confirmDeck/cancelDeck）
//   DiscoverPanel      —— 发现三选一（pickDiscover）
//   GravePanel         —— 墓地查看（openGrave/closeGrave）
// 发现提示按真实候选来源与支付阶段展示，交互由当前战斗归属守卫。
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
        void SetSnapshot(BattleSnapshot s);   // 更新当前呈现；稳定内容可保留控件。
        void Dismiss();                       // 随状态消失（UiStack Pop）
    }

    /// <summary>子页基座：#overlay 遮罩 + .card 容器（header/ovBody/ov-btns）。</summary>
    public abstract class BattleSubpageBase : Panel, IBattleSubpage
    {
        protected RectTransform CardRoot;
        protected Transform BodyRoot;
        protected Transform BtnsRoot;
        protected GameObject SurfaceRoot;

        public override void Build()
        {
            var root = UIKit.Panel("subpage", transform);
            SurfaceRoot=root;
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
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
            var img = card.AddComponent<Image>(); img.sprite = BtSprites.White();
            img.color = BtColors.HexA("#10232B", 0.98f);
            var ol = card.AddComponent<Outline>(); ol.effectColor = BtColors.BorderDark; ol.effectDistance = new Vector2(2, -2);
            var vl = card.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 8; vl.padding = new RectOffset(0, 0, 0, 12);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;
            CardRoot = rt;
            BuildHeader(card.transform);
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
        private void BuildHeader(Transform card)
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
        }

        protected abstract string TitleText();
        protected abstract void OnBody();

        public void Dismiss() { Close(); }

        /// <summary>立即撤下旧控件，再按当前内容重建。</summary>
        protected void ClearBody()
        {
            UIKit.ClearChildren(BodyRoot);
            UIKit.ClearChildren(BtnsRoot);
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
        CurrentDeckFormation _formation;
        public override void Build()
        {
            if(_formation!=null)return;
            _formation=UIKit.GetOrAdd<CurrentDeckFormation>(this);
            _formation.Initialize(this);_formation.Refresh(GameSnapshotRef.Current);
        }
        public override void SetSnapshot(BattleSnapshot snapshot)
        {if(_formation==null)Build();_formation.Refresh(snapshot);}
        public override void CloseFromEscape()
        {if(UiStack.Top==this)BattleView.Commands.CancelDeck();}
        protected override string TitleText() => "[[icon:demon]] BOSS战 · 编组牌库";

        protected override void OnBody() { }
    }

    // ================= discovering 段（发现三选一） =================
    public sealed class DiscoverPanel : BattleSubpageBase
    {
        int _selected = -1;
        float _readyAt;
        string _token;
        long _selectionId;
        int _revision;
        bool _closed;
        string _kind, _sourceCommit;
        IBattleCommands _commands;
        readonly List<CardDef> _options = new List<CardDef>();
        readonly List<string> _candidateUids = new List<string>();
        readonly List<Outline> _selectionFrames = new List<Outline>();
        Button _confirm;
        Button _watch;
        Text _watchLabel;
        Color _maskColor;
        public bool WatchingBattlefield { get; private set; }
        internal bool PresentsChoice(BattleSnapshot snapshot)=>snapshot!=null&&snapshot.BattleToken==_token&&snapshot.Discovering?.selectionId==_selectionId;
        public override void Build()
        {
            base.Build();
            var layout=BodyRoot.GetComponent<VerticalLayoutGroup>();
            layout.padding=new RectOffset(40,40,20,20);layout.spacing=16;
            _maskColor=UiStack.MaskColor(this);
            _watch=CurrentRunHudView.Button(transform,"discover-watch-battlefield",0,0,48,48,ToggleBattlefield,new Vector2(1,1),new Vector2(1,1));
            _watch.GetComponent<Image>().color=BtColors.HexA("#172C36",.96f);
            var glyph=CurrentRunHudView.Box(_watch.transform,"eye",10,10,28,28);
            var eye=UIKit.GetOrAdd<CurrentRunControlGlyph>(glyph);eye.SetKind("eye");eye.color=BtColors.Hex("#F0E0B8");eye.raycastTarget=false;
            _watchLabel=CurrentRunHudView.Text(_watch.transform,"return-label","返回发现",46,0,116,48,18,"#F0E0B8");
            _watchLabel.gameObject.SetActive(false);
            ((RectTransform)_watch.transform).anchoredPosition=new Vector2(-44,-42);
        }
        bool Owns(string token,long selectionId,int revision)
        {
            var state=GameSnapshotRef.Current;
            return this!=null&&!_closed&&isActiveAndEnabled&&UiStack.Top==this&&revision==_revision
                &&ReferenceEquals(_commands,BattleView.Commands)&&state!=null&&!state.Over&&state.BattleToken==token&&state.Discovering?.selectionId==selectionId;
        }
        bool Current(string token,long selectionId,int revision)=>!WatchingBattlefield&&Owns(token,selectionId,revision);
        void ToggleBattlefield()
        {
            if(!Owns(_token,_selectionId,_revision))return;
            SetBattlefieldView(!WatchingBattlefield);
            Sdt.Run.AudioService.I.PlaySfx("click");
        }
        void SetBattlefieldView(bool visible)
        {
            WatchingBattlefield=visible;
            SurfaceRoot.SetActive(!visible);
            // The stack's transparent mask still intercepts battlefield input.
            UiStack.SetMaskColor(this,visible?Color.clear:_maskColor);
            _watchLabel.gameObject.SetActive(visible);
            var rect=(RectTransform)_watch.transform;
            rect.sizeDelta=new Vector2(visible?172:48,48);
            rect.anchoredPosition=visible?new Vector2(-28,-112):new Vector2(-44,-42);
            var focus=!visible&&_selected>=0&&_selected<_selectionFrames.Count?_selectionFrames[_selected].gameObject:_watch.gameObject;
            UnityEngine.EventSystems.EventSystem.current?.SetSelectedGameObject(focus);
        }
        public override void SetSnapshot(BattleSnapshot snapshot)
        {if(!_closed)Render(snapshot);}
        public override void CloseFromEscape()
        {
            if(WatchingBattlefield&&Owns(_token,_selectionId,_revision)){SetBattlefieldView(false);return;}
            if(Current(_token,_selectionId,_revision))BattleView.Commands?.CancelDiscover(_token,_selectionId);
        }
        internal override void OnClose(){_closed=true;_revision++;WatchingBattlefield=false;}
        protected override string TitleText()
        {
            var s = GameSnapshotRef.Current;
            bool boss = s != null && s.Opts != null && s.Opts.IsBoss;
            return (boss ? "[[icon:demon]] BOSS战" : "[[icon:swords]] 遭遇战") +
                   " · 第 " + (s != null ? s.Turn : 0) + " 回合 · [[icon:question]] 发现";
        }

        protected override void OnBody()
        {Render(GameSnapshotRef.Current);}
        bool SameView(BattleSnapshot snapshot,IBattleCommands commands)
        {
            var discovery=snapshot.Discovering;
            if(_token!=snapshot.BattleToken||_selectionId!=discovery.selectionId||_kind!=discovery.kind
                ||_sourceCommit!=discovery.sourceCommit||!ReferenceEquals(_commands,commands)||_options.Count!=discovery.Options.Count)return false;
            int uidCount=discovery.candidateUids?.Count??0;
            if(uidCount!=_candidateUids.Count)return false;
            for(int i=0;i<uidCount;i++)if(_candidateUids[i]!=discovery.candidateUids[i])return false;
            // Options belong to this discovery round. Snapshots copy the list, retaining its card instances.
            for(int i=0;i<_options.Count;i++)if(!ReferenceEquals(_options[i],discovery.Options[i]))return false;
            return true;
        }
        void Select(int index)
        {
            if(_selected==index)return;
            if(_selected>=0)_selectionFrames[_selected].enabled=false;
            _selected=index;
            if(index>=0)_selectionFrames[index].enabled=true;
            _confirm.interactable=index>=0;
        }
        void Render(BattleSnapshot s)
        {
            var cmd = BattleView.Commands;
            if (s == null || s.Discovering == null || cmd == null||SameView(s,cmd)) return;
            string token=s.BattleToken;long selectionId=s.Discovering.selectionId;int revision=++_revision;
            _token=token;_selectionId=selectionId;_commands=cmd;_selected=-1;_readyAt=Time.unscaledTime+.35f;
            _kind=s.Discovering.kind;_sourceCommit=s.Discovering.sourceCommit;
            _options.Clear();_options.AddRange(s.Discovering.Options);_selectionFrames.Clear();_confirm=null;
            _candidateUids.Clear();if(s.Discovering.candidateUids!=null)_candidateUids.AddRange(s.Discovering.candidateUids);
            ClearBody();
            string kind=s.Discovering.kind;
            bool preview=s.Discovering.sourceCommit=="preview";
            string prompt=kind=="deckBottom"?"从牌库底的候选中选择 1 张置入手牌":kind=="swap"?"选择 1 张招式置入手牌；两张齐后交换费用":kind=="play"?"选择 1 张直接施放":kind=="stored"?"选择 1 张锦囊法术直接施放":kind=="effect"?"选择 1 张，按来源卡牌效果结算":"从随机 "+s.Discovering.Options.Count+" 张卡牌中选择 1 张获得";
            var instruction=UIKit.Label(BodyRoot,prompt,24,Color.white);instruction.name="discoverPrompt";
            var row = UIKit.Row(BodyRoot);
            if(_options.Count>5)
            {
                var grid=row.AddComponent<GridLayoutGroup>();grid.cellSize=CardFace.SizeOf(CardSize.Xl);
                grid.spacing=new Vector2(64,36);grid.padding=new RectOffset(32,32,28,22);grid.childAlignment=TextAnchor.UpperCenter;
                grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=3;
            }
            else
            {
                var hl = row.AddComponent<HorizontalLayoutGroup>();
                hl.spacing = 64; hl.padding = new RectOffset(32, 32, 28, 22); hl.childAlignment = TextAnchor.MiddleCenter;
                hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
                hl.childControlWidth = true; hl.childControlHeight = true;
            }
            for (int i = 0; i < s.Discovering.Options.Count; i++)
            {
                var c = s.Discovering.Options[i];
                string uid=i<_candidateUids.Count?_candidateUids[i]:null;
                var presentation=uid==null?null:BattleView.Api.CardPresentation(uid);
                var cardGo = CardFace.Create(presentation?.Card??c, CardSize.Xl, row.transform,
                    options:new CardFaceOptions{HideCost=false,Presentation=presentation,CostOverride=presentation?.EffectiveCost,
                        DescriptionContext=uid==null?null:CardFace.BattleDescription(s,uid)});
                var idx = i;
                var btn = cardGo.AddComponent<Button>(); btn.targetGraphic = cardGo.GetComponent<Image>();
                btn.name="discoverPick-"+i;
                var outline = cardGo.AddComponent<Outline>(); outline.effectColor = BtColors.Hex("#E0C98E"); outline.effectDistance = new Vector2(3,-3);
                outline.useGraphicAlpha=false;outline.enabled=false;
                _selectionFrames.Add(outline);
                btn.onClick.AddListener(() => { if (Current(token,selectionId,revision)&&Time.unscaledTime>=_readyAt)Select(idx); });
            }
            string hint=kind=="deckBottom"?"从本场牌库取回原实体；取消会将未确认的候选按原序放回牌库底。":kind=="swap"?"每次确认即入手；第二轮取消会保留首张原费用，尚未确认的牌不会生成。":kind=="stored"?"确认后消耗所选锦囊卡；取消不会消耗未选卡牌。":kind=="play"?"直接施放视为已注能，不消耗注能材料；已结算效果保留。":kind=="effect"?"确认后按来源效果处理；取消只放弃尚未确认的部分。":"本场生成的卡牌仅供本场使用；取消不会撤销此前已确认的选择。";
            if(preview)hint="尚未使用来源卡牌；取消使用不消耗源牌、能量、注能材料或手牌代价。确认后按当前条件结算，本回合重新打开保留候选。";
            var note=UIKit.Label(BodyRoot,hint,17,UiPalette.Dim);note.name="discoverHint";
            _confirm=BtBtn.Create(BtnsRoot,"确认选择",()=>{if(Current(token,selectionId,revision)&&_selected>=0&&Time.unscaledTime>=_readyAt)cmd.PickDiscover(_selected,token,selectionId);},"ok");_confirm.name="discoverConfirm";_confirm.interactable=false;
            var cancel=BtBtn.Create(BtnsRoot,preview?"取消使用":"结束发现",()=>{if(Current(token,selectionId,revision))cmd.CancelDiscover(token,selectionId);});cancel.name="discoverCancel";
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
