using System;
using System.Linq;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Hub
{
    /// <summary>CSS minmax/fr tracks. Fixed directories never share free space.</summary>
    public sealed class HubSourceColumns : LayoutGroup
    {
        public float[] Fixed = Array.Empty<float>(), Minimum = Array.Empty<float>(), Fraction = Array.Empty<float>();
        public float Gap = 22;
        public override void CalculateLayoutInputHorizontal() { base.CalculateLayoutInputHorizontal(); SetLayoutInputForAxis(padding.horizontal, LayoutUtility.DefaultMaxSize, padding.horizontal, 1, 0); }
        public override void CalculateLayoutInputVertical() { SetLayoutInputForAxis(0, LayoutUtility.DefaultMaxSize, 0, 1, 1); }
        float[] Widths()
        {
            int n=rectChildren.Count;var sizes=new float[n];var locked=new bool[n];float available=rectTransform.rect.width-padding.horizontal-Mathf.Max(0,n-1)*Gap;
            for(int i=0;i<n;i++) if(i<Fixed.Length&&Fixed[i]>0){sizes[i]=Fixed[i];locked[i]=true;available-=sizes[i];}
            for(int pass=0;pass<=n;pass++)
            {
                float weight=0;for(int i=0;i<n;i++)if(!locked[i])weight+=i<Fraction.Length?Fraction[i]:1;
                bool changed=false;
                for(int i=0;i<n;i++)if(!locked[i])
                {float width=weight>0?available*(i<Fraction.Length?Fraction[i]:1)/weight:0;float min=i<Minimum.Length?Minimum[i]:0;if(width<min){sizes[i]=min;locked[i]=true;available-=min;changed=true;}}
                if(changed)continue;
                for(int i=0;i<n;i++)if(!locked[i])sizes[i]=Mathf.Max(0,weight>0?available*(i<Fraction.Length?Fraction[i]:1)/weight:0);break;
            }
            return sizes;
        }
        public override void SetLayoutHorizontal(){float x=padding.left;var widths=Widths();for(int i=0;i<rectChildren.Count;i++){SetChildAlongAxis(rectChildren[i],0,x,widths[i]);x+=widths[i]+Gap;}}
        public override void SetLayoutVertical(){foreach(var child in rectChildren)SetChildAlongAxis(child,1,padding.top,Mathf.Max(0,rectTransform.rect.height-padding.vertical));}
    }
    /// <summary>Current warehouse 348px divisor or trade auto-fill 220px; stable full rows and left-aligned final row.</summary>
    public sealed class HubSourceCardGrid : LayoutGroup
    {
        public bool Warehouse;
        public float Gap=24, CellHeight=512, MaximumWidth;
        int Columns=>Mathf.Max(1,Mathf.FloorToInt(Warehouse?(rectTransform.rect.width+24)/348:(rectTransform.rect.width-padding.horizontal+Gap)/(220+Gap)));
        public override void CalculateLayoutInputHorizontal(){base.CalculateLayoutInputHorizontal();SetLayoutInputForAxis(0,LayoutUtility.DefaultMaxSize,0,1,0);}
        public override void CalculateLayoutInputVertical(){float height=padding.vertical+Mathf.Ceil(rectChildren.Count/(float)Columns)*(CellHeight+Gap)-Gap;SetLayoutInputForAxis(Mathf.Max(0,height),Mathf.Max(0,height),Mathf.Max(0,height),0,1);}
        public override void SetLayoutHorizontal()
        {
            float track=Mathf.Max(0,(rectTransform.rect.width-padding.horizontal-(Columns-1)*Gap)/Columns),width=MaximumWidth>0?Mathf.Min(track,MaximumWidth):track;
            for(int i=0;i<rectChildren.Count;i++)SetChildAlongAxis(rectChildren[i],0,padding.left+i%Columns*(track+Gap)+(track-width)/2,width);
        }
        public override void SetLayoutVertical(){for(int i=0;i<rectChildren.Count;i++)SetChildAlongAxis(rectChildren[i],1,padding.top+i/Columns*(CellHeight+Gap),CellHeight);}
    }
    public sealed class HubCardFit : MonoBehaviour, ILayoutSelfController
    {
        public RectTransform Face; public float MaximumWidth=300;
        void Fit(){if(Face==null)return;var host=(RectTransform)transform;float width=Mathf.Min(MaximumWidth,host.rect.width),height=host.rect.height;if(width<=0||height<=0||Face.rect.width<=0||Face.rect.height<=0)return;Face.localScale=Vector3.one*Mathf.Min(width/Face.rect.width,height/Face.rect.height);}
        public void SetLayoutHorizontal()=>Fit(); public void SetLayoutVertical()=>Fit();
        void LateUpdate()=>Fit();
    }
    public sealed class HubIntrinsicWidth : MonoBehaviour, ILayoutSelfController
    {
        public Text Content;public float HorizontalPadding;
        void Fit(){if(Content==null)return;float width=Mathf.Ceil(Content.preferredWidth+HorizontalPadding);var bounds=UIKit.GetOrAdd<LayoutElement>(this);if(Mathf.Approximately(bounds.preferredWidth,width)&&bounds.flexibleWidth==0)return;bounds.minWidth=bounds.preferredWidth=width;bounds.flexibleWidth=0;LayoutRebuilder.MarkLayoutForRebuild((RectTransform)transform);}
        public void SetLayoutHorizontal()=>Fit();public void SetLayoutVertical(){}
        void LateUpdate()=>Fit();
    }
    static class HubDefaultPortrait
    {
        static Material _material;
        public static Material Material
        {
            get
            {
                if(_material==null){var shader=Resources.Load<Shader>("HubPortraitMultiply");if(shader!=null)_material=new Material(shader){name="Default portrait CSS multiply",hideFlags=HideFlags.HideAndDontSave};}
                return _material;
            }
        }
    }
    public sealed class HubArchiveBackFeedback : MonoBehaviour,IPointerEnterHandler,IPointerExitHandler,ISelectHandler,IDeselectHandler
    {
        public Image Background,Icon;public GameObject FocusOutline;bool _hover,_focus;float _elapsed=1;Color _from=Color.clear,_target=Color.clear;
        void Refresh(){_from=Background.color;_target=_hover||_focus?HubScreen.Ink("#50544f"):Color.clear;_elapsed=0;Icon.color=_hover||_focus?Color.white:HubScreen.InkColor;FocusOutline.SetActive(_focus);}
        public void OnPointerEnter(PointerEventData e){_hover=true;Refresh();}public void OnPointerExit(PointerEventData e){_hover=false;Refresh();}
        public void OnSelect(BaseEventData e){_focus=!(e is PointerEventData);Refresh();}public void OnDeselect(BaseEventData e){_focus=false;Refresh();}
        void Update(){if(_elapsed>=1)return;_elapsed=CurrentUiPreferences.ReducedMotion?1:Mathf.Min(1,_elapsed+Time.unscaledDeltaTime/.16f);Background.color=Color.Lerp(_from,_target,1-Mathf.Pow(1-_elapsed,3));}
    }
    public sealed partial class HubScreen
    {
        static void SourceColumns(Transform root,float[] fixedWidths,float[] minimum,float[] fraction,float gap)
        {var old=root.GetComponent<HorizontalLayoutGroup>();if(old!=null){old.enabled=false;UnityEngine.Object.DestroyImmediate(old);}var source=UIKit.GetOrAdd<HubSourceColumns>(root);source.Fixed=fixedWidths;source.Minimum=minimum;source.Fraction=fraction;source.Gap=gap;}
        static void SourceCardGrid(Transform root,bool warehouse)
        {var old=root.GetComponent<VerticalLayoutGroup>();if(old!=null){old.enabled=false;UnityEngine.Object.DestroyImmediate(old);}var source=UIKit.GetOrAdd<HubSourceCardGrid>(root);source.Warehouse=warehouse;source.Gap=warehouse?24:16;source.CellHeight=warehouse?512:528;source.MaximumWidth=warehouse?0:260;source.padding=warehouse?new RectOffset(12,12,8,8):new RectOffset(4,4,4,8);}
        internal static Button ArchiveBack(Transform parent,Action action)
        {
            var owner=parent.GetComponentInParent<HubScreen>();int revision=owner!=null?owner._renderVersion:0;
            var root=new GameObject("hub-back archive-back",typeof(RectTransform));root.transform.SetParent(parent,false);
            var image=UIKit.GetOrAdd<Image>(root);image.color=Color.clear;var button=UIKit.GetOrAdd<Button>(root);button.targetGraphic=image;button.transition=Selectable.Transition.None;
            button.onClick.AddListener(()=>{if(owner!=null&&!owner.CurrentHub(revision))return;AudioService.I.PlaySfx("click");action?.Invoke();});
            var icon=UIKit.Image(root.transform,CurrentHomeAssets.Load("linked-back"));icon.color=InkColor;Set(icon.transform,new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(-12,-12),new Vector2(12,12));icon.raycastTarget=false;
            var focus=Area(root.transform,"archive-back-focus-visible",Vector2.zero,Vector2.one,new Vector2(-3,-3),new Vector2(3,3));
            void Line(string name,Vector2 min,Vector2 max,Vector2 low,Vector2 high){var line=Area(focus,name,min,max,low,high);var ink=UIKit.GetOrAdd<Image>(line);ink.color=Theme.HexA("#e6cb76",.8f);ink.raycastTarget=false;}
            Line("top",new Vector2(0,1),Vector2.one,new Vector2(0,-1),Vector2.zero);Line("bottom",Vector2.zero,new Vector2(1,0),Vector2.zero,new Vector2(0,1));Line("left",Vector2.zero,new Vector2(0,1),Vector2.zero,new Vector2(1,0));Line("right",new Vector2(1,0),Vector2.one,new Vector2(-1,0),Vector2.zero);focus.gameObject.SetActive(false);
            var feedback=UIKit.GetOrAdd<HubArchiveBackFeedback>(root);feedback.Background=image;feedback.Icon=icon;feedback.FocusOutline=focus.gameObject;return button;
        }
        internal static void IntrinsicWidth(Transform node,Text content,float padding=0)
        {var fit=UIKit.GetOrAdd<HubIntrinsicWidth>(node);fit.Content=content;fit.HorizontalPadding=padding;content.horizontalOverflow=HorizontalWrapMode.Overflow;content.verticalOverflow=VerticalWrapMode.Truncate;}
        static Button DirectoryEntry(Transform parent,int number,string name,Action action,bool selected,string subtitle=null)
        {
            var button=Command(parent,"",action,selected);var old=button.GetComponentInChildren<Text>();if(old!=null){old.gameObject.SetActive(false);UnityEngine.Object.Destroy(old.gameObject);}
            var rect=(RectTransform)button.transform;Bounds(button.gameObject,0,subtitle==null?66:90,1,0);
            Text Copy(string value,int size,Vector2 min,Vector2 max,Vector2 low,Vector2 high)
            {var t=UIKit.Label(rect,value,size,selected?Ink("#102a34"):Muted);Set(t.transform,min,max,low,high);t.alignment=TextAnchor.MiddleLeft;return t;}
            Copy(number.ToString("00"),11,new Vector2(0,.5f),new Vector2(0,.5f),new Vector2(12,-14),new Vector2(36,14));
            var title=Copy(name,subtitle==null?17:22,Vector2.zero,Vector2.one,new Vector2(44,subtitle==null?14:36),new Vector2(-32,-14));title.fontStyle=FontStyle.Bold;
            Copy("›",18,new Vector2(1,.5f),new Vector2(1,.5f),new Vector2(-24,-16),new Vector2(-12,16));
            if(subtitle!=null)Copy(subtitle,12,Vector2.zero,Vector2.one,new Vector2(44,12),new Vector2(-32,-50));return button;
        }
    }
}
