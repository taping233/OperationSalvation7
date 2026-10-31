using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Sdt.UI.Kit;

namespace Sdt.UI.Kit
{
    public sealed class InlineIconRun { public string key,color;public int characterIndex,characterCount,size; }
    public sealed class InlineIconDocument { public string text;public List<InlineIconRun> icons=new List<InlineIconRun>(); }
}
public static class Program
{
    static int checks;
    static void Require(bool value,string message){if(!value)throw new InvalidOperationException(message);checks++;}
    static CjkNativeLayout.Result Check(string value,float width,InlineIconRun icon=null)
    {
        var document=new InlineIconDocument{text=value};if(icon!=null)document.icons.Add(icon);
        var advances=value.Select(c=>c>=0x3400?5f:c=='\n'?0:c==' '?1:2).ToArray();
        foreach(Match tag in Regex.Matches(value,"<[^>]+>"))for(int i=tag.Index;i<tag.Index+tag.Length;i++)advances[i]=0;
        var result=CjkNativeLayout.Wrap(document,advances,width,true);
        var restored=new StringBuilder(result.Text);for(int i=result.Breaks.Length-1;i>=0;i--)restored.Remove(result.Breaks[i]+i,1);
        Require(restored.ToString()==value,"Synthetic wrapping changed source characters/tags");
        string plain=Regex.Replace(result.Text,"<[^>]+>","");
        Require(!plain.Split('\n').Any(line=>Regex.IsMatch(line.TrimStart(),@"^[，。；：！？、）)\]】》〉」』….,;:!?%％]")),"Closing punctuation starts line");
        Require(!plain.Split('\n').Any(line=>Regex.IsMatch(line.TrimEnd(),@"[（(\[【《〈「『]$")),"Opening punctuation ends line");
        return result;
    }
    public static void Main()
    {
        var card=Check("选择 2 个目标（可以重复）：对第 1 个目标造成伤害，并附加流血。",42);
        Require(card.Text.Split('\n')[0].Trim()!="选择 2","A whole CJK phrase still moved to the next line");
        var rich=Check("<b>选择目标</b>，获得 <color=#cc3333>12</color> 点伤害。",32);
        Require(rich.Text.Contains("<b>")&&rich.Text.Contains("</b>")&&rich.Text.Contains("<color=#cc3333>12</color>"),"Rich tags were modified");
        var words=Check("保留 EnglishWords 与 12345，关闭后返回。",32);
        Require(words.Text.Contains("EnglishWords")&&words.Text.Contains("12345"),"A fitting Latin/numeric word was broken");
        string value="前面的正文\u00a0\u00a0\u00a0\u00a0后面的正文，保留图标。";int at=value.IndexOf('\u00a0');
        var icon=Check(value,32,new InlineIconRun{key="cards",size=11,characterIndex=at,characterCount=4});
        Require(icon.Breaks.All(b=>b<=at||b>=at+4),"Break inside an atomic icon span");
        Require(icon.Text.Substring(icon.Icons[0].characterIndex,4)=="\u00a0\u00a0\u00a0\u00a0","Icon index mapping differs after wrap");
        var paragraphs=Check("保留原换行。\n下一段继续阅读。",32);
        Require(paragraphs.Text.Contains("。\n"),"Existing paragraph break disappeared");
        Console.WriteLine("PASS "+checks+" content/markup/word/punctuation/icon invariants. Synthetic advances only; native font probe remains required.");
    }
}
