using System.Linq;
using UnityEngine;
using Sdt.Core.Battle;
using Sdt.Core;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;

namespace Sdt.UI.Screens.Battle
{
    public partial class BattleScreen
    {
        BattlePresentationQueue _presentation;
        readonly System.Collections.Generic.List<UnitMount> _allyViews=new System.Collections.Generic.List<UnitMount>();
        internal BattleUnitFrames ActorFrames => _self?.Frames;
        internal bool PresentationBusy => _presentation?.Busy == true;
        RectTransform _automaticCardRoot;
        GameObject _automaticCardFace;
        string _automaticCardSignature;
        internal void PresentAutomaticCard(CardDef card)
        {
            if(_automaticCardRoot==null)
            {
                _automaticCardRoot=new GameObject("automatic-card",typeof(RectTransform),typeof(CanvasGroup)).GetComponent<RectTransform>();
                _automaticCardRoot.SetParent(_fxLayer,false);
                _automaticCardRoot.anchorMin=_automaticCardRoot.anchorMax=new Vector2(.48f,.64f);
                _automaticCardRoot.sizeDelta=new Vector2(248,350);
                var group=_automaticCardRoot.GetComponent<CanvasGroup>();group.blocksRaycasts=false;group.interactable=false;
                var caption=UIKit.Label(_automaticCardRoot,"自动施放",18,UiPalette.AkMint);
                caption.name="automatic-card-caption";caption.alignment=TextAnchor.MiddleCenter;
                caption.rectTransform.anchorMin=caption.rectTransform.anchorMax=new Vector2(.5f,1);
                caption.rectTransform.pivot=new Vector2(.5f,1);caption.rectTransform.anchoredPosition=Vector2.zero;caption.rectTransform.sizeDelta=new Vector2(248,34);
            }
            string signature=Sdt.Run.SaveJson.Stringify(card)+"|cost:"+CardVisual.Cost(card,null)+"|base:"+card._baseCost;
            if(_automaticCardSignature!=signature)
            {
                if(_automaticCardFace!=null){_automaticCardFace.SetActive(false);Destroy(_automaticCardFace);}
                _automaticCardFace=CardFace.Create(card,CardSize.Lg,_automaticCardRoot,options:new CardFaceOptions{ScrollDescription=false});
                var face=(RectTransform)_automaticCardFace.transform;face.anchorMin=face.anchorMax=new Vector2(.5f,0);face.pivot=new Vector2(.5f,0);face.anchoredPosition=Vector2.zero;
                _automaticCardSignature=signature;
            }
            _automaticCardRoot.gameObject.SetActive(true);_automaticCardRoot.SetAsLastSibling();
        }
        internal void HideAutomaticCard(){if(_automaticCardRoot!=null)_automaticCardRoot.gameObject.SetActive(false);}
        internal void ReleaseAutomaticCard()
        {
            if(_automaticCardRoot!=null){_automaticCardRoot.gameObject.SetActive(false);Destroy(_automaticCardRoot.gameObject);}
            _automaticCardRoot=null;_automaticCardFace=null;_automaticCardSignature=null;
        }
        internal void CompletePresentationSnapshot(BattleSnapshot snapshot)
        {
            if (snapshot.BattleToken != GameSnapshotRef.Current?.BattleToken) return;
            BuildStage(snapshot); UpdateSubpages(snapshot);
        }
        void DrainPresentationFloats()
        {
            var floats = BattleView.Api?.TakeFloats();
            if (floats == null) return;
            _presentation.AppendFeedback(floats.Where(f=>f.PresentationSequence==0).Select(f=>
                new BattleFloat { unit=f.IsSelf?(object)"self":f.Unit,text=f.Text,cls=f.Cls,warm=f.Warm }).ToArray());
        }
        internal void PresentResolvedHit(BattleActorCue beat)
        {
            if(beat.Kind=="hit")CurrentBattleSoundPolicy.PlayHit(beat);
            UnitMount view = beat.AllyIndex>=0&&beat.AllyIndex<_allyViews.Count?_allyViews[beat.AllyIndex]:beat.IsSelf ? _self : beat.Unit >= 0 && beat.Unit < _foeRoots.Count
                ? _units.Values.FirstOrDefault(v=>v.Root==_foeRoots[beat.Unit]) : null;
            view?.PresentHealth(beat.HpAfter,beat.MaxHp,beat.DefenseAfter,beat.Dead && !beat.IsSelf);
            if((beat.Feedback==null||beat.Feedback.Count==0)&&beat.HpAfter<beat.HpBefore)
            {
                if(beat.IsSelf) ActorFrames?.Play("hurt");
                else if(view!=null) BattleHitFx.Play(view.Figure,false,false);
                if (view != null) BattleArtFx.Spawn(_fxLayer,ArtPoint(view.Figure,beat.IsSelf),beat.IsSelf ? "slash" : "pulse",145,440);
            }
            if (beat.Feedback != null) PresentFloats(beat.Feedback.Select(f=>new FloatSpec {
                Unit=f.unit is int index?index:-1, IsSelf=f.unit is string key&&key=="self", Text=f.text,Cls=f.cls,Warm=f.warm }),beat.Kind=="hit"?beat:null);
        }
        internal void PresentEnemyAttack(int index)
        {
            if (index<0 || index>=_foeFigures.Count || Sdt.UI.Kit.CurrentUiPreferences.ReducedMotion) return;
            string id=GameSnapshotRef.Current?.Foes[index].Id;
            BattleEnemyFrameMotion.Play(_foeFigures[index],id,"attack");
        }
    }
}
