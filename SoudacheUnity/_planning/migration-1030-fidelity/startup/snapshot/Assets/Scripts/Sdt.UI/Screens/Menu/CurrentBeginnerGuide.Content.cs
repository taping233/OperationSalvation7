using System;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using A = Sdt.UI.Screens.Menu.CurrentArchiveUi;

namespace Sdt.UI.Screens.Menu
{
    public sealed partial class CurrentBeginnerGuide
    {
        void BuildArticle(Page page)
        {
            var heading=A.Column(_articleContent,"bg-page-heading",6);
            Flow(heading,page.eyebrow,11,"#8c7847",1.5f,true);
            Flow(heading,page.title,29,"#292e31",1.3f,true);
            Flow(heading,page.lead,17,"#62666a",1.65f);
            EnterGroup(heading);
            float bodyWidth=Mathf.Max(600,_frame.rect.width-206-56),leftWidth=(bodyWidth-25)*1.65f/2.65f,rightWidth=bodyWidth-25-leftWidth;
            var row=A.Row(_articleContent,"bg-content",25);var group=row.GetComponent<HorizontalLayoutGroup>();group.childAlignment=TextAnchor.UpperLeft;group.childControlHeight=true;
            var source=ImageFor(page.id);float ratio=source==null?16f/9:source.rect.width/source.rect.height;
            float imageWidth=leftWidth-14,imageHeight=imageWidth/ratio,figureHeight=imageHeight+110;
            var left=A.Full(row,"bg-illustration-host");A.Size(left,leftWidth,figureHeight);
            var figure=A.Box(left,"bg-illustration",0,0,leftWidth,figureHeight);
            var frame=A.Box(figure,"bg-image-frame",0,0,leftWidth,imageHeight+14);A.Surface(frame,"#22282b");A.Border(frame,"#969b96");
            var shot=A.Box(frame,"bg-shot",7,7,imageWidth,imageHeight);var image=UIKit.Image(shot,source);image.name="guide-shot";A.Fill(image.rectTransform);image.raycastTarget=false;
            int marker=0;foreach(var step in page.steps??Array.Empty<Step>())
            {
                marker++;if(step.point==null||step.point.Length!=2)continue;
                var point=A.Box(shot,"guide-point-"+marker,step.point[0]*imageWidth*.01f-14,step.point[1]*imageHeight*.01f-14,28,28);
                var disc=UIKit.GetOrAdd<GuideDisc>(point);disc.color=Theme.Hex("#b39650");disc.raycastTarget=false;
                var number=A.Text(point,marker.ToString(),14,"#fff9e6",true);A.Fill(number.rectTransform);number.alignment=TextAnchor.MiddleCenter;number.raycastTarget=false;
            }
            TextAt(figure,"guide-caption-kind","实机界面示例",0,imageHeight+29,leftWidth-150,20,12,"#444c48",true);
            TextAt(figure,"guide-caption",page.caption,0,imageHeight+51,leftWidth-150,28,12,"#6a6f6a");
            _imageOpen=Button(figure,"guideImageOpen","查看大图 ↗",OpenImage,"#f5f5ee","#344340",13);Place(_imageOpen.transform,leftWidth-134,imageHeight+29,134,36);
            TextAt(figure,"guide-image-key","①  画面编号对应右侧说明",0,imageHeight+89,leftWidth,20,11,"#84877e");
            var sticky=UIKit.GetOrAdd<GuideSticky>(left);sticky.Initialize(_articleScroll.viewport,(RectTransform)row,(RectTransform)left,figure);
            EnterGroup(figure,sticky);
            var copy=A.Column(row,"bg-copy",21);A.Size(copy.GetComponent<RectTransform>(),rightWidth,-1);
            EnterGroup(copy);
            int index=0;foreach(var step in page.steps??Array.Empty<Step>())
            {
                index++;var stepRow=A.Row(copy,"guide-step-"+index,11);stepRow.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.UpperLeft;
                var number=A.Box(stepRow,"step-number",0,0,28,28);A.Size(number,28,28);var disc=UIKit.GetOrAdd<GuideDisc>(number);disc.color=Theme.Hex("#8b7644");disc.raycastTarget=false;
                var label=A.Text(number,index.ToString(),13,"#fdf9ed",true);A.Fill(label.rectTransform);label.alignment=TextAnchor.MiddleCenter;
                var words=A.Column(stepRow,"step-copy",7);A.Size(words.GetComponent<RectTransform>(),rightWidth-39,-1);
                Flow(words,step.title,19,"#2c3435",1.5f,true);Flow(words,step.text,18,"#535b5c",1.8f);
            }
            if(page.feature!=null)
            {
                var feature=A.Column(copy,"bg-feature",8,new RectOffset(17,17,17,17));A.Surface(feature,"#303b3c");
                Flow(feature,page.feature.title,18,"#ead8a6",1.5f,true);Flow(feature,page.feature.text,16,"#e1e7e1",1.85f);
            }
            var tip=A.Row(copy,"bg-tip",10);var tipLayout=tip.GetComponent<HorizontalLayoutGroup>();tipLayout.padding=new RectOffset(14,14,15,15);tipLayout.childAlignment=TextAnchor.UpperLeft;A.Surface(tip,"#deded4");
            var tipTitle=Flow(tip,"要点",12,"#827043",1.9f,true);A.Size(tipTitle,28,24);var tipWords=Flow(tip,page.tip,15,"#64614c",1.85f);A.Size(tipWords,Mathf.Max(100,rightWidth-66),-1,0);
            if(page.notes!=null&&page.notes.Length>0)
            {
                var details=A.Column(copy,"bg-more",0);var toggle=Button(details,"guideMore",(_more?"▾ ":"▸ ")+(page.moreTitle??"继续了解"),null,"#e9e9e6","#4b5a57",15);A.Size(toggle,0,46,1);
                var notes=A.Column(details,"guide-more-notes",17);notes.gameObject.SetActive(_more);
                foreach(var note in page.notes)
                {var noteBox=A.Column(notes,"bg-note",5,new RectOffset(13,0,0,0));Flow(noteBox,note.title,15,"#424f4d",1.5f,true);Flow(noteBox,note.text,15,"#626d67",1.8f);}
                toggle.onClick.AddListener(()=>{if(!Current)return;_more=!_more;notes.gameObject.SetActive(_more);toggle.GetComponentInChildren<Text>().text=(_more?"▾ ":"▸ ")+(page.moreTitle??"继续了解");});
            }
            if(page.controls!=null&&page.controls.Length>0)
            {
                var controls=A.Column(copy,"bg-controls",9);
                foreach(var control in page.controls)
                {var controlRow=A.Row(controls,"guide-control",7);var key=A.Text(controlRow,control.key,11,"#ededdf");A.Surface(key.transform,"#4a5650");A.Size(key,Mathf.Max(30,key.preferredWidth+12),24);key.alignment=TextAnchor.MiddleCenter;Flow(controlRow,control.text,11,"#777e74",1.6f);}
            }
        }
    }
    // CSS sticky illustration: its containing row bounds the travel while the article scrolls.
    internal sealed class GuideSticky : MonoBehaviour
    {
        RectTransform _viewport,_row,_host,_figure;
        public Vector2 VisualOffset;
        public void Initialize(RectTransform viewport,RectTransform row,RectTransform host,RectTransform figure){_viewport=viewport;_row=row;_host=host;_figure=figure;}
        void LateUpdate()
        {
            if(_viewport==null||_row==null||_host==null||_figure==null)return;
            float top=_viewport.InverseTransformPoint(_host.TransformPoint(new Vector3(0,_host.rect.yMax))).y;
            float travel=Mathf.Clamp(top-_viewport.rect.yMax,0,Mathf.Max(0,_row.rect.height-_host.rect.height));
            _figure.anchoredPosition=new Vector2(0,-travel)+VisualOffset;
        }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    internal sealed class GuideDisc : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();var rect=GetPixelAdjustedRect();var center=rect.center;const int sides=32;vh.AddVert(center,color,Vector2.one*.5f);
            for(int i=0;i<=sides;i++){float angle=i*Mathf.PI*2/sides;var uv=new Vector2(Mathf.Cos(angle),Mathf.Sin(angle))*.5f+Vector2.one*.5f;vh.AddVert(new Vector2(rect.xMin+uv.x*rect.width,rect.yMin+uv.y*rect.height),color,uv);if(i>0)vh.AddTriangle(0,i,i+1);}
        }
    }
}
