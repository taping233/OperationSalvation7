from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs')
s=p.read_text(encoding='utf-8-sig')
tail=s[s.index('    // ============================================================\n    // 仓库物品弹窗'):]
head='''// Direct presentation port of the production game.hub.runtime.js import chain.
// Current navigation/home/rooms live in the HubCurrent partials. See current-base/source-map.json.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen : Panel
    {
        static string _tab = "deploy";
        static int? _browseSlot;
        static string _warehouseView = "cards", _warehouseGroup = "", _warehouseQuery = "", _warehouseType = "", _warehouseRarity = "", _warehouseCharacter = "";
        static string _person = "wu", _personSection = "profile", _personGroup = "people", _pet = "", _previewSkin = "", _facility = "bag";
        static bool _hatch;
        static string _archiveView = "cards", _collectionId = "", _collectionQuery = "", _collectionType = "", _achievement = "", _achievementFilter = "", _backId = "";
        static string _tradeMode = "buy", _tradeCategory = "", _tradeKey = "";
        GameRuntime G => GameRuntime.I;
        public static void Open(string tab)
        {
            var runtime = GameRuntime.I;
            if (_browseSlot != runtime.ActiveSlot)
            {
                _browseSlot = runtime.ActiveSlot; _warehouseView = "cards"; _warehouseGroup = _warehouseQuery = _warehouseType = _warehouseRarity = _warehouseCharacter = "";
                _person = "wu"; _personSection = "profile"; _personGroup = "people"; _previewSkin = _pet = ""; _hatch = false;
                _archiveView = "cards"; _collectionId = _collectionQuery = _collectionType = _achievement = _achievementFilter = _backId = "";
                _tradeMode = "buy"; _tradeCategory = _tradeKey = "";
            }
            runtime.State.Phase = "modal";
            _tab = tab == "home" || string.IsNullOrEmpty(tab) ? "deploy" : tab == "collection" ? "ach" : tab;
            runtime.Meta.CheckUnlocks(); runtime.Audio.PlayBgm("title");
            foreach (var existing in UiStack.CapturePanels()) if (existing is HubScreen) UiStack.Close(existing);
            UiStack.Show<HubScreen>("Hub-" + _tab);
        }
        public override void CloseFromEscape() => Back();
        void Navigate(string tab) { _tab = tab; AudioService.I.PlaySfx("switch"); Rebuild(); }
        void Back()
        {
            if (_tab == "classes" && (_personGroup == "pets" || _personSection != "profile"))
            { if (_hatch) _hatch = false; else { _personGroup = "people"; _personSection = "profile"; } Rebuild(); return; }
            if (_tab == "stash" && _warehouseView == "pocket") { _warehouseView = "cards"; Rebuild(); return; }
            if (_tab == "ach" && _archiveView != "cards") { _archiveView = "cards"; Rebuild(); return; }
            if (_tab == "shop" || _tab == "upgrade") { Navigate("stash"); return; }
            if (_tab != "deploy") { Navigate("deploy"); return; }
            Close(); UiStack.Show<Menu.SlotPickerScreen>("SlotPicker");
        }
        public override void Build()
        {
            var root = UIKit.Panel("hubMain base-frame-v7 " + (_tab == "deploy" ? "base-home" : "base-subpage"), transform);
            var scene = UIKit.Image(root.transform, Sdt.Res.Res.Scene("base-operations-v5"));
            Fill(scene.rectTransform); scene.type = Image.Type.Simple; scene.preserveAspect = false;
            if (scene.sprite == null) scene.color = Ink("#152028");
            var shade = Area(root.transform, "base-backdrop-tint", Vector2.zero, Vector2.one);
            shade.gameObject.AddComponent<Image>().color = Theme.HexA("#152028", .32f);
            shade.GetComponent<Image>().raycastTarget = false;
            var head = Area(root.transform, "hub-head", new Vector2(0, 1), Vector2.one, new Vector2(0, -84), Vector2.zero);
            Surface(head, .72f, 0);
            var back = Command(head, "‹", Back); Set(back.transform, new Vector2(0, .5f), new Vector2(0, .5f), new Vector2(24, -27), new Vector2(78, 27));
            var title = LabelAt(head, RoomTitle(_tab), 32, new Vector2(102, 0), new Vector2(350, 84)); title.fontStyle = FontStyle.Bold;
            LabelAt(head, G.ActiveSlot.HasValue ? "档案 / 0" + G.ActiveSlot.Value : "未选档", 20, new Vector2(340, 0), new Vector2(560, 84), Muted);
            var resources = Area(head, "base-resource-strip", new Vector2(1, 0), Vector2.one, new Vector2(-850, 12), new Vector2(-52, -12));
            var resourceRow = resources.gameObject.AddComponent<HorizontalLayoutGroup>(); Configure(resourceRow, 18, new RectOffset(), false);
            Resource(resources, "wood", "木材", G.Base.wood); Resource(resources, "rations", "口粮", G.Base.rations);
            Resource(resources, "key", "钥匙", G.Base.KeyCount); Resource(resources, "coin", "储备币", G.Base.coins);
            if (G.Base.runes.Count > 0) Resource(resources, "rune", "符文", G.Base.runes.Count);
            var page = Area(root.transform, "hub-page", Vector2.zero, Vector2.one, new Vector2(_tab == "deploy" ? 0 : 48, 104 + (_tab == "deploy" ? 0 : 24)), new Vector2(_tab == "deploy" ? 0 : -48, -84 - (_tab == "deploy" ? 0 : 24)));
            switch (_tab)
            {
                case "deploy": BuildDeploy(page); break; case "classes": BuildClasses(page); break; case "stash": BuildStash(page); break;
                case "shop": BuildTrade(page); break; case "upgrade": BuildUpgrade(page); break; case "courtyard": CourtyardScreen.Open(); break;
                default: BuildCollectionRoom(page); break;
            }
            BuildNavigation(root.transform);
            // The production v7 public shell is stationary; no legacy PageIn animation.
        }
        static string RoomTitle(string id) { switch(id) { case "classes": return "人物"; case "stash": return "后勤"; case "shop": return "交易所"; case "ach": return "收藏室"; case "upgrade": return "建设"; case "courtyard": return "庭院"; default: return "基地"; } }
        void BuildNavigation(Transform parent)
        {
            var nav = Area(parent, "base-navigation-v7", Vector2.zero, new Vector2(1, 0), Vector2.zero, new Vector2(0, 104)); Surface(nav, .82f, 0);
            var row = nav.gameObject.AddComponent<HorizontalLayoutGroup>(); Configure(row, 5, new RectOffset(40, 40, 0, 0), true);
            foreach (var id in new[] { "deploy", "classes", "stash", "shop", "ach", "upgrade", "courtyard" })
            {
                string destination = id; bool selected = id == _tab;
                var button = Command(nav, "", () => { if (destination == "courtyard") CourtyardScreen.Open(); else Navigate(destination); }, selected);
                button.name = "hub-tab " + id; Bounds(button.gameObject, 0, 104, 1, 0);
                var icon = UIKit.Image(button.transform, Sdt.Res.Res.HubIcon(id == "deploy" ? "home" : id)); icon.preserveAspect = true;
                Set(icon.transform, new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(-16,0),new Vector2(16,32)); icon.color = InkColor;
                var text = UIKit.Label(button.transform, RoomTitle(id), 22, InkColor); text.fontStyle = FontStyle.Bold; text.alignment = TextAnchor.MiddleCenter;
                Set(text.transform, Vector2.zero, Vector2.one, new Vector2(4, 25), new Vector2(-4, -49));
                if (selected) { var line = Area(button.transform, "selected-indicator", new Vector2(0,1),Vector2.one,new Vector2(0,-3),Vector2.zero); line.gameObject.AddComponent<Image>().color = Accent; }
                int pending = PendingRewards;
                if (id == "ach" && pending > 0) { var badge = LabelAt(button.transform,pending.ToString(),20,new Vector2(126,70),new Vector2(158,98),Accent); badge.fontStyle=FontStyle.Bold; }
            }
        }
        int PendingRewards => G.Meta.PendingAch().Count + HubCatalog.Current.milestones.Count(m => !G.Meta.MilestoneClaimed(m.id) && G.Meta.CollectionProgress >= G.Meta.MilestoneNeed(m));
        void BuildDeploy(Transform page)
        {
            var B = G.Base;
            bool hasAffairs = !B.ammoTaught || B.CanUpgradeBag || B.CanUpgradeStash || PendingRewards > 0 || B.stash.Any(s => s.card.id == PetCatalog.Current.eggId && s.count > 0);
            var affairs = Area(page, "base-home-affairs", new Vector2(0,1),new Vector2(0,1),new Vector2(48,-580),new Vector2(hasAffairs?428:312,-40));
            Surface(affairs); var list = Column(affairs, "base-affairs-list", 10, new RectOffset(22,22,20,20));
            Label(list,"基地事务",22,true);
            if (!B.ammoTaught) Affair(list,"首次目标：带回资源","撤离后，在后勤使用资源卡。",OpenDeparture);
            if (B.CanUpgradeBag || B.CanUpgradeStash) Affair(list,"可扩建  " + ((B.CanUpgradeBag?1:0)+(B.CanUpgradeStash?1:0)),(B.CanUpgradeStash?"基地仓库 · 当前 " + B.StashCap:"出征背包 · 当前 " + B.BagCap) + " 格",()=>{_facility=B.CanUpgradeStash?"stash":"bag";Navigate("upgrade");});
            int eggs=B.stash.Where(s=>s.card.id==PetCatalog.Current.eggId).Sum(s=>s.count);
            if(eggs>0 && B.coins>=PetCatalog.Current.hatchCost && B.pets.Count<BaseData.PetsCatalog.Count) Affair(list,"可孵化  "+eggs,"伙伴蛋 × "+eggs,()=>{_personGroup="pets";Navigate("classes");});
            if(PendingRewards>0) Affair(list,"待领取  "+PendingRewards,"收藏与成就奖励",()=>{_archiveView="rewards";Navigate("ach");});
            if(!hasAffairs) Label(list,"暂无待处理事务",20,false,Muted);
            var prep=Area(page,"base-home-preparation",new Vector2(1,1),new Vector2(1,1),new Vector2(-468,-620),new Vector2(-48,-120)); Surface(prep);
            var body=Column(prep,"preparation",18,new RectOffset(24,24,24,24));
            var facts=Row(body,"base-home-ready-facts",16,86); var person=Column(facts,"person",6); var cards=Column(facts,"cards",6);
            Label(person,"人物",20,false,Muted); Label(person,"待选择",22,true); Label(cards,"携带卡牌",20,false,Muted); Label(cards,"待配置",22,true);
            var launch=Command(body,"[[icon:map]]  出征整备     →",OpenDeparture); Bounds(launch.gameObject,0,90,1,0); foreach(var t in launch.GetComponentsInChildren<Text>())t.fontSize=28;
            var modes=Column(body,"base-home-mode",10,new RectOffset(7,7,7,7)); Surface(modes,.55f); var selector=Row(modes,"行动难度",6,54);
            foreach(var mode in GameRuntime.AllModes.Values) { string id=mode.id; var b=Command(selector,id=="elite"?"直入敌腹":"正常入城",()=>{if(!G.TryPersistMutation(()=>G.Base.selMode=id,out var why)){Log(why,"warn");return;}Rebuild();},B.selMode==id); Bounds(b.gameObject,0,54,1,0); }
            var elite=GameRuntime.AllModes["elite"];
            Label(modes,B.selMode=="elite"?$"四层探索 · 敌人与首脑 ×{elite.enemyMul} · 战斗金币 ×{elite.coinMul} · 人物经验 ×{elite.xpMul} · 高稀有度掉率 +20%。":"四层探索 · 基础难度",20);
            Command(body,"携带预设 →",PreparationScreen.Open);
            int restore=B.pocket.Sum(s=>s.count); if(restore>0) Command(body,"待复原 "+restore+" →",()=>{_warehouseView="pocket";Navigate("stash");});
        }
        void OpenDeparture() => DepartPrepScreen.Open(); // Main departure owner supplies current classchoice → prep → start.
        void Affair(Transform parent,string title,string description,Action action)
        {
            var button=Command(parent,"",action); Bounds(button.gameObject,0,80,1,0);
            var t=UIKit.Label(button.transform,"<b>"+title+"</b>   ›\\n<size=19><color=#BCC8CA>"+description+"</color></size>",22,InkColor); Fill(t.rectTransform,new Vector2(12,8),new Vector2(-12,-8));
        }
        void Log(string text,string tone) => G.Bus.Emit(new ToastRequested {Text=text,Tone=tone});
    }

'''
p.write_text(head+tail,encoding='utf-8')
