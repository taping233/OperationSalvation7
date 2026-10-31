// Current source: game.run.class-choice.page.js, roster-departure-v2.css and roster-reference.css.
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;
using Sdt.Run;
using D = Sdt.UI.Screens.Run.DepartureElements;

namespace Sdt.UI.Screens.Run
{
    public sealed partial class ClassChoiceScreen : Panel
    {
        string[] _picks;
        string _sel, _notice;
        bool _poolView, _growth, _requested, _submitting;
        int _portraitDirection;
        Action<string> _selected;
        Action _cancel;
        BaseData _base;
        int? _slot;
        public override bool CanCloseWithEscape => _requested || _poolView;
        bool Current => ReferenceEquals(_base, GameRuntime.I.Base) && _slot == GameRuntime.I.ActiveSlot;
        public static void Request(Action<string> selected, Action cancel, string initial = null)
            => Present(selected, cancel, initial, true);
        // Existing LoadRun(null class) repair entry remains separate from the uncommitted base draft.
        public static void Open() => Present(null, null, GameRuntime.I.State.characterId, false);
        static void Present(Action<string> selected, Action cancel, string initial, bool request)
        {
            var runtime = GameRuntime.I;
            var picks = CharacterTable.All.Where(c => CardLibrary.ClassPool(c.rulesetId).Count > 0).Select(c => c.id).ToArray();
            if (!request && runtime.State.runActive && string.IsNullOrEmpty(runtime.State.myClass) && CharacterTable.For(runtime.State.characterId) != null)
                picks = picks.Where(id => id == runtime.State.characterId).ToArray();
            if (picks.Length == 0) return;
            var page = ScreenMount.Show<ClassChoiceScreen>("ClassChoice");
            page._picks = picks; page._sel = picks.Contains(CharacterTable.For(initial)?.id) ? CharacterTable.For(initial).id : picks[0];
            page._selected = selected; page._cancel = cancel; page._requested = request;
            page._base = runtime.Base; page._slot = runtime.ActiveSlot; page.Build();
        }
        public override void CloseFromEscape()
        {
            if (_submitting) return;
            if (_poolView) { _poolView = false; Rebuild(); return; }
            if (_requested) Cancel();
        }
        void Cancel()
        {
            if (!Current || _submitting) return;
            var cancel = _cancel; Close(); cancel?.Invoke();
        }
        string ConfirmLabel => _requested ? "下一步：选择卡牌" : "继续本次出征";
        public override void Build()
        {
            if (!Current) { Close(); return; }
            if (_poolView) { BuildPool(); return; }
            var root = UIKit.Panel("cls2-page roster-reference", transform).transform;
            D.Surface(root, Theme.Hex("#EDF1F2"));
            root.gameObject.AddComponent<RosterRadialBackdrop>();
            D.TextAt(root, "选择出征人物", 30, new Vector2(0, 1), new Vector2(0, 1), new Vector2(106, -68), new Vector2(500, -28), Theme.Hex("#243845")).fontStyle = FontStyle.Bold;
            D.CommandAt(root, "cls2Quit", "‹", Cancel, new Vector2(0, 1), new Vector2(0, 1), new Vector2(32, -76), new Vector2(86, -22), Color.clear, Theme.Hex("#263F4D"), 34).gameObject.SetActive(_requested);
            if (_requested) BuildSteps(root);
            var stage = D.Area(root, "cls2-stage", Vector2.zero, Vector2.one, new Vector2(36, 112), new Vector2(-334, -106));
            var figure = D.Area(stage, "cls2-fullart", Vector2.zero, new Vector2(.59f, 1));
            D.Surface(figure, Theme.HexA("#FFFFFF", .64f), true, false, 24);
            var artSurface = D.Area(figure, "roster-art-surface", Vector2.zero, Vector2.one, Vector2.one * 18, Vector2.one * -18);
            D.Surface(artSurface, Color.white, true); artSurface.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            BuildPortrait(artSurface);
            var panel = D.Area(stage, "cls2-panel", new Vector2(.63f, 0), Vector2.one);
            D.Surface(panel, Theme.Hex("#3A505B"), true, false, 24);
            var contents = D.Scroll(panel, "cls2-panel-scroll", Vector2.zero, Vector2.one, new Vector2(26, 28), new Vector2(-26, -28));
            var flow = contents.GetComponent<VerticalLayoutGroup>(); flow.spacing = 18; flow.padding = new RectOffset();
            BuildInformation(contents);
            DepartureSourceMotion.Enter(panel, .18f, new Vector2(0, -4));
            DepartureSourceMotion.Enter(artSurface, .26f, new Vector2(_portraitDirection * 14, 0));
            BuildRoster(root);
            D.CommandAt(root, "cls2Quit-footer", "‹  返回基地", Cancel, Vector2.zero, Vector2.zero, new Vector2(36, 28), new Vector2(242, 90), Color.clear, Theme.Hex("#263F4D")).gameObject.SetActive(_requested);
            D.CommandAt(root, "pickClass", ConfirmLabel + "   ✓", PickClass, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-302, 28), new Vector2(-32, 90), Theme.Hex("#294854"), Color.white, 20);
            if (!string.IsNullOrEmpty(_notice)) D.TextAt(root, _notice, 18, new Vector2(0, 0), new Vector2(1, 0), new Vector2(270, 30), new Vector2(-334, 90), Theme.Hex("#743D30"));
        }
        void BuildSteps(Transform root)
        {
            var step = D.Area(root, "camp-steps", new Vector2(1, 1), Vector2.one, new Vector2(-440, -68), new Vector2(-32, -28));
            D.CommandAt(step, "cls2Mode", "01 模式", Cancel, Vector2.zero, new Vector2(.29f, 1), Vector2.zero, Vector2.zero, Color.clear, Theme.Hex("#5A727E"));
            D.TextAt(step, "02 人物", 19, new Vector2(.35f, 0), new Vector2(.65f, 1), Vector2.zero, Vector2.zero, Theme.Hex("#20333E")).fontStyle = FontStyle.Bold;
            D.CommandAt(step, "cls2Prepare", "03 整备", PickClass, new Vector2(.71f, 0), Vector2.one, Vector2.zero, Vector2.zero, Color.clear, Theme.Hex("#5A727E"));
        }
        void BuildPortrait(Transform host)
        {
            var skin = _base.SelectedSkin(_sel); var sprite = Sdt.Res.Res.SkinPortrait(_sel, skin);
            var figure = D.Area(host, "art-figure " + _sel + "/" + skin, Vector2.zero, Vector2.one);
            var image = figure.gameObject.AddComponent<Image>(); image.raycastTarget = false; image.sprite = sprite; image.color = sprite != null ? Color.white : Color.clear;
            if (sprite == null) { D.TextAt(host, "立绘暂未加载", 20, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, Theme.Hex("#20333E")); return; }
            if (skin != "default") { ConfigureSkinCover(image, skin, false); return; }
            float height = .95f, bottom = .025f, shift = -.5f;
            switch (_sel)
            {
                case "wu": height = .95115f; bottom = .02257f; shift = -.57764f; break;
                case "changwuyu": height = .95796f; bottom = .02268f; shift = -.50664f; break;
                case "baita": height = 1.00192f; bottom = .02026f; shift = -.49434f; break;
                case "heixiang": height = .95932f; bottom = .03f; shift = -.5002f; break;
            }
            var fit = figure.gameObject.AddComponent<RosterPortraitFit>(); fit.Height = height; fit.Bottom = bottom; fit.Center = shift; fit.Aspect = sprite.rect.width / sprite.rect.height;
        }
        void BuildInformation(Transform content)
        {
            var character = CharacterTable.For(_sel); int lv = GameRuntime.I.Meta.ClassLv(character.rulesetId);
            D.Copy(content, character.name, 50, Color.white, 60).fontStyle = FontStyle.Bold;
            var petHp = _base.CarriedPet?.effect?.maxHp ?? 0;
            D.Copy(content, "生命上限 <b>" + (GameRules.PlayerMaxHp + petHp + Math.Max(0, lv - 1)) + "</b> · 基础攻击 <b>" + GameRules.PlayerAtk + "</b>", 18);
            string title, mechanic, skill;
            switch (_sel)
            {
                case "wu": title = "物理进攻"; mechanic = "潜行 · 流血 · 连击"; skill = "<b>刺击</b> · 每回合一次\n1 费 · 造成 2 点固定伤害"; break;
                case "changwuyu": title = "法术压制"; mechanic = "火球 · 诅咒"; skill = "<b>火球</b> · 每回合一次\n2 费 · 施放一次火球（4 点法伤）· 不消耗卡牌"; break;
                case "baita": title = "奥术施法"; mechanic = "发现法术 · 召唤"; skill = "<b>搜刮</b> · 每回合一次\n1 费 · 随机获得一张卡牌：普通战道具进栏、其他卡牌入手，首脑战排除道具并洗入牌库 · 不消耗卡牌"; break;
                case "heixiang": title = "正面防线"; mechanic = "护甲 · 流血"; skill = "<b>猛击</b> · 每回合一次\n2 费 · 攻击一次（等同打出一张初始攻击）· 不消耗卡牌"; break;
                default: title = "治疗护持"; mechanic = "治疗 · 圣盾 · 圣光"; skill = "<b>圣疗</b> · 每回合一次\n1 费 · 回复 3 点生命；使用后切换为「惩戒」（3 点法伤）· 不消耗卡牌"; break;
            }
            D.Copy(content, title, 26).fontStyle = FontStyle.Bold;
            D.Copy(content, mechanic, 20, Theme.Hex("#B8D0DA"));
            D.Copy(content, skill, 16, Theme.Hex("#B8D0DA"));
            var growth = D.Command(content, "cls2-growth", (_growth ? "▾ " : "▸ ") + "熟练成长 · Lv." + lv, () => { _growth = !_growth; Rebuild(); }, Color.clear, D.Ink, 18);
            growth.GetComponent<LayoutElement>().preferredHeight = 42;
            if (_growth)
            {
                int xp = GameRuntime.I.Meta.ClassXP(character.rulesetId), need = MetaProgress.XpForNext(lv);
                D.Copy(content, lv >= MetaProgress.LevelMax ? "熟练度已满级 MAX" : xp + " / " + need + " XP", 16, D.Muted);
                D.Copy(content, "出征加成 " + MetaProgress.PerkText(lv), 16, D.Muted);
            }
            var skins = HubCatalog.Current.skins.Where(s => s.characterId == _sel).ToList();
            if (skins.Count > 0)
            {
                D.Copy(content, "皮肤", 16, Theme.Hex("#B3CBD1"));
            var row = D.Area(content, "cls2-skins", Vector2.zero, Vector2.one); row.gameObject.AddComponent<LayoutElement>().preferredHeight = Mathf.Ceil((skins.Count + 1) / 4f) * 110;
            var grid = row.gameObject.AddComponent<GridLayoutGroup>(); grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount; grid.constraintCount = 4; grid.cellSize = new Vector2(100, 100); grid.spacing = Vector2.one * 10;
            row.gameObject.AddComponent<RosterSkinGrid>();
                BuildSkin(row, "default", "标准"); foreach (var skin in skins) BuildSkin(row, skin.id, skin.name);
            }
            D.Command(content, "clsPool", "[[icon:card-library]] 完整人物卡池（" + CardLibrary.ClassPool(character.rulesetId).Count + " 张）", () => { _poolView = true; _poolPage = 0; _poolFilter = ""; _poolSelected = null; Rebuild(); }, Theme.HexA("#FFFFFF", .03f), D.Ink, 17);
        }
        void BuildSkin(Transform parent, string id, string caption)
        {
            var selected = _base.SelectedSkin(_sel) == id;
            var button = D.Command(parent, "clsSkin-" + id, "", () =>
            { if (!Current) return; if (!_base.TrySelectSkin(_sel, id, out _notice)) { Rebuild(); return; } Rebuild(); }, selected ? Theme.Hex("#A8DBE9") : Theme.HexA("#12232C", .4f));
            var clip = D.Area(button.transform, "cls2-skin-preview", new Vector2(0, .40f), Vector2.one); clip.gameObject.AddComponent<RectMask2D>();
            var art = D.Area(clip, "skin-art", Vector2.zero, Vector2.one).gameObject.AddComponent<Image>(); art.sprite = Sdt.Res.Res.SkinPortrait(_sel, id); ConfigureSkinCover(art, id, true);
            D.TextAt(button.transform, caption, 15, Vector2.zero, new Vector2(1, .4f), new Vector2(2, 2), new Vector2(-2, 0), selected ? Theme.Hex("#183442") : D.Ink).alignment = TextAnchor.MiddleCenter;
        }
        void BuildRoster(Transform root)
        {
            var strip = D.Area(root, "cls2-strip", new Vector2(1, 1), Vector2.one, new Vector2(-302, -106 - 3 * 170), new Vector2(-32, -106));
            for (int i = 0; i < _picks.Length; i++)
            {
                string id = _picks[i]; float x = (i % 2) * 143, y = (i / 2) * 170;
                var button = D.CommandAt(strip, "selClass-" + id, "", () => { if (!Current || _submitting || _sel == id) return; _portraitDirection = Math.Sign(Array.IndexOf(_picks, id) - Array.IndexOf(_picks, _sel)); _sel = id; _growth = false; Rebuild(); }, new Vector2(0, 1), new Vector2(0, 1), new Vector2(x, -y - 154), new Vector2(x + 127, -y), Theme.Hex("#B8C7CE"));
                var clip = D.Area(button.transform, "avatar-frame", new Vector2(0, 1), Vector2.one, new Vector2(2, -114), new Vector2(-2, -2)); clip.gameObject.AddComponent<RectMask2D>();
                var image = D.Area(clip, "avatar", Vector2.zero, Vector2.one).gameObject.AddComponent<Image>(); D.Cover(image, Sdt.Res.Res.Avatar(id));
                var caption = D.Area(button.transform, "face-name", Vector2.zero, new Vector2(1, 0), new Vector2(2, 2), new Vector2(-2, 40)); D.Surface(caption, Theme.Hex(_sel == id ? "#83C9DF" : "#233640"));
                D.TextAt(caption, CharacterTable.Name(id), 18, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, _sel == id ? Theme.Hex("#183442") : D.Ink).alignment = TextAnchor.MiddleCenter;
                if (_sel == id) { button.GetComponent<Outline>().effectColor = Theme.Hex("#498EAB"); button.GetComponent<Outline>().effectDistance = new Vector2(3, -3); D.TextAt(button.transform, "✓", 20, Vector2.one, Vector2.one, new Vector2(-32, -32), new Vector2(-7, -7), Theme.Hex("#183442")); }
            }
        }
        void PickClass()
        {
            if (!Current || _submitting || CharacterTable.For(_sel) == null) return;
            if (_requested) { var selected = _selected; string id = _sel; Close(); selected?.Invoke(id); return; }
            _submitting = true;
            if (!GameRuntime.I.TryPersistMutation(() => GameRuntime.I.SetCharacter(_sel), out _notice)) { _submitting = false; Rebuild(); return; }
            Close(); EntrySupplyScreen.Open();
        }
        static void ConfigureSkinCover(Image image, string skin, bool preview)
        {
            image.raycastTarget = false; image.color = image.sprite != null ? Color.white : Color.clear;
            if (image.sprite == null) return;
            var fit = image.gameObject.AddComponent<RosterSkinCover>(); fit.Aspect = image.sprite.rect.width / image.sprite.rect.height;
            switch (skin)
            {
                case "casual": fit.Focus = new Vector2(.62f, preview ? .28f : .5f); break;
                case "spring": fit.Focus = new Vector2(.68f, preview ? .25f : .5f); break;
                case "beach": fit.Focus = new Vector2(.70f, preview ? .30f : .5f); break;
                case "drum-room": fit.Focus = new Vector2(.50f, preview ? .30f : .5f); break;
                case "last-seat": case "coast-half-day": fit.Focus = new Vector2(.58f, preview ? .35f : .5f); break;
                case "snowline-vigil": fit.Focus = new Vector2(.44f, preview ? .35f : .5f); break;
            }
        }
    }
    // Preserve the existing UID entry used by other Run pages.
    public static class RunUid
    {
        static long _n;
        public static string Next() => "u" + (++_n) + "-" + GameRuntime.I.Rng.Next(1 << 30);
    }
    internal sealed class RosterPortraitFit : MonoBehaviour
    {
        public float Height, Bottom, Center, Aspect;
        void OnEnable() => Canvas.willRenderCanvases += Fit;
        void OnDisable() => Canvas.willRenderCanvases -= Fit;
        void LateUpdate() => Fit();
        void OnRectTransformDimensionsChange() => Fit();
        void Fit()
        {
            if (transform.parent == null || Height <= 0 || Aspect <= 0) return;
            var rect = (RectTransform)transform; float parentHeight = ((RectTransform)transform.parent).rect.height, height = parentHeight * Height;
            var anchor=new Vector2(.5f,0);var pivot=new Vector2(-Center,0);var size=new Vector2(height*Aspect,height);var position=new Vector2(0,parentHeight*Bottom);
            if(rect.anchorMin!=anchor)rect.anchorMin=anchor;if(rect.anchorMax!=anchor)rect.anchorMax=anchor;
            if(rect.pivot!=pivot)rect.pivot=pivot;if(rect.sizeDelta!=size)rect.sizeDelta=size;if(rect.anchoredPosition!=position)rect.anchoredPosition=position;
        }
    }
    internal sealed class RosterRadialBackdrop : MonoBehaviour
    {
        static Sprite _source;
        void Awake()
        {
            if (_source == null)
            {
                const int side = 256; var texture = new Texture2D(side, side, TextureFormat.RGBA32, false) { name = "roster-radial-css", wrapMode = TextureWrapMode.Clamp };
                var middle = Theme.Hex("#EDF1F2"); var edge = Theme.Hex("#D6DFE4");
                for (int y = 0; y < side; y++) for (int x = 0; x < side; x++)
                { float dx = (x / 255f - .28f) / .90f, dy = (y / 255f - .45f) / .70f, distance = Mathf.Clamp01(Mathf.Sqrt(dx * dx + dy * dy)); texture.SetPixel(x, y, distance <= .48f ? Color.Lerp(Color.white, middle, distance / .48f) : Color.Lerp(middle, edge, (distance - .48f) / .52f)); }
                texture.Apply(); _source = Sprite.Create(texture, new Rect(0, 0, side, side), Vector2.one * .5f);
            }
            var image = GetComponent<Image>(); image.sprite = _source; image.color = Color.white;
        }
    }
    internal sealed class RosterSkinGrid : MonoBehaviour
    { void LateUpdate() { var grid = GetComponent<GridLayoutGroup>(); grid.cellSize = new Vector2(Mathf.Max(1, (((RectTransform)transform).rect.width - 30) / 4f), 100); } }
    internal sealed class RosterSkinCover : MonoBehaviour
    {
        public float Aspect; public Vector2 Focus = Vector2.one * .5f;
        void LateUpdate()
        {
            var rect = (RectTransform)transform; var bounds = ((RectTransform)transform.parent).rect.size;
            float width = Mathf.Max(bounds.x, bounds.y * Aspect), height = width / Aspect;
            rect.anchorMin = rect.anchorMax = Vector2.one * .5f; rect.pivot = Vector2.one * .5f; rect.sizeDelta = new Vector2(width, height);
            rect.anchoredPosition = new Vector2((bounds.x - width) * (Focus.x - .5f), (bounds.y - height) * (.5f - Focus.y));
        }
    }
}
