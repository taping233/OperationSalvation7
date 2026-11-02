// battle.layers.js makeUnitSkeleton: head, optional player/ally stats, bounded statuses, then passive intention.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Core.Battle;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Battle
{
    public sealed class CurrentBattleNameplate:MonoBehaviour
    {
        RectTransform _unit,_root,_headRoot,_eliteRoot;Text _head,_stats,_intent;CurrentBattleStatuses _statuses;Button _headHit;
        bool _elite;
        string _detailTitle,_detailCopy;
        float _layoutWidth=-1,_layoutHead=-1,_layoutStats=-1,_layoutStatuses=-1,_layoutIntent=-1,_layoutElite=-1,_layoutBase=-1;
        bool _self,_enemy;float _actorHeight=-1,_lastWidth=-1,_lastHeight=-1;BattleScreen _owner;
        public CurrentBattleStatuses Statuses=>_statuses;
        public void Initialize(RectTransform unit,bool self,bool enemy)
        {
            _unit=unit;_root=(RectTransform)transform;_self=self;_enemy=enemy;_owner=unit.GetComponentInParent<BattleScreen>();
            _root.anchorMin=_root.anchorMax=new Vector2(.5f,0);_root.pivot=new Vector2(.5f,0);
            _eliteRoot=BattleScreen.BattleRect("sts-elite",transform);
            var eliteImage=UIKit.GetOrAdd<Image>(_eliteRoot);eliteImage.color=BtColors.HexA("#3B2B16",.96f);eliteImage.raycastTarget=false;
            var eliteText=UIKit.Label(_eliteRoot,"精英",15,BtColors.Hex("#F2CB7D"));eliteText.alignment=TextAnchor.MiddleCenter;eliteText.raycastTarget=false;UiStack.Stretch(eliteText.rectTransform);
            _eliteRoot.gameObject.SetActive(false);
            _headRoot=BattleScreen.BattleRect("sts-headrow",transform);_head=UIKit.Label(_headRoot,"",20,BtColors.Hex("#f2f6f8"));_head.alignment=TextAnchor.MiddleCenter;UiStack.Stretch(_head.rectTransform);
            var headImage=UIKit.GetOrAdd<Image>(_headRoot);headImage.color=Color.clear;headImage.raycastTarget=enemy;_headHit=UIKit.GetOrAdd<Button>(_headRoot);_headHit.targetGraphic=headImage;_headHit.transition=Selectable.Transition.None;_headHit.interactable=enemy;
            UIKit.GetOrAdd<BattleHoverInfo>(_headRoot).Setup(ShowDetails);
            _stats=UIKit.IconText(transform,"");_stats.name="sts-stats";_stats.fontSize=20;_stats.alignment=TextAnchor.MiddleCenter;
            var statuses=BattleScreen.BattleRect("sts-chips",transform);_statuses=UIKit.GetOrAdd<CurrentBattleStatuses>(statuses);_statuses.Initialize(!self,_owner);
            _intent=UIKit.IconText(transform,"");_intent.name="sts-intent";_intent.fontSize=24;_intent.alignment=TextAnchor.MiddleCenter;_intent.color=BtColors.Hex("#f0b5a7");
        }
        public static string IntentText(FoeIntent intent,bool frozen,bool dead)
        {
            if(dead)return "";if(frozen)return "[[icon:status-freeze]]";if(intent==null)return "";
            return intent.Icon+(intent.HasDamage?" "+Math.Max(0,intent.Damage)+(intent.hits>1?"×"+intent.hits:""):"");
        }
        public static string IntentDescription(FoeIntent intent,bool frozen,bool dead)
        {
            if(dead)return "已退场";if(frozen)return "冰冻·无法行动";if(intent==null)return "";
            return intent.Label+(intent.HasDamage?" · "+Math.Max(0,intent.Damage)+(intent.hits>1?" ×"+intent.hits+"（共"+Math.Max(0,intent.Damage)*intent.hits+"）":""):"")+(intent.bleedBonus>0?" · 流血 "+intent.bleedBonus+" 层":"");
        }
        public void Sync(string name,string stats,IReadOnlyList<StatusChip> chips,FoeIntent intent,bool dead,IReadOnlyDictionary<string,int> sourceStatus=null,IReadOnlyList<BattlePlayerEffect> playerEffects=null)
        {
            _head.text=_self?"":name;_headRoot.gameObject.SetActive(!_self&&!string.IsNullOrWhiteSpace(name));
            _stats.text=_enemy?"":stats;_stats.gameObject.SetActive(!_enemy&&!string.IsNullOrWhiteSpace(stats));
            var statuses=sourceStatus!=null||playerEffects!=null?CurrentBattleStatusModel.Project(sourceStatus,playerEffects):CurrentBattleStatusModel.Legacy(chips);
            _statuses.Sync(dead?Array.Empty<CurrentBattleStatus>():statuses);
            bool frozen=sourceStatus!=null?sourceStatus.TryGetValue("freeze",out var turns)&&turns>0:statuses.Any(c=>c.Key=="curse:freeze");
            _intent.text=_enemy?IntentText(intent,frozen,dead):"";_intent.gameObject.SetActive(!string.IsNullOrEmpty(_intent.text));
            SetDetails(name,IntentDescription(intent,frozen,dead));Layout();
        }
        public void SetDetails(string title,string detail){_detailTitle=title;_detailCopy=detail;}
        void ShowDetails(){if(_owner!=null)BattleReadout.Show(_owner.transform,_detailTitle,_detailCopy);}
        public void SetElite(bool elite)
        {
            elite=elite&&_enemy;
            if(_elite==elite)return;
            _elite=elite;_eliteRoot.gameObject.SetActive(elite);
            _head.color=elite?BtColors.Hex("#F2CB7D"):BtColors.Hex("#f2f6f8");
            Layout();
        }
        public void SetActorHeight(float height){_actorHeight=height;Layout();}
        public void PresentDead(bool dead){if(!dead)return;_statuses.Sync(Array.Empty<CurrentBattleStatus>());_intent.gameObject.SetActive(false);Layout();}
        void Area(RectTransform rect,float top,float width,float height)
        {rect.anchorMin=rect.anchorMax=new Vector2(.5f,1);rect.pivot=new Vector2(.5f,1);rect.anchoredPosition=new Vector2(0,-top);rect.sizeDelta=new Vector2(width,height);}
        void Layout()
        {
            if(_unit==null)return;float width=_self?290:_enemy?Mathf.Min(290,Mathf.Max(80,_unit.rect.width+16)):190;
            if(_enemy&&_owner!=null&&GameSnapshotRef.Current?.Foes.Count>=3)width=Mathf.Min(250,width);
            if(_headRoot.sizeDelta.x!=width)_headRoot.sizeDelta=new Vector2(width,_headRoot.sizeDelta.y);
            if(_stats.rectTransform.sizeDelta.x!=width)_stats.rectTransform.sizeDelta=new Vector2(width,_stats.rectTransform.sizeDelta.y);
            float head=_headRoot.gameObject.activeSelf?Mathf.Max(25,_head.preferredHeight):0;
            float stats=_stats.gameObject.activeSelf?Mathf.Max(26,_stats.preferredHeight):0;
            float statuses=_statuses.Count>0?_statuses.RegionHeight:0,intent=_intent.gameObject.activeSelf?44:0,elite=_elite?22:0;
            float baseY=(_self&&_actorHeight>0?_actorHeight:_unit.rect.height)+(_self?18:20);
            _lastWidth=_unit.rect.width;_lastHeight=_unit.rect.height;
            if(_layoutWidth==width&&_layoutHead==head&&_layoutStats==stats&&_layoutStatuses==statuses&&_layoutIntent==intent&&_layoutElite==elite&&_layoutBase==baseY)return;
            _layoutWidth=width;_layoutHead=head;_layoutStats=stats;_layoutStatuses=statuses;_layoutIntent=intent;_layoutElite=elite;_layoutBase=baseY;
            float total=0;if(elite>0)total+=elite+6;if(head>0)total+=head+6;if(stats>0)total+=stats+6;if(statuses>0)total+=statuses+6;if(intent>0)total+=intent+6;
            _root.sizeDelta=new Vector2(width,Mathf.Max(0,total-6));_root.anchoredPosition=new Vector2(0,baseY);float y=0;
            if(elite>0){Area(_eliteRoot,y,58,elite);y+=elite+6;}
            if(head>0){Area(_headRoot,y,width,head);y+=head+6;}
            if(stats>0){Area(_stats.rectTransform,y,width,stats);y+=stats+6;}
            if(statuses>0){Area((RectTransform)_statuses.transform,y,width,statuses);y+=statuses+6;}
            if(intent>0)Area(_intent.rectTransform,y,width,intent);
        }
        void LateUpdate(){if(_unit!=null&&(_unit.rect.width!=_lastWidth||_unit.rect.height!=_lastHeight))Layout();}
    }
}
