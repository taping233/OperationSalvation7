using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Sdt.Editor
{
    /// <summary>隔离新档的原生 Play 模式集成检查；所有操作由程序构造，真实输入单独验收。</summary>
    [InitializeOnLoad]
    public static class DesktopValidation
    {
        const string Active = "Sdt.DesktopCheck.Active";
        const string Step = "Sdt.DesktopCheck.Step";
        static readonly List<string> Errors = new List<string>();
        static int _loggedStep = -1;
        static string Output => Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT") ?? Path.GetFullPath(Path.Combine(Application.dataPath, "../../搜打撤/docs/evidence/2026-10-29-unity-desktop/native-check"));
        static DesktopValidation() { EditorApplication.update += Tick; Application.logMessageReceived += ObserveLog; }
        static void ObserveLog(string message, string stack, LogType type)
        { if (SessionState.GetBool(Active, false) && (type == LogType.Exception || type == LogType.Error)) Errors.Add(message + "\n" + stack); }
        static void Require(bool value, string message) { if (!value) throw new InvalidOperationException(message); }

        public static void Run()
        {
            Directory.CreateDirectory(Output);
            AssetDatabase.DisallowAutoRefresh();
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA", Path.Combine(Output, "new-profile-" + DateTime.UtcNow.ToString("yyyyMMddHHmmss")));
            SessionState.SetString("Sdt.DesktopCheck.Output", Output);
            SessionState.SetFloat("Sdt.DesktopCheck.Start", (float)EditorApplication.timeSinceStartup);
            SessionState.SetBool(Active, true);
            SessionState.SetInt(Step, 0);
            SessionState.SetFloat("Sdt.DesktopCheck.ReadyAt", (float)EditorApplication.timeSinceStartup + 2);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity");
            EditorApplication.EnterPlaymode();
        }

        public static void CheckBgm()
        {
            Directory.CreateDirectory(Output);
            try
            {
                var tracks = new List<object>();
                foreach (var pair in Sdt.Res.CurrentAssets.Music)
                {
                    Require(pair.Value.StartsWith("Audio/Current/music-demo/", StringComparison.Ordinal), "禁止使用历史 BGM：" + pair.Value);
                    var clip = Sdt.Res.Res.Music(pair.Key);
                    Require(clip != null && clip.length > 0, "当前 BGM 无法导入：" + pair.Key);
                    tracks.Add(new { scene = pair.Key, path = pair.Value, seconds = clip.length, channels = clip.channels, frequency = clip.frequency });
                }
                Require(tracks.Count == 4, "现行四首配乐映射不完整");
                File.WriteAllText(Path.Combine(Output, "bgm-result.json"), JsonConvert.SerializeObject(new { passed = true, currentTracksOnly = true, tracks }, Formatting.Indented));
                EditorApplication.Exit(0);
            }
            catch (Exception exception) { Fail(exception); }
        }

        static void Tick()
        {
            if (!SessionState.GetBool(Active, false)) return;
            if (EditorApplication.timeSinceStartup - SessionState.GetFloat("Sdt.DesktopCheck.Start", 0) > 180) { Fail(new TimeoutException("原生流程检查超时，阶段=" + SessionState.GetInt(Step, 0) + ", playing=" + EditorApplication.isPlaying + ", frame=" + Time.frameCount)); return; }
            EditorApplication.QueuePlayerLoopUpdate();
            if (!EditorApplication.isPlaying || EditorApplication.isCompiling) return;
            if (EditorApplication.timeSinceStartup < SessionState.GetFloat("Sdt.DesktopCheck.ReadyAt", 0)) return;
            try
            {
                if (Errors.Count > 0) throw new InvalidOperationException(string.Join("\n", Errors));
                var game = GameRuntime.I;
                int currentStep = SessionState.GetInt(Step, 0);
                if (_loggedStep != currentStep) { _loggedStep = currentStep; Debug.Log("[DesktopCheck] stage=" + currentStep + ", frame=" + Time.frameCount); }
                switch (SessionState.GetInt(Step, 0))
                {
                    case 0:
                        Require(App.Canvas != null && UiStack.Count > 0, "标题界面未建立");
                        Require(game.Audio.MusicScene == "title" && game.Audio.MusicAsset == "01-title-frostglass-v12", "标题未使用现行 BGM");
                        Require(CharacterTable.All.Count == 5, "角色数量未同步");
                        Require(CardLibrary.All().Count == CardDatabase.All.Length && CardLibrary.All().Count >= 291, "启动未接现行完整卡库");
                        foreach (var character in CharacterTable.All)
                            Require(Res.Res.Portrait(character.id) != null && Res.Res.BattlePortrait(character.id) != null, "人物素材缺失：" + character.id);
                        Capture("title");
                        Advance(1);
                        break;
                    case 1:
                        if (!File.Exists(Path.Combine(Output, "title.png"))) return;
                        while (UiStack.Count > 0) UiStack.Pop();
                        game.ResetSlot(5);
                        Sdt.UI.Screens.Hub.HubScreen.Open("deploy");
                        Advance(2);
                        break;
                    case 2:
                        Capture("hub");
                        while (UiStack.Count > 0) UiStack.Pop();
                        game.NewRun(5, CharacterTable.All[0].id, "standard", null);
                        Require(game.GetEntrySupplyCards().Count == 2, "入城职业补给缺失");
                        for (int index = 0; index < game.GetEntrySupplyCards().Count; index++)
                            Require(game.ClaimEntrySupply(index, out _), "入城补给领取失败");
                        Require(game.Map.Snapshot.layers.Count == 4 && LayeredMapGenerator.ValidateSnapshot(game.Map.Snapshot, out _), "四层地图无效");
                        Require(game.State.runActive && game.State.ownedCards.Count > 0, "新局或初始卡牌未建立");
                        Require(game.Audio.MusicScene == "board" && game.Audio.MusicAsset == "02-explore-ashline", "探索未使用现行 BGM");
                        Advance(3);
                        break;
                    case 3:
                        while (UiStack.Count > 0) UiStack.Pop();
                        game.State.Phase = "idle";
                        var map = JsonConvert.SerializeObject(game.State.mapSnapshot);
                        var position = game.CurrentNodeId;
                        Require(!game.TryMoveToNode("invalid-node", out _), "非法移动未拒绝");
                        Require(game.CurrentNodeId == position, "非法移动改变位置");
                        game.SaveCurrent();
                        Require(game.Saves.LastWriteSucceeded, "新局保存失败：" + game.Saves.LastError);
                        int hp = game.State.hp, coins = game.State.coins;
                        game.State.hp = 1; game.State.coins = 999;
                        Require(game.LoadRun(5), "新档读取失败：" + game.Saves.LastError);
                        Require(game.State.hp == hp && game.State.coins == coins && JsonConvert.SerializeObject(game.State.mapSnapshot) == map, "续档状态或地图发生变化");
                        Require(game.GetReachableNodeIds().Count > 0, "地图没有可用路线");
                        Advance(4);
                        break;
                    case 4:
                        Capture("map");
                        while (UiStack.Count > 0) UiStack.Pop();
                        game.Bus.Emit(new BattleRequested { Request = new BattleRequest { Name = "原生集成测试", Layer = 0, Foes = new List<EnemyStats> { new EnemyStats { id = "validation-foe", name = "测试敌人", hp = 12, atk = 1 } } } });
                        Require(Boot.BattleViewApi.Session != null, "战斗接线未建立");
                        Advance(5);
                        break;
                    case 5:
                        var snapshot = Boot.BattleViewApi.Session.Snapshot;
                        Require(snapshot != null && snapshot.hand.Count > 0 && game.State.battleActive, "普通战手牌未建立");
                        Require(game.Audio.MusicScene == "battle" && game.Audio.MusicAsset == "03-battle-shadowtide-full-v2", "战斗未使用现行 BGM");
                        foreach (var uid in snapshot.hand) Require(Boot.BattleViewApi.Session.FindCard(uid) != null, "正常手牌卡面读取失败");
                        Capture("battle");
                        Advance(6);
                        break;
                    case 6:
                        var checkpoint = game.BattleCheckpoint;
                        Require(checkpoint != null, "战斗入场检查点未保存");
                        string entry = JsonConvert.SerializeObject(checkpoint.battle);
                        int entryHp = checkpoint.run.hp, kills = game.Base.stats.kills;
                        Boot.BattleViewApi.Session.EndTurn();
                        Require(game.State.hp < entryHp, "受控敌人回合未改变生命");
                        game.SaveCurrent();
                        Require(game.LoadRun(5), "原生战斗入场恢复失败：" + game.Saves.LastError);
                        Require(game.State.hp == entryHp && game.Base.stats.kills == kills && Boot.BattleViewApi.Session.Snapshot.turn == 1, "战斗恢复混入半结算状态");
                        Require(JsonConvert.SerializeObject(game.BattleCheckpoint.battle) == entry, "战斗恢复改变敌人、随机状态或选牌");
                        Boot.BattleViewApi.Session.Retract();
                        Advance(7);
                        break;
                    case 7:
                        Require(!game.State.battleActive && game.BattleCheckpoint == null, "撤退未清理检查点");
                        Require(!UiStack.CapturePanels().Any(panel => panel is Sdt.UI.Screens.Battle.BattleScreen), "撤退后战斗页仍挡住地图");
                        Require(game.Audio.MusicScene == "board", "撤退未恢复现行探索配乐");
                        SessionState.SetBool(Active, false);
                        File.WriteAllText(Path.Combine(Output, "result.json"), JsonConvert.SerializeObject(new { passed = true, unity = Application.unityVersion, input = "constructed-runtime-commands", catalogCount = CardLibrary.All().Count, title = true, hub = true, mapLayers = 4, newSaveRoundTrip = true, rejectedMove = true, battleHandLookup = true, battleEntryRestore = true, retreatClosesBattle = true, dataDirectory = SaveSystem.Dir }, Formatting.Indented));
                        Debug.Log("SDT_DESKTOP_NATIVE_CHECK_PASSED");
                        EditorApplication.Exit(0);
                        break;
                }
            }
            catch (Exception exception) { Fail(exception); }
        }
        static void Advance(int step)
        {
            SessionState.SetInt(Step, step);
            SessionState.SetFloat("Sdt.DesktopCheck.ReadyAt", (float)EditorApplication.timeSinceStartup + 1.2f);
        }
        static void Capture(string name)
        {
            var canvas = App.Canvas; var camera = Sdt.View.BoardViewHost.BoardCamera;
            Require(camera != null, "原生主相机未建立");
            var originalMode = canvas.renderMode; var originalCamera = canvas.worldCamera; var originalPlane = canvas.planeDistance;
            var originalTarget = camera.targetTexture; var originalActive = RenderTexture.active;
            var originalMask = camera.cullingMask;
            int width = Math.Max(320, Screen.width), height = Math.Max(240, Screen.height);
            var target = new RenderTexture(width, height, 24);
            var texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            try
            {
                canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = camera; canvas.planeDistance = 1;
                camera.cullingMask |= (1 << 0) | (1 << 5);
                camera.targetTexture = target; Canvas.ForceUpdateCanvases(); camera.Render();
                RenderTexture.active = target; texture.ReadPixels(new Rect(0, 0, width, height), 0, 0); texture.Apply();
                File.WriteAllBytes(Path.Combine(Output, name + ".png"), texture.EncodeToPNG());
            }
            finally
            {
                canvas.renderMode = originalMode; canvas.worldCamera = originalCamera; canvas.planeDistance = originalPlane;
                camera.targetTexture = originalTarget; camera.cullingMask = originalMask; RenderTexture.active = originalActive;
                UnityEngine.Object.DestroyImmediate(texture); target.Release(); UnityEngine.Object.DestroyImmediate(target); Canvas.ForceUpdateCanvases();
            }
        }
        static void Fail(Exception exception)
        {
            SessionState.SetBool(Active, false);
            Directory.CreateDirectory(Output);
            File.WriteAllText(Path.Combine(Output, "failure.txt"), exception.ToString());
            Debug.LogException(exception);
            EditorApplication.Exit(2);
        }
    }
}
