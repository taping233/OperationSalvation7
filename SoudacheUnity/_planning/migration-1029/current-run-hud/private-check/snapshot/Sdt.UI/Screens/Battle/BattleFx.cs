// ported from src/battle.view.js spawnFloats()/hurtFlash()/showFoePreview() + css/battle.css 动画关键帧
// 飘字/受击抖动/红闪/治疗暖光/BOSS 登场竖纹/悬停预估浮窗。全部挂在 fx 层——不随快照整页重建销毁
// （对应 JS 飘字挂 #overlay 而非 ovBody 的语义）。
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

    /// <summary>spawnFloats 单条：sts-float 飘字（stsFloatUp/stkPop 关键帧手写插值）。</summary>
    public class BattleFloatText : MonoBehaviour
    {
        private Vector2 _base; private float _t; private bool _pop; private Text _text;

        /// <summary>spawnFloats 逐条：localPos 为 figure 中心在 fxRoot 的局部坐标。</summary>
        public static void Spawn(RectTransform fxRoot, Vector2 localPos, string text, string cls, bool warm)
        {
            var go = new GameObject("sts-float", typeof(RectTransform));
            go.transform.SetParent(fxRoot, false);
            var rt = go.GetComponent<RectTransform>();
            rt.pivot = new Vector2(0.5f, 0.5f);
            var t = go.AddComponent<Text>();
            t.font = Theme.Mono != null ? Theme.Mono : Theme.Sans;
            t.alignment = TextAnchor.MiddleCenter;
            t.fontSize = 30; t.fontStyle = FontStyle.Bold;             // .sts-float font:30 weight:900
            t.raycastTarget = false;
            t.supportRichText = true;
            // .sts-float.dmg/.hurt/.block/.stk 颜色与字号（battle.css）
            Color col; float size = 30f; bool pop = false;
            if (cls != null && cls.Contains("hurt")) { col = BtColors.FloatHurt; size = 34f; }
            else if (cls != null && cls.Contains("block")) { col = BtColors.FloatBlock; size = 22f; }
            else if (cls != null && cls.Contains("stk")) { col = Color.white; size = 42f; pop = true; }
            else col = BtColors.FloatDmg;
            if (warm) col = UiPalette.Hex("#61D69B");                  // SDT.VisualFX burstAtElement warm 色
            t.fontSize = Mathf.RoundToInt(size);
            t.text = text;
            t.color = new Color(col.r, col.g, col.b, 0f);
            var self = go.AddComponent<BattleFloatText>();
            self._base = localPos; self._t = 0f; self._pop = pop; self._text = t;
        }

        void Update()
        {
            _t += Time.deltaTime * BattlePresentationSettings.Pace;
            float dur = _pop ? 1.0f : 0.95f;                            // stsFloatUp .95s / stkPop 1s
            float p = Mathf.Clamp01(_t / dur);
            float alpha, scale, rise;
            if (_pop)
            {   // stkPop 关键帧：scale .2→1.3→.95→1.05，rotate 省略
                if (p < 0.22f) { alpha = p / 0.22f; scale = Mathf.Lerp(0.2f, 1.3f, p / 0.22f); }
                else if (p < 0.4f) { alpha = 1f; scale = Mathf.Lerp(1.3f, 0.95f, (p - 0.22f) / 0.18f); }
                else { alpha = 1f - (p - 0.4f) / 0.6f; scale = Mathf.Lerp(0.95f, 1.05f, (p - 0.4f) / 0.6f); }
                rise = p * 1.2f;
            }
            else
            {   // stsFloatUp：0% op0/s.6/-30% → 18% op1/s1.12/-55% → 100% op0/s1/-160%
                if (p < 0.18f) { float k = p / 0.18f; alpha = k; scale = Mathf.Lerp(0.6f, 1.12f, k); rise = Mathf.Lerp(-0.3f, -0.55f, k); }
                else { float k = (p - 0.18f) / 0.82f; alpha = 1f - k; scale = Mathf.Lerp(1.12f, 1f, k); rise = Mathf.Lerp(-0.55f, -1.6f, k); }
            }
            var rt = (RectTransform)transform;
            rt.anchoredPosition = _base + new Vector2(0, rise * 60f);  // 相对 figure 的百分比位移近似
            rt.localScale = Vector3.one * scale;
            var c = _text.color; c.a = alpha; _text.color = c;
            if (p >= 1f) Destroy(gameObject);
        }
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
    public class BattleDread : MonoBehaviour
    {
        float _t;

        public static void Play(RectTransform fxRoot)
        {
            var go = new GameObject("fx-dread", typeof(RectTransform));
            go.transform.SetParent(fxRoot, false);
            var rt = go.GetComponent<RectTransform>();
            UiExt.Stretch(rt);
            var img = go.AddComponent<Image>();
            img.sprite = BtSprites.Stripes(); img.raycastTarget = false;
            go.AddComponent<BattleDread>();
        }

        void Update()
        {
            _t += Time.deltaTime * BattlePresentationSettings.Pace;
            float p = Mathf.Clamp01(_t / 2.4f);
            // stsDread：0 op0 → 16% op1 → 72% op.8 → 100% op0
            float a = p < 0.16f ? p / 0.16f : p < 0.72f ? Mathf.Lerp(1f, 0.8f, (p - 0.16f) / 0.56f) : 1f - (p - 0.72f) / 0.28f;
            var img = GetComponent<Image>(); var c = img.color; c.a = a; img.color = c;
            if (p >= 1f) Destroy(gameObject);
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
                var r = api.PreviewDamage(snap.Player.Atk, snap.Player.SpellPower, foe, amount, type);
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
