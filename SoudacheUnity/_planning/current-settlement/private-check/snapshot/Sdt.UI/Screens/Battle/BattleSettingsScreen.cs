// Local secondary page from battle.view.js btSettings and settings-battle-restart.js.
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    internal static class BattlePresentationSettings
    {
        public static bool Shake => !CurrentUiPreferences.ReduceShake;
        public static float Pace => CurrentUiPreferences.BattlePace;
    }
    public sealed class BattleSettingsScreen : Panel
    {
        IBattleCommands _owner;
        string _token;
        IReadOnlyList<string> _log;
        bool Current => _owner != null && ReferenceEquals(BattleView.Commands, _owner) && GameSnapshotRef.Current?.over == false && GameSnapshotRef.Current.BattleToken == _token;
        public static void Open(IReadOnlyList<string> log)
        {
            var page = ScreenMount.Show<BattleSettingsScreen>("BattleSettings");
            page._owner = BattleView.Commands; page._token = GameSnapshotRef.Current?.BattleToken; page._log = log; page.Build();
        }
        public override void Build()
        {
            var root = Sdt.UI.Screens.Menu.MenuShared.MakeOverlayCard(transform, "[[icon:gear]] 战斗设置", wide:true);
            var audio = AudioService.I;
            Setting(root.transform, "背景音乐", !audio.MusicMuted, value => audio.SetMusicMuted(!value));
            Setting(root.transform, "音效", !audio.SfxMuted, value => audio.SetSfxMuted(!value));
            Setting(root.transform, "屏幕震动反馈", BattlePresentationSettings.Shake, value => SetFlag("sdt-reduce-shake", !value));
            Setting(root.transform, "2× 战斗节奏", BattlePresentationSettings.Pace == 2, value =>
            {
                if (!CurrentUiPreferences.TrySetString("sdt-battle-pace", value ? "2" : "1", out var error)) throw new InvalidOperationException(error);
            });
            var runtime = GameRuntime.I;
            if (runtime.BattleCheckpoint != null && runtime.RestoreBattleCheckpoint != null)
            {
                var status = UIKit.Label(root.transform, "本场战斗的出牌、受伤与消耗将回到开战时。", 20, Theme.Sub);
                bool used = false;
                var restart = BtBtn.Create(root.transform, "重新开始本场战斗", () =>
                {
                    if (used || !Current) return;
                    used = true;
                    try { if (runtime.BattleCheckpoint == null || runtime.RestoreBattleCheckpoint?.Invoke(runtime.BattleCheckpoint) != true) throw new InvalidOperationException(); Close(); }
                    catch { used = false; status.text = "未能重新开始本场战斗，请重试。"; }
                });
                restart.interactable = Current;
            }
            BtBtn.Create(root.transform, "[[icon:scroll]] 战斗日志", () => { if (Current) BattleLogScreen.Open(_log); }, "ghost");
            var surrender = BtBtn.Create(root.transform, "[[icon:runner]] 撤离", null, "ghost");
            surrender.gameObject.AddComponent<BattleSurrenderButton>().Configure(surrender, GameSnapshotRef.Current?.Mode == "boss", () => { if (!Current) return; Close(); _owner.Flee(); });
            surrender.interactable = Current && GameSnapshotRef.Current?.Busy == false;
            UIKit.Label(root.transform, "完整设置可在基地 / 标题页打开。关闭后回到战斗。", 20, Theme.Sub);
            BtBtn.Create(root.transform, "返回战斗", Close, "ok");
        }
        void Setting(Transform parent, string label, bool value, Action<bool> change)
        {
            var button = BtBtn.Create(parent, (value ? "☑ " : "☐ ") + label, null, "ghost");
            bool state = value;
            button.onClick.AddListener(() =>
            {
                if (!Current) return;
                try { change(!state); state = !state; }
                catch (Exception e) { GameRuntime.I.Bus.Emit(new ToastRequested { Text=e.Message, Tone="warn" }); return; }
                button.GetComponentInChildren<Text>().text = (state ? "☑ " : "☐ ") + label;
            });
        }
        static void SetFlag(string key, bool value)
        {
            if (!CurrentUiPreferences.TrySetFlag(key, value, out var error)) throw new InvalidOperationException(error);
        }
    }
}
