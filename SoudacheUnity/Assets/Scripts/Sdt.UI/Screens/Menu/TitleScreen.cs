// Current index.html #title.home-composed, title-p0.css + final home-polish.css cascade.
// Module boundaries: layout here; home-fx/home-layers/home-menu-motion → CurrentHomeMotion;
// title-wallpaper → preference and layer switch here; title-credits → CreditsScreen.
using System;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
using UnityEngine.UI;
using E = Sdt.UI.Screens.Menu.CurrentHomeElements;

namespace Sdt.UI.Screens.Menu
{
    public sealed class TitleScreen : Panel
    {
        CurrentHomeMotion _motion;
        Text _wallpaperCount, _viewLabel;
        Image _muteIcon;
        int _wallpaper;
        bool _wallpaperOnly;
        public override bool CanCloseWithEscape => false;

        public override void Build()
        {
            var root = UIKit.Panel("title", transform);
            root.AddComponent<RectMask2D>();
            _motion = root.AddComponent<CurrentHomeMotion>();
            var scene = UIKit.Panel("home-scene", root.transform);
            _motion.Scene = (RectTransform)scene.transform;
            // CSS background-size: cover, one independently fading layer for each source wallpaper.
            string saved = GameRuntime.I.Saves.Global.GetString(CurrentHomeAssets.PreferenceKey);
            _wallpaper = Array.IndexOf(CurrentHomeAssets.Wallpapers, saved);
            if (_wallpaper < 0) _wallpaper = Array.IndexOf(CurrentHomeAssets.Wallpapers, CurrentHomeAssets.DefaultWallpaper);
            _motion.BuildWallpapers(scene.transform, _wallpaper);
            var decor = UIKit.Panel("home-composition-layers", root.transform);
            _motion.Decor = E.Group(decor.transform);
            _motion.BuildLayers(decor.transform);
            var inner = UIKit.Panel("title-inner", root.transform);
            _motion.Inner = E.Group(inner.transform);
            BuildCommand(inner.transform);
            BuildSupport(inner.transform);
            BuildFooter(inner.transform);
            BuildReadout(inner.transform);
            var view = E.Box(root.transform, "btnTitleWallpaperView", 1662.32f, 937.6f, 154, 56);
            E.Hit(view, ToggleWallpaperOnly);
            var eye = E.Art(view, "btnTitleWallpaperView", 12, 15, 26, 26);
            eye.color = E.Hex("#F5F6F3");
            _viewLabel = E.Text(view, "view-label", "只看壁纸", 18, E.Hex("#F5F6F3"), 47, 0, 98, 56);
            _motion.ViewButton = view;
            _motion.Returned = SyncMute;
            SyncMute();
            _motion.Enter(false);
        }

        void BuildCommand(Transform inner)
        {
            // home-polish: command left6.6%, top13%, width28%; brand width91%.
            var command = E.Box(inner, "home-command", 126.72f, 140.4f, 537.6f, 537);
            float wordmarkWidth = 537.6f * .91f;
            float wordmarkHeight = wordmarkWidth * 1486f / 3200f;
            var brand = E.Box(command, "home-brand", 0, 0, wordmarkWidth, wordmarkHeight + 12);
            E.Art(brand, "wordmark", 0, 0, wordmarkWidth, wordmarkHeight);
            E.Fill(brand, "brand-rule", Theme.HexA("#C9DCE9", .58f), 0, wordmarkHeight + 10, wordmarkWidth * .68f, 2);
            _motion.Brand = brand;
            _motion.Register(brand, "brand", false, 0, .7f);
            _motion.BuildBrandSparks(brand);
            // Image height + 10px rule margin +2px rule; primary margin-top52px.
            var primary = E.Box(command, "home-primary", 0, wordmarkHeight + 64, 537.6f, 200);
            Plate(primary, "mStart", "进入城市", "plate-start", 0, 0, 537.6f, 108, 1,
                  () => UiStack.Show<SlotPickerScreen>("SlotPicker"), 40, 44, false);
            Plate(primary, "mGuide", "生存指南", "plate-guide", 0, 128, 440.832f, 72, 2,
                  () => UiStack.Show<GuideScreen>("Guide"), 24, 32, false);
        }

        void BuildSupport(Transform inner)
        {
            // home-support right6.6%, top32%, width22%; collection gap22; system margin38 gap6.
            var support = E.Box(inner, "home-support", 1370.88f, 345.6f, 422.4f, 426);
            var collection = E.Box(support, "home-secondary home-collection", 0, 0, 422.4f, 202);
            Plate(collection, "mAch", "成就总览", "plate-collection", 42.24f, 0, 380.16f, 90, 3,
                  () => UiStack.Show<AchievementsScreen>("AchOverview"), 24, 36, true);
            Plate(collection, "btnCardLib", "照相馆", "plate-collection", 0, 112, 422.4f, 90, 4,
                  () => App.OpenCardLib?.Invoke(), 24, 36, true);
            var system = E.Box(support, "home-secondary home-system", 0, 240, 422.4f, 186);
            var systemGroup = E.Group(system); systemGroup.alpha = .86f;
            E.Fill(system, "system-rule", Theme.HexA("#CAD9E3", .14f), 0, -17, 422.4f, 1);
            Plate(system, "mSettings", "设置", "plate-system", 59.136f, 0, 363.264f, 58, 5,
                  () => UiStack.Show<SettingsScreen>("Settings"), 21, 26, true);
            Plate(system, "mCredits", "制作名单", "plate-system", 59.136f, 64, 363.264f, 58, 6,
                  () => UiStack.Show<CreditsScreen>("Credits"), 21, 26, true);
            Plate(system, "btnTitleExit", "退出游戏", "plate-system", 59.136f, 128, 363.264f, 58, 7,
                  () => Application.Quit(), 21, 26, true);
            _motion.SystemGroup = systemGroup;
        }

        void Plate(Transform parent, string id, string label, string face, float x, float y,
                   float width, float height, int index, Action open, int fontSize, int iconSize, bool right)
        {
            var plate = E.Box(parent, id, x, y, width, height);
            E.Art(plate, face, 0, 0, width, height, "plate-face");
            E.Hit(plate, () => _motion.Leave(id, open));
            var ink = id == "mStart" ? E.Hex("#14120A") : E.Hex("#F1F0EE");
            float padding = id == "mStart" ? 25 : right ? (index < 5 ? 16 : 14) : 16;
            float gap = id == "mStart" ? 16 : right ? (index < 5 ? 14 : 12) : 18;
            float tracking = fontSize * (id == "mStart" ? .3f : index >= 5 ? .1f : .16f);
            // CJK advance is one em in the current HarmonyOS font; explicit tracked span matches CSS flex sizing.
            float copyWidth = label.Length * fontSize + (label.Length - 1) * tracking;
            float iconX = right ? width - padding - copyWidth - gap - iconSize : padding;
            var icon = E.Art(plate, id, iconX, (height - iconSize) / 2, iconSize, iconSize, "home-line-icon");
            icon.color = id == "mStart" ? ink : index >= 5 ? E.Hex(id == "btnTitleExit" ? "#C9A7AB" : "#B7C7D3") : E.Hex("#DBEAF0");
            var text = E.Text(plate, "home-button-copy", label, fontSize, ink,
                              iconX + iconSize + gap, 0, copyWidth, height, tracking, true);
            // CSS ::after sublabels remain display:none in the final cascade.
            if (index < 5)
            {
                var tag = E.Text(plate, "home-index", index.ToString("00"), 10,
                    index == 1 ? Theme.HexA("#14120A", .6f) : Theme.HexA("#FFFFFF", .4f),
                    right ? 72 : width - (index == 1 ? 70 : 38), index == 1 ? 14 : 8, 30, 12, 2.4f, true);
                tag.font = CurrentHomeMotion.LabelFont;
            }
            var fx = plate.gameObject.AddComponent<CurrentHomePlate>();
            fx.Setup(text.rectTransform, icon, face, right, index == 1);
            _motion.Register(plate, id, right, .08f + (index - 1) * .065f, .56f);
        }

        void BuildFooter(Transform inner)
        {
            var footer = E.Box(inner, "home-footer", 103.68f, 937.6f, 1712.64f, 56);
            _motion.Register(footer, "footer", false, .44f, .42f);
            var mute = E.Box(footer, "btnTitleMute", 0, 0, 56, 56);
            E.Hit(mute, () => { AudioService.I.Mute(!AudioService.I.Muted); SyncMute(); });
            _muteIcon = E.Art(mute, "btnTitleMute", 15, 15, 26, 26);
            var inbox = E.Box(footer, "mInbox", 66, 0, 137, 56);
            E.Hit(inbox, () => _motion.Leave("mInbox", () => UiStack.Show<HomeInboxScreen>("SuggestionInbox")));
            E.Art(inbox, "mInbox", 15, 15, 26, 26);
            E.Text(inbox, "inbox-label", "留言信箱", 18, E.Hex("#F5F6F3"), 50, 0, 72, 56);
            var wallpaper = E.Box(footer, "btnTitleWallpaper", 1402.64f, 0, 144, 56);
            E.Hit(wallpaper, NextWallpaper);
            E.Art(wallpaper, "btnTitleWallpaper", 12, 15, 26, 26);
            _wallpaperCount = E.Text(wallpaper, "wallpaper-count", "", 18, E.Hex("#F5F6F3"), 47, 0, 90, 56);
            UpdateWallpaperCount();
        }

        void BuildReadout(Transform inner)
        {
            var readout = E.Box(inner, "home-readout", 0, 76, 0, 22);
            _motion.Clock = E.Text(readout, "local-clock", "LOCAL 00:00:00", 14, Theme.HexA("#AABCCA", .55f), 22, 0, 220, 14, 1.96f);
            _motion.Clock.font = CurrentHomeMotion.LabelFont;
            float clockWidth = _motion.Clock.preferredWidth;
            var version = E.Text(readout, "local-version", "ASCENSION COUNCIL " + CurrentHomeAssets.Version, 14,
                Theme.HexA("#AABCCA", .55f), 22 + clockWidth + 16, 0, 300, 14, 1.96f);
            version.font = CurrentHomeMotion.LabelFont;
            float width = 22 + clockWidth + 16 + version.preferredWidth;
            readout.sizeDelta = new Vector2(width, 22);
            readout.anchoredPosition = new Vector2(1816.32f - width, -76);
            E.Fill(readout, "readout-rule", Theme.HexA("#FFFFFF", .099f), 0, 21, width, 1);
            E.Fill(readout, "readout-gold", E.Hex("#FFD23C"), 0, 21, 30, 2);
            E.Fill(readout, "home-readout-dot", E.Hex("#1FB2FF"), 0, 4, 6, 6);
            _motion.Register(readout, "readout", true, .32f, .42f);
        }

        void NextWallpaper()
        {
            int next = (_wallpaper + 1) % CurrentHomeAssets.Wallpapers.Length;
            try { GameRuntime.I.Saves.Global.SetString(CurrentHomeAssets.PreferenceKey, CurrentHomeAssets.Wallpapers[next]); }
            catch (Exception e) { Debug.LogError("[HomeWallpaper] 保存失败: " + e.Message); return; }
            _wallpaper = next; _motion.SwitchWallpaper(_wallpaper); UpdateWallpaperCount();
        }
        void UpdateWallpaperCount() => _wallpaperCount.text = "壁纸 <color=#FFD23C>" + (_wallpaper + 1) + "/7</color>";
        void ToggleWallpaperOnly()
        {
            _wallpaperOnly = !_wallpaperOnly;
            _viewLabel.text = _wallpaperOnly ? "恢复界面" : "只看壁纸";
            _motion.SetWallpaperOnly(_wallpaperOnly);
        }
        void SyncMute() => _muteIcon.sprite = CurrentHomeAssets.Load(AudioService.I.Muted ? "btnTitleMute-off" : "btnTitleMute");
        // SlotPickerScreen already consumes this shared presentation helper.
        public static string FmtPlayTime(double seconds)
        {
            long sec = Math.Max(0, (long)Math.Floor(seconds));
            long hours = sec / 3600, minutes = sec % 3600 / 60;
            return hours > 0 ? $"{hours} 小时 {minutes:D2} 分" : $"{minutes} 分钟";
        }
    }
}
