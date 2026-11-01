// Source game.bag.drag.js: one click inspects; drag targets are the left rail and current board.
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace Sdt.UI.Screens.Bag
{
    public sealed class BagCell : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler, IPointerClickHandler, IPointerEnterHandler, IPointerExitHandler, ISubmitHandler, ISelectHandler, IDeselectHandler
    {
        BagScreen _owner;
        public BagScreen.Stack Entry { get; private set; }
        GameObject _art, _ghost;
        Text _count, _status;
        CanvasGroup _alpha;
        bool _down,_moved;
        Vector2 _origin,_last,_speed;
        Coroutine _detailRoutine;
        float _cardWidth;
        string _artFingerprint;
        int _dropFrame=-1;
        public static BagCell Create(Transform parent,BagScreen owner,BagScreen.Stack stack,bool safe)
        {
            var rt=BagView.Rect("bag-tile",parent);BagView.Paint(rt,"#ffffff00");rt.gameObject.AddComponent<Selectable>();var cell=rt.gameObject.AddComponent<BagCell>();cell._owner=owner;cell._alpha=rt.gameObject.AddComponent<CanvasGroup>();
            cell._count=BagView.Text(rt,"bag-tct","",18,"#edf2f3");cell._count.alignment=TextAnchor.MiddleCenter;
            cell._status=BagView.Text(rt,"bag-tstate","",18,"#c9b477");cell._status.alignment=TextAnchor.MiddleCenter;cell.Bind(stack);return cell;
        }
        public void Bind(BagScreen.Stack stack)
        {
            string fingerprint=BagView.CardFingerprint(stack.card);
            bool artChanged=Entry==null||_artFingerprint!=fingerprint;_artFingerprint=fingerprint;Entry=stack;
            name=stack.supply?"supply-"+stack.supplyName:stack.pocketIndex>=0?"inspectPocket-"+stack.pocketIndex:"inspectStack-"+stack.uids.FirstOrDefault();
            if(artChanged)
            {
                if(_art!=null){_art.SetActive(false);Destroy(_art);}
                if(stack.card!=null)_art=BagView.Card(transform,stack.card,_cardWidth>0?_cardWidth:272.64f);
                else {_art=BagView.Rect("supply-fallback",transform).gameObject;var label=BagView.Text(_art.transform,"supply-label",stack.supplyName,22,"#edf2f3");UiExt.Stretch(label.rectTransform);label.alignment=TextAnchor.MiddleCenter;}
                _art.transform.SetAsFirstSibling();
            }
            _count.text=stack.count>1?"×"+stack.count:"";_count.gameObject.SetActive(stack.count>1);
            _status.text=stack.zone=="safe"?"押运":stack.zone=="pocket"?(stack.card.type=="道具"||stack.card.type=="装备"?"火堆不可复原":"火堆可复原"):stack.card?.type=="道具"?BagCardDetail.UseStatus(stack.card,stack.uids.FirstOrDefault()).badge:"";
            _status.gameObject.SetActive(!string.IsNullOrEmpty(_status.text));
            if(_art!=null){var group=UIKit.GetOrAdd<CanvasGroup>(_art);group.alpha=stack.zone=="pocket"?.65f:1;}
        }
        public void SetSize(float width,float height,float canvasWidth)
        {
            _cardWidth=Mathf.Min(canvasWidth*.142f,width-12);
            if(_art!=null){var rt=(RectTransform)_art.transform;BagView.Place(rt,(width-_cardWidth)/2,width*.032f,_cardWidth,_cardWidth*1.5f);if(rt.childCount>0&&rt.GetChild(0).name.StartsWith("card-"))BagView.ScaleCard(rt.GetChild(0),_cardWidth);}
            BagView.Place(_count.rectTransform,width-66,8,58,32);BagView.Place(_status.rectTransform,8,height-39,width-16,30);
        }
        public void OnPointerDown(PointerEventData e)
        {
            if(e.button!=PointerEventData.InputButton.Left||_owner!=BagScreen.Current||UiStack.Top!=_owner)return;
            StopPending();EventSystem.current?.SetSelectedGameObject(gameObject);_down=true;_moved=false;_origin=_last=e.position;_speed=Vector2.zero;
        }
        public void OnDrag(PointerEventData e)
        {
            if(!_down||Entry.supply||Entry.pocketIndex>=0)return;
            if(!_moved){if(Vector2.Distance(_origin,e.position)<5)return;_moved=true;StopPending();MakeGhost();_alpha.alpha=.32f;AudioService.I.PlaySfx("pick");}
            var delta=e.position-_last;_speed=_speed*.72f+delta*.9f;_last=e.position;
            if(_ghost!=null){_ghost.transform.position=e.position;_ghost.transform.localRotation=Quaternion.Euler(Mathf.Clamp(-_speed.y*1.4f,-22,22),Mathf.Clamp(_speed.x*1.5f,-30,30),0);}
        }
        void MakeGhost()
        {
            _ghost=BagView.Rect("bag-ghost",GetComponentInParent<Canvas>().transform).gameObject;
            ((RectTransform)_ghost.transform).sizeDelta=new Vector2(_cardWidth,_cardWidth*1.5f);_ghost.transform.position=_last;
            var group=_ghost.AddComponent<CanvasGroup>();group.blocksRaycasts=false;group.interactable=false;group.alpha=.95f;
            var art=BagView.Card(_ghost.transform,Entry.card,_cardWidth);var rt=(RectTransform)art.transform;rt.anchorMin=rt.anchorMax=Vector2.one*.5f;rt.anchoredPosition=Vector2.zero;
        }
        public void OnPointerUp(PointerEventData e)
        {
            if(!_down)return;_down=false;ClearGhost();if(!_moved)return;_dropFrame=Time.frameCount;AudioService.I.PlaySfx("drop");
            BagCell over=null;DropZoneKind? zone=null;
            var hits=new List<RaycastResult>();EventSystem.current?.RaycastAll(e,hits);
            foreach(var hit in hits)
            {
                var cell=hit.gameObject.GetComponentInParent<BagCell>();var target=hit.gameObject.GetComponentInParent<DropZone>();
                if(cell!=null&&cell!=this){over=cell;break;}if(target!=null){zone=target.kind;break;}
            }
            BagCellHover.Current=null;DropZoneHover.Current=null;_owner.Drop(Entry,over,zone);
        }
        public void OnPointerClick(PointerEventData e)
        {
            if(_moved||_dropFrame==Time.frameCount||Entry.supply||e.button!=PointerEventData.InputButton.Left||_owner!=BagScreen.Current||UiStack.Top!=_owner)return;
            StopPending();_detailRoutine=StartCoroutine(OpenDetail(_owner.Generation));
        }
        IEnumerator OpenDetail(int generation)
        {
            yield return new WaitForSecondsRealtime(.04f);_detailRoutine=null;
            if(_owner!=null&&_owner.IsCurrent(generation)&&UiStack.Top==_owner)BagCardDetail.ShowEntry(Entry);
        }
        void StopPending(){if(_detailRoutine!=null)StopCoroutine(_detailRoutine);_detailRoutine=null;}
        void ClearGhost(){if(_ghost!=null){_ghost.SetActive(false);Destroy(_ghost);}_ghost=null;if(_alpha!=null)_alpha.alpha=1;}
        internal void CancelInteraction(){StopPending();ClearGhost();_down=_moved=false;if(BagCellHover.Current==this)BagCellHover.Current=null;}
        void OnDisable()=>CancelInteraction();void OnDestroy()=>CancelInteraction();
        void OnApplicationFocus(bool focused){if(!focused)CancelInteraction();}
        void OnApplicationPause(bool paused){if(paused)CancelInteraction();}
        public static class BagCellHover{public static BagCell Current;}
        public void OnPointerEnter(PointerEventData e){BagCellHover.Current=this;}
        public void OnPointerExit(PointerEventData e){if(BagCellHover.Current==this)BagCellHover.Current=null;}
        public void OnSubmit(BaseEventData e){if(!Entry.supply&&UiStack.Top==_owner)BagCardDetail.ShowEntry(Entry);}
        public void OnSelect(BaseEventData e){BagView.Border((RectTransform)transform,"#91c2c6");}
        public void OnDeselect(BaseEventData e){var line=GetComponent<Outline>();if(line!=null)line.effectColor=Color.clear;}
    }
    public enum DropZoneKind{BagArea,Safe}
    public static class DropZoneHover{public static DropZoneKind? Current;}
    public sealed class DropZone:MonoBehaviour,IPointerEnterHandler,IPointerExitHandler
    {
        public DropZoneKind kind;
        public void OnPointerEnter(PointerEventData e){DropZoneHover.Current=kind;}
        public void OnPointerExit(PointerEventData e){if(DropZoneHover.Current==kind)DropZoneHover.Current=null;}
    }
}
