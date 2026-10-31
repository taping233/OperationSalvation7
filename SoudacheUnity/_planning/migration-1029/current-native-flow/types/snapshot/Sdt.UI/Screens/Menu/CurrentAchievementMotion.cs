using System;
using System.Collections;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using A=Sdt.UI.Screens.Menu.CurrentArchiveUi;
namespace Sdt.UI.Screens.Menu
{
    internal static class CurrentArchiveMotion
    {
        public static float Ease(float t,float x1=.22f,float y1=1,float x2=.36f,float y2=1)
        {t=Mathf.Clamp01(t);float lo=0,hi=1,u=.5f;for(int i=0;i<15;i++){u=(lo+hi)/2;float v=3*(1-u)*(1-u)*u*x1+3*(1-u)*u*u*x2+u*u*u;if(v<t)lo=u;else hi=u;}return 3*(1-u)*(1-u)*u*y1+3*(1-u)*u*u*y2+u*u*u;}
    }
    public sealed class CurrentAchievementMotion : MonoBehaviour
    {
        public void Begin(RectTransform root,Action revealed){if(CurrentUiPreferences.ReducedMotion){revealed?.Invoke();return;}StartCoroutine(ArchiveFilm(root,revealed));}
        IEnumerator ArchiveFilm(RectTransform root,Action revealed)
        {
            var cover=A.Full(root,"achievement-archive-cut");A.Surface(cover,"#090b0d");var imageHost=A.Full(cover,"sfArchive-image-clip");var imageClip=UIKit.GetOrAdd<RectMask2D>(imageHost);var image=A.Paint(imageHost,"archive-leaves-v1");image.preserveAspect=true;var fitter=UIKit.GetOrAdd<AspectRatioFitter>(image);fitter.aspectMode=AspectRatioFitter.AspectMode.EnvelopeParent;fitter.aspectRatio=image.sprite.rect.width/image.sprite.rect.height;
            var clipped=UIKit.GetOrAdd<RectMask2D>(cover);var shade=A.Full(cover,"archive-raking-light");var paint=UIKit.GetOrAdd<CurrentAchievementRaking>(shade);paint.raycastTarget=false;
            var visible=UIKit.GetOrAdd<CanvasGroup>(cover);float elapsed=0;
            // cinematic profile850ms; revealTransition waits the remaining film, then max(680,profile.exitDuration).
            while(elapsed<.85f){elapsed+=Time.unscaledDeltaTime;float p=CurrentArchiveMotion.Ease(elapsed/.85f,0,0,.58f,1),raking=CurrentArchiveMotion.Ease(elapsed/.85f,.42f,0,.58f,1);image.color=new Color(1,1,1,Mathf.Lerp(.15f,1,p));imageClip.padding=new Vector4(0,0,cover.rect.width*(1-p),0);shade.anchoredPosition=new Vector2(Mathf.Lerp(-.9f,1,raking)*cover.rect.width,0);yield return null;}
            clipped.softness=new Vector2Int(Mathf.CeilToInt(cover.rect.width*.01f),0);elapsed=0;while(elapsed<.68f){elapsed+=Time.unscaledDeltaTime;float p=CurrentArchiveMotion.Ease(elapsed/.68f,.42f,0,.58f,1);float edge=Mathf.Lerp(1.05f,0,p);clipped.padding=new Vector4(0,0,Mathf.Max(0,cover.rect.width*(1-edge)),0);yield return null;}
            visible.blocksRaycasts=false;cover.gameObject.SetActive(false);Destroy(cover.gameObject);revealed?.Invoke();
        }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CurrentAchievementGlint : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper mesh)
        {mesh.Clear();var r=rectTransform.rect;for(int i=0;i<2;i++){int n=mesh.currentVertCount;float a=i*.5f,b=(i+1)*.5f;var ca=new Color(1,244/255f,197/255f,i==0?0:1);var cb=new Color(1,244/255f,197/255f,i==0?1:0);mesh.AddVert(new Vector2(r.xMin+a*r.width,r.yMin),ca,Vector2.zero);mesh.AddVert(new Vector2(r.xMin+b*r.width,r.yMin),cb,Vector2.zero);mesh.AddVert(new Vector2(r.xMin+b*r.width,r.yMax),cb,Vector2.zero);mesh.AddVert(new Vector2(r.xMin+a*r.width,r.yMax),ca,Vector2.zero);mesh.AddTriangle(n,n+1,n+2);mesh.AddTriangle(n,n+2,n+3);}}
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CurrentAchievementRaking : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper mesh)
        {
            mesh.Clear();float width=rectTransform.rect.width,height=rectTransform.rect.height;
            // sf-shade final100deg gradient: opaque30%, transparent44..53%, opaque67%.
            for(int i=0;i<96;i++)
            {
                float a=i/96f,b=(i+1)/96f;float Sample(float x,float y){float t=(x*width*.98480775f+y*height*.17364818f)/(width*.98480775f+height*.17364818f);return t<.3f?1:t<.44f?1-(t-.3f)/.14f:t<.53f?0:t<.67f?(t-.53f)/.14f:1;}
                int n=mesh.currentVertCount;void Vert(float x,float y){mesh.AddVert(new Vector2(rectTransform.rect.xMin+x*width,rectTransform.rect.yMax-y*height),new Color(9/255f,11/255f,13/255f,Sample(x,y)),Vector2.zero);}
                Vert(a,0);Vert(b,0);Vert(b,1);Vert(a,1);mesh.AddTriangle(n,n+1,n+2);mesh.AddTriangle(n,n+2,n+3);
            }
        }
    }
}
