// Source game.bag.rules.js openBagDiscovery: choose, then confirm; saved candidates survive cancellation.
using System.Collections.Generic;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Bag
{
    public sealed class BagItemDiscoveryScreen:Panel
    {
        string _uid,_reason;List<CardDef> _candidates;int _selected=-1;
        public static void Open(string uid){var screen=ScreenMount.Show<BagItemDiscoveryScreen>("BagDiscovery");screen._uid=uid;screen.Prepare();}
        void Prepare(){BagItemCommands.TryPrepareDiscovery(GameRuntime.I,_uid,out _candidates,out _reason);Refresh();}
        void Refresh(){foreach(Transform child in transform){child.gameObject.SetActive(false);Destroy(child.gameObject);}Build();}
        public override void Build()
        {
            var root=BagView.Rect("reward-v14 reward-standalone-picker bag-discover",transform);float width=((RectTransform)transform).rect.width,height=((RectTransform)transform).rect.height;if(width<=0)width=1920;if(height<=0)height=1080;
            BagView.Place(root,44,44,width-88,height-88);BagView.Paint(root,"#15212cef");BagView.Border(root,"#a8bbc238");
            var title=BagView.Text(root,"bagDiscoverTitle","发现卡牌",36,"#eef1ed");BagView.Place(title.rectTransform,36,26,width-160,60);
            var note=BagView.Text(root,"bagDiscoverNotice",string.IsNullOrEmpty(_reason)?"确认后才消耗通行证；取消可保留候选。":_reason,22,"#e4bea8");BagView.Place(note.rectTransform,36,100,width-160,60);
            if(_candidates!=null)
            {
                float cardWidth=Mathf.Min(340,(width-240)/3),gap=40,start=(width-88-(_candidates.Count*cardWidth+(_candidates.Count-1)*gap))/2;
                for(int i=0;i<_candidates.Count;i++)
                {
                    int index=i;var select=BagView.Button(root,"bagDiscoverPick-"+i,"",()=>{_selected=index;Refresh();});BagView.Place((RectTransform)select.transform,start+i*(cardWidth+gap),190,cardWidth,cardWidth*1.5f+62);BagView.Selected(select,_selected==i);
                    var card=BagView.Card(select.transform,_candidates[i],cardWidth);BagView.Place((RectTransform)card.transform,0,0,cardWidth,cardWidth*1.5f);
                    var caption=BagView.Text(select.transform,"discover-selected",_selected==i?"已选中":"选择此牌",22,"#edf2f3");BagView.Place(caption.rectTransform,0,cardWidth*1.5f+12,cardWidth,40);caption.alignment=TextAnchor.MiddleCenter;
                }
            }
            var confirm=BagView.Button(root,_candidates==null?"bagDiscoverRetry":"bagDiscoverConfirm",_candidates==null?"重试":"确认选择",()=>{if(_candidates==null){Prepare();return;}if(_selected<0)return;if(!BagItemCommands.TryChooseDiscovery(GameRuntime.I,_uid,_candidates[_selected].id,out _reason)){Refresh();return;}AudioService.I.PlaySfx("ding");Close();BagScreen.Refresh();});
            BagView.Place((RectTransform)confirm.transform,width/2-324,height-192,280,60);confirm.interactable=_candidates==null||_selected>=0;
            var cancel=BagView.Button(root,"bagDiscoverCancel","取消，返回背包",Close);BagView.Place((RectTransform)cancel.transform,width/2+4,height-192,280,60);
        }
    }
}
