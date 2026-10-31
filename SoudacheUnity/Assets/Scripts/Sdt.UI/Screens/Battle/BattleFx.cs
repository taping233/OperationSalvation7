// Current battle.fx-art.js atlas, plus the retained hit/preview presenters.
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    /// <summary>fx 挂载约定：所有特效挂在 BattleScreen._fxLayer（整屏、不随快照重建、位于 UI 最上层）。</summary>

    /// <summary>Sixteen current source atlas cells; shared sprites and a bounded transient layer.</summary>
    public class BattleArtFx : MonoBehaviour
    {
        static readonly string[] Kinds = { "slash","block","magic","fire","ice","lightning","poison","heal","curse","pulse","trail","death","buff","debuff","draw","boss" };
        static readonly Sprite[] Cells = new Sprite[16];
        static readonly List<BattleArtFx> Live = new List<BattleArtFx>();
        static Texture2D _atlas; static bool _missing;
        RectTransform _rect; Image _image; Vector2 _origin; float _elapsed,_duration,_angle; bool _quiet,_boss,_rise;
        public static Sprite Cell(string kind)
        {
            int index = System.Array.IndexOf(Kinds,kind); if(index<0)return null;
            if (Cells[index] != null) return Cells[index];
            if (_atlas == null) _atlas = Resources.Load<Texture2D>("Art/Current/BattleFxAtlas");
            if (_atlas == null) { if (!_missing) { _missing=true;Debug.LogWarning("Current battle FX atlas missing: Art/Current/BattleFxAtlas"); } return null; }
            float width=_atlas.width/4f,height=_atlas.height/4f;
            return Cells[index]=Sprite.Create(_atlas,new Rect(index%4*width,(3-index/4)*height,width,height),Vector2.one*.5f,100);
        }
        public static void Spawn(RectTransform root,Vector2 at,string kind,float size,float milliseconds,float angle=0)
        {
            var sprite=Cell(kind);if(root==null||sprite==null)return;
            while(Live.Count>=36){var old=Live[0];Live.RemoveAt(0);if(old!=null){old.gameObject.SetActive(false);Destroy(old.gameObject);}}
            var go=new GameObject("bt-fx-art "+kind,typeof(RectTransform));go.transform.SetParent(root,false);
            var effect=go.AddComponent<BattleArtFx>();effect._rect=(RectTransform)go.transform;effect._rect.sizeDelta=Vector2.one*size;
            effect._rect.anchoredPosition=at;effect._origin=at;effect._angle=angle;effect._boss=kind=="boss";effect._rise=kind=="heal"||kind=="buff";
            effect._quiet=CurrentUiPreferences.ReducedMotion||CurrentUiPreferences.Quality=="low";
            effect._duration=effect._quiet?.28f:(float)BattlePresentationTiming.Demo(milliseconds,CurrentUiPreferences.BattlePace)/1000;
            effect._image=go.AddComponent<Image>();effect._image.sprite=sprite;effect._image.raycastTarget=false;Live.Add(effect);effect.Paint(0);
        }
        void Update()
        {
            _elapsed+=Time.unscaledDeltaTime;float p=Mathf.Clamp01(_elapsed/Mathf.Max(.001f,_duration));Paint(p);
            if(p>=1)Destroy(gameObject);
        }
        void Paint(float p)
        {
            if(_quiet){_image.color=new Color(1,1,1,_boss?.25f:1);return;}
            float low=0,high=1;
            for(int i=0;i<12;i++){float t=(low+high)/2,u=1-t,x=3*u*u*t*.2f+3*u*t*t*.4f+t*t*t;if(x<p)low=t;else high=t;}
            float a=(low+high)/2,b=1-a,e=3*b*b*a*.7f+3*b*a*a+a*a*a;
            float alpha,scale,rotation;
            if(_boss){alpha=p<.2f?p/.2f*.5f:(1-p)/.8f*.5f;scale=Mathf.Lerp(.8f,1.18f,e);rotation=0;}
            else if(e<.22f){float k=e/.22f;alpha=Mathf.Lerp(0,.84f,k);scale=Mathf.Lerp(.45f,1,k);rotation=Mathf.Lerp(-8,0,k);}
            else if(e<.6f){float k=(e-.22f)/.38f;alpha=Mathf.Lerp(.84f,.65f,k);scale=Mathf.Lerp(1,1.04f,k);rotation=Mathf.Lerp(0,3,k);}
            else{float k=(e-.6f)/.4f;alpha=Mathf.Lerp(.65f,0,k);scale=Mathf.Lerp(1.04f,1.12f,k);rotation=Mathf.Lerp(3,5,k);}
            _image.color=new Color(1,1,1,alpha);_rect.localScale=Vector3.one*scale;_rect.localRotation=Quaternion.Euler(0,0,-_angle-rotation);
            _rect.anchoredPosition=_origin+new Vector2(0,_rise?34*e:0);
        }
        void OnDestroy(){Live.Remove(this);}
    }

    /// <summary>fx-hit / fx-hit-self 受击抖动（stsShake .42s / stsSelfHit .45s 关键帧）+ 治疗暖光 fx-warm。</summary>
    public class BattleHitFx : MonoBehaviour
    {
        private Vector3 _basePos; private float _t; private bool _self, _warm;
        private Image _img; private Color _baseColor;

        public static void Play(RectTransform figure, bool isSelf, bool warm)
        {
            if (figure == null) return;
            var fx = figure.gameObject.GetComponent<BattleHitFx>();
            if (fx == null) { fx = figure.gameObject.AddComponent<BattleHitFx>(); fx._img = figure.GetComponentInChildren<Image>(); if (fx._img != null) fx._baseColor = fx._img.color; }
            fx._basePos = figure.anchoredPosition3D;
            fx._self = isSelf; fx._warm = warm; fx._t = 0f; fx.enabled = true;
        }

        void Update()
        {
            // stsShake：20% -9 / 40% +7 / 60% -5 / 80% +3（水平位移 px）
            _t += Time.deltaTime * BattlePresentationSettings.Pace;
            float dur = _self ? 0.45f : 0.42f;
            float p = Mathf.Clamp01(_t / dur);
            float x;
            if (p < 0.2f) x = Mathf.Lerp(0, -9, p / 0.2f);
            else if (p < 0.4f) x = Mathf.Lerp(-9, 7, (p - 0.2f) / 0.2f);
            else if (p < 0.6f) x = Mathf.Lerp(7, -5, (p - 0.2f) / 0.2f);
            else if (p < 0.8f) x = Mathf.Lerp(-5, 3, (p - 0.4f) / 0.2f);
            else x = Mathf.Lerp(3, 0, (p - 0.8f) / 0.2f);
            ((RectTransform)transform).anchoredPosition = _basePos + new Vector3(BattlePresentationSettings.Shake ? x : 0, 0, 0);
            // 亮度/红染近似：自己受击叠红、治疗暖绿（30% 峰值后回落）
            if (_img != null && (_self || _warm))
            {
                float k = p < 0.3f ? p / 0.3f : 1f - (p - 0.3f) / 0.7f;
                var tint = _warm ? UiPalette.HexA("#82EBAA", 0.45f * k) : UiPalette.HexA("#FF5A46", 0.5f * k);
                _img.color = Color.Lerp(_baseColor, Color.white, k * 0.15f) + tint * 0.5f;
            }
            if (p >= 1f)
            {
                ((RectTransform)transform).anchoredPosition = _basePos;
                if (_img != null) _img.color = _baseColor;
                enabled = false;
            }
        }
    }

    /// <summary>hurtFlash：全屏径向红闪（stsHurtFlash .6s 淡出；连续受击不叠层）。</summary>
    public class BattleHurtFlash : MonoBehaviour
    {
        static BattleHurtFlash _active;
        float _t;

        public static void Play(RectTransform fxRoot)
        {
            if (_active != null) return;                                // 连续受击不叠层
            var go = new GameObject("sts-hurtflash", typeof(RectTransform));
            go.transform.SetParent(fxRoot, false);
            var rt = go.GetComponent<RectTransform>();
            UiExt.Stretch(rt);
            var img = go.AddComponent<Image>();
            img.sprite = BtSprites.Vignette(); img.raycastTarget = false;
            _active = go.AddComponent<BattleHurtFlash>();
        }

        void Update()
        {
            _t += Time.deltaTime * BattlePresentationSettings.Pace;
            float p = Mathf.Clamp01(_t / 0.6f);
            // 关键帧：0% op0 → 15% op1 → 100% op0
            float a = p < 0.15f ? p / 0.15f : 1f - (p - 0.15f) / 0.85f;
            var img = GetComponent<Image>(); var c = img.color; c.a = a; img.color = c;
            if (p >= 1f) { Destroy(gameObject); if (_active == this) _active = null; }
        }
    }

    /// <summary>fx-dread：BOSS 登场竖线阴影压过场景 2.4s（每场一次，markDreadShown 由 core 记）。</summary>
    public static class BattleDread
    {
        public static void Play(RectTransform fxRoot)
        {
            BattleArtFx.Spawn(fxRoot,new Vector2(0,fxRoot.rect.height*.12f),"boss",340,1400);
        }
    }

    /// <summary>showFoePreview：拖拽悬停敌人的打出结果预估浮窗（bt-fpreview，Combat.previewDamage 预结算）。</summary>
    public class BattleFoePreview
    {
        /// <summary>在敌人 widget 头顶挂预估浮窗；已存在则不重建（move 连续触发）。</summary>
        public static void Show(RectTransform foeRoot, FoeSnapshot foe, CardDef card)
        {
            if (foeRoot == null || foeRoot.Find("bt-fpreview") != null) return;
            var api = BattleView.Api;
            if (api == null || foe == null || foe.Dead || card == null) return;
            if (GameSnapshotRef.Current == null || GameSnapshotRef.Current.Player == null) return;

            // 段数推断（照抄 showFoePreview 的两个正则）
            var desc = card.desc == null ? "" : card.desc;
            var tm = Regex.Match(desc, @"(?:攻击|命中)\s*(\d+)\s*次");
            if (!tm.Success) tm = Regex.Match(desc, @"(\d+)\s*段");
            int times = tm.Success ? Mathf.Max(1, int.Parse(tm.Groups[1].Value)) : 1;

            string main, sub;
            if (api.AegisBlocked(foe))
            {
                main = "[[icon:crystal]] 将被元素庇幕完全减免";
                sub = "先挂「破甲」再打才能造成伤害";
            }
            else
            {
                var type = string.IsNullOrEmpty(card.dmgType) ? "fixed" : card.dmgType;   // DMG_TYPE_META 无效回落 FIXED
                var snap = GameSnapshotRef.Current;                    // BattleScreen 维护的当前快照（player 攻/法强）
                int amount = card.dmg ?? 0;
                var r = api.PreviewDamage(snap.Player.Atk, snap.Player.SpellPower, foe, amount, type, card);
                if (r.Stealthed)
                {
                    main = "[[icon:runner]] " + foe.Name + " 潜行中——伤害无法命中";
                    sub = "等潜行结束，或先用非伤害卡过渡";
                }
                else
                {
                    int total = r.Dealt * times;
                    main = "[[icon:bolt]] 预计造成 " + total + " 点" + api.DmgTypeName(type) +
                           (times > 1 ? "（" + r.Dealt + " × " + times + " 段）" : "");
                    sub = r.Log != null && r.Log.Count > 0 ? string.Join(" · ", r.Log) : "无加成";
                    if (foe.Hp - total <= 0) main = "[[icon:skull]] 预计击倒 " + foe.Name + "！";
                }
            }

            var go = new GameObject("bt-fpreview", typeof(RectTransform));
            go.transform.SetParent(foeRoot, false);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 1f);
            rt.anchoredPosition = new Vector2(0, 108);                 // #overlay .battle-stage .bt-fpreview { top:-108px }
            rt.pivot = new Vector2(0.5f, 0f);
            var img = go.AddComponent<Image>(); img.sprite = BtSprites.White();
            img.color = BtColors.HexA("#0E0E0E", 0.96f); img.raycastTarget = false;
            var ol = go.AddComponent<Outline>(); ol.effectColor = BtColors.HexA("#C4C4C4", 0.75f); ol.effectDistance = new Vector2(1, -1);
            var vl = go.AddComponent<VerticalLayoutGroup>();
            vl.padding = new RectOffset(12, 12, 8, 8); vl.spacing = 3;
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;
            var leGo = go.AddComponent<LayoutElement>(); leGo.minWidth = 170; leGo.minHeight = 50;
            var mb = UIKit.IconText(go.transform, main);
            mb.fontSize = 13; mb.color = BtColors.Hex("#D9D9D9"); mb.fontStyle = FontStyle.Bold;
            var sb = UIKit.Label(go.transform, sub, 11, BtColors.Hex("#ADADAD"));
            sb.alignment = TextAnchor.UpperCenter;
            var tip = UIKit.Label(go.transform, "—— 松手打出 ——", 10, BtColors.Hex("#7C7C7C"));
            tip.alignment = TextAnchor.UpperCenter;
            Sdt.Run.AudioService.I.PlaySfx("hover");
        }

        /// <summary>clearFoePreview。</summary>
        public static void Clear(RectTransform foeRoot)
        {
            var p = foeRoot == null ? null : foeRoot.Find("bt-fpreview");
            if (p != null) Object.Destroy(p.gameObject);
        }
    }

    /// <summary>BattleScreen 每次重建时写入当前快照，供预览取 player 攻/法强（对应 JS getSnapshot() 现取）。</summary>
    public static class GameSnapshotRef
    {
        public static BattleSnapshot Current;
    }
}
