// Fixed per-unit density, retained status cells and independent scrolling/reading targets.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Battle
{
    public sealed class CurrentBattleStatuses:MonoBehaviour
    {
        sealed class Cell {public RectTransform Root;public Button Button;public Text Name,Amount;public Image Icon,Background;public Outline Border;public GameObject SolidEdge,DashedEdge;public CurrentBattleStatus Data;}
        readonly Dictionary<string,Cell> _cells=new Dictionary<string,Cell>();readonly List<Cell> _ordered=new List<Cell>();
        RectTransform _root,_viewport,_content;ScrollRect _scroll;Text _summary;bool _compact;float _width=-1;BattleScreen _owner;
        public float RegionHeight=>CurrentBattleStatusLayout.ViewportHeight(_compact);public int Count=>_ordered.Count;public int CellCreationCount{get;private set;}
        public void Initialize(bool compact,BattleScreen owner)
        {
            if(_root!=null)return;_compact=compact;_owner=owner;_root=(RectTransform)transform;
            var catchClick=UIKit.GetOrAdd<Image>(this);catchClick.color=Color.clear;var block=UIKit.GetOrAdd<Button>(this);block.targetGraphic=catchClick;block.transition=Selectable.Transition.None;block.navigation=new Navigation{mode=Navigation.Mode.None};
            _viewport=CurrentRunHudView.Box(transform,"status-chip-list",0,0,0,RegionHeight);_viewport.anchorMax=new Vector2(1,1);UIKit.GetOrAdd<RectMask2D>(_viewport);
            var hit=UIKit.GetOrAdd<Image>(_viewport);hit.color=new Color(0,0,0,.002f);
            _scroll=UIKit.GetOrAdd<ScrollRect>(_viewport);_scroll.horizontal=false;_scroll.vertical=true;_scroll.viewport=_viewport;_scroll.movementType=ScrollRect.MovementType.Clamped;
            _content=CurrentRunHudView.Box(_viewport,"status-content",0,0,0,RegionHeight);_content.anchorMax=new Vector2(1,1);_scroll.content=_content;
            _summary=CurrentRunHudView.Text(transform,"status-chip-summary","",0,0,0,28,18,"#dbe5e5");_summary.rectTransform.anchorMin=_summary.rectTransform.anchorMax=new Vector2(1,1);_summary.rectTransform.pivot=new Vector2(1,1);_summary.horizontalOverflow=HorizontalWrapMode.Overflow;
            var bounds=UIKit.GetOrAdd<LayoutElement>(this);bounds.minHeight=bounds.preferredHeight=RegionHeight;bounds.flexibleHeight=0;
        }
        Cell Create(string key)
        {
            CellCreationCount++;var cell=new Cell{Root=CurrentRunHudView.Box(_content,"status-"+key,0,0,60,26)};
            cell.Background=UIKit.GetOrAdd<Image>(cell.Root);cell.Button=UIKit.GetOrAdd<Button>(cell.Root);cell.Button.targetGraphic=cell.Background;cell.Button.onClick.AddListener(()=>{});
            cell.Border=UIKit.GetOrAdd<Outline>(cell.Root);cell.Border.effectDistance=new Vector2(1,-1);cell.Border.effectColor=Theme.HexA("#a9d7cc",.21f);
            cell.SolidEdge=CurrentRunHudView.Fill(cell.Root,"status-left-edge",0,0,2,26,"#a5d8cc").gameObject;cell.DashedEdge=CurrentRunHudView.Box(cell.Root,"status-curse-edge",0,0,2,26).gameObject;for(int i=0;i<4;i++)CurrentRunHudView.Fill(cell.DashedEdge.transform,"dash-"+i,0,i*7,2,4,"#d29a9e");cell.Icon=CurrentRunHudView.Art(cell.Root,"status-icon",null,4,4,18,18);
            cell.Name=CurrentRunHudView.Text(cell.Root,"status-name","",24,0,120,26,18,"#e0eeea");cell.Amount=CurrentRunHudView.Text(cell.Root,"status-amount","",24,0,34,26,18,"#e0eeea");cell.Amount.font=Sdt.Res.Res.SansBold;cell.Amount.alignment=TextAnchor.MiddleRight;
            UIKit.GetOrAdd<BattleHoverInfo>(cell.Root).Setup(()=>{if(_owner!=null)BattleReadout.Show(_owner.transform,cell.Data.Name,(cell.Data.Description??"")+"\n当前："+cell.Data.Label);});
            UIKit.GetOrAdd<CurrentBattleStatusFocus>(cell.Root).Bind(this,cell.Root);return cell;
        }
        public void Sync(IReadOnlyList<CurrentBattleStatus> values)
        {
            _ordered.Clear();var keep=new HashSet<string>();foreach(var value in values??Array.Empty<CurrentBattleStatus>()){
                keep.Add(value.Key);if(!_cells.TryGetValue(value.Key,out var cell)){cell=Create(value.Key);_cells[value.Key]=cell;}
                cell.Data=value;cell.Background.color=Theme.HexA(value.Curse?"#35212b":"#122c2e",.86f);cell.Icon.sprite=Sdt.Res.Res.Ui(value.Icon);cell.Name.text=value.Name;cell.Name.gameObject.SetActive(!_compact);cell.Name.verticalOverflow=VerticalWrapMode.Truncate;
                cell.Border.effectColor=Theme.HexA(value.Curse?"#d79799":"#a9d7cc",.22f);cell.SolidEdge.SetActive(!value.Curse);cell.DashedEdge.SetActive(value.Curse);cell.Name.color=cell.Amount.color=Theme.Hex(value.Curse?"#f1d8dc":"#e0eeea");
                cell.Amount.text=value.Amount+(_compact?"":value.Unit);cell.Amount.gameObject.SetActive(!string.IsNullOrEmpty(value.Amount));_ordered.Add(cell);
            }
            foreach(var key in _cells.Keys.Where(k=>!keep.Contains(k)).ToArray()){var cell=_cells[key];if(EventSystem.current?.currentSelectedGameObject==cell.Root.gameObject)EventSystem.current.SetSelectedGameObject(null);Destroy(cell.Root.gameObject);_cells.Remove(key);}
            _summary.text=_ordered.Count+"项↕";_root.gameObject.SetActive(_ordered.Count>0);_width=-1;Layout();
        }
        void Layout()
        {
            if(_root==null)return;float width=Mathf.Max(80,_root.rect.width);if(Mathf.Approximately(width,_width))return;_width=width;
            float caption=Mathf.Ceil(_summary.preferredWidth);_summary.rectTransform.sizeDelta=new Vector2(caption,28);_viewport.sizeDelta=new Vector2(-caption-4,RegionHeight);
            float available=Mathf.Max(22,width-caption-4-6);var widths=_ordered.Select(cell=>4+18+2+(_compact?0:cell.Name.preferredWidth)+(!_compact&&cell.Name.preferredWidth>0&&!string.IsNullOrEmpty(cell.Data.Amount)?2:0)+(string.IsNullOrEmpty(cell.Data.Amount)?0:Mathf.Max(22,cell.Amount.preferredWidth))+4);
            var positions=CurrentBattleStatusLayout.Arrange(widths,available,_compact,out float contentHeight);
            for(int i=0;i<_ordered.Count;i++){
                var cell=_ordered[i];float number=string.IsNullOrEmpty(cell.Data.Amount)?0:Mathf.Max(22,cell.Amount.preferredWidth);float w=positions[i].Width;
                cell.Root.anchoredPosition=new Vector2(positions[i].X,-positions[i].Y);cell.Root.sizeDelta=new Vector2(w,26);cell.Root.SetSiblingIndex(i);
                cell.Name.rectTransform.sizeDelta=new Vector2(Mathf.Max(0,w-number-30),26);cell.Amount.rectTransform.anchoredPosition=new Vector2(w-number-4,0);cell.Amount.rectTransform.sizeDelta=new Vector2(number,26);
                var navigation=new Navigation{mode=Navigation.Mode.Explicit,selectOnUp=i>0?_ordered[i-1].Button:null,selectOnDown=i+1<_ordered.Count?_ordered[i+1].Button:null};cell.Button.navigation=navigation;
            }
            _content.sizeDelta=new Vector2(0,contentHeight);
        }
        public void Reveal(RectTransform cell)
        {float top=-cell.anchoredPosition.y,offset=_content.anchoredPosition.y;if(top<offset)offset=top;else if(top+26>offset+RegionHeight)offset=top+26-RegionHeight;_content.anchoredPosition=new Vector2(0,Mathf.Clamp(offset,0,Mathf.Max(0,_content.rect.height-RegionHeight)));}
        void LateUpdate()=>Layout();
        void Update()
        {
            if(!Input.GetKeyDown(KeyCode.Tab)||CurrentInputBindings.SuppressGameplayInput||!string.IsNullOrEmpty(Input.compositionString))return;
            var current=EventSystem.current?.currentSelectedGameObject;int index=_ordered.FindIndex(c=>c.Root.gameObject==current);if(index<0)return;int direction=Input.GetKey(KeyCode.LeftShift)||Input.GetKey(KeyCode.RightShift)?-1:1;int next=index+direction;if(next>=0&&next<_ordered.Count)EventSystem.current.SetSelectedGameObject(_ordered[next].Root.gameObject);
        }
    }
    public sealed class CurrentBattleStatusFocus:MonoBehaviour,ISelectHandler
    {
        CurrentBattleStatuses _owner;RectTransform _cell;public void Bind(CurrentBattleStatuses owner,RectTransform cell){_owner=owner;_cell=cell;}
        public void OnSelect(BaseEventData e)=>_owner?.Reveal(_cell);
    }
}
