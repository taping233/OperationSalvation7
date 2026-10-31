using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class DesktopVisualValidation
    {
        const string Active = "Sdt.Visual.Active";
        static int _step;
        static double _next, _start;
        static readonly List<object> Frames = new List<object>();
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static DesktopVisualValidation() { EditorApplication.update += Tick; Application.logMessageReceived += Observe; }
        static void Observe(string text, string stack, LogType type)
        { if (SessionState.GetBool(Active, false) && (type == LogType.Error || type == LogType.Exception)) Fail(new InvalidOperationException(text + "\n" + stack)); }
        public static void Run()
        {
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "profile-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss")));
            AssetDatabase.DisallowAutoRefresh(); SessionState.SetBool(Active, true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity"); EditorApplication.EnterPlaymode();
        }
        static void Clear() { while (UiStack.Count > 0) UiStack.Pop(); }
        static void Capture(string name)
        {
            Frames.Add(new { name, render = OffscreenCapture.Write(Path.Combine(Output, name + ".png")), pages = UiStack.Names() });
            File.WriteAllText(Path.Combine(Output, "frames.json"), JsonConvert.SerializeObject(Frames, Formatting.Indented));
        }
        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling || EditorApplication.timeSinceStartup < _next) return;
            if (_start == 0) _start = EditorApplication.timeSinceStartup;
            _next = EditorApplication.timeSinceStartup + 1;
            try
            {
                if (EditorApplication.timeSinceStartup - _start > 180) throw new TimeoutException("离屏视觉验收超时 " + _step);
                var g = GameRuntime.I;
                switch (_step++)
                {
                    case 0:
                        if (App.Canvas == null) { _step--; return; }
                        OffscreenCapture.PrepareReference();Clear();App.ShowTitle();
                        _next = EditorApplication.timeSinceStartup + 3;
                        break;
                    case 1:
                        Capture("title"); Clear(); g.ResetSlot(5); Sdt.UI.Screens.Hub.HubScreen.Open("deploy"); break;
                    case 2:
                        Capture("hub"); Sdt.UI.Screens.Hub.PreparationScreen.Open(); break;
                    case 3:
                        Capture("preparation"); Clear(); Sdt.UI.Screens.Misc.CardLibraryScreen.Open(); break;
                    case 4:
                        Capture("library"); Clear(); UiStack.Show<IconReviewPanel>("FormalComponents"); break;
                    case 5:
                        Capture("cards-and-icons");
                        var panel = UiStack.Top as IconReviewPanel;
                        panel.Dynamic.text = "动态更新　[[icon:coin]] 123　<color=#f4d188>[[icon:heart]] 48/50</color>\n第二行 [[icon:shield]] 8　[[icon:bolt]] 2";
                        panel.Dynamic.fontSize = 26; panel.Dynamic.alignment = TextAnchor.UpperRight;
                        break;
                    case 6:
                        Capture("icons-updated"); Clear();
                        g.NewRun(5, CharacterTable.All[0].id);
                        for (int i = 0; i < g.GetEntrySupplyCards().Count; i++) g.ClaimEntrySupply(i, out _);
                        Clear(); g.State.Phase = "idle";
                        g.State.togglesIndex = true; Sdt.View.BoardViewHost.SetNodeLabelsVisible(true);
                        Sdt.EditorTools.MapVisualProbe.StressFontAtlas();
                        break;
                    case 7:
                        Capture("map");
                        var mapCheck = Sdt.EditorTools.MapVisualProbe.Verify();
                        Sdt.EditorTools.MapVisualProbe.ExportFontAtlas(Path.Combine(Output, "map-atlas.png"));
                        File.WriteAllText(Path.Combine(Output, "map-fonts.json"), JsonConvert.SerializeObject(mapCheck, Formatting.Indented));
                        if (Newtonsoft.Json.Linq.JObject.FromObject(mapCheck).Value<bool>("passed") != true)
                            throw new InvalidOperationException("地图字形或图标几何断言未通过，见 map-fonts.json");
                        g.Bus.Emit(new BattleRequested { Request = new BattleRequest { Name = "图标与卡面离屏样本", Foes = new List<EnemyStats> {
                            new EnemyStats { id = "heavy_hammer", name = "笨重锤手", hp = 8, atk = 8, elite = true, evenAttack = true, eliteSkill = "evenAttack" },
                            new EnemyStats { id = "camo_sniper", name = "迷彩狙击手", hp = 4, atk = 7, elite = true, eliteSkill = "firstTurnStealth" } } } });
                        break;
                    case 8:
                        Capture("battle");
                        Sdt.Boot.BattleViewApi.Session.Retract(); Clear();
                        g.State.inventory.Add(new InvSlot { name = "木材", value = 10, count = 3 });
                        foreach (var id in new[] { "tt3-fireball", "tt2-pearlbox", "pet-egg" })
                            g.GrantCard(CardLibrary.FindById(id));
                        Sdt.UI.Screens.Bag.BagScreen.Open();
                        _next = EditorApplication.timeSinceStartup + 3;
                        break;
                    case 9:
                        Capture("bag"); Clear();
                        UiStack.Show<Sdt.UI.Screens.Menu.SettingsScreen>("Settings");
                        break;
                    case 10:
                        Capture("settings");
                        Clear(); g.ResetSlot(5); Sdt.UI.Screens.Hub.HubScreen.Open("classes"); break;
                    case 11:
                        Capture("personnel"); Sdt.UI.Screens.Hub.HubScreen.Open("stash"); break;
                    case 12:
                        Capture("logistics"); Sdt.UI.Screens.Hub.HubScreen.Open("shop"); break;
                    case 13:
                        Capture("trade"); Sdt.UI.Screens.Hub.HubScreen.Open("ach"); break;
                    case 14:
                        Capture("archive"); Sdt.UI.Screens.Hub.HubScreen.Open("upgrade"); break;
                    case 15:
                        Capture("facilities"); Sdt.UI.Screens.Hub.HubScreen.Open("courtyard");
                        _next = EditorApplication.timeSinceStartup + 3; break;
                    case 16:
                        Capture("courtyard"); Clear(); Sdt.UI.Screens.Run.ClassChoiceScreen.Request(_=>{},()=>{}); break;
                    case 17:
                        Capture("character"); Clear(); Sdt.UI.Screens.Hub.DepartPrepScreen.Open(); break;
                    case 18:
                        var pick=UiStack.Top.GetComponentsInChildren<Button>(true).Single(b=>b.name=="pickClass");
                        pick.onClick.Invoke(); _next=EditorApplication.timeSinceStartup+3; break;
                    case 19:
                        Capture("departure"); Clear(); Sdt.UI.Screens.Misc.PhotoDetailScreen.Open(CardLibrary.All().ToList(),"tt3-fireball");
                        _next=EditorApplication.timeSinceStartup+2; break;
                    case 20:
                        Capture("photo-detail");
                        Clear(); UiStack.Show<Sdt.UI.Screens.Menu.SlotPickerScreen>("SlotPicker");
                        _next=EditorApplication.timeSinceStartup+3; break;
                    case 21:
                        Capture("slots"); Clear(); UiStack.Show<Sdt.UI.Screens.Menu.AchievementsScreen>("Achievements");
                        _next=EditorApplication.timeSinceStartup+3; break;
                    case 22:
                        Capture("achievements"); Clear(); g.ResetSlot(5); g.NewRun(5,CharacterTable.All[0].id);
                        _next=EditorApplication.timeSinceStartup+2; break;
                    case 23:
                        Capture("entry"); Clear(); FireRestScreen.Open(); break;
                    case 24:
                        Capture("fire"); Clear(); ChestOpenScreen.Open(new List<string>{"small","medium"},()=>{});
                        _next=EditorApplication.timeSinceStartup+2; break;
                    case 25:
                        Capture("rewards"); Clear();
                        var eventCard=CardLibrary.All().First(card=>card.type=="事件");g.TriggerEventCard(eventCard);
                        EventDialogScreen.Open(eventCard,new Sdt.Narrative.NarrativeService(Sdt.Res.Res.NarrativeJson.text));
                        _next=EditorApplication.timeSinceStartup+2; break;
                    case 26:
                        Capture("event"); Clear(); var extraction=g.DoExtract(); if(extraction==null)throw new InvalidOperationException("构造撤离页面失败");
                        ExtractStashScreen.Present(extraction); _next=EditorApplication.timeSinceStartup+2; break;
                    case 27:
                        Capture("extraction"); g.ExtractStashAll(); if(g.FinishExtract()==null)throw new InvalidOperationException("构造撤离完成页面失败");
                        _next=EditorApplication.timeSinceStartup+2; break;
                    case 28:
                        Capture("extract-done"); Clear();g.ResetSlot(5);g.NewRun(5,CharacterTable.All[0].id);Clear();
                        g.State.hp=0;if(g.DoDeath()==null)throw new InvalidOperationException("构造失败结算页面失败");
                        _next=EditorApplication.timeSinceStartup+2; break;
                    case 29:
                        Capture("death");Clear();g.ResetSlot(5);g.NewRun(5,CharacterTable.All[0].id);Clear();Sdt.UI.Screens.Menu.LeaveMenuScreen.Open();break;
                    case 30:
                        Capture("leave-menu");var abandon=g.AbandonRun();if(abandon==null)throw new InvalidOperationException("构造放弃结算失败");
                        Clear();UiStack.Show<Sdt.UI.Screens.Menu.AbandonResultScreen>("AbandonResult").Setup(abandon);
                        _next=EditorApplication.timeSinceStartup+2;break;
                    case 31:
                        Capture("abandon");
                        if(!CurrentUiPreferences.TrySetPerformance("low",60,out var lowError))throw new InvalidOperationException(lowError);
                        Clear();App.ShowTitle();_next=EditorApplication.timeSinceStartup+3;break;
                    case 32:
                        Capture("title-low");
                        if(!CurrentUiPreferences.TrySetPerformance("high",60,out var highError))throw new InvalidOperationException(highError);
                        Clear();App.ShowTitle();_next=EditorApplication.timeSinceStartup+3;break;
                    case 33:
                        Capture("title-high");
                        if(!CurrentUiPreferences.TrySetPerformance("balanced",60,out var balancedError)||!CurrentUiPreferences.TrySetFlag("sdt-reading-large",true,out balancedError))throw new InvalidOperationException(balancedError);
                        Clear();Sdt.UI.Screens.Battle.BattleLogScreen.Open(new[]{"[[icon:cards]] 当前战斗日志：抽牌效果从本场牌库取牌，牌库抽空时停止。","[[icon:swords]] 分段攻击逐次记录实际生命与防御变化。"});break;
                    case 34:
                        Capture("reading-log");Clear();
                        UiStack.Show<Sdt.UI.Screens.Menu.CurrentSettingsConfirmation>("ReadingConfirmation").Configure("确认保存本次设置？","大字阅读保持当前页面的内容边界，完成操作前可以返回继续查看。","确认",()=>null,()=>{});break;
                    case 35:
                        Capture("reading-confirmation");Clear();CurrentRewardCardZoom.Open(new CurrentRewardItem{Card=CardLibrary.FindById("tt7-bloodpoison"),State="taken"});break;
                    case 36:
                        Capture("reading-card-zoom");
                        var textures = Sdt.EditorTools.CurrentTextureQuality.Verify();
                        File.WriteAllText(Path.Combine(Output, "texture-quality.json"), JsonConvert.SerializeObject(textures, Formatting.Indented));
                        if (Newtonsoft.Json.Linq.JObject.FromObject(textures).Value<bool>("passed") != true)
                            throw new InvalidOperationException("当前素材导入比例检查未通过，见 texture-quality.json");
                        SessionState.SetBool(Active, false);
                        File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = true, renderGenerationPassed=true, sourceEffectAcceptance="pending-independent-review", input = "background-offscreen-native-render; constructed fixture and programmatic page/button calls; no OS input", referenceWidth = OffscreenCapture.Width, referenceHeight = OffscreenCapture.Height, frames = Frames.Count, dataDirectory = SaveSystem.Dir }, Formatting.Indented));
                        EditorApplication.Exit(0); break;
                }
            }
            catch (Exception exception) { Fail(exception); }
        }
        static void Fail(Exception e)
        {
            SessionState.SetBool(Active, false);
            Directory.CreateDirectory(Output); File.WriteAllText(Path.Combine(Output, "failure.txt"), "step=" + _step + "\n" + e);
            Debug.LogException(e); EditorApplication.Exit(2);
        }
    }

    /// <summary>仅验收样板；所有卡面、按钮和文字均调用正式组件。</summary>
    public sealed class IconReviewPanel : Panel
    {
        public Text Dynamic;
        public override void Build()
        {
            var root = UIKit.Panel("FormalSamples", transform);
            root.AddComponent<Image>().color = Theme.Bg;
            var layout = root.AddComponent<VerticalLayoutGroup>();
            layout.padding = new RectOffset(70, 70, 30, 30); layout.spacing = 12;
            layout.childControlWidth = true; layout.childControlHeight = true;
            layout.childForceExpandWidth = true; layout.childForceExpandHeight = false;
            UIKit.Label(root.transform, "正式组件 · 图标、卡框与排版样本", 28, Theme.Txt).gameObject.AddComponent<LayoutElement>().preferredHeight = 42;
            UIKit.IconText(root.transform, "[[icon:swords]] 攻击　[[icon:shield]] 格挡　[[icon:heart]] 生命　[[icon:coin]] 金币　[[icon:cards]] 卡牌　[[icon:gear]] 设置").fontSize = 24;
            var row = UIKit.Row(root.transform); var buttons = row.AddComponent<HorizontalLayoutGroup>();
            buttons.spacing = 20; buttons.childForceExpandWidth = false; buttons.childControlWidth = true; buttons.childControlHeight = true;
            row.AddComponent<LayoutElement>().preferredHeight = 52;
            UIKit.BtnOk(row.transform, "[[icon:save]] 保存", () => { });
            UIKit.Btn(row.transform, "[[icon:bag]] 背包 16/30", () => { });
            UIKit.Btn(row.transform, "[[icon:exit]] 返回", () => { });
            UIKit.Btn(row.transform, "[[icon:lock]] 尚未解锁", () => { }).interactable = false;
            Dynamic = UIKit.Label(root.transform, "费用 [[icon:bolt]] 2　<color=#e3bc65>[[icon:coin]] 12</color>　[[icon:heart]] 31/50\n换行 [[icon:flask]] 药剂 [[icon:plate]] 护甲 [[icon:crystal]] 能力", 24, Theme.Txt);
            Dynamic.gameObject.AddComponent<LayoutElement>().preferredHeight = 70;
            var mono = UIKit.Label(root.transform, "Mono 费用 [[icon:bolt]] 2 / [[icon:coin]] 12", 22, Theme.Txt);
            mono.font = Sdt.Res.Res.Mono;
            mono.gameObject.AddComponent<LayoutElement>().preferredHeight = 32;
            var samples = new List<CardDef> { CardLibrary.FindById("starter-attack"), CardLibrary.FindById("tt3-fireball"), CardLibrary.FindById("tt2-pearlbox"), CardLibrary.FindById("pet-egg"), CardLibrary.FindById("tt6-goldmine") };
            foreach (string type in new[] { "武术", "法术", "装备", "道具", "资源", "事件", "能力卡", "英雄卡", "生物" })
            { var card = CardLibrary.All().FirstOrDefault(c => c.type == type && !samples.Any(s => s?.id == c.id)); if (card != null) samples.Add(card); }
            var grid = UIKit.Grid(root.transform, 6, CardFace.SizeOf(CardSize.Lg), new Vector2(30, 18));
            grid.AddComponent<LayoutElement>().preferredHeight = 634;
            foreach (var card in samples.Where(c => c != null).Take(12)) CardFace.Create(card, CardSize.Lg, grid.transform);
        }
    }
}
