// Direct presentation port of the production game.hub.runtime.js import chain.
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
        static int _renderSequence;int _renderVersion;BaseData _viewBase;int? _viewSlot;
        bool CurrentHub(int revision)=>this!=null&&isActiveAndEnabled&&_renderVersion==revision&&_renderSequence==revision&&ReferenceEquals(_viewBase,G.Base)&&_viewSlot==G.ActiveSlot;
        static string _warehouseView = "cards", _warehouseGroup = "", _warehouseQuery = "", _warehouseType = "", _warehouseRarity = "", _warehouseCharacter = "";
        static string _person = "wu", _personSection = "profile", _personGroup = "people", _pet = "", _previewSkin = "", _facility = "bag";
        static bool _hatch, _stashFromPersonnel;
        static string _shopParent="stash", _facilityParent="stash", _achievementReturn="rewards";
        static string _archiveView = "cards", _collectionId = "", _collectionQuery = "", _collectionType = "", _achievement = "", _achievementFilter = "", _backId = "";
        static string _tradeMode = "buy", _tradeCategory = "", _tradeKey = "";
        GameRuntime G => GameRuntime.I;
        public static void Open(string tab)
        {
            var runtime = GameRuntime.I;
            if (_browseSlot != runtime.ActiveSlot)
            {
                BrowseScroll.Clear();BrowseFocus.Clear();InputSelection.Clear();_collectionPage=_poolPage=0;_storySegment=0;_rewardRecord=_milestoneRecord=_achievementQuery="";_shopParent=_facilityParent="stash";_stashFromPersonnel=false;
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
        void Navigate(string tab)
        {
            if(tab=="shop"&&_tab!="shop")_shopParent=_tab=="upgrade"?"stash":_tab;
            if(tab=="upgrade"&&_tab!="upgrade")_facilityParent=_tab;
            if(tab=="stash"&&_tab!="stash"&&!(_tab=="shop"&&_shopParent=="stash"))_stashFromPersonnel=_tab=="classes"&&!string.IsNullOrEmpty(_warehouseCharacter);
            _tab=tab; AudioService.I.PlaySfx("switch"); Rebuild();
        }
        void Back()
        {
            if (_tab == "classes" && (_personGroup == "pets" || _personSection != "profile"))
            { if (_hatch) _hatch = false; else { _personGroup = "people"; _personSection = "profile"; } Rebuild(); return; }
            if (_tab == "stash" && _warehouseView == "pocket") { _warehouseView = "cards"; Rebuild(); return; }
            if(_tab=="stash"&&_stashFromPersonnel){_personGroup="people";_personSection="profile";Navigate("classes");return;}
            if (_tab == "ach" && _archiveView != "cards") { _archiveView=_archiveView=="achievements"?_achievementReturn:_archiveView=="classes"?"rewards":"cards"; Rebuild(); return; }
            if (_tab == "shop" || _tab == "upgrade") { Navigate(_tab=="shop"?_shopParent:_facilityParent); return; }
            if (_tab != "deploy") { Navigate("deploy"); return; }
            Close(); UiStack.Show<Menu.SlotPickerScreen>("SlotPicker");
        }
        public override void Build()
        {
            _renderVersion=++_renderSequence;_viewBase=G.Base;_viewSlot=G.ActiveSlot;
            var root = UIKit.Panel("hubMain base-frame-v7 " + (_tab == "deploy" ? "base-home" : "base-subpage"), transform);
            var scene = UIKit.Image(root.transform, Sdt.Res.Res.Scene("base-operations-v5"));
            Fill(scene.rectTransform); scene.type = Image.Type.Simple; scene.preserveAspect = true;
            root.AddComponent<RectMask2D>();
            if(scene.sprite!=null){var cover=scene.gameObject.AddComponent<AspectRatioFitter>();cover.aspectMode=AspectRatioFitter.AspectMode.EnvelopeParent;cover.aspectRatio=scene.sprite.rect.width/scene.sprite.rect.height;}
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
            var resourceRow = resources.gameObject.AddComponent<HorizontalLayoutGroup>(); Configure(resourceRow, 18, new RectOffset(), false);resourceRow.childAlignment=TextAnchor.MiddleRight;
            Resource(resources, "wood", "木材", G.Base.wood); Resource(resources, "rations", "口粮", G.Base.rations);
            Resource(resources, "key", "钥匙", G.Base.KeyCount); Resource(resources, "coin", "储备币", G.Base.coins);
            if (G.Base.runes.Count > 0) Resource(resources, "rune", "符文", G.Base.runes.Count);
            var page = Area(root.transform, "hub-page", Vector2.zero, Vector2.one, new Vector2(_tab == "deploy" ? 0 : 48, 104 + (_tab == "deploy" ? 0 : 24)), new Vector2(_tab == "deploy" ? 0 : -48, -84 - (_tab == "deploy" ? 0 : 24)));
            switch (_tab)
            {
                case "deploy": BuildDeploy(page); break; case "classes": BuildClasses(page); break; case "stash": BuildStash(page); break;
                case "shop": BuildTrade(page); break; case "upgrade": BuildUpgrade(page); break; case "courtyard": CourtyardScreen.BuildCurrentRoom(page); break;
                default: BuildCollectionRoom(page); break;
            }
            BuildNavigation(root.transform);
            RestoreBrowse(root);
            ApplyCurrentMotion(root);
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
                var button = Command(nav, "", () => { { if(destination=="classes"){_personGroup="people";_personSection="profile";}if(destination=="ach")_archiveView="cards";if(destination=="stash"&&_tab=="deploy"){_warehouseView="cards";_warehouseGroup=_warehouseQuery=_warehouseType=_warehouseRarity=_warehouseCharacter="";} Navigate(destination); } }, selected);
                button.name = "hub-tab " + id; Bounds(button.gameObject, 0, 104, 1, 0);button.GetComponent<Image>().material=null;button.GetComponent<Image>().color=selected?Theme.HexA("#9EDCE7",.11f):Color.clear;button.GetComponent<Outline>().enabled=false;
                var icon = UIKit.Image(button.transform, Sdt.Res.Res.HubIcon(id == "deploy" ? "home" : id)); icon.preserveAspect = true;
                Set(icon.transform, new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(-16,0),new Vector2(16,32)); icon.color = InkColor;
                var text = UIKit.Label(button.transform, RoomTitle(id), 22, InkColor); text.fontStyle = FontStyle.Bold; text.alignment = TextAnchor.MiddleCenter;
                Set(text.transform, Vector2.zero, Vector2.one, new Vector2(4, 25), new Vector2(-4, -49));
                if (selected) { var line = Area(button.transform, "selected-indicator", new Vector2(0,1),Vector2.one,new Vector2(0,-3),Vector2.zero); line.gameObject.AddComponent<Image>().color = Accent; }
                int pending = PendingRewards;
                if (id == "ach" && pending > 0) { var badge=UIKit.Label(button.transform,pending.ToString(),20,Accent);Set(badge.transform,Vector2.one,Vector2.one,new Vector2(-50,-36),new Vector2(-20,-8));badge.fontStyle=FontStyle.Bold; }
            }
        }
        int PendingRewards => G.Meta.PendingAch().Count + HubCatalog.Current.milestones.Count(m => !G.Meta.MilestoneClaimed(m.id) && G.Meta.CollectionProgress >= G.Meta.MilestoneNeed(m));
        void BuildDeploy(Transform page)
        {
            var B = G.Base;
            int eggCount=B.stash.Where(s=>s.card.id==PetCatalog.Current.eggId).Sum(s=>s.count);
            int affairCount=(!B.ammoTaught?1:0)+(B.CanUpgradeBag||B.CanUpgradeStash?1:0)+(PendingRewards>0?1:0)+(eggCount>0&&B.coins>=PetCatalog.Current.hatchCost&&B.pets.Count<BaseData.PetsCatalog.Count?1:0);
            bool hasAffairs=affairCount>0;
            var list=HomeCard(page,"base-home-affairs",false,hasAffairs?380:264,40,4,hasAffairs?new RectOffset(14,14,20,14):new RectOffset(16,16,13,13));
            var heading=hasAffairs?Column(list,"affairs-heading",0,new RectOffset(8,8,0,6),false):list;Label(heading,"基地事务",hasAffairs?22:21,true);
            if (!B.ammoTaught) Affair(list,"首次目标：带回资源","撤离后，在后勤使用资源卡。",OpenDeparture);
            if (B.CanUpgradeBag || B.CanUpgradeStash) Affair(list,"可扩建  " + ((B.CanUpgradeBag?1:0)+(B.CanUpgradeStash?1:0)),(B.CanUpgradeStash?"基地仓库 · 当前 " + B.StashCap:"出征背包 · 当前 " + B.BagCap) + " 格",()=>{_facility=B.CanUpgradeStash?"stash":"bag";Navigate("upgrade");});
            int eggs=B.stash.Where(s=>s.card.id==PetCatalog.Current.eggId).Sum(s=>s.count);
            if(eggs>0 && B.coins>=PetCatalog.Current.hatchCost && B.pets.Count<BaseData.PetsCatalog.Count) Affair(list,"可孵化  "+eggs,"伙伴蛋 × "+eggs,()=>{_personGroup="pets";Navigate("classes");});
            if(PendingRewards>0) Affair(list,"待领取  "+PendingRewards,"收藏与成就奖励",()=>{_archiveView="rewards";Navigate("ach");});
            if(!hasAffairs) Label(list,"暂无待处理事务",20,false,Muted);
            var body=HomeCard(page,"base-home-preparation",true,420,Mathf.Clamp(((RectTransform)page).rect.height*.14f,40,120),18,new RectOffset(24,24,24,24));
            var facts=Row(body,"base-home-ready-facts",16,101);facts.GetComponent<HorizontalLayoutGroup>().padding=new RectOffset(0,0,16,16);var person=Column(facts,"person",6); var cards=Column(facts,"cards",6);
            HomeRule(facts,0);HomeRule(facts,1);
            Label(person,"人物",20,false,Muted); Label(person,DepartPrepScreen.HasDraft?CharacterTable.Name(DepartPrepScreen.DraftCharacterId):"待选择",22,true); Label(cards,"携带卡牌",20,false,Muted); Label(cards,DepartPrepScreen.HasDraft?DepartPrepScreen.DraftCardCount+" 张":"待配置",22,true);
            var launch=Command(body,DepartPrepScreen.HasDraft?"继续整备":"出征整备",OpenDeparture); Bounds(launch.gameObject,0,90,1,0); foreach(var t in launch.GetComponentsInChildren<Text>()){t.fontSize=28;t.fontStyle=FontStyle.Bold;t.alignment=TextAnchor.MiddleLeft;t.rectTransform.offsetMin=new Vector2(82,18);t.rectTransform.offsetMax=new Vector2(-58,-18);}
            launch.GetComponent<Image>().material=null;
            var launchArrow=UIKit.Label(launch.transform,"→",28,Ink("#E2C891"));Set(launchArrow.transform,new Vector2(1,0),Vector2.one,new Vector2(-42,0),new Vector2(-18,0));launchArrow.alignment=TextAnchor.MiddleCenter;
            var launchIcon=UIKit.Image(launch.transform,Sdt.Res.Res.HubIcon("deploy"));launchIcon.color=Ink("#E2C891");launchIcon.preserveAspect=true;Set(launchIcon.transform,new Vector2(0,.5f),new Vector2(0,.5f),new Vector2(20,-23),new Vector2(66,23));
            var stripe=Area(launch.transform,"launch-gold-line",Vector2.zero,new Vector2(0,1),Vector2.zero,new Vector2(5,0));stripe.gameObject.AddComponent<Image>().color=Ink("#E2C891");
            var modes=Column(body,"base-home-mode",14,new RectOffset(7,7,7,7),false); Surface(modes,.55f); var selector=Row(modes,"行动难度",6,54);
            modes.GetComponent<Image>().material=null;
            foreach(var mode in GameRuntime.AllModes.Values) { string id=mode.id; var b=Command(selector,id=="elite"?"直入敌腹":"正常入城",()=>{if(!G.TryPersistMutation(()=>G.Base.selMode=id,out var why)){Log(why,"warn");return;}Rebuild();},B.selMode==id); Bounds(b.gameObject,0,54,1,0);b.GetComponent<Image>().material=null;b.GetComponent<Outline>().effectColor=Color.clear;if(B.selMode!=id)b.GetComponent<Image>().color=Color.clear;if(id=="elite"&&B.selMode==id)b.GetComponent<Image>().color=Ink("#FF818C"); }
            var elite=GameRuntime.AllModes["elite"];
            Label(modes,B.selMode=="elite"?$"四层探索 · 敌人与首脑 ×{elite.enemyMul} · 战斗金币 ×{elite.coinMul} · 人物经验 ×{elite.xpMul} · 高稀有度掉率 +20%。":"四层探索 · 基础难度",20);
            var services=Row(body,"base-home-services",18,51);services.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;services.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleRight;
            HomeService(services,"携带预设 →",PreparationScreen.Open);
            int restore=B.pocket.Sum(s=>s.count); if(restore>0) HomeService(services,"待复原 "+restore+" →",()=>{_warehouseView="pocket";Navigate("stash");});
            foreach(var card in page.GetComponentsInChildren<HubCurrentHomeCard>())card.Fit(true);
        }
        static Transform HomeCard(Transform page,string name,bool right,float width,float top,float gap,RectOffset padding)
        {
            var host=Area(page,name,new Vector2(right?1:0,1),new Vector2(right?1:0,1));host.pivot=new Vector2(right?1:0,1);host.anchoredPosition=new Vector2(right?-48:48,-top);host.sizeDelta=new Vector2(width,100);Surface(host);
            var viewport=Area(host,"viewport",Vector2.zero,Vector2.one);viewport.gameObject.AddComponent<RectMask2D>();
            var body=(RectTransform)Column(viewport,name+"-content",gap,padding,false);body.anchorMin=new Vector2(0,1);body.anchorMax=Vector2.one;body.pivot=new Vector2(.5f,1);body.sizeDelta=Vector2.zero;body.anchoredPosition=Vector2.zero;
            UIKit.GetOrAdd<ContentSizeFitter>(body).verticalFit=ContentSizeFitter.FitMode.PreferredSize;
            var scroll=UIKit.GetOrAdd<ScrollRect>(host);scroll.viewport=viewport;scroll.content=body;scroll.horizontal=false;scroll.movementType=ScrollRect.MovementType.Clamped;scroll.scrollSensitivity=36;
            UIKit.GetOrAdd<HubCurrentHomeCard>(host).Content=body;return body;
        }
        static void HomeRule(Transform parent,float y)
        {var line=Area(parent,"base-home-facts-border",new Vector2(0,y),new Vector2(1,y),Vector2.zero,new Vector2(0,1));line.gameObject.AddComponent<Image>().color=Theme.HexA("#D2E3E3",.18f);UIKit.GetOrAdd<LayoutElement>(line).ignoreLayout=true;}
        static void HomeService(Transform parent,string caption,Action clicked)
        {var b=Command(parent,caption,clicked);b.GetComponent<Image>().material=null;var t=b.GetComponentInChildren<Text>();Bounds(b.gameObject,t.preferredWidth+28,51,0,0);}
        void OpenDeparture() => DepartPrepScreen.Open(); // Main departure owner supplies current classchoice → prep → start.
        void Affair(Transform parent,string title,string description,Action action)
        {
            var button=Command(parent,"",action);Bounds(button.gameObject,0,74,1,0);button.GetComponent<LayoutElement>().preferredHeight=-1;
            button.GetComponent<Image>().material=null;button.GetComponent<Image>().color=Theme.HexA("#FFFFFF",7f/255);button.GetComponent<Outline>().effectColor=Color.clear;
            button.GetComponentInChildren<Text>().gameObject.SetActive(false);
            var layout=UIKit.GetOrAdd<HorizontalLayoutGroup>(button);Configure(layout,10,new RectOffset(8,8,12,12),false);layout.childAlignment=TextAnchor.MiddleLeft;
            bool first=title.StartsWith("首次目标");
            if(!first){var icon=UIKit.Image(button.transform,Sdt.Res.Res.HubIcon(title.StartsWith("可扩建")?"upgrade":title.StartsWith("可孵化")?"pets":"ach"));icon.preserveAspect=true;icon.color=Accent;Bounds(icon.gameObject,32,30);}
            var copy=Column(button.transform,"base-home-affair-copy",5,null,false);Label(copy,title,first?23:22,true);Label(copy,description,first?21:19,false,Ink("#BCC8CA"));
            var arrow=Label(button.transform,"›",26,false,Accent);Bounds(arrow.gameObject,16,34,0,0);arrow.alignment=TextAnchor.MiddleRight;
        }
        void Log(string text,string tone) => G.Bus.Emit(new ToastRequested {Text=text,Tone=tone});
    }

    // ============================================================
    // 仓库物品弹窗（openStashItem：文案照抄）
    // ============================================================
    public sealed class StashItemModal : Panel
    {
        public void Setup(int index)
        {
            var current=GameRuntime.I.Base;
            if(index>=0&&index<current.stash.Count)HubScreen.HubInventoryCardScreen.Open(current.stash[index].card,()=>HubScreen.Open("stash"));
            Close();
        }
        public override void Build() { }

        internal static GameObject MakeCard(Transform parent, string title)
        {
            var overlay = UIKit.Panel("overlay", parent);
            var dim = overlay.AddComponent<Image>();
            dim.color = Theme.HexA("#000000", 0.55f);
            var cardGo = new GameObject("card", typeof(RectTransform));
            cardGo.transform.SetParent(overlay.transform, false);
            var crt = (RectTransform)cardGo.transform;
            crt.anchorMin = crt.anchorMax = new Vector2(0.5f, 0.5f);
            crt.sizeDelta = new Vector2(640, 480);
            var img = cardGo.AddComponent<Image>();
            img.color = Theme.HexA("#112530", 0.97f);
            var outl = cardGo.AddComponent<Outline>(); outl.effectColor = Theme.Line; outl.effectDistance = new Vector2(2, -2);
            var vl = cardGo.AddComponent<VerticalLayoutGroup>();
            vl.spacing = 8; vl.padding = new RectOffset(24, 24, 20, 20);
            vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            var h2 = UIKit.IconText(cardGo.transform, title);
            h2.fontSize = 24; h2.fontStyle = FontStyle.Bold; h2.color = Theme.Txt;
            h2.gameObject.AddComponent<LayoutElement>().minHeight = 34;
            return cardGo;
        }

        internal static void MakeRow(GameObject card, Action<GameObject> fill)
        {
            var btns = UIKit.Row(card.transform);
            var hl = btns.AddComponent<HorizontalLayoutGroup>();
            hl.spacing = 10; hl.childAlignment = TextAnchor.MiddleRight;
            hl.childForceExpandWidth = false; hl.childForceExpandHeight = false;
            fill(btns);
        }
    }

    // ============================================================
    // 物资卖出弹窗（openRawItem：文案照抄）
    // ============================================================
    public sealed class RawItemModal : Panel
    {
        string _kind;
        public void Setup(string kind) { _kind = kind; Rebuild(); }

        public override void Build()
        {
            var B = GameRuntime.I.Base;
            var item = _kind == "wood" ? MapData.Items["wood"] : MapData.Items["rations"];
            int have = _kind == "wood" ? B.wood : B.rations;
            var card = StashItemModal.MakeCard(transform, "[[icon:archive]] " + item.name);
            var stats = UIKit.Label(card.transform,
                $"储备 <b>{have}</b> 个 · 收购价 <color=#{ColorUtility.ToHtmlStringRGB(Theme.Gold)}><b>{item.value} 币</b></color>/个", 15, Theme.Txt);
            stats.gameObject.AddComponent<LayoutElement>().minHeight = 26;
            var note = UIKit.Label(card.transform,
                (_kind == "wood" ? "木材用于扩建背包与仓库容量" : "口粮用于升级宠物安全格") + "——卖出后不可买回，确定吗？", 14, Theme.Sub);
            note.gameObject.AddComponent<LayoutElement>().minHeight = 36;

            StashItemModal.MakeRow(card, r =>
            {
                var one = UIKit.BtnOk(r, $"[[icon:coin]] 卖出 1 个（+{item.value}）", () => Sell(false));
                one.interactable = have >= 1;
                var all = UIKit.Btn(r, $"[[icon:coin]] 全部卖出（+{item.value * have}）", () => Sell(true));
                all.interactable = have >= 2;
            });
            StashItemModal.MakeRow(card, r => UIKit.Btn(r, "↩ 返回仓库", () => { Close(); HubScreen.Open("stash"); }));
        }

        void Sell(bool all)
        {
            var res = GameRuntime.I.Base.SellRaw(_kind, all);
            if (res.ok) { AudioService.I.PlaySfx("ding"); GameRuntime.I.Bus.Emit(new ToastRequested { Text = res.msg, Tone = "coin" }); }
            Close(); HubScreen.Open("stash");
        }
    }
}
