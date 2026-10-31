// home-layers.js composition and home-fx.js particles, using their source coordinates and timing.
using System.Collections.Generic;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using E = Sdt.UI.Screens.Menu.CurrentHomeElements;

namespace Sdt.UI.Screens.Menu
{
    public sealed class CurrentHomeAmbient : MonoBehaviour
    {
        readonly List<Particle> _snow = new List<Particle>(), _sparks = new List<Particle>();
        Image _beams, _accent, _mist, _depth, _flash;
        Material _depthMaterial,_flashMaterial;
        RawImage _grain;
        RectTransform _ghostRect;
        CanvasGroup _ghostGroup;
        float _ghostHalfWidth;
        bool _ensemble;
        Vector2 _nearPointer;
        sealed class Particle { public RectTransform rect; public Image image; public float x, duration, delay, size; public bool near; }
        public void Build()
        {
            E.Art(transform, "scene-shade", 0, 0, 1920, 1080);
            E.Art(transform, "home-slash", 0, 0, 1920, 1080);
            _beams = E.Art(transform, "home-beams", 0, 0, 1920, 1080);
            CurrentHomeMaterials.Composite(_beams,0);
            _depth=E.Fill(transform,"home-depth",Color.white,0,0,1920,1080);
            _depthMaterial=CurrentHomeMaterials.Composite(_depth,2,1.8f,.92f,1);
            _mist = E.Art(transform,"home-mist",-192,648,2304,432);
            _mist.color=new Color(1,1,1,.16f);
            CurrentHomeMaterials.Composite(_mist,0);
            var grainRect=E.Box(transform,"home-grain",-153.6f,-86.4f,2227.2f,1252.8f);
            _grain=grainRect.gameObject.AddComponent<RawImage>();
            _grain.texture=Sdt.Res.CurrentHomeAssets.Load("home-grain").texture;
            _grain.texture.wrapMode=TextureWrapMode.Repeat;_grain.uvRect=new Rect(0,0,12.373f,6.96f);
            _grain.color=new Color(1,1,1,.16f);_grain.raycastTarget=false;
            CurrentHomeMaterials.Composite(_grain,1,0,1,2);
            _flash=E.Fill(transform,"home-flash",Color.clear,0,0,1920,1080);_flashMaterial=CurrentHomeMaterials.Composite(_flash,4);
            // The divider is x=24% at the top of the rightmost38%, x=0 at its bottom.
            var edge = E.Fill(transform, "hs-edge", Theme.HexA("#FFFFFF", .34f), 1365.504f, 0, 1, 1094);
            edge.rectTransform.localEulerAngles = new Vector3(0, 0, -9.68f);
            _accent = E.Fill(transform, "hs-accent", Theme.HexA("#D9C18A", .5f), 1365.504f, 0, 2, 229.7f);
            _accent.rectTransform.localEulerAngles = new Vector3(0, 0, -9.68f);
            for (int i = 0; i < 4; i++)
            {
                bool right = i % 2 == 1, bottom = i >= 2;
                float x = right ? 1876 : 18, y = bottom ? 1036 : 46;
                E.Fill(transform, "home-corner", Theme.HexA("#FFFFFF", .45f), x, y + (bottom ? 25 : 0), 26, 1);
                E.Fill(transform, "home-corner", Theme.HexA("#FFFFFF", .45f), x + (right ? 25 : 0), y, 1, 26);
            }
            E.Fill(transform, "home-corner-gold", E.Hex("#FFD23C"), 17, 45, 7, 7);
            var band = E.Box(transform, "home-edge-band-top", -57.6f, -27.04f, 2035.2f, 57.04f);
            band.localEulerAngles = new Vector3(0, 0, .65f);
            var bandBlur=E.Fill(band,"band-backdrop",new Color(1,1,1,.55f),0,0,2035.2f,57.04f);CurrentHomeMaterials.Composite(bandBlur,2,8,.75f);
            E.Fill(band, "band-glass", Theme.HexA("#06080A", .275f), 0, 0, 2035.2f, 57.04f);
            E.Fill(band, "band-hairline", Theme.HexA("#FFFFFF", .121f), 0, 56.04f, 2035.2f, 1);
            E.Fill(band, "band-gold", Theme.HexA("#FFD23C",.55f), 0, 56.04f, 84, 1);
            E.Text(band, "home-band-track", "冬日猜想   /   CODE NAME 7", 11, Theme.HexA("#FFFFFF", .286f),
                   109.9f, 35.04f, 700, 14, 5.5f, true);
            var rail = E.Box(transform, "home-rail", 20, 367.2f, 14, 367.2f);
            var railText = E.Text(rail, "home-rail-text", "WINTER SPECULATION · ASCENSION COUNCIL · 2026", 10,
                Theme.HexA("#FFFFFF", .2475f), 0, 0, 390, 14, 5, true);
            railText.font = Resources.Load<Font>("Art/CurrentHome/Rajdhani-700");
            railText.rectTransform.localEulerAngles = new Vector3(0, 0, -90);
            for (int y = 0; y < 367; y += 8) E.Fill(rail, "ruler-tick", Theme.HexA("#FFFFFF", .165f), 12, y, 5, 1);
            E.Fill(rail, "ruler-mark", Theme.HexA("#D9C18A", .3025f), 10, 73.44f, 11, 2);
            BuildGhost();
            float[] positions = { 3,9,16,23,31,38,45,52,59,66,73,80 };
            float[] durations = { 11,14,9,16,12,10,15,13,9.5f,17,11.5f,14.5f };
            float[] delays = { 0,-4,-8,-2,-9,-5,-1,-11,-6,-3,-10,-7 };
            for (int i = 0; i < 12; i++) AddSnow(positions[i], 5, durations[i], delays[i], false);
            float[,] near = { {12,7,13,-3}, {28,9,16,-10}, {43,6,14,-7}, {69,8,18,-14}, {83,10,15,-5}, {93,6,19,-17} };
            for (int i = 0; i < 6; i++) AddSnow(near[i,0], near[i,1], near[i,2], near[i,3], true);
        }
        void BuildGhost()
        {
            var clip=E.Box(transform,"home-ghost",0,0,1920,1080);clip.gameObject.AddComponent<RectMask2D>();_ghostGroup=E.Group(clip);
            _ghostRect=E.Box(clip,"home-ghost-track",0,822.4f,1,290);
            float x=0;
            for(int i=0;i<4;i++)
            {
                var ghost=E.Text(_ghostRect,"ghost-span","CODE NAME 7",290,Theme.HexA("#C7D4DF",26f/255),x,0,2400,290,11.6f,true);
                ghost.font=Resources.Load<Font>("Art/CurrentHome/Rajdhani-700");
                float width=ghost.preferredWidth+145;ghost.rectTransform.sizeDelta=new Vector2(width,290);
                CurrentHomeMaterials.Apply(ghost,"CurrentHomeGhost");x+=width;
            }
            _ghostRect.sizeDelta=new Vector2(x,290);_ghostHalfWidth=x/2;
        }
        public void SetWallpaper(int selected)
        {_ensemble=Sdt.Res.CurrentHomeAssets.Wallpapers[selected]=="ensemble";}
        public void SetDeparture(string picked,float opacity)
        {if(_flashMaterial!=null)_flashMaterial.SetFloat("_Flash",picked=="mStart"?1:picked=="btnTitleExit"?2:0);_flash.color=new Color(1,1,1,opacity);}
        void AddSnow(float x, float size, float duration, float delay, bool near)
        {
            var image = E.Art(transform, "home-snow-dot", x * 19.2f, -36, size * 2.6f, size * 2.6f);
            if(near){image.rectTransform.sizeDelta=Vector2.one*(size+6.6f);var material=CurrentHomeMaterials.Apply(image,"CurrentHomeSnow");if(material!=null)material.SetFloat("_Size",size);}
            _snow.Add(new Particle { rect=image.rectTransform, image=image, x=x * 19.2f, size=size, duration=duration, delay=delay, near=near });
        }
        public void BuildBrandSparks(RectTransform brand)
        {
            float[,] values = { {8,18,0,1}, {92,14,1.3f,.8f}, {96,64,2.4f,1}, {3,70,3.1f,.7f}, {50,2,.7f,.6f}, {78,88,1.9f,.8f} };
            for (int i = 0; i < 6; i++)
            {
                var image = E.Art(brand, "home-spark", values[i,0] / 100 * brand.rect.width, values[i,1] / 100 * brand.rect.height, 14 * values[i,3], 14 * values[i,3]);
                _sparks.Add(new Particle { rect=image.rectTransform, image=image, delay=values[i,2], size=values[i,3] });
            }
        }
        public void SetPointer(Vector2 pointer)
        {_nearPointer=Vector2.Lerp(_nearPointer,pointer,Mathf.Clamp01(Time.unscaledDeltaTime));}
        public void Tick(float time, bool active)
        {
            bool reduced = CurrentHomeMotion.Reduced;
            _ghostGroup.alpha=reduced?0:Mathf.Clamp01((time-1.2f)/2.4f);
            _ghostRect.anchoredPosition=new Vector2(-_ghostHalfWidth*Mathf.Repeat(time/180,1),-822.4f);
            foreach (var snow in _snow)
            {
                if (reduced || (_ensemble&&snow.near)) { snow.image.enabled = false; continue; }
                snow.image.enabled = true;
                float t = Mathf.Repeat((time - snow.delay) / snow.duration, 1);
                float dx = snow.near ? 70 * t : t < .5f ? Mathf.Lerp(0,57.6f,t*2) : Mathf.Lerp(57.6f,-38.4f,(t-.5f)*2);
                snow.rect.anchoredPosition = snow.near?new Vector2(snow.x-3.3f+dx+_nearPointer.x*10,39.3f-t*1160+_nearPointer.y*5):new Vector2(snow.x + dx,36-t*1200);
                float opacity = snow.near ? t<.15f?Mathf.Lerp(0,.3f,t/.15f):t<.78f?Mathf.Lerp(.3f,.22f,(t-.15f)/.63f):Mathf.Lerp(.22f,0,(t-.78f)/.22f) : t < .08f ? t/.08f*.85f : Mathf.Lerp(.85f,.15f,(t-.08f)/.92f);
                snow.image.color = new Color(1,1,1, opacity * (snow.near?156f/255:.5f));
            }
            foreach (var spark in _sparks)
            {
                float t = Mathf.Repeat((time-spark.delay)/10,1);
                float opacity = t < .45f ? t/.45f : t < .7f ? 1-(t-.45f)/.25f : 0;
                spark.image.color = new Color(1,1,1, reduced ? 0 : opacity*.42f);
                spark.rect.localScale = Vector3.one * Mathf.Lerp(.2f,1,opacity);
                spark.rect.localEulerAngles = new Vector3(0,0,t*90);
            }
            _beams.enabled = !reduced;
            if(_depthMaterial!=null){_depthMaterial.SetFloat("_Ensemble",_ensemble?1:0);_depthMaterial.SetFloat("_Blur",_ensemble?.7f:1.8f);_depthMaterial.SetFloat("_Saturation",_ensemble?.95f:.92f);}
            _grain.enabled = !reduced;
            _mist.rectTransform.anchoredPosition = new Vector2(-192+Mathf.Lerp(-76.8f,96,Mathf.PingPong(time/40,1)),-648);
            int grainFrame=Mathf.FloorToInt(time/1.4f*4)%4;
            Vector2[] grainOffsets={Vector2.zero,new Vector2(-9,-6),new Vector2(7,10),new Vector2(-5,4)};
            ((RectTransform)_grain.transform).anchoredPosition=new Vector2(-153.6f,86.4f)+grainOffsets[grainFrame];
            _beams.color = new Color(1,1,1, Mathf.Lerp(.24f,.5f, Mathf.PingPong(time/14,1)));
            float travel = reduced ? 0 : CurrentHomeMotion.Ease(Mathf.PingPong(time/18,1), .42f,0,.58f,1);
            _accent.rectTransform.anchoredPosition = new Vector2(1365.504f - 138.33f*travel,-853.2f*travel);
        }
    }
}
