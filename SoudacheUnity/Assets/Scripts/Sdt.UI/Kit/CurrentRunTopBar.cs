// Current run-top-bar.js/css: a retained transparent physical header across map, battle and illustrated rooms.
using System;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Run;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Battle;

namespace Sdt.UI.Kit
{
    public sealed class CurrentRunTopBar : MonoBehaviour
    {
        Text _health, _chapter, _coins, _attack, _save, _detailTitle, _detailCopy;
        RectTransform _resources, _goldButton, _attackButton;
        Image _healthFill, _avatar; Button _options, _retry; CurrentRunControlGlyph _mute;
        GameObject _detail, _saveRoot; string _avatarId, _skinId, _layerName; float _healthWidth = 164; CanvasGroup _visibility;CurrentRunTopShade _shade;
        RectTransform _avatarPosition, _healthPosition;
        int? _hp, _maxHp, _coinCount, _attackValue;
        int _layerIndex = -1, _layerCount = -1;
        bool? _combat;
        static readonly string[] CoverNames = {"BagScreen","BagCardDetail","GuideScreen","CurrentSettingsPage","SettingsScreen","CurrentSettingsShell","HomeSettingsScreen","ShopScreen","ExtractStashScreen","CardZoom","ActionConfirmation","Discover"};
        bool _failed; string _saveMessage;
        public static CurrentRunTopBar Install(Transform root)
        {
            var rt = CurrentRunHudView.Box(root,"runTopBar",0,0,0,104); rt.anchorMax = Vector2.one; rt.anchorMin = new Vector2(0,1); rt.sizeDelta = new Vector2(0,104);
            var bar=UIKit.GetOrAdd<CurrentRunTopBar>(rt); bar.Build(); return bar;
        }
        static CurrentRunControlGlyph Control(Transform parent,string name,string kind,float x,Action action)
        {
            var button=CurrentRunHudView.Button(parent,name,x,16,64,58,action);
            var glyph=UIKit.GetOrAdd<CurrentRunControlGlyph>(CurrentRunHudView.Box(button.transform,"source-glyph",20,17,24,24));
            glyph.Kind=kind;glyph.color=Theme.Hex("#eff4f6");glyph.raycastTarget=false; return glyph;
        }
        void Build()
        {
            _visibility=UIKit.GetOrAdd<CanvasGroup>(this);
            var shadeRect=CurrentRunHudView.Box(transform,"illustrated-header-shade",0,0,0,104);shadeRect.anchorMax=new Vector2(1,1);
            _shade=UIKit.GetOrAdd<CurrentRunTopShade>(shadeRect);_shade.raycastTarget=false;
            Control(transform,"btnHome","back",18,()=>{
                if(UiStack.Top!=null&&(UiStack.Top is Sdt.UI.Screens.Run.NodeShellPanel || UiStack.Top is Sdt.UI.Screens.Run.ChestOpenScreen)&&UiStack.Top.CanCloseWithEscape) UiStack.Top.CloseFromEscape(); else LeaveMenuScreen.Open();
            });
            _mute=Control(transform,"btnMute","sound",94,()=>AudioService.I.Mute(!AudioService.I.Muted));
            var settings=Control(transform,"btnBattleOptions","settings",170,BattleScreen.OpenBattleSettings); _options=settings.transform.parent.GetComponent<Button>();
            var avatar=CurrentRunHudView.Button(transform,"heroAva",178,16,58,58,()=>ShowDetail("角色",Sdt.Core.CharacterTable.Name(GameRuntime.I.State.characterId)+" · "+GameRuntime.I.State.myClass));
            _avatar=CurrentRunHudView.Art(avatar.transform,"heroAvatar",null,0,0,58,58);
            _avatarPosition=(RectTransform)avatar.transform;
            var hp=CurrentRunHudView.Box(transform,"hpHud",250,16,164,58);
            _healthPosition=hp;
            CurrentRunHudView.Text(hp,"map-health-heading","生命值",0,0,164,14,13,"#aebfc9");
            _health=CurrentRunHudView.Text(hp,"hpText","",0,18,164,28,26,"#eff4f6",true);
            CurrentRunHudView.Fill(hp,"hpBarWrap",0,54,164,4,"#334946"); _healthFill=CurrentRunHudView.Fill(hp,"hpBar",0,54,164,4,"#91b5b0");
            var location=CurrentRunHudView.Box(transform,"expeditionChapter",0,16,420,58,new Vector2(.5f,1),new Vector2(.5f,1));
            _chapter=CurrentRunHudView.Text(location,"chapter-name","",0,0,420,58,22);_chapter.alignment=TextAnchor.MiddleCenter;
            var resources=CurrentRunHudView.Box(transform,"resHud",-24,20,310,64,new Vector2(1,1),new Vector2(1,1));
            _resources=resources;
            var gold=CurrentRunHudView.Button(resources,"run-gold",0,0,170,64,()=>ShowDetail("金币","当前持有 "+GameRuntime.I.State.coins+" 币，可用于商店交易。"));
            _goldButton=(RectTransform)gold.transform;
            CurrentRunHudView.Art(gold.transform,"coin",Sdt.Res.CurrentRunHudAssets.Tool("gold"),0,-16,96,96);_coins=CurrentRunHudView.Text(gold.transform,"goldText","",106,0,64,64,31,"#f4e2a5",true);
            var attack=CurrentRunHudView.Button(resources,"run-attack",190,0,120,64,()=>ShowDetail("攻击力","当前攻击 "+_attack.text+"。攻击伤害按卡牌数值加攻击力结算；战斗临时加成与减益见状态栏。"));
            _attackButton=(RectTransform)attack.transform;
            CurrentRunHudView.Art(attack.transform,"swords",Sdt.Res.CurrentRunHudAssets.Tool("attack"),0,0,64,64);_attack=CurrentRunHudView.Text(attack.transform,"charAtk","",74,0,46,64,31,"#ff8d7e",true);
            _coins.horizontalOverflow=_attack.horizontalOverflow=HorizontalWrapMode.Overflow;
            _saveRoot=CurrentRunHudView.Box(transform,"save-status",-24,104,320,28,new Vector2(1,1),new Vector2(1,1)).gameObject;
            _save=CurrentRunHudView.Text(_saveRoot.transform,"save-label","",0,0,220,28,12,"#ed9a86");_save.alignment=TextAnchor.MiddleRight;
            _retry=CurrentRunHudView.Button(_saveRoot.transform,"save-retry",230,0,90,28,()=>{_saveMessage="保存中…";RefreshSave();GameRuntime.I.SaveCurrent();});
            CurrentRunHudView.Text(_retry.transform,"label","重试保存",0,0,90,28,12);
            _detail=CurrentRunHudView.Box(transform,"run-top-detail",0,114,380,200,new Vector2(.5f,1),new Vector2(.5f,1)).gameObject;
            UIKit.GetOrAdd<Image>(_detail).color=Theme.Hex("#182c36");
            _detailTitle=CurrentRunHudView.Text(_detail.transform,"detail-title","",20,14,340,30,20);
            _detailCopy=CurrentRunHudView.Text(_detail.transform,"detail-copy","",20,54,340,90,15);
            var close=CurrentRunHudView.Button(_detail.transform,"detail-close",20,150,90,36,CloseDetail);CurrentRunHudView.Text(close.transform,"label","关闭",0,0,90,36,15);
            _detail.SetActive(false); RefreshSave();
            GameRuntime.I.Bus.On<SaveCompleted>(_=>{_failed=false;_saveMessage=null;RefreshSave();});
        }
        void RefreshSave() { _saveRoot.SetActive(_failed||_saveMessage!=null); _save.text=_saveMessage??"保存失败";_retry.gameObject.SetActive(_failed); }
        public void SaveFailed(string message) { _failed=true;_saveMessage=message;RefreshSave(); }
        public bool CloseDetailIfOpen() { if(!_detail.activeSelf)return false;CloseDetail();return true; }
        void CloseDetail()=>_detail.SetActive(false);
        void ShowDetail(string title,string text) { _detailTitle.text=title;_detailCopy.text=text;_detail.SetActive(true); }
        static bool Covers(Panel panel)
        {
            if(panel==null)return false;
            string name=panel.GetType().Name;
            foreach(string covered in CoverNames)if(name.Contains(covered))return true;
            return panel.GetComponentInChildren<CurrentSettingsPage>(true)!=null;
        }
        public static bool Covered()
        {
            for(int i=0;i<UiStack.Count;i++)if(Covers(UiStack.PanelAt(i)))return true;
            return false;
        }
        public static bool Visible=>GameRuntime.I.State.runActive&&!Covered();
        void Update()
        {
            var runtime=GameRuntime.I; bool covered=false,illustrated=false,reward=false;
            for(int i=0;i<UiStack.Count;i++)
            {
                var panel=UiStack.PanelAt(i);if(panel==null)continue;
                covered|=Covers(panel);
                illustrated|=panel.GetComponentInChildren<Sdt.UI.Screens.Run.CurrentIllustratedNode>()!=null;
                reward|=panel.GetComponentInChildren<Sdt.UI.Screens.Run.CurrentRewardScene>()!=null;
            }
            bool visible=runtime.State.runActive&&!covered;
            _visibility.alpha=visible?1:0;_visibility.interactable=_visibility.blocksRaycasts=visible;
            if(_shade.gameObject.activeSelf!=illustrated)_shade.gameObject.SetActive(illustrated);
            if(_chapter.transform.parent.gameObject.activeSelf==reward)_chapter.transform.parent.gameObject.SetActive(!reward);
            if(!visible){CloseDetail();return;}
            var s=runtime.State;var battle=s.battleActive?GameSnapshotRef.Current:null;
            bool combat=battle?.Player!=null;
            if(_combat!=combat)
            {
                _combat=combat;_options.gameObject.SetActive(combat);
                float personX=combat?254:178;_avatarPosition.anchoredPosition=new Vector2(personX,-16);_healthPosition.anchoredPosition=new Vector2(personX+72,-16);
            }
            string skin=runtime.Base.SelectedSkin(s.characterId);
            if(s.characterId!=_avatarId||skin!=_skinId){_avatarId=s.characterId;_skinId=skin;_avatar.sprite=Sdt.Res.Res.Avatar(s.characterId);}
            int hp=combat?battle.Player.Hp:s.hp,max=combat?battle.Player.MaxHp:s.maxHp,atk=combat?battle.Player.Atk:s.atk;
            if(combat&&battle.Pstat?.Status!=null&&battle.Pstat.Status.TryGetValue("atkUp",out var bonus))atk+=bonus;
            if(_hp!=hp||_maxHp!=max){_hp=hp;_maxHp=max;_health.text=hp+" / "+max;}
            if(_coinCount!=s.coins||_attackValue!=atk)
            {
                _coinCount=s.coins;_attackValue=atk;_coins.text=s.coins.ToString();_attack.text=atk.ToString();
                // Source resHud is a flex row: numeric children expand without splitting digits.
                float coinExtra=Mathf.Max(0,Mathf.Ceil(_coins.preferredWidth)-64),attackExtra=Mathf.Max(0,Mathf.Ceil(_attack.preferredWidth)-46);
                _resources.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,310+coinExtra+attackExtra);
                _goldButton.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,170+coinExtra);
                _attackButton.anchoredPosition=new Vector2(190+coinExtra,0);_attackButton.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,120+attackExtra);
                _coins.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,64+coinExtra);_attack.rectTransform.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal,46+attackExtra);
            }
            float width=164*Mathf.Clamp01((float)hp/Math.Max(1,max));_healthWidth=CurrentUiPreferences.ReducedMotion?width:Mathf.MoveTowards(_healthWidth,width,Time.unscaledDeltaTime*630);
            if(_healthFill.rectTransform.sizeDelta.x!=_healthWidth)_healthFill.rectTransform.sizeDelta=new Vector2(_healthWidth,4);
            var layers=runtime.Map?.Layers;string layer=layers!=null&&s.layerIdx<layers.Count?layers[s.layerIdx]:"第 "+(s.layerIdx+1)+" 层";
            int count=layers?.Count??4;
            if(_layerName!=layer||_layerIndex!=s.layerIdx||_layerCount!=count)
            {
                _layerName=layer;_layerIndex=s.layerIdx;_layerCount=count;
                _chapter.text="<b>"+CurrentRunHudView.AreaName(layer)+"</b>  <size=14>第 "+(s.layerIdx+1)+" 层 / "+count+"</size>";
            }
            _mute.SetKind(AudioService.I.Muted?"muted":"sound");
            if(_detail.activeSelf&&Input.GetMouseButtonDown(0)&&!RectTransformUtility.RectangleContainsScreenPoint((RectTransform)_detail.transform,Input.mousePosition))CloseDetail();
        }
    }
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class CurrentRunTopShade : MaskableGraphic
    {
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();var r=GetPixelAdjustedRect();float middle=r.yMax-r.height*.65f;
            Strip(vh,r.xMin,r.xMax,r.yMax,middle,.93f,.85f);Strip(vh,r.xMin,r.xMax,middle,r.yMin,.85f,0);
        }
        static void Strip(VertexHelper vh,float left,float right,float top,float bottom,float a,float b)
        {
            int i=vh.currentVertCount;vh.AddVert(new Vector2(left,top),new Color(.031f,.059f,.098f,a),Vector2.zero);vh.AddVert(new Vector2(right,top),new Color(.031f,.059f,.098f,a),Vector2.zero);
            vh.AddVert(new Vector2(right,bottom),new Color(.031f,.059f,.098f,b),Vector2.zero);vh.AddVert(new Vector2(left,bottom),new Color(.031f,.059f,.098f,b),Vector2.zero);vh.AddTriangle(i,i+1,i+2);vh.AddTriangle(i,i+2,i+3);
        }
    }
}
