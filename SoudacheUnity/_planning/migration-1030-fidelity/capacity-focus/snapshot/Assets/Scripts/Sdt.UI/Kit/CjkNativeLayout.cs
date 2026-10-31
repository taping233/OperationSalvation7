using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace Sdt.UI.Kit
{
    // Line breaking only: advances come from the same native TextGenerator and
    // raster scale used to paint. No font-size, spacing or content substitution.
    public static class CjkNativeLayout
    {
        static readonly Regex Tag = new Regex(@"\G</?(?:b|i|size|color|material|quad)(?:[= ][^>]*)?>", RegexOptions.IgnoreCase);
        const string Opening = "（([【《〈「『〔［｛“‘";
        const string Closing = "，。；：！？、）)]】》〉」』〕］｝”’….,;:!?%％";
        public sealed class Result
        {
            public string Text;
            public List<InlineIconRun> Icons;
            public int[] Breaks;
        }
        struct Unit { public int Start, End; public char First, Last; public float Width; }
        public static Result Wrap(InlineIconDocument document, IReadOnlyList<float> advances, float width, bool richText)
        {
            string source=document.text??"";var units=new List<Unit>();int iconIndex=0;
            for(int i=0;i<source.Length;)
            {
                if(richText&&source[i]=='<'){var tag=Tag.Match(source,i);if(tag.Success){i+=tag.Length;continue;}}
                var icon=iconIndex<document.icons.Count?document.icons[iconIndex]:null;
                if(icon!=null&&icon.characterIndex<i){iconIndex++;continue;}
                int count=icon!=null&&icon.characterIndex==i?icon.characterCount:char.IsSurrogatePair(source,i)?2:1;
                int end=Math.Min(source.Length,i+count);float advance=0;
                for(int n=i;n<end;n++)if(n<advances.Count)advance+=Math.Max(0,advances[n]);
                units.Add(new Unit{Start=i,End=end,First=icon!=null&&icon.characterIndex==i?'\ufffc':source[i],Last=icon!=null&&icon.characterIndex==i?'\ufffc':source[end-1],Width=advance});
                if(icon!=null&&icon.characterIndex==i)iconIndex++;
                i=end;
            }
            var breaks=new List<int>();int start=0;
            while(start<units.Count)
            {
                if(units[start].First=='\n'||units[start].First=='\r'){start++;continue;}
                float used=0;int end=start;
                while(end<units.Count&&units[end].First!='\n'&&units[end].First!='\r'&&used+units[end].Width<=width+.01f){used+=units[end].Width;end++;}
                if(end==units.Count)break;
                if(units[end].First=='\n'||units[end].First=='\r'){start=end+1;continue;}
                int split=end;
                while(split>start&&!Allowed(units[split-1].Last,units[split].First))split--;
                // overflow-wrap:anywhere is only needed for an indivisible word
                // wider than the whole line. Never lose a glyph or loop at zero.
                if(split==start)
                {
                    split=Math.Max(start+1,end);
                    while(split>start+1&&Opening.IndexOf(units[split-1].Last)>=0)split--;
                    // A unit+closing punctuation may exceed an impossibly narrow
                    // box; retain that pair rather than put punctuation first.
                    while(split<units.Count&&Closing.IndexOf(units[split].First)>=0)split++;
                }
                if(split>=units.Count)break;
                breaks.Add(units[split].Start);start=split;
            }
            var output=new StringBuilder(source.Length+breaks.Count);int cursor=0;
            foreach(int at in breaks){output.Append(source,cursor,at-cursor);output.Append('\n');cursor=at;}
            output.Append(source,cursor,source.Length-cursor);
            var icons=new List<InlineIconRun>();
            foreach(var icon in document.icons)
            {
                int shift=0;foreach(int at in breaks)if(at<=icon.characterIndex)shift++;
                icons.Add(new InlineIconRun{key=icon.key,color=icon.color,size=icon.size,characterCount=icon.characterCount,characterIndex=icon.characterIndex+shift});
            }
            return new Result{Text=output.ToString(),Icons=icons,Breaks=breaks.ToArray()};
        }
        static bool Word(char c)=>c<128&&(char.IsLetterOrDigit(c)||c=='_'||c=='/'||c=='.');
        static bool Allowed(char previous,char next)
        {
            if(Opening.IndexOf(previous)>=0||Closing.IndexOf(next)>=0||next==' '||next=='\u00a0')return false;
            return !(Word(previous)&&Word(next));
        }
    }
}
