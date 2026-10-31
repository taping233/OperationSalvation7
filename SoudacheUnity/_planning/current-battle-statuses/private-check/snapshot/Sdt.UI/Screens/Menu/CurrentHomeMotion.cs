// Direct native phase machine for home-menu-motion.js, title-wallpaper.js and home-fx.js.
using System;
using System.Collections;
using System.Collections.Generic;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Menu
{
    public sealed class CurrentHomeMotion : MonoBehaviour
    {
        public RectTransform Scene, Brand, ViewButton;
        public CanvasGroup Inner, Decor, SystemGroup;
        public Text Clock;
        public Action Returned;
        public static Font LabelFont => Resources.Load<Font>("Art/CurrentHome/Rajdhani-600");
        public static bool Reduced => GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion") == "1";
        readonly List<Region> _regions = new List<Region>();
        readonly List<Image> _wallpapers = new List<Image>();
        readonly List<Material> _sceneMaterials=new List<Material>();
        readonly float[] _alphas = new float[7], _fromAlphas = new float[7];
        int _selected;
        float _crossfade = 1, _phaseTime, _ambientTime, _viewFade,_filterPhase,_flashPhase,_divePhase;
        bool _everEntered, _leaving, _covered, _wallpaperOnly;
        string _picked;
        TitleScreen _owner;
        Vector2 _pointer;
        CurrentHomeAmbient _ambient;
        static readonly float[] EntryDelays = { .08f, .14f, .22f, .28f, .35f, .4f, .45f };
        static readonly float[] RestoreDelays = { .1f, .15f, .23f, .29f, .34f, .39f, .44f };
        sealed class Region
        {
            public RectTransform rect; public Vector2 position; public CanvasGroup group;
            public string id; public bool right; public float delay, duration, baseAlpha = 1;
        }

        public void Register(RectTransform rect, string id, bool right, float delay, float duration)
        {
            _regions.Add(new Region { rect = rect, id = id, position = rect.anchoredPosition, right = right,
                                      delay = delay, duration = duration, group = CurrentHomeElements.Group(rect) });
        }
        public void BuildWallpapers(Transform scene, int selected)
        {
            _owner = GetComponentInParent<TitleScreen>();
            for (int i = 0; i < CurrentHomeAssets.Wallpapers.Length; i++)
            {
                var image = UIKit.Image(scene, null); image.name = CurrentHomeAssets.Wallpapers[i];
                UiStack.Stretch(image.rectTransform);
                var fitter = image.gameObject.AddComponent<AspectRatioFitter>();
                fitter.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent;
                image.color = Color.clear; _wallpapers.Add(image);
                _sceneMaterials.Add(CurrentHomeMaterials.Apply(image,"CurrentHomeScene"));
            }
            _selected = selected; _alphas[selected] = 1; LoadWallpaper(selected); ApplyWallpapers();
        }
        void LoadWallpaper(int index)
        {
            var image = _wallpapers[index]; if (image.sprite != null) return;
            string key = CurrentHomeAssets.Wallpapers[index];
            image.sprite = CurrentHomeAssets.Load(key == "baita-heixiang" ? key + "-filtered" : key);
            if (image.sprite != null)
                image.GetComponent<AspectRatioFitter>().aspectRatio = image.sprite.rect.width / image.sprite.rect.height;
        }
        public void SwitchWallpaper(int selected)
        {
            Array.Copy(_alphas, _fromAlphas, _alphas.Length);
            _selected = selected; LoadWallpaper(selected); _crossfade = 0;
            _ambient?.SetWallpaper(selected);
        }
        void ApplyWallpapers()
        {
            for (int i = 0; i < _wallpapers.Count; i++) _wallpapers[i].color = new Color(1, 1, 1, _alphas[i]);
        }
        public void BuildLayers(Transform parent)
        {
            _ambient = UIKit.GetOrAdd<CurrentHomeAmbient>(parent); _ambient.Build();_ambient.SetWallpaper(_selected);
        }
        public void BuildBrandSparks(RectTransform brand) => _ambient.BuildBrandSparks(brand);
        public void Enter(bool fromWallpaper)
        {
            bool first = !_everEntered; _everEntered = true; _leaving = false; _phaseTime = 0;
            foreach (var region in _regions)
            {
                int plateIndex = region.id == "mStart" ? 0 : region.id == "mGuide" ? 1 : region.id == "mAch" ? 2
                    : region.id == "btnCardLib" ? 3 : region.id == "mSettings" ? 4 : region.id == "mCredits" ? 5
                    : region.id == "btnTitleExit" ? 6 : -1;
                region.duration = fromWallpaper ? .36f : region.id == "brand" ? (first ? .7f : .42f)
                    : plateIndex >= 0 ? (first ? .56f : .38f) : first ? .42f : .32f;
                region.delay = fromWallpaper ? (plateIndex >= 0 ? RestoreDelays[plateIndex] : region.id == "brand" ? .04f : region.id == "footer" ? .43f : .38f)
                    : plateIndex >= 0 ? EntryDelays[plateIndex] * (first ? 1 : .4f)
                    : region.id == "brand" ? 0 : (region.id == "footer" ? .44f : .32f) * (first ? 1 : .4f);
                region.group.alpha = Reduced ? 1 : 0;
            }
            Returned?.Invoke();
        }
        public void Leave(string id, Action open)
        {
            if (_leaving || _wallpaperOnly || UiStack.Top != _owner) return;
            _picked = id; _phaseTime = 0; _leaving = true;
            Inner.interactable = false; Inner.blocksRaycasts = false;
            StartCoroutine(OpenAfterDeparture(open));
        }
        IEnumerator OpenAfterDeparture(Action open)
        {
            if (!Reduced) yield return new WaitForSecondsRealtime(.18f);
            open?.Invoke();
            _covered = UiStack.Top != _owner;
            if (!_covered) { Enter(false); Inner.interactable = Inner.blocksRaycasts = true; }
        }
        public void SetWallpaperOnly(bool enabled)
        {
            _wallpaperOnly = enabled;
            Inner.interactable = Inner.blocksRaycasts = !enabled;
            if (!enabled) Enter(true);
        }
        void Update()
        {
            if (_owner == null || Inner == null) return;
            bool covered = UiStack.Top != _owner;
            if (_covered && !covered) { Enter(false); Inner.interactable = Inner.blocksRaycasts = true; }
            _covered = covered;
            float dt = Time.unscaledDeltaTime;
            // Crossfade remains independent of the ambient pause and handles rapid repeated switches.
            if (_crossfade < 1)
            {
                _crossfade = Mathf.Min(1, _crossfade + dt / .5f);
                float t = Ease(_crossfade, .42f, 0, .58f, 1);
                for (int i = 0; i < _alphas.Length; i++) _alphas[i] = Mathf.Lerp(_fromAlphas[i], i == _selected ? 1 : 0, t);
                ApplyWallpapers();
            }
            _viewFade = Mathf.MoveTowards(_viewFade, _wallpaperOnly ? 1 : 0, dt / (_wallpaperOnly ? .26f : .34f));
            Inner.alpha = Decor.alpha = 1 - _viewFade;
            if (covered && !_leaving) return;
            _phaseTime += dt;
            foreach (var region in _regions)
            {
                float t = Reduced ? 1 : Mathf.Clamp01((_phaseTime - (_leaving ? 0 : region.delay)) / (_leaving ? .18f : region.duration));
                float ease = Ease(t, _leaving ? .4f : .22f, _leaving ? 0 : 1, _leaving ? .7f : .36f, 1);
                region.group.alpha = _leaving ? 1 - ease : ease;
                Vector2 offset = _leaving ? region.id == _picked ? new Vector2(0, 4 * ease)
                    : region.id=="brand"||region.id=="footer"?new Vector2(0,6*ease):new Vector2((region.right ? 18 : -18) * ease, 0)
                    : new Vector2((region.right ? 32 : -32) * (1 - ease), 0);
                region.rect.anchoredPosition = region.position + offset;
                region.rect.localScale=Vector3.one*(!_leaving?1:region.id==_picked?ease<.3f?Mathf.Lerp(1,.985f,ease/.3f):Mathf.Lerp(.985f,.99f,(ease-.3f)/.7f):region.id=="brand"||region.id=="footer"?1:Mathf.Lerp(1,.985f,ease));
            }
            bool active = !covered && !_wallpaperOnly && !_leaving && Application.isFocused;
            if (active && !Reduced) _ambientTime += dt;
            _ambient.Tick(_ambientTime, active && !Reduced);
            Vector2 target = active && !Reduced ? new Vector2(Input.mousePosition.x / Mathf.Max(1, Screen.width) * 2 - 1,
                Input.mousePosition.y / Mathf.Max(1, Screen.height) * 2 - 1) : Vector2.zero;
            _pointer = Vector2.Lerp(_pointer, target, Mathf.Min(1, dt / .7f * 4));
            _ambient.SetPointer(_pointer);
            float drift = Reduced || _wallpaperOnly ? 0 : Ease(Mathf.PingPong(_ambientTime / 48, 1), .42f, 0, .58f, 1);
            float zoom = Reduced || _wallpaperOnly ? 1 : Mathf.Lerp(1.03f, 1.045f, drift);
            DepartureTargets(_picked,out float dive,out float brightness,out float blur,out float gray,out float flash);
            bool depart=_leaving&&!Reduced;
            _divePhase=Mathf.MoveTowards(_divePhase,depart?1:0,dt/(_picked=="btnTitleExit"?.7f:.9f));
            _filterPhase=Mathf.MoveTowards(_filterPhase,depart?1:0,dt/(_picked=="btnTitleExit"?.22f:.7f));
            _flashPhase=Mathf.MoveTowards(_flashPhase,depart?1:0,dt/.5f);
            float filterWeight=Ease(_filterPhase,.25f,.1f,.25f,1);
            foreach(var material in _sceneMaterials)if(material!=null){material.SetFloat("_Brightness",Mathf.Lerp(1,brightness,filterWeight));material.SetFloat("_Blur",blur*filterWeight);material.SetFloat("_Gray",gray*filterWeight);}
            _ambient.SetDeparture(_picked,flash*Ease(_flashPhase,.25f,.1f,.25f,1));
            Scene.localScale = Vector3.one * (zoom * Mathf.Lerp(1,dive,Ease(_divePhase,.22f,1,.36f,1)));
            Scene.anchoredPosition = new Vector2(-6 * _pointer.x - drift * 7.68f, -3 * _pointer.y + drift * 3.24f);
            if (active && Clock != null) Clock.text = "LOCAL " + DateTime.Now.ToString("HH:mm:ss");
        }
        static void DepartureTargets(string id,out float dive,out float brightness,out float blur,out float gray,out float flash)
        {
            dive=1.05f;brightness=.62f;blur=2;gray=flash=0;
            switch(id)
            {
                case "mStart":dive=1.2f;brightness=.88f;blur=0;flash=.6f;break;
                case "mGuide":dive=1.04f;brightness=.42f;blur=6;break;
                case "mAch":dive=1.06f;brightness=.5f;blur=3;break;
                case "btnCardLib":dive=1.1f;brightness=.55f;blur=0;break;
                case "mSettings":dive=1.03f;brightness=.5f;blur=4;break;
                case "mInbox":dive=1.03f;brightness=.6f;blur=3;break;
                case "mCredits":dive=1.02f;brightness=.45f;blur=4;break;
                case "btnTitleExit":dive=.985f;brightness=.16f;blur=0;gray=1;flash=.55f;break;
            }
        }
        internal static float Ease(float x, float x1, float y1, float x2, float y2)
        {
            float low = 0, high = 1, t = x;
            for (int i = 0; i < 10; i++)
            {
                t = (low + high) / 2;
                float tx = 3 * (1-t) * (1-t) * t * x1 + 3 * (1-t) * t * t * x2 + t*t*t;
                if (tx < x) low = t; else high = t;
            }
            return 3 * (1-t) * (1-t) * t * y1 + 3 * (1-t) * t * t * y2 + t*t*t;
        }
    }
}
