// ported from css/winter.css（当前主题色表逐值抄）+ css/base.css（hpBar 渐变，ui.js refresh 内联）
// 字体：Cascadia Code（Mono）/ 现行 HarmonyOS Sans SC（Sans）经 Sdt.Res.Res 加载；
//       加载失败回退 LegacyRuntime.ttf（或 OS 宋体），不许抛异常（协调者补充 1）。
using UnityEngine;

namespace Sdt.UI.Kit
{
    /// <summary>
    /// winter.css :root 变量与关键组件色（色值逐值对齐源 CSS，未自创杂色）：
    ///   --ink/--bg #101E27 · --panel #192E39 · --inset #112530 · --line #3B5663 · --line2 #6B828A
    ///   --txt #E8EEEA · --sub #B2C4C9 · --dim #849DA7 · --amber/--gold #DDB876 · --amber-soft #ECD2A3
    ///   --ok #9BC5C0 · --arcane #B1A1C4 · --akmint #A9EFC3
    /// 退出朱红渐变（winter.css #btnHome）：#A02020→#701616（hover #B82A2A→#82201B）。
    /// 血条三档（ui.js refresh）：蓝 #2F6F9F/#55A4D6 · 金 #B08238/#D4A44E · 红 #B8453A/#D97A52。
    /// </summary>
    public static class Theme
    {
        public static Color Ink => Hex("#101E27");
        public static Color Bg => Hex("#101E27");
        public static Color Panel => Hex("#192E39");
        public static Color Panel2 => Hex("#233D49");
        public static Color Inset => Hex("#112530");
        public static Color Line => Hex("#3B5663");
        public static Color Line2 => Hex("#6B828A");
        public static Color Txt => Hex("#E8EEEA");
        public static Color Sub => Hex("#B2C4C9");
        public static Color Dim => Hex("#849DA7");
        public static Color Amber => Hex("#DDB876");
        public static Color AmberSoft => Hex("#ECD2A3");
        public static Color Gold => Hex("#DDB876");
        public static Color Ok => Hex("#9BC5C0");
        public static Color Arcane => Hex("#B1A1C4");

        // AK 风标题页（winter.css .ak-hud 局部变量）
        public static Color AkMint => Hex("#A9EFC3");          // --akmint 薄荷绿高亮
        public static Color AkPanel => HexA("#222527", 0.93f); // --akb
        public static Color AkText => Hex("#EEF1EC");          // --akt
        public static Color AkSub => Hex("#AEB8B0");           // --aksub（手写体英文小字）
        public static Color AkScript => Hex("#9FB3A6");        // .bn-en / .c-en 手写体色
        public static Color TitleBg => Hex("#112330");         // #title 背景

        // 退出按钮朱红渐变（唯一功能色例外）
        public static Color ExitRed => Hex("#A02020");
        public static Color ExitRed2 => Hex("#701616");
        public static Color ExitRedHover => Hex("#B82A2A");

        // 血条三档渐变（蓝→金→红）
        public static Color HpBlue => Hex("#2F6F9F");
        public static Color HpBlue2 => Hex("#55A4D6");
        public static Color HpGold => Hex("#B08238");
        public static Color HpGold2 => Hex("#D4A44E");
        public static Color HpRed => Hex("#B8453A");
        public static Color HpRed2 => Hex("#D97A52");

        // ov-btn（overlays.css）：底 #2F2F2F→#1C1C1C · .ok（winter）#D8BC86 底/#152E3B 字
        public static Color BtnBg => Hex("#262626");
        public static Color BtnOkBg => Hex("#D8BC86");
        public static Color BtnOkText => Hex("#152E3B");
        public static Color BtnArmBg => Hex("#2C2C2C");        // .arm 两步确认态
        public static Color BtnArmLine => Hex("#5C5C5C");

        // hub（winter.css）：页签 on #D7C193 底/#16323E 字 · res-chip #102833/#4C6A76/#B3C9CE · b #E5D4AE
        public static Color HubTabOnBg => Hex("#D7C193");
        public static Color HubTabOnText => Hex("#16323E");
        public static Color HubTabText => Hex("#9DB4BD");
        public static Color ChipBg => Hex("#102833");
        public static Color ChipLine => Hex("#4C6A76");
        public static Color ChipText => Hex("#B3C9CE");
        public static Color ChipNum => Hex("#E5D4AE");

        // ---------- 字体（含兜底） ----------
        static Font _mono, _sans, _serif;
        public static Font Mono
        {
            get
            {
                if (_mono != null) return _mono;
                _mono = Sdt.Res.Res.Mono;
                if (_mono == null) _mono = Fallback("Cascadia Mono");
                return _mono;
            }
        }
        public static Font Sans
        {
            get
            {
                if (_sans != null) return _sans;
                _sans = Sdt.Res.Res.Sans;
                if (_sans == null) _sans = Fallback("Microsoft YaHei");
                return _sans;
            }
        }
        /// <summary>中文大标题宋体（cn-title 'Songti SC','SimSun',serif）。</summary>
        public static Font Serif
        {
            get
            {
                if (_serif != null) return _serif;
                _serif = Font.CreateDynamicFontFromOSFont("SimSun", 16);
                if (_serif == null) _serif = Sans;
                return _serif;
            }
        }

        static Font Fallback(string osFont)
        {
            var f = Font.CreateDynamicFontFromOSFont(osFont, 14);
            if (f == null) f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            return f;   // 仍为 null 时 Text 自带兜底字体，不抛异常
        }

        public static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }
        public static Color HexA(string h, float a) { var c = Hex(h); c.a = a; return c; }
    }
}
