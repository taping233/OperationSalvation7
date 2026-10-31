// Native font metrics; no scene, window or user profile mutation.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.UI.Kit;
using UnityEditor;
using UnityEngine;

namespace Sdt.Editor
{
    public static class CurrentCjkLayoutValidation
    {
        public static void Run()
        {
            string output=Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");Directory.CreateDirectory(output);
            var records=new List<object>();
            try
            {
                var font=Theme.Sans;if(font==null)throw new InvalidOperationException("Current UI font missing");
                var guide=JObject.Parse(Resources.Load<TextAsset>("Data/CurrentBeginnerGuide").text);
                string card="选择 2 个目标（可以重复）：对第 1 个目标造成（你的攻击力 + 1）点攻击伤害，并附加 1 层流血；对第 2 个目标造成（你的攻击力 + 1）点攻击伤害。";
                Check("actual-card-description-box",card,font,11,165.689f,2,records);
                Check("actual-guide-paragraph",guide["pages"][0]["steps"][2]["text"].ToString(),font,18,546,4f/3,records);
                Check("mixed-key-punctuation","按 Esc 关闭大图，返回当前章节。保留 EnglishWords 与 12345 的完整词段。",font,18,248,4f/3,records);
                Check("rich-text-and-icon","<b>选择目标</b>，获得 <color=#cc3333>12</color> 点伤害。[[icon:cards]] 卡牌仍保留原图标。",font,18,190,4f/3,records);
                File.WriteAllText(Path.Combine(output,"result.json"),JsonConvert.SerializeObject(new{passed=true,font=font.name,records,scope="Native TextGenerator advances, content/tag preservation, punctuation rules, bounded lines and atomic inline-icon remapping. Actual page screenshots remain root scope."},Formatting.Indented));
                EditorApplication.Exit(0);
            }
            catch(Exception error){File.WriteAllText(Path.Combine(output,"result.json"),JsonConvert.SerializeObject(new{passed=false,error=error.ToString(),records},Formatting.Indented));EditorApplication.Exit(2);}
        }
        static void Check(string name,string source,Font font,int size,float width,float scale,List<object> records)
        {
            var document=InlineIconParser.Parse(source,size,true,_=>4);
            var settings=new TextGenerationSettings{font=font,fontSize=size,fontStyle=FontStyle.Normal,color=Color.white,scaleFactor=scale,lineSpacing=1.5f,richText=true,textAnchor=TextAnchor.UpperLeft,horizontalOverflow=HorizontalWrapMode.Overflow,verticalOverflow=VerticalWrapMode.Overflow,generationExtents=new Vector2(100000,0)};
            var generator=new TextGenerator();
            {
                generator.Populate(document.text,settings);
                if(generator.characters.Count<document.text.Length)throw new InvalidOperationException("Native character indexing differs from source markup: "+name);
                var advances=generator.characters.Take(document.text.Length).Select(character=>character.charWidth/scale).ToArray();
                var wrapped=CjkNativeLayout.Wrap(document,advances,width-1/scale,true);
                if(wrapped.Text.Replace("\n","")!=document.text.Replace("\n",""))throw new InvalidOperationException("Source text/markup changed: "+name);
                var plain=Regex.Replace(wrapped.Text,"<[^>]+>","");
                if(plain.Split('\n').Any(line=>Regex.IsMatch(line.TrimStart(),@"^[，。；：！？、）)\]】》〉」』….,;:!?%％]")))throw new InvalidOperationException("Forbidden punctuation at line start: "+name);
                if(plain.Contains("English\nWords")||plain.Contains("123\n45"))throw new InvalidOperationException("A fitting Latin/numeric word was split: "+name);
                if(name=="actual-card-description-box"&&plain.Split('\n')[0].Trim()=="选择 2")throw new InvalidOperationException("CJK phrase still moved wholesale");
                for(int i=0;i<document.icons.Count;i++)if(wrapped.Text.Substring(wrapped.Icons[i].characterIndex,wrapped.Icons[i].characterCount)!=document.text.Substring(document.icons[i].characterIndex,document.icons[i].characterCount))throw new InvalidOperationException("Icon character mapping changed");
                settings.generationExtents=new Vector2(width,0);generator.Populate(wrapped.Text,settings);
                var characters=generator.characters;var lines=generator.lines;
                var widths=new List<float>();
                for(int line=0;line<lines.Count;line++)
                {
                    int end=line+1<lines.Count?lines[line+1].startCharIdx:characters.Count;float extent=0;
                    for(int i=lines[line].startCharIdx;i<end;i++)extent+=Math.Max(0,characters[i].charWidth)/scale;
                    if(extent>width+.1f)throw new InvalidOperationException("Native painted line overflow: "+name+" "+extent+">"+width);
                    widths.Add(extent);
                }
                records.Add(new{name,size,width,scale,lines=widths.Count,widths,text=wrapped.Text,source=source,icons=wrapped.Icons});
            }
        }
    }
}
