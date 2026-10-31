using System;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using E = Sdt.UI.Screens.Menu.CurrentHomeElements;

namespace Sdt.UI.Screens.Menu
{
    internal static class CurrentSettingsPaint
    {
        static Sprite _capsule;
        public static Sprite Capsule
        {
            get
            {
                if(_capsule!=null)return _capsule;
                var texture=new Texture2D(32,32,TextureFormat.RGBA32,false);var pixels=new Color[1024];
                for(int y=0;y<32;y++)for(int x=0;x<32;x++){float d=Vector2.Distance(new Vector2(x+.5f,y+.5f),new Vector2(16,16));pixels[y*32+x]=new Color(1,1,1,Mathf.Clamp01(16-d));}
                texture.SetPixels(pixels);texture.Apply(false,true);texture.filterMode=FilterMode.Bilinear;
                return _capsule=Sprite.Create(texture,new Rect(0,0,32,32),new Vector2(.5f,.5f),1,0,SpriteMeshType.FullRect,new Vector4(16,16,16,16));
            }
        }
    }
    // Confirmation has an explicit secondary action, matching UI.confirmAction.
    public sealed class CurrentSettingsConfirmation : Panel
    {
        Transform _card;
        Action _cancel;
        bool _resolved;
        public override void Build()
        {
            var card=E.Box(transform,"action-confirmation",660,365,600,350);
            card.gameObject.AddComponent<Image>().color=Theme.Hex("#1A2028");
            card.gameObject.AddComponent<Outline>().effectColor=Theme.HexA("#DCE7EF",.24f);
            var vl=card.gameObject.AddComponent<VerticalLayoutGroup>();vl.padding=new RectOffset(32,32,28,28);vl.spacing=16;
            vl.childControlHeight=vl.childControlWidth=true;vl.childForceExpandHeight=false;_card=card;
        }
        public void Configure(string title,string message,string confirm,Func<string> apply,Action cancel)
        {
            _cancel=cancel;CurrentSettingsPage.Heading(_card,title,26,48);CurrentReadingPreference.Bind(CurrentSettingsPage.Copy(_card,message,22,124,"#C4D0DA"));
            var row=CurrentSettingsPage.Row(_card,56);
            CurrentSettingsPage.Control(row.transform,"confirmation-cancel","返回",Cancel,52);
            CurrentSettingsPage.Control(row.transform,"confirmation-accept",confirm,()=>
            {
                if(_resolved||UiStack.Top!=this)return;_resolved=true;
                string error=apply?.Invoke();
                if(string.IsNullOrEmpty(error)){if(this!=null)Close();return;}
                _resolved=false;CurrentReadingPreference.Bind(CurrentSettingsPage.Copy(_card,error,18,60,"#E7BBC2"));
            },52,true);
        }
        void Cancel(){if(_resolved)return;_resolved=true;Close();_cancel?.Invoke();}
        public override void CloseFromEscape()=>Cancel();
    }
    public sealed class CurrentSettingsChoice : Panel
    {
        Transform _card;
        public override void Build()
        {
            var card=E.Box(transform,"settings-select",710,300,500,470);_card=card;
            card.gameObject.AddComponent<Image>().color=Theme.Hex("#19212A");card.gameObject.AddComponent<Outline>().effectColor=Theme.Hex("#657B8D");
            var vl=card.gameObject.AddComponent<VerticalLayoutGroup>();vl.padding=new RectOffset(24,24,20,20);vl.spacing=12;
            vl.childControlWidth=vl.childControlHeight=true;vl.childForceExpandHeight=false;
        }
        public void Configure(string title,string[] values,int current,Action<int> changed)
        {
            CurrentSettingsPage.Heading(_card,title,26,60);
            for(int i=0;i<values.Length;i++)
            {
                int index=i;
                var button=CurrentSettingsPage.Control(_card,"settings-option-"+i,values[i],()=>{if(UiStack.Top!=this)return;Close();changed?.Invoke(index);},64);
                if(i==current)button.GetComponent<Image>().color=Theme.HexA("#6C9BA9",.3f);
            }
            CurrentSettingsPage.Control(_card,"settings-select-cancel","返回",Close,48);
        }
    }
    public sealed class CurrentAudioSources : Panel
    {
        public override void Build()
        {
            var root=UIKit.Panel("audio-sources",transform);root.AddComponent<Image>().color=Theme.Hex("#11171F");
            var back=E.Box(root.transform,"sources-back",18,16,64,58);E.Hit(back,Close);E.Art(back,"linked-back",20,17,24,24);
            E.Text(root.transform,"sources-title","战斗音效来源",30,Theme.Hex("#E8EEF4"),134,20,1200,48,2,true);
            var content=UIKit.Scroll(root.transform);var viewport=(RectTransform)content.transform.parent;
            viewport.anchorMin=new Vector2(.1f,.06f);viewport.anchorMax=new Vector2(.9f,.86f);viewport.offsetMin=viewport.offsetMax=Vector2.zero;
            var text=CurrentSettingsPage.Copy(content.transform,CurrentAudioSourcesText.Value,18,2400,"#C4D0DA");text.lineSpacing=1.6f;
        }
    }
    // Runtime projection of page-settings.css blur(7px) saturate(.5), using the source snow-road image.
    public sealed class CurrentSettingsBackdrop : MonoBehaviour
    {
        static Sprite _filtered;
        public static void Build(Transform parent)
        {
            var source=Sdt.Res.CurrentHomeAssets.Load("snow-road");if(source==null)return;
            if(_filtered==null)_filtered=Filter(source.texture);
            var image=UIKit.Image(parent,_filtered??source);image.name="settings-wallpaper";UiStack.Stretch(image.rectTransform);
            image.color=Color.white;image.preserveAspect=false;
            var shade=UIKit.Panel("settings-wallpaper-shade",parent);shade.AddComponent<Image>().color=Theme.HexA("#11171F",.76f);
        }
        static Sprite Filter(Texture source)
        {
            const int w=480,h=270;RenderTexture buffer=null;var previous=RenderTexture.active;
            try
            {
                buffer=RenderTexture.GetTemporary(w,h,0,RenderTextureFormat.ARGB32);Graphics.Blit(source,buffer);RenderTexture.active=buffer;
                var texture=new Texture2D(w,h,TextureFormat.RGBA32,false);texture.ReadPixels(new Rect(0,0,w,h),0,0);texture.Apply();
                var input=texture.GetPixels();var output=new Color[input.Length];
                // 7 virtual pixels at quarter resolution; separable Gaussian approximation with three box passes.
                for(int pass=0;pass<3;pass++)
                {
                    for(int y=0;y<h;y++)for(int x=0;x<w;x++)
                    {
                        Color sum=Color.clear;for(int d=-1;d<=1;d++)sum+=input[y*w+Mathf.Clamp(x+d,0,w-1)];output[y*w+x]=sum/3;
                    }
                    for(int y=0;y<h;y++)for(int x=0;x<w;x++)
                    {
                        Color sum=Color.clear;for(int d=-1;d<=1;d++)sum+=output[Mathf.Clamp(y+d,0,h-1)*w+x];input[y*w+x]=sum/3;
                    }
                }
                for(int i=0;i<input.Length;i++){float gray=input[i].grayscale;input[i]=Color.Lerp(new Color(gray,gray,gray,1),input[i],.5f);}
                texture.SetPixels(input);texture.Apply(false,true);texture.filterMode=FilterMode.Bilinear;
                return Sprite.Create(texture,new Rect(0,0,w,h),new Vector2(.5f,.5f),1);
            }
            catch(Exception e){Debug.LogWarning("[Settings] 背景滤镜未能生成："+e.Message);return null;}
            finally{RenderTexture.active=previous;if(buffer!=null)RenderTexture.ReleaseTemporary(buffer);}
        }
    }
}
