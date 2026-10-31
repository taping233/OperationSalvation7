// ported from css/battle.css + src/battle.view.js（selfHTML/foesHTML 的控件级拆件）
// 战斗专属基础件：battle.css 灰基底色表、程序化 sprite（圆/环/暗角/竖条纹）、
// ov-btn(ghost/ok) 按钮变体、sts-nameplate 名牌、bt-hpwrap 血条、sts-intent 意图气泡、状态 chips。
// 尺寸均按 battle.css 像素值 1:1 映射到 Canvas 单位（参考分辨率 1920×1080）。
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    /// <summary>battle.css 灰基底色表（winter.css 未覆盖战斗区，保持源码原字面值）。</summary>
    public static class BtColors
    {
        public static Color Hex(string h) => UiPalette.Hex(h);
        public static Color HexA(string h, float a) => UiPalette.HexA(h, a);

        public static readonly Color BorderDark = Hex("#3F3F3F");       // .bt-foe border
        public static readonly Color FoeCardBgTop = Hex("#222222");     // .bt-foe 渐变起点
        public static readonly Color NameBorder = HexA("#969696", 0.35f); // .sts-nameplate border
        public static readonly Color NameBgTop = HexA("#0C0C0C", 0.5f);
        public static readonly Color NameBgBot = HexA("#080808", 0.85f);
        public static readonly Color NameText = Hex("#ECECEC");         // .sts-nameplate b
        public static readonly Color YouTag = Hex("#D6D6D6");           // .sts-you
        public static readonly Color Stats = Hex("#B9B9B9");            // .sts-stats
        public static readonly Color IntentBorder = Hex("#8F8F8F");     // .sts-intent
        public static readonly Color IntentBg = HexA("#0C0C0C", 0.9f);
        public static readonly Color IntentText = Hex("#E3E3E3");
        public static readonly Color Dim = Hex("#8F8F8F");              // .sts-note
        public static readonly Color Silver = Hex("#D9D9D9");           // .bt-card.targeting / count 文本
        public static readonly Color CountBg = Hex("#1C1C1C");          // .bt-count
        public static readonly Color CountBorder = Hex("#B9B9B9");
        public static readonly Color EnergyRing = Hex("#9C9C9C");       // .sts-energy border
        public static readonly Color EnergyText = Hex("#F0F0F0");
        public static readonly Color EnergySub = Hex("#A8A8A8");
        // 飘字（battle.css .sts-float.*）
        public static readonly Color FloatDmg = Hex("#F2C9C9");
        public static readonly Color FloatHurt = Hex("#FF8F7A");
        public static readonly Color FloatBlock = Hex("#C9C9C9");
        // 指向箭头（battle.view.js AIM_COLOR）
        public static readonly Color AimEnemy = Hex("#E0523C");
        public static readonly Color AimSelf = Hex("#4ECF8E");
        // 血条蓝→金→红（03 报告 §3：按百分比渐变）
        public static readonly Color HpHigh = Hex("#4C7FB8");
        public static readonly Color HpMid = Hex("#F0B24A");
        public static readonly Color HpLow = Hex("#C0392B");
    }

    /// <summary>程序化生成 sprite（一次性缓存）：实心圆、环、径向暗角、竖条纹。不依赖美术资源。</summary>
    public static class BtSprites
    {
        static Sprite _circle, _ring, _vignette, _stripes;

        /// <summary>实心圆（抗锯齿边缘）。能量球底 / 宝石用。</summary>
        public static Sprite Circle()
        {
            if (_circle != null) return _circle;
            int n = 128; var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            tex.wrapMode = TextureWrapMode.Clamp;
            float c = (n - 1) * 0.5f, r = c - 1f;
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++)
            {
                float d = Mathf.Max(Mathf.Abs(x - c), Mathf.Abs(y - c));
                float a = Mathf.Clamp01(r - d + 1f);
                tex.SetPixel(x, y, new Color(1, 1, 1, a));
            }
            tex.Apply();
            _circle = Sprite.Create(tex, new Rect(0, 0, n, n), Vector2.one * 0.5f, n);
            return _circle;
        }

        /// <summary>圆环（描边宽 frac）。能量球边框用。</summary>
        public static Sprite Ring(float frac = 0.06f)
        {
            if (_ring != null) return _ring;
            int n = 128; var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            tex.wrapMode = TextureWrapMode.Clamp;
            float c = (n - 1) * 0.5f, r = c - 1f;
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++)
            {
                float d = Mathf.Sqrt((x - c) * (x - c) + (y - c) * (y - c));
                float a = Mathf.Clamp01(r - d + 1f) * Mathf.Clamp01(d - r * (1f - frac * 2f) + 1f);
                tex.SetPixel(x, y, new Color(1, 1, 1, a));
            }
            tex.Apply();
            _ring = Sprite.Create(tex, new Rect(0, 0, n, n), Vector2.one * 0.5f, n);
            return _ring;
        }

        /// <summary>径向暗角（sts-hurtflash：中心透明 → 边缘红 rgba(168,26,26,.5)）。</summary>
        public static Sprite Vignette()
        {
            if (_vignette != null) return _vignette;
            int n = 256; var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            tex.wrapMode = TextureWrapMode.Clamp;
            float c = (n - 1) * 0.5f;
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++)
            {
                // 椭圆距离：50%,55% 中心 → 42% 半径内全透明，边缘到 0.5 alpha
                float dx = (x - c) / c, dy = (y - c) / c * 0.9f; // ellipse at 50% 55%
                float d = Mathf.Sqrt(dx * dx + dy * dy);
                float a = Mathf.Clamp01((d - 0.42f) / 0.58f) * 0.5f;
                tex.SetPixel(x, y, new Color(168f / 255f, 26f / 255f, 26f / 255f, a));
            }
            tex.Apply();
            _vignette = Sprite.Create(tex, new Rect(0, 0, n, n), Vector2.one * 0.5f, n);
            return _vignette;
        }

        /// <summary>竖条纹（fx-dread：3px 黑 0.6 / 6px 透明，repeat）。</summary>
        public static Sprite Stripes()
        {
            if (_stripes != null) return _stripes;
            int n = 16; var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
            tex.wrapMode = TextureWrapMode.Repeat;
            for (int y = 0; y < n; y++) for (int x = 0; x < n; x++)
                tex.SetPixel(x, y, x < 3 ? new Color(0, 0, 0, 0.6f) : Color.clear);
            tex.Apply();
            _stripes = Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), n / 9f); // 9 单位一个重复周期 → 3px 条纹
            return _stripes;
        }

        static Sprite _white;

        /// <summary>1×1 白块（拉stretch做底色/渐变叠层），缓存。</summary>
        public static Sprite White()
        {
            if (_white != null) return _white;
            var tex = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            tex.SetPixel(0, 0, Color.white); tex.Apply();
            _white = Sprite.Create(tex, new Rect(0, 0, 1, 1), Vector2.one * 0.5f, 1f);
            return _white;
        }
    }

    /// <summary>ov-btn 战斗变体（battle.view.js 的 撤退 ghost / 结束回合 ok / mini-btn）。</summary>
    public static class BtBtn
    {
        /// <summary>ov-btn：tone "" / "ok" / "ghost"（battle.css #overlay .card.battle 沿用 overlays.css 按钮）。</summary>
        public static Button Create(Transform parent, string label, Action onClick, string tone = "", bool enabled = true)
        {
            var go = new GameObject("ov-btn", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.sprite = BtSprites.White();
            bool ok = tone == "ok", ghost = tone == "ghost";
            img.color = !enabled ? BtColors.HexA("#20242A", 0.8f)
                : ok ? UiPalette.Hex("#B6CBD7")
                : ghost ? BtColors.HexA("#15212C", 0.86f)
                : BtColors.Hex("#203A48");
            var hl = go.AddComponent<HorizontalLayoutGroup>();
            hl.padding = new RectOffset(14, 14, 7, 7); hl.spacing = 4;
            hl.childAlignment = TextAnchor.MiddleCenter;
            hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
            hl.childControlWidth = true; hl.childControlHeight = true;
            var t = UIKit.IconText(go.transform, label);
            t.fontSize = 24;
            t.color = enabled ? (ok ? BtColors.Hex("#15212C") : BtColors.Hex("#EEF1ED")) : BtColors.Hex("#9FB4BF");
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img; btn.interactable = enabled;
            if (enabled && onClick != null)
                btn.onClick.AddListener(() => { Sdt.Run.AudioService.I.PlaySfx("click"); onClick(); });
            var le = go.AddComponent<LayoutElement>(); le.minHeight = le.preferredHeight = 48; le.flexibleHeight = 0;
            return btn;
        }

        /// <summary>mini-btn（注能条内 发动/取消）。</summary>
        public static Button Mini(Transform parent, string label, Action onClick, bool ok = false, bool enabled = true)
        {
            var b = Create(parent, label, enabled ? onClick : null, ok ? "ok" : "");
            b.GetComponent<LayoutElement>().minHeight = b.GetComponent<LayoutElement>().preferredHeight = 48;
            var t = b.GetComponentInChildren<Text>(); if (t != null) t.fontSize = 20;
            b.interactable = enabled;
            return b;
        }
    }

    /// <summary>bt-hpwrap.sts-hp：暗底 + 按百分比蓝→金→红填充 + 「hp/max」居中数字。</summary>
    public static class BtHpBar
    {
        public static GameObject Create(Transform parent, float width)
        {
            var go = new GameObject("sts-hp", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(width, 36);
            var bg = go.AddComponent<Image>(); bg.sprite = BtSprites.White();
            bg.color = Color.clear; bg.raycastTarget = false;
            var track = new GameObject("track", typeof(RectTransform)).AddComponent<Image>(); track.transform.SetParent(go.transform, false);
            track.sprite = BtSprites.White(); track.color = BtColors.HexA("#0A131B", .9f); track.raycastTarget = false;
            track.rectTransform.anchorMin = Vector2.zero; track.rectTransform.anchorMax = Vector2.right;
            track.rectTransform.pivot = Vector2.zero; track.rectTransform.offsetMin = Vector2.zero; track.rectTransform.offsetMax = new Vector2(0, 7);
            var fill = new GameObject("fill", typeof(RectTransform)).GetComponent<RectTransform>();
            fill.SetParent(go.transform, false);
            fill.anchorMin = fill.anchorMax = Vector2.zero;
            fill.offsetMin = new Vector2(0, 1); fill.offsetMax = new Vector2(0, 6);
            var fillImg = fill.gameObject.AddComponent<Image>();
            fillImg.sprite = BtSprites.White();
            fillImg.raycastTarget = false;
            var txt = UIKit.Label(go.transform, "", 21, BtColors.Hex("#EEF1ED"));
            txt.alignment = TextAnchor.UpperCenter;
            txt.fontStyle = FontStyle.Bold;
            UiExt.Stretch(txt.rectTransform);
            txt.raycastTarget = false;
            return go;
        }

        /// <summary>width:pct% + hp/max 文案（selfHTML/foesHTML 内联样式）。</summary>
        public static void Set(GameObject bar, int hp, int maxHp)
        {
            var fill = bar.transform.Find("fill").GetComponent<Image>();
            float pct = Mathf.Max(0, maxHp > 0 ? hp / (float)maxHp : 0f);
            fill.rectTransform.anchorMax = new Vector2(Mathf.Clamp01(pct), 0);
            fill.color = bar.transform.parent != null && bar.transform.parent.name == "sts-me" ? BtColors.Hex("#9EBBC6") : BtColors.Hex("#BA817D");
            bar.GetComponentInChildren<Text>().text = Mathf.Max(0, hp) + "/" + maxHp;
        }
    }

    /// <summary>sts-intent：敌头顶意图气泡（icon + label · damage）。</summary>
    public static class BtIntent
    {
        public static GameObject Create(Transform foeRoot, FoeIntent intent)
        {
            var go = new GameObject("sts-intent", typeof(RectTransform));
            go.transform.SetParent(foeRoot, false);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 1f);
            rt.anchoredPosition = new Vector2(0, 36);                    // top:-36px
            rt.pivot = new Vector2(0.5f, 0f);
            var img = go.AddComponent<Image>(); img.sprite = BtSprites.White();
            img.color = BtColors.IntentBg; img.raycastTarget = false;
            var ol = go.AddComponent<Outline>(); ol.effectColor = BtColors.IntentBorder; ol.effectDistance = new Vector2(1.5f, -1.5f);
            var hl = go.AddComponent<HorizontalLayoutGroup>();
            hl.padding = new RectOffset(12, 12, 3, 3); hl.spacing = 4;
            hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
            hl.childControlWidth = true; hl.childControlHeight = true;
            var t = UIKit.IconText(go.transform,
                intent.Icon + " " + intent.Label + (intent.Damage > 0 ? " · " + intent.Damage : ""));
            t.fontSize = 12; t.color = BtColors.IntentText;
            return go;
        }
    }

    /// <summary>sts-chips：curseChips(pstat.status) 的状态角标行（viewApi.CurseChips 单项 → chip）。</summary>
    public static class BtChips
    {
        public static GameObject Create(Transform parent, IReadOnlyList<StatusChip> chips)
        {
            var go = UIKit.Row(parent);
            go.name = "sts-chips";
            var hl = go.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 4; hl.childAlignment = TextAnchor.LowerLeft;
            hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
            hl.childControlWidth = true; hl.childControlHeight = true;
            foreach (var c in chips)
            {
                var chipGo = new GameObject("chip", typeof(RectTransform));
                chipGo.transform.SetParent(go.transform, false);
                var img = chipGo.AddComponent<Image>(); img.sprite = BtSprites.White();
                img.color = c.IsCurse ? BtColors.HexA("#2A1414", 0.9f) : BtColors.HexA("#12202A", 0.9f);
                var chl = chipGo.AddComponent<HorizontalLayoutGroup>();
                chl.padding = new RectOffset(6, 6, 1, 1); chl.spacing = 2;
                chl.childForceExpandWidth = false; chl.childForceExpandHeight = false;
                chl.childControlWidth = true; chl.childControlHeight = true;
                var t = UIKit.IconText(chipGo.transform, c.Icon + " " + c.Name + (string.IsNullOrEmpty(c.Value) ? "" : " " + c.Value));
                t.fontSize = 18; t.color = BtColors.Hex("#EEF2EF");
                var status = c;
                chipGo.AddComponent<BattleHoverInfo>().Setup(() => BattleReadout.Show(parent.GetComponentInParent<BattleScreen>().transform, status.Name, status.Desc));
            }
            var le = go.AddComponent<LayoutElement>(); le.minHeight = 18; le.flexibleHeight = 0;
            return go;
        }
    }

    /// <summary>sts-nameplate：名牌（名字行 + 血条 + 攻/盾/甲 + chips），selfHTML/foesHTML 共用。</summary>
    public static class BtNameplate
    {
        /// <summary>nameLine：主名字 IconText（外补 You 角标/死亡标记/词缀角标用 append）。</summary>
        public static GameObject Create(Transform parent, float width, string nameLine, string statsLine,
            GameObject hpBar, IReadOnlyList<StatusChip> chips)
        {
            var go = new GameObject("sts-nameplate", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>(); img.sprite = BtSprites.White();
            img.color = BtColors.NameBgTop;                              // 渐变近似：上浅下深两层中的底色
            var img2 = new GameObject("bg2", typeof(RectTransform)).AddComponent<Image>();
            img2.transform.SetParent(go.transform, false);
            img2.sprite = BtSprites.White(); img2.color = BtColors.NameBgBot;
            UiExt.Stretch(img2.rectTransform); img2.rectTransform.anchorMax = new Vector2(1, 0.5f);
            var ol = go.AddComponent<Outline>(); ol.effectColor = BtColors.NameBorder; ol.effectDistance = new Vector2(1, -1);
            var vl = go.AddComponent<VerticalLayoutGroup>();
            vl.padding = new RectOffset(8, 8, 5, 6); vl.spacing = 3;    // padding:5px 8px 6px
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            vl.childControlWidth = true; vl.childControlHeight = true;
            var name = UIKit.IconText(go.transform, nameLine);
            name.fontSize = 14; name.color = BtColors.NameText; name.fontStyle = FontStyle.Bold;
            var leN = name.gameObject.AddComponent<LayoutElement>(); leN.minHeight = 18; leN.flexibleHeight = 0;
            if (hpBar != null)
            {
                hpBar.transform.SetParent(go.transform, false);
                var leH = hpBar.AddComponent<LayoutElement>(); leH.minHeight = 15; leH.flexibleHeight = 0; leH.minWidth = 40;
                leH.flexibleWidth = 1;
            }
            var stats = UIKit.IconText(go.transform, statsLine);
            stats.fontSize = 11; stats.color = BtColors.Stats;
            var leS = stats.gameObject.AddComponent<LayoutElement>(); leS.minHeight = 15; leS.flexibleHeight = 0;
            if (chips != null && chips.Count > 0) BtChips.Create(go.transform, chips);
            var leP = go.AddComponent<LayoutElement>(); leP.minWidth = width; leP.minHeight = 60;
            return go;
        }
    }
}
