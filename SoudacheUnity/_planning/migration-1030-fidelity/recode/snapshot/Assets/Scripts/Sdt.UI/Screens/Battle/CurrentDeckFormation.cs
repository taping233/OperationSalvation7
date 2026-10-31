// battle.overlays.js + battle-decision.css / battle-hand-overhaul.css formation.
// A retained presentation of the existing snapshot and commands; no deck rules live here.
using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Battle
{
    public sealed class CurrentDeckFormation : MonoBehaviour
    {
        sealed class Choice { public Button Select, Inspect; public Text State; public Outline Ring; }
        readonly Dictionary<string,Choice> _choices=new Dictionary<string,Choice>();
        readonly List<Button> _inspect=new List<Button>();
        DeckSelectionPanel _owner;BattleSnapshot _snapshot;
        RectTransform _workspace,_header,_summary,_body,_footer,_grid,_rulesBody;
        Text _name,_stats,_progress,_capacity,_instruction,_shortPool,_capacityRule;
        Button _confirm,_rulesToggle;ScrollRect _scroll;
        string _poolKey,_token;bool _rulesOpen;
        public RectTransform Workspace=>_workspace;
        public ScrollRect ContentScroll=>_scroll;
        public bool RulesExpanded=>_rulesOpen;
        bool Current=>_owner!=null&&UiStack.Top==_owner&&GameSnapshotRef.Current?.BattleToken==_token;
        public void Initialize(DeckSelectionPanel owner)
        {
            _owner=owner;UiStack.SetMaskColor(owner,Color.clear);
            var shade=Rect(transform,"formation-overlay");UiStack.Stretch(shade);Fill(shade,"#050c12d1");
            _workspace=Rect(transform,"battle-decision formation");_workspace.anchorMin=_workspace.anchorMax=_workspace.pivot=Vector2.one*.5f;
            UIKit.GetOrAdd<RectMask2D>(_workspace);UIKit.GetOrAdd<FormationSurface>(_workspace).raycastTarget=false;
            var border=UIKit.GetOrAdd<Outline>(_workspace);border.effectColor=Theme.Hex("#8da7b43d");border.effectDistance=new Vector2(1,-1);
            _header=Rect(_workspace,"battle-decision-head");
            Label(_header,"formation-title","[[icon:demon]] BOSS战 · 编组牌库",34,"#eef2ed",true,1.35f);
            var phase=Label(_header,"formation-phase","开战前准备",21,"#aebfc9");phase.alignment=TextAnchor.UpperRight;
            _summary=Rect(_workspace,"battle-decision-summary");
            Label(_summary,"boss-formation-kicker","本局首脑",14,"#9dbfc8");
            _name=Label(_summary,"boss-formation-name","",30,"#f2e4c3",true,1.35f);
            _stats=Label(_summary,"boss-formation-stats","",25,"#bfd2d7",false,1.5f);
            _progress=Label(_summary,"boss-formation-progress","",42,"#c6e8e2",true,1);_progress.alignment=TextAnchor.UpperRight;
            _capacity=Label(_summary,"boss-formation-capacity","",25,"#bfd2d7",false,1.5f);_capacity.alignment=TextAnchor.UpperRight;
            var line=Rect(_summary,"summary-rule");Fill(line,"#b2c5cf22");
            _body=Rect(_workspace,"battle-decision-content");var content=UIKit.Scroll(_body);_scroll=content.GetComponentInParent<ScrollRect>();_scroll.name="boss-formation-scroll";_scroll.movementType=ScrollRect.MovementType.Clamped;_scroll.scrollSensitivity=36;
            var flow=content.GetComponent<VerticalLayoutGroup>();flow.padding=new RectOffset(0,10,0,0);flow.spacing=0;
            var rail=Rect(_scroll.viewport,"boss-formation-scrollbar");rail.anchorMin=new Vector2(1,0);rail.anchorMax=Vector2.one;rail.offsetMin=new Vector2(-6,0);rail.offsetMax=Vector2.zero;
            var track=UIKit.GetOrAdd<Image>(rail);track.color=Color.clear;
            var handle=Rect(rail,"handle");UiStack.Stretch(handle);var thumb=UIKit.GetOrAdd<Image>(handle);thumb.color=Theme.Hex("#aebfc96b");
            var scrollbar=UIKit.GetOrAdd<Scrollbar>(rail);scrollbar.handleRect=handle;scrollbar.targetGraphic=thumb;scrollbar.direction=Scrollbar.Direction.BottomToTop;scrollbar.transition=Selectable.Transition.None;
            _scroll.verticalScrollbar=scrollbar;_scroll.verticalScrollbarVisibility=ScrollRect.ScrollbarVisibility.AutoHide;
            _footer=Rect(_workspace,"battle-decision-actions");Fill(_footer,"#0e1a2480");
            var footerLine=Rect(_footer,"actions-rule");Fill(footerLine,"#afc4ce26");
            _confirm=Action(_footer,"bossGo","开始战斗",()=>{if(Current)BattleView.Commands.ConfirmDeck();},true);
            Action(_footer,"bossCancel","↩ 放弃挑战",()=>{if(Current)BattleView.Commands.CancelDeck();});
            Layout();
        }
        public void Refresh(BattleSnapshot snapshot)
        {
            var ds=snapshot?.DeckSelection;if(ds==null)return;_snapshot=snapshot;_token=snapshot.BattleToken;
            string pool=SaveJson.Stringify(ds.Cards.Select(entry=>new{entry.Uid,entry.Card}));
            if(_poolKey!=pool){_poolKey=pool;RebuildContent(ds);}
            int selected=ds.Selected.Count,need=Math.Min(ds.Need,ds.Cards.Count),excess=Math.Max(0,selected-ds.Maximum);
            _name.text=ds.Boss?.Name??"???";_stats.text=ds.Boss==null?"属性未知":"攻击 "+ds.Boss.Atk+" · 生命 "+Math.Max(ds.Boss.MaxHp,ds.Boss.Hp);
            _progress.text=selected+"<size=24> / "+need+"</size>";_capacity.text="已编入"+(ds.Maximum>ds.Need?" · 上限 "+ds.Maximum:"");
            _instruction.text="选择招式、装备或能力卡。初始攻击 ×"+ds.StarterCount+" 已固定编入。开战装备占用装备栏，生效即消耗。";
            _shortPool.text="携带 "+ds.Cards.Count+" 张可编卡牌，全部选入后即可迎战。";_shortPool.gameObject.SetActive(ds.Cards.Count<ds.Need);
            int bonus=ds.Maximum-GameRules.BossDeckSize;_capacityRule.text=bonus>0?"混沌之眼：可编牌库上限增加 "+bonus+"，最多选择 "+ds.Maximum+" 张。":"";_capacityRule.gameObject.SetActive(bonus>0);
            bool ready=selected>=need&&excess==0;_confirm.interactable=ready;
            _confirm.GetComponentInChildren<Text>().text=excess>0?"超出上限，请移出 "+excess+" 张…":ready?"[[icon:swords]] 开始战斗（牌库 "+(selected+ds.StarterCount)+" 张）":"还需选择 "+(need-selected)+" 张…";
            foreach(var pair in _choices){bool on=ds.Selected.Contains(pair.Key);pair.Value.State.text=on?"已编入":"点击编入";pair.Value.Ring.enabled=on;}
            Canvas.ForceUpdateCanvases();Layout();
        }
        void RebuildContent(DeckSelectionSnapshot ds)
        {
            var content=_scroll.content;float y=content.anchoredPosition.y;
            foreach(Transform child in content){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            _choices.Clear();_inspect.Clear();
            var aff=ds.Boss!=null&&!string.IsNullOrEmpty(ds.Boss.Affix)?BattleView.Api.AffixMeta(ds.Boss.Affix):null;
            if(aff!=null){var row=Rect(content,"boss-formation-affix");Fill(row,"#27434b");var text=Label(row,"affix-copy","<b>"+aff.Icon+" "+aff.Name+"</b>    "+aff.Desc,20,"#c7d9dc",false,1.5f);UiStack.Stretch(text.rectTransform);text.rectTransform.offsetMin=new Vector2(16,12);text.rectTransform.offsetMax=new Vector2(-16,-12);UIKit.GetOrAdd<LayoutElement>(row).preferredHeight=68;}
            _instruction=Flow(content,"boss-formation-instruction","",18,"#edf2e9",1.5f,12);
            _shortPool=Flow(content,"formation-small-pool","",18,"#abc5ce",1.5f,12);
            _rulesToggle=Action(content,"bossFormationRules","▸ 查看编组与抽牌规则",()=>{if(!Current)return;_rulesOpen=!_rulesOpen;_rulesBody.gameObject.SetActive(_rulesOpen);_rulesToggle.GetComponentInChildren<Text>().text=(_rulesOpen?"▾ ":"▸ ")+"查看编组与抽牌规则";},false);
            _rulesToggle.image.color=Color.clear;var ruleLabel=_rulesToggle.GetComponentInChildren<Text>();ruleLabel.fontSize=15;ruleLabel.alignment=TextAnchor.MiddleLeft;ruleLabel.color=Theme.Hex("#abc5ce");ruleLabel.rectTransform.offsetMin=new Vector2(0,3);ruleLabel.rectTransform.offsetMax=new Vector2(0,-3);var rulesSize=UIKit.GetOrAdd<LayoutElement>(_rulesToggle);rulesSize.minHeight=rulesSize.preferredHeight=48;
            _rulesBody=Rect(content,"boss-formation-rules");var ruleFlow=UIKit.GetOrAdd<VerticalLayoutGroup>(_rulesBody);ruleFlow.spacing=10;ruleFlow.childControlWidth=ruleFlow.childControlHeight=true;ruleFlow.childForceExpandHeight=false;
            Flow(_rulesBody,"draw-rules","开局抽 "+BattleView.Api.BattleStartDraw+" 张 · 每回合抽 "+BattleView.Api.BattleTurnDraw+" 张 · 每回合 "+BattleView.Api.BattleEnergy+" 能量。",15,"#abc5ce",1.6f,10);
            Flow(_rulesBody,"pool-rules","道具、资源、事件、生物与初始攻击不可选入。固定初始攻击不足部分由本场补给，不占背包格。「对战开始时」装备编入即生效。",15,"#abc5ce",1.6f,10);
            _capacityRule=Flow(_rulesBody,"capacity-rule","",15,"#abc5ce",1.6f,10);_rulesBody.gameObject.SetActive(_rulesOpen);
            var heading=Flow(content,"carried-cards","<b>携带卡牌</b>    <size=15>点击编入 / 再点移出</size>",20,"#e5edf1",1.5f,0);UIKit.GetOrAdd<LayoutElement>(heading).minHeight=48;
            _grid=Rect(content,"boss-formation-grid");var grid=UIKit.GetOrAdd<GridLayoutGroup>(_grid);grid.cellSize=new Vector2(280,560);grid.spacing=new Vector2(28,28);grid.padding=new RectOffset(8,8,18,24);grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.childAlignment=TextAnchor.UpperCenter;
            for(int i=0;i<ds.Cards.Count;i++)
            {
                int index=i;var entry=ds.Cards[i];var slot=Rect(_grid,"battle-select-slot-"+i);var select=Action(slot,"bossSel-"+entry.Uid,"",()=>{if(Current)BattleView.Commands.SelectDeckCard(entry.Uid);});select.image.color=Color.clear;
                bool start=entry.Card.type=="装备"&&(entry.Card.desc??"").Contains("对战开始时");
                Set((RectTransform)select.transform,0,0,280,start?488:455);
                var card=DepartureElements.Card(select.transform,entry.Card,280,"formation-card",Options(index,false));card.anchorMin=card.anchorMax=card.pivot=new Vector2(.5f,1);card.anchoredPosition=Vector2.zero;
                foreach(var graphic in card.GetComponentsInChildren<Graphic>())graphic.raycastTarget=false;foreach(var scroll in card.GetComponentsInChildren<ScrollRect>())scroll.enabled=false;
                var state=Label(select.transform,"boss-selection-state","点击编入",22,"#b7d5df");Set(state.rectTransform,0,428,280,32);state.alignment=TextAnchor.MiddleCenter;
                if(start){var note=Label(select.transform,"boss-start-note","开战自动装配 · 占装备栏",18,"#b5c9d2",false,1.4f);Set(note.rectTransform,0,461,280,27);note.alignment=TextAnchor.MiddleCenter;}
                var ring=UIKit.GetOrAdd<Outline>(select);ring.effectDistance=new Vector2(3,-3);ring.effectColor=Theme.Hex("#b7d5df");ring.useGraphicAlpha=false;ring.enabled=false;
                var inspect=Action(slot,"btDecisionInspect-"+i,"查看详情",()=>Inspect(index));Set((RectTransform)inspect.transform,58,start?499:466,164,46);inspect.image.color=Theme.Hex("#12233099");var inspectText=inspect.GetComponentInChildren<Text>();inspectText.fontSize=21;inspectText.color=Theme.Hex("#bbd0dc");_inspect.Add(inspect);
                _choices.Add(entry.Uid,new Choice{Select=select,Inspect=inspect,State=state,Ring=ring});
            }
            if(ds.Cards.Count==0)Flow(content,"formation-empty","背包里没有可编入的非道具卡牌……",20,"#abc5ce",1.5f,0);
            _scroll.content.anchoredPosition=new Vector2(0,y);Layout();
        }
        CardFaceOptions Options(int index,bool reading=true)
        {
            var entry=_snapshot.DeckSelection.Cards[index];return new CardFaceOptions{HideCost=false,ScrollDescription=reading,CostOverride=BattleView.Api.EffCostOf(entry.Card),DescriptionContext=CardFace.BattleDescription(_snapshot,entry.Uid)};
        }
        void Inspect(int index)
        {if(Current)DepartureCardZoom.Open(_snapshot.DeckSelection.Cards.Select(entry=>entry.Card).ToArray(),index,i=>Options(i),i=>_inspect[i].gameObject);}
        void LateUpdate()=>Layout();
        void Layout()
        {
            if(_workspace==null)return;var bounds=((RectTransform)transform).rect;float width=Mathf.Min(1760,Mathf.Max(1,bounds.width-88)),height=Mathf.Min(980,Mathf.Max(1,bounds.height-88));
            _workspace.sizeDelta=new Vector2(width,height);_workspace.anchoredPosition=Vector2.zero;
            Set(_header,36,26,width-72,46);Set((RectTransform)_header.GetChild(0),0,0,width-360,46);Set((RectTransform)_header.GetChild(1),width-352,0,280,34);
            Set(_summary,36,92,width-72,137);Set((RectTransform)_summary.GetChild(0),0,0,width-350,21);Set(_name.rectTransform,0,29,width-350,41);Set(_stats.rectTransform,0,78,width-350,38);Set(_progress.rectTransform,width-352,0,280,50);Set(_capacity.rectTransform,width-352,60,280,38);Set((RectTransform)_summary.GetChild(5),0,136,width-72,1);
            Set(_body,36,251,width-72,Mathf.Max(80,height-347));Set(_footer,0,height-96,width,96);Set((RectTransform)_footer.GetChild(0),0,0,width,1);
            float confirm=Mathf.Max(220,_confirm.GetComponentInChildren<Text>().preferredWidth+48),cancel=220,total=confirm+cancel+18;
            Set((RectTransform)_confirm.transform,(width-total)*.5f,18,confirm,60);Set((RectTransform)_footer.GetChild(2),(width-total)*.5f+confirm+18,18,cancel,60);
            if(_grid!=null){var grid=_grid.GetComponent<GridLayoutGroup>();int columns=Mathf.Max(1,Mathf.FloorToInt((width-72-16+28)/308));grid.constraintCount=columns;var element=UIKit.GetOrAdd<LayoutElement>(_grid);element.preferredHeight=grid.padding.top+grid.padding.bottom+Mathf.CeilToInt(_choices.Count/(float)columns)*588-28;}
        }
        static RectTransform Rect(Transform parent,string name){var go=new GameObject(name,typeof(RectTransform));go.transform.SetParent(parent,false);return (RectTransform)go.transform;}
        static void Set(RectTransform rect,float x,float y,float width,float height){rect.anchorMin=rect.anchorMax=rect.pivot=new Vector2(0,1);rect.anchoredPosition=new Vector2(x,-y);rect.sizeDelta=new Vector2(width,height);}
        static Image Fill(RectTransform rect,string ink){var image=UIKit.GetOrAdd<Image>(rect);image.color=Theme.Hex(ink);image.raycastTarget=false;return image;}
        static Text Label(Transform parent,string name,string text,int size,string ink,bool bold=false,float em=1.5f){var label=UIKit.Label(parent,text,size,Theme.Hex(ink));label.name=name;if(bold)label.font=Sdt.Res.Res.SansBold;label.fontStyle=FontStyle.Normal;label.lineSpacing=SourceTextLayout.LineSpacing(label,em);label.raycastTarget=false;return label;}
        static Text Flow(Transform parent,string name,string text,int size,string ink,float em,float after){var label=Label(parent,name,text,size,ink,false,em);SourceTextLayout.Cjk(label);label.verticalOverflow=VerticalWrapMode.Overflow;var element=UIKit.GetOrAdd<LayoutElement>(label);element.minHeight=size*em+after;element.preferredHeight=-1;element.flexibleHeight=0;return label;}
        static Button Action(Transform parent,string name,string text,Action run,bool primary=false){var button=UIKit.Btn(parent,text,run);button.name=name;button.image.color=Theme.Hex(primary?"#d7c698":"#152a35");var copy=button.GetComponentInChildren<Text>();copy.fontSize=24;copy.color=Theme.Hex(primary?"#17232b":"#e5edf1");var layout=UIKit.GetOrAdd<LayoutElement>(button);layout.minHeight=60;layout.flexibleHeight=0;return button;}
    }
    [RequireComponent(typeof(CanvasRenderer))]
    internal sealed class FormationSurface:MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();var rect=rectTransform.rect;float radius=Mathf.Min(16,Mathf.Min(rect.width,rect.height)*.5f);
            Color Ink(Vector2 p){float t=((p.x-rect.xMin)*.574f+(rect.yMax-p.y)*.819f)/Mathf.Max(1,rect.width*.574f+rect.height*.819f);return Color.Lerp(Theme.Hex("#1d2d38f5"),Theme.Hex("#101c26fa"),t);}
            mesh.AddVert(rect.center,Ink(rect.center),Vector2.zero);int count=0;
            for(int corner=0;corner<4;corner++)
            {
                var center=new Vector2(corner==0||corner==3?rect.xMax-radius:rect.xMin+radius,corner<2?rect.yMax-radius:rect.yMin+radius);
                for(int step=0;step<=12;step++){float angle=(corner*90+step*7.5f)*Mathf.Deg2Rad;var point=center+new Vector2(Mathf.Cos(angle),Mathf.Sin(angle))*radius;mesh.AddVert(point,Ink(point),Vector2.zero);if(count>0)mesh.AddTriangle(0,count,count+1);count++;}
            }
            if(count>1)mesh.AddTriangle(0,count,1);
        }
    }
}
