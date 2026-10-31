using System;
using System.Collections;
using Sdt.Res;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using A=Sdt.UI.Screens.Menu.CurrentArchiveUi;
namespace Sdt.UI.Screens.Menu
{
    public sealed class CurrentAchievementGrid : LayoutGroup
    {
        public bool Grid,Empty;public float[] Tops=Array.Empty<float>(),Heights=Array.Empty<float>();float[] _rows=Array.Empty<float>();
        int Columns=>Grid&&!Empty?Mathf.Max(1,Mathf.FloorToInt((rectTransform.rect.width-padding.horizontal+10)/250)):1;
        float Width=>Mathf.Max(1,(rectTransform.rect.width-padding.horizontal-(Columns-1)*10)/Columns);
        public override void CalculateLayoutInputHorizontal(){base.CalculateLayoutInputHorizontal();SetLayoutInputForAxis(0,LayoutUtility.DefaultMaxSize,0,1,0);}
        void Measure()
        {
            int count=rectChildren.Count,cols=Columns;Tops=new float[count];Heights=new float[count];_rows=new float[Mathf.CeilToInt(count/(float)cols)];
            for(int i=0;i<count;i++){var tile=rectChildren[i].GetComponent<CurrentAchievementTile>();Heights[i]=tile!=null?tile.Measure(Width,Grid):310;_rows[i/cols]=Mathf.Max(_rows[i/cols],Heights[i]);}
            float top=padding.top;for(int r=0;r<_rows.Length;r++){for(int j=r*cols;j<Mathf.Min(count,(r+1)*cols);j++){Tops[j]=top;Heights[j]=_rows[r];}top+=_rows[r]+10;}
        }
        public override void CalculateLayoutInputVertical(){Measure();float height=padding.vertical;foreach(float row in _rows)height+=row+10;if(_rows.Length>0)height-=10;SetLayoutInputForAxis(height,height,height,0,1);}
        public override void SetLayoutHorizontal(){for(int i=0;i<rectChildren.Count;i++)SetChildAlongAxis(rectChildren[i],0,padding.left+i%Columns*(Width+10),Width);}
        public override void SetLayoutVertical(){Measure();for(int i=0;i<rectChildren.Count;i++){SetChildAlongAxis(rectChildren[i],1,Tops[i],Heights[i]);rectChildren[i].GetComponent<CurrentAchievementTile>()?.Arrange(Width,Grid);}}
    }
    public sealed class CurrentAchievementTile : MonoBehaviour
    {
        Text _name,_state,_description,_footer;RectTransform _emblem,_marker;internal string Id;float _headingHeight,_descriptionHeight,_footerHeight;bool _wrap;
        internal void Build(CurrentAchievementEntry entry,string style)
        {
            Id=entry.Id;_emblem=A.Box(transform,"ag-emblem",20,14,76,76);var image=UIKit.Image(_emblem,CurrentArchiveAssets.Medal(Id,style));A.Fill(image.rectTransform);image.preserveAspect=true;image.raycastTarget=false;
            _name=A.Text(transform,entry.Definition.name,26,"#303735",true);_state=A.Text(transform,(entry.Unlocked?"✓ ":"◇ ")+entry.State,16,entry.StateColor);_description=A.Text(transform,entry.Definition.desc,22,"#59675d");_footer=A.Text(transform,CurrentAchievementPage.CategoryNames[entry.Category],16,"#748077");
            _name.lineSpacing=1.15f;_description.lineSpacing=1.25f;_footer.lineSpacing=1.15f;
            _marker=A.Area(transform,"detail-source-marker",Vector2.zero,new Vector2(0,1),Vector2.zero,new Vector2(3,0));A.Surface(_marker,"#6398a6").raycastTarget=false;
        }
        public void SetSelection(bool selected){GetComponent<Image>().color=A.Color(selected?"#e0ebeb":"#f7f8f5");_marker.gameObject.SetActive(selected);foreach(Transform child in transform)if(child.name.StartsWith("border-"))child.GetComponent<Image>().color=A.Color(selected?"#89aeb5":"#c9d0c7");}
        public void Reveal(bool initial,float delay){if(!CurrentUiPreferences.ReducedMotion)StartCoroutine(Entry(initial,delay));}
        IEnumerator Entry(bool initial,float delay)
        {
            var rect=(RectTransform)transform;var position=rect.anchoredPosition;var group=UIKit.GetOrAdd<CanvasGroup>(this);float elapsed=-delay,duration=initial?.26f:.16f;
            while(elapsed<duration){elapsed+=Time.unscaledDeltaTime;float p=CurrentArchiveMotion.Ease(elapsed/duration);group.alpha=Mathf.Lerp(initial?0:.4f,1,p);rect.anchoredPosition=position+new Vector2(initial?0:14*(1-p),-(initial?18:5)*(1-p));rect.localScale=Vector3.one*Mathf.Lerp(initial?.97f:1,1,p);yield return null;}group.alpha=1;rect.anchoredPosition=position;rect.localScale=Vector3.one;
        }
        static float MeasureText(Text text,float width,float minimum)
        {var settings=text.GetGenerationSettings(new Vector2(Mathf.Max(1,width),10000));return Mathf.Max(minimum,Mathf.Ceil(text.cachedTextGeneratorForLayout.GetPreferredHeight(text.text,settings)/text.pixelsPerUnit));}
        public float Measure(float width,bool grid)
        {
            float copyWidth=Mathf.Max(1,width-40-(grid?0:94));_wrap=grid||_name.preferredWidth+12+_state.preferredWidth>copyWidth;
            _headingHeight=MeasureText(_name,copyWidth,37)+(_wrap?30:0);_descriptionHeight=MeasureText(_description,copyWidth,33);_footerHeight=MeasureText(_footer,copyWidth,23);
            float copy=_headingHeight+8+_descriptionHeight+8+_footerHeight;return Mathf.Max(112,28+(grid?76+18+copy:Mathf.Max(76,copy)));
        }
        public void Arrange(float width,bool grid)
        {
            Measure(width,grid);float x=grid?20:114,y=grid?108:14,copyWidth=width-x-20;
            Place(_emblem,grid?(width-76)/2:20,grid?14:(GetComponent<RectTransform>().rect.height-76)/2,76,76);
            Place(_name.rectTransform,x,y,_wrap?copyWidth:Mathf.Min(copyWidth,_name.preferredWidth),_headingHeight-(_wrap?30:0));
            Place(_state.rectTransform,_wrap?x:x+_name.preferredWidth+12,_wrap?y+_headingHeight-23:y+7,_wrap?copyWidth:Mathf.Max(1,copyWidth-_name.preferredWidth-12),23);
            y+=_headingHeight+8;Place(_description.rectTransform,x,y,copyWidth,_descriptionHeight);y+=_descriptionHeight+8;Place(_footer.rectTransform,x,y,copyWidth,_footerHeight);
        }
        static void Place(RectTransform rect,float x,float y,float width,float height){rect.anchorMin=rect.anchorMax=new Vector2(0,1);rect.pivot=new Vector2(0,1);rect.anchoredPosition=new Vector2(x,-y);rect.sizeDelta=new Vector2(width,height);}
    }
}
