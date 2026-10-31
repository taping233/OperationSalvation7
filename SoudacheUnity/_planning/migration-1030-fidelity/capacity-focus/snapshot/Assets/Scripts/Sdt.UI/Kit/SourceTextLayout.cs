using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Kit
{
    // CSS line-height is measured in em; uGUI multiplies the imported font's line metric.
    public static class SourceTextLayout
    {
        public static void Cjk(Text text){if(text is InlineIconText inline)inline.BrowserCjkWrap=true;}
        public static float LineSpacing(Text text, float em)
        {
            var font = text == null ? null : text.font;
            if (font == null || font.fontSize <= 0 || font.lineHeight <= 0) return em;
            return em * font.fontSize / font.lineHeight;
        }
    }
}
