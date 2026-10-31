using Sdt.Narrative;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;

namespace Sdt.UI.Screens.Hub
{
    public sealed class StoryArchiveScreen : Sdt.UI.Screens.Run.NodeShellPanel
    {
        int _segment;
        public static void Open()
        {
            var page = Sdt.UI.Screens.Run.ScreenMount.Show<StoryArchiveScreen>("StoryArchive");
            page.Tone = "event"; page.AssetKey = "scene-last-lamp"; page.Title = "北门灯标 · 故事见闻";
            if (GameRuntime.I.Base.TryReadLastLamp(out var state, out _)) page._segment = state.stage;
            page.Build();
        }
        protected override void OnBody()
        {
            if (!GameRuntime.I.Base.TryReadLastLamp(out var state, out var reason))
            {
                UIKit.Label(BodyRoot, reason + "；原记录已保留", 18, Theme.Sub);
                UIKit.Btn(BodyRoot, "重新读取", Rebuild);
            }
            else
            {
                UIKit.Label(BodyRoot, state.stage + " / 3 段已记录", 18, Theme.Sub);
                for (int i = 1; i <= 3; i++)
                {
                    int segment = i;
                    var button = UIKit.Btn(BodyRoot, "第" + i + "段" + (i <= state.stage ? " · 已记录" : " · 未记录"), () => { _segment = segment; Rebuild(); });
                    button.interactable = i <= state.stage;
                }
                if (_segment > 0 && _segment <= state.stage)
                {
                    try
                    {
                        var narrative = new NarrativeService(Sdt.Res.Res.NarrativeJson.text).OpenLastLamp(_segment);
                        foreach (var paragraph in narrative.Paragraphs) UIKit.Label(BodyRoot, paragraph, 18, Theme.Txt);
                        if (_segment == 3) UIKit.Label(BodyRoot, state.ending == "open_beacon"
                            ? "你让灯光越过风雪，公共疏散线也随之暴露。" : "你让窄光留在墙边，近路仍隐蔽，远处却看不见出口。", 19, Theme.Amber);
                    }
                    catch { UIKit.Label(BodyRoot, "正文暂时无法载入，段落记录仍在。请重新选择此段重试。", 18, Theme.Sub); }
                }
                else UIKit.Label(BodyRoot, "尚无见闻。已记录的远征见闻会收入这里。", 18, Theme.Sub);
            }
            UIKit.Btn(FootRoot, "返回收藏室", Close);
        }
    }
}
