using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen
    {
        static readonly Dictionary<string,Vector2> BrowseScroll=new Dictionary<string,Vector2>();
        static readonly Dictionary<string,string> BrowseFocus=new Dictionary<string,string>();
        static readonly Dictionary<string,Vector2Int> InputSelection=new Dictionary<string,Vector2Int>();
        string _mountedView;
        static string ViewKey=>_tab+"/"+(_tab=="stash"?_warehouseView:_tab=="classes"?_personGroup+"/"+_personSection+"/"+(_hatch?"hatch":"browse"):_tab=="ach"?_archiveView:_tab=="shop"?_tradeMode:"");
        new void Rebuild()
        {
            if(!string.IsNullOrEmpty(_mountedView))
            {
                foreach(var scroll in GetComponentsInChildren<ScrollRect>())BrowseScroll[_mountedView+"/"+scroll.name]=scroll.normalizedPosition;
                var focused=EventSystem.current?.currentSelectedGameObject;
                if(focused!=null&&focused.transform.IsChildOf(transform)){BrowseFocus[_mountedView]=focused.name;var field=focused.GetComponent<InputField>();if(field!=null)InputSelection[_mountedView+"/"+focused.name]=new Vector2Int(field.selectionAnchorPosition,field.selectionFocusPosition);}
            }
            base.Rebuild();
        }
        void RestoreBrowse(GameObject root)
        {
            _mountedView=ViewKey;string key=_mountedView;
            root.AddComponent<HubBrowseRestore>().Apply=()=>
            {
                foreach(var scroll in root.GetComponentsInChildren<ScrollRect>())if(BrowseScroll.TryGetValue(key+"/"+scroll.name,out var position))scroll.normalizedPosition=position;
                if(!BrowseFocus.TryGetValue(key,out var focus)||EventSystem.current==null)return;
                foreach(var selectable in root.GetComponentsInChildren<Selectable>())if(selectable.name==focus&&selectable.IsInteractable()){EventSystem.current.SetSelectedGameObject(selectable.gameObject);var field=selectable as InputField;if(field!=null){field.ActivateInputField();if(InputSelection.TryGetValue(key+"/"+focus,out var selection)){field.selectionAnchorPosition=selection.x;field.selectionFocusPosition=selection.y;}}break;}
            };
        }
    }
    sealed class HubBrowseRestore : MonoBehaviour
    {
        public Action Apply;int _frames;
        void LateUpdate(){if(++_frames<2)return;Canvas.ForceUpdateCanvases();Apply?.Invoke();enabled=false;}
    }
}
