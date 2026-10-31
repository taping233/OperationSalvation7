// Current reward-scene-view.js: retained card faces, independent read/claim, fixed footer.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentRewardItem
    {
        public string Key,State="pending",ClaimLabel,StateCopy;public CardDef Card;public int Index;public bool Choice,Bonus,Fits=true,Organize,ExplicitMode=true;
        public Action Claim;public Func<string> LiveState;
    }
    public sealed class CurrentRewardScene:MonoBehaviour
    {
        public RectTransform Actions,Info;
        RectTransform _main,_header,_footer,_content,_objects;
        Text _title,_source,_rule,_notice;
        CurrentRewardFlow _grid;ScrollRect _scroll;
        readonly Dictionary<string,CurrentRewardTile> _tiles=new Dictionary<string,CurrentRewardTile>();
        Vector2 _last;bool _entry;float _openedAt;
        public bool IsCurrent=>UiStack.Top==_owner;
        public bool CanSubmit=>Time.unscaledTime>=_openedAt+.18f&&UiStack.Top==_owner;
        public Action OnResume;Panel _owner;bool _active=true;
        public static CurrentRewardScene Create(Transform parent,bool entry=false)
        {var root=CurrentNodeElements.Rect(parent,"reward-v14 room-reward");CurrentNodeElements.Stretch(root);var view=UIKit.GetOrAdd<CurrentRewardScene>(root);view._entry=entry;view.Build();return view;}
        void Build()
        {
            _owner=GetComponentInParent<Panel>();_openedAt=Time.unscaledTime;
            if(_entry){CurrentNodeElements.Background(transform,"scene-entry-current");CurrentNodeShade.Create(transform,"entry");}
            else{CurrentNodeElements.Background(transform,"scene-reward-current");CurrentNodeShade.Create(transform,"reward");}
            _header=CurrentNodeElements.Rect(transform,"reward-head");_title=CurrentNodeElements.Text(_header,"title","",34,"#e9f0eb",true);_title.alignment=TextAnchor.MiddleCenter;
            _source=CurrentNodeElements.Text(_header,"source","",18,"#bbcbd0");_source.alignment=TextAnchor.MiddleCenter;
            _rule=CurrentNodeElements.Text(_header,"reward-rule","",18,"#bbcbd0");_rule.alignment=TextAnchor.MiddleCenter;
            _main=CurrentNodeElements.Rect(transform,"reward-main");var scroll=UIKit.Scroll(_main);_content=(RectTransform)scroll.transform;_content.name="reward-objects";
            var column=UIKit.GetOrAdd<VerticalLayoutGroup>(_content);column.padding=new RectOffset();column.spacing=12;column.childForceExpandWidth=true;column.childForceExpandHeight=false;column.childControlWidth=column.childControlHeight=true;
            _objects=CurrentNodeElements.Rect(_content,"reward-objects");_grid=UIKit.GetOrAdd<CurrentRewardFlow>(_objects);_grid.padding=new RectOffset(12,12,12,12);_grid.childAlignment=TextAnchor.UpperCenter;
            _scroll=_content.GetComponentInParent<ScrollRect>();
            _footer=CurrentNodeElements.Rect(transform,"reward-foot room-footer");var line=CurrentNodeElements.Fill(_footer,"footer-line","#d2e3e3");line.color=Theme.HexA("#d2e3e3",.16f);line.rectTransform.anchorMin=new Vector2(0,1);line.rectTransform.anchorMax=Vector2.one;line.rectTransform.pivot=new Vector2(.5f,1);line.rectTransform.sizeDelta=new Vector2(0,1);line.rectTransform.anchoredPosition=Vector2.zero;
            Info=CurrentNodeElements.Rect(_footer,"reward-footer-info");Actions=CurrentNodeElements.Rect(_footer,"loot-actions");
            var info=UIKit.GetOrAdd<HorizontalLayoutGroup>(Info);info.spacing=18;info.childAlignment=TextAnchor.MiddleLeft;info.childControlWidth=info.childControlHeight=true;info.childForceExpandWidth=info.childForceExpandHeight=false;
            var actions=UIKit.GetOrAdd<HorizontalLayoutGroup>(Actions);actions.spacing=12;actions.childAlignment=TextAnchor.MiddleRight;actions.childControlWidth=actions.childControlHeight=true;actions.childForceExpandWidth=actions.childForceExpandHeight=false;
            _notice=CurrentNodeElements.Text(_content,"reward-notice","",22,"#d0dcd8");_notice.alignment=TextAnchor.MiddleCenter;
        }
        public void Set(string title,string source,string notice=null,string rule=null)
        {_title.text=title;_source.text=source??"";_rule.text=rule??"";_rule.gameObject.SetActive(!string.IsNullOrEmpty(rule));_notice.text=notice??"";_notice.gameObject.SetActive(!string.IsNullOrEmpty(notice));_last=new Vector2(-1,-1);}
        public void Reveal(int index){var tile=_tiles.Values.FirstOrDefault(t=>t.Index==index);if(tile!=null)tile.Pop();}
        public void PlayAcquisition(string[] ids)
        {
            foreach(string id in ids){var tile=_tiles.Values.FirstOrDefault(t=>t.CardId==id);if(tile!=null)CurrentRewardAcquisition.Play(transform,tile.ArtRect,Info,CardLibrary.FindById(id));}
        }
        public void ClearActions(){CurrentNodeElements.Clear(Actions);CurrentNodeElements.Clear(Info);_last=new Vector2(-1,-1);}
        public void Sync(IReadOnlyList<CurrentRewardItem> items)
        {
            var keep=new HashSet<string>();int order=0;
            foreach(var item in items)
            {
                keep.Add(item.Key);
                if(!_tiles.TryGetValue(item.Key,out var tile)||tile==null){var root=CurrentNodeElements.Rect(_objects,"reward-unit "+item.Key);tile=UIKit.GetOrAdd<CurrentRewardTile>(root);tile.Build(item.Card);_tiles[item.Key]=tile;}
                tile.Set(item);tile.transform.SetSiblingIndex(order++);
            }
            var ordered=_tiles.Values.Where(t=>t!=null&&keep.Contains(t.Key)).OrderBy(t=>t.transform.GetSiblingIndex()).ToArray();
            for(int i=0;i<ordered.Length;i++)ordered[i].Navigate(ordered[(i+ordered.Length-1)%ordered.Length],ordered[(i+1)%ordered.Length]);
            foreach(var key in _tiles.Keys.ToArray())if(!keep.Contains(key)){_tiles[key].gameObject.SetActive(false);Destroy(_tiles[key].gameObject);_tiles.Remove(key);}
        }
        void LateUpdate()
        {
            bool active=UiStack.Top==_owner;if(active&&!_active){_active=true;OnResume?.Invoke();}_active=active;
            var size=((RectTransform)transform).rect.size;if(size==_last)return;_last=size;
            _rule.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,Mathf.Max(1,size.x-112));float ruleHeight=string.IsNullOrEmpty(_rule.text)?0:Mathf.Max(27,_rule.preferredHeight)+8;float baseHead=string.IsNullOrEmpty(_source.text)?52:92;float headHeight=baseHead+ruleHeight;CurrentNodeElements.Fixed(_header,56,28,Mathf.Max(1,size.x-112),headHeight);
            CurrentNodeElements.Fixed(_title.rectTransform,0,0,Mathf.Max(1,size.x-112),46);CurrentNodeElements.Fixed(_source.rectTransform,0,50,Mathf.Max(1,size.x-112),34);CurrentNodeElements.Fixed(_rule.rectTransform,0,baseHead,Mathf.Max(1,size.x-112),ruleHeight);
            CurrentNodeElements.Stretch(_main,56,28+headHeight+16,56,112);_grid.MinimumHeight=Mathf.Max(0,size.y-(28+headHeight+16)-112);LayoutRebuilder.MarkLayoutForRebuild(_objects);
            CurrentNodeElements.Stretch(_content.GetComponentInParent<ScrollRect>().GetComponent<RectTransform>());
            CurrentNodeElements.Fixed(_footer,56,20,Mathf.Max(1,size.x-112),72,new Vector2(0,0),new Vector2(0,0));_footer.anchoredPosition=new Vector2(56,20);
            float actionWidth=0;int buttons=0;foreach(Transform child in Actions)if(child.gameObject.activeSelf){actionWidth+=Mathf.Max(160,LayoutUtility.GetPreferredWidth(child as RectTransform));buttons++;}actionWidth+=Mathf.Max(0,buttons-1)*12;
            CurrentNodeElements.Stretch(Info,0,12,actionWidth+20,0);
            CurrentNodeElements.Stretch(Actions,Mathf.Max(0,size.x-112-actionWidth),12,0,0);

        }
    }
    public sealed class CurrentRewardTile:MonoBehaviour
    {
        Material _paint;string _paintState;float _pop=-1;
        CurrentRewardItem _item;Button _claim,_read;Text _state,_tag;CanvasGroup _art;CardDef _card;RectTransform _faceRect;
        public int Index=>_item?.Index??-1;
        public void Pop(){if(!CurrentUiPreferences.ReducedMotion)_pop=0;}
        void Update(){if(_pop<0)return;_pop+=Time.unscaledDeltaTime;float p=Mathf.Clamp01(_pop/.32f)*3;float[] scales={1,1.16f,.98f,1};int i=Mathf.Min(2,(int)p);float scale=Mathf.Lerp(scales[i],scales[i+1],p-i);transform.localScale=Vector3.one*scale;if(_pop>=.32f){_pop=-1;transform.localScale=Vector3.one;}}
        void OnDestroy(){if(_paint!=null)Destroy(_paint);}
        public string CardId=>_item?.Card?.id;public RectTransform ArtRect=>_art.transform as RectTransform;
        public string Key=>_item?.Key;
        public void Navigate(CurrentRewardTile left,CurrentRewardTile right){var n=new Navigation{mode=Navigation.Mode.Explicit,selectOnLeft=left._read,selectOnRight=right._read,selectOnDown=_claim};_read.navigation=n;n.selectOnLeft=left._claim.gameObject.activeSelf?left._claim:left._read;n.selectOnRight=right._claim.gameObject.activeSelf?right._claim:right._read;n.selectOnUp=_read;_claim.navigation=n;}
        public bool Bonus=>_item?.Bonus==true;
        public void Build(CardDef card)
        {
            _card=card;var art=CurrentNodeElements.Rect(transform,"reward-card");CurrentNodeElements.Fixed(art,0,0,300,450);
            var face=CardFace.Create(card,CardSize.Xl,art);var rt=(RectTransform)face.transform;rt.anchorMin=rt.anchorMax=Vector2.one*.5f;rt.pivot=Vector2.one*.5f;rt.anchoredPosition=Vector2.zero;
            _faceRect=rt;
            var le=UIKit.GetOrAdd<LayoutElement>(face);le.ignoreLayout=true;var paper=face.transform.Find("paper-card") as RectTransform;if(paper!=null)rt.localScale=Vector3.one*(300/paper.sizeDelta.x);
            _art=UIKit.GetOrAdd<CanvasGroup>(art);_read=UIKit.GetOrAdd<Button>(art);_read.targetGraphic=face.GetComponent<Image>();_read.onClick.AddListener(()=>{var scene=GetComponentInParent<CurrentRewardScene>();if(scene!=null&&scene.IsCurrent)CurrentRewardCardZoom.Open(_item);});
            _claim=CurrentNodeElements.Button(transform,"收下",()=>{var scene=GetComponentInParent<CurrentRewardScene>();if(scene!=null&&!scene.CanSubmit||_item.State!="pending")return;if(!_item.Fits){if(_item.Organize)CurrentRewardCapacityOrganizer.Open(_item,GetComponentInParent<Panel>());else GameRuntime.I.Bus.Emit(new BagOpened());}else _item.Claim?.Invoke();});CurrentNodeElements.Fixed((RectTransform)_claim.transform,50,472,200,52);
            _state=CurrentNodeElements.Text(transform,"reward-unit-state","",20,"#bfd4c8");CurrentNodeElements.Fixed(_state.rectTransform,0,472,300,52);_state.alignment=TextAnchor.MiddleCenter;
            _tag=CurrentNodeElements.Text(transform,"reward-category","",18,"#b6c7c2");CurrentNodeElements.Fixed(_tag.rectTransform,0,-25,300,24);_tag.alignment=TextAnchor.MiddleCenter;
        }
        public void Set(CurrentRewardItem item)
        {
            _item=item;bool pending=item.State=="pending";_claim.gameObject.SetActive(pending);_state.gameObject.SetActive(!pending);_art.alpha=item.State=="received"?.6f:item.State=="forfeited"?.28f:1;
            float width=item.Bonus?190:300,height=item.Bonus?330:524,artWidth=item.Bonus?166:300,artHeight=artWidth*1.5f;
            var le=UIKit.GetOrAdd<LayoutElement>(this);le.preferredWidth=le.minWidth=width;le.preferredHeight=le.minHeight=height;le.flexibleWidth=le.flexibleHeight=0;
            CurrentNodeElements.Fixed((RectTransform)_art.transform,(width-artWidth)*.5f,item.Bonus?12:0,artWidth,artHeight);
            var paper=_faceRect.Find("paper-card") as RectTransform;if(paper!=null)_faceRect.localScale=Vector3.one*(artWidth/paper.sizeDelta.x);
            CurrentNodeElements.Fixed((RectTransform)_claim.transform,item.Bonus?12:50,artHeight+(item.Bonus?24:22),item.Bonus?166:200,item.Bonus?46:52);
            CurrentNodeElements.Fixed(_state.rectTransform,0,artHeight+22,width,52);CurrentNodeElements.Fixed(_tag.rectTransform,0,-25,width,24);
            _state.text=item.StateCopy??(item.State=="received"?item.ExplicitMode?item.Choice?"✓ 已入背包":"✓ 已收下":item.Choice?"已选择":"已收下":item.ExplicitMode?"× 已放弃":"已放弃");
            if(_paintState!=item.State)
            {
                _paintState=item.State;
                if(item.State!="pending"&&_paint==null){var shader=Resources.Load<Shader>("CurrentHomeScene");if(shader!=null)_paint=new Material(shader){name="reward settled-card saturation"};}
                if(_paint!=null)_paint.SetFloat("_Gray",item.State=="received"?.5f:item.State=="forfeited"?.8f:0);
                foreach(var image in _art.GetComponentsInChildren<Image>())image.material=item.State=="pending"?null:_paint;
            }
            _tag.text=item.Bonus?"附赠":item.Choice?"候选":"";
            foreach(var text in _claim.GetComponentsInChildren<Text>())text.text=item.ClaimLabel??(!item.Fits?"整理背包":item.Choice?"选择":"收下");
        }
    }
    public sealed class CurrentRewardCardZoom:Panel
    {
        CurrentRewardItem _item;
        public static void Open(CurrentRewardItem item){if(item?.Card==null)return;var page=ScreenMount.Show<CurrentRewardCardZoom>("CardZoom reward-read");page._item=item;page.Build();}
        public override void Build()
        {
            var root=UIKit.Panel("reward-cardZoom",transform);var dim=UIKit.GetOrAdd<Image>(root);dim.color=Theme.HexA("#07121b",.96f);
            var face=CardFace.Create(_item.Card,CardSize.Xl,root.transform);var rt=(RectTransform)face.transform;rt.anchorMin=rt.anchorMax=Vector2.one*.5f;rt.pivot=Vector2.one*.5f;rt.anchoredPosition=new Vector2(0,30);rt.localScale=Vector3.one*1.5f;
            var actions=CurrentNodeElements.Rect(root.transform,"reward-zoom-actions");CurrentNodeElements.Fixed(actions,0,30,620,60,new Vector2(.5f,0),new Vector2(.5f,0));actions.anchoredPosition=new Vector2(0,30);
            var row=UIKit.GetOrAdd<HorizontalLayoutGroup>(actions);row.spacing=18;row.childControlWidth=row.childControlHeight=true;row.childForceExpandWidth=false;
            CurrentNodeElements.Button(actions,"返回奖励",Close);
            string state=_item.LiveState?.Invoke()??_item.State;
            if(state=="pending")CurrentNodeElements.Button(actions,_item.Choice?"选择":"收下",()=>{Close();if(!_item.Fits){if(_item.Organize)CurrentRewardCapacityOrganizer.Open(_item,UiStack.Top);else GameRuntime.I.Bus.Emit(new BagOpened());}else _item.Claim?.Invoke();},true);
        }
    }
    public sealed class CurrentRewardReceipt:MonoBehaviour
    {
        float _time;Text _text;
        public static void Show(Transform parent,string copy="已收下")
        {var root=CurrentNodeElements.Rect(parent,"reward-completion-receipt");CurrentNodeElements.Fixed(root,0,96,240,54,new Vector2(.5f,0),new Vector2(.5f,0));root.anchoredPosition=new Vector2(0,96);var image=UIKit.GetOrAdd<Image>(root);image.color=Theme.Hex("#15313a");image.raycastTarget=false;var receipt=UIKit.GetOrAdd<CurrentRewardReceipt>(root);receipt._text=CurrentNodeElements.Text(root,"receipt",copy,22,"#e3ece8");CurrentNodeElements.Stretch(receipt._text.rectTransform);receipt._text.alignment=TextAnchor.MiddleCenter;}
        void Update(){_time+=Time.unscaledDeltaTime;float p=_time/1.8f;var group=UIKit.GetOrAdd<CanvasGroup>(this);group.blocksRaycasts=false;group.alpha=CurrentUiPreferences.ReducedMotion?1:p<.08f?p/.08f:p>.9f?(1-p)/.1f:1;if(p>=1)Destroy(gameObject);}
    }
}
