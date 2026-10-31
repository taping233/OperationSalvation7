using System.Linq;
using UnityEngine;
using Sdt.Core.Battle;

namespace Sdt.UI.Screens.Battle
{
    public partial class BattleScreen
    {
        BattlePresentationQueue _presentation;
        readonly System.Collections.Generic.List<UnitMount> _allyViews=new System.Collections.Generic.List<UnitMount>();
        internal BattleUnitFrames ActorFrames => _self?.Frames;
        internal bool PresentationBusy => _presentation?.Busy == true;
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
            UnitMount view = beat.AllyIndex>=0&&beat.AllyIndex<_allyViews.Count?_allyViews[beat.AllyIndex]:beat.IsSelf ? _self : beat.Unit >= 0 && beat.Unit < _foeRoots.Count
                ? _units.Values.FirstOrDefault(v=>v.Root==_foeRoots[beat.Unit]) : null;
            view?.PresentHealth(beat.HpAfter,beat.MaxHp,beat.DefenseAfter,beat.Dead && !beat.IsSelf);
            if((beat.Feedback==null||beat.Feedback.Count==0)&&beat.HpAfter<beat.HpBefore)
            {
                if(beat.IsSelf) ActorFrames?.Play("hurt");
                else if(view!=null) BattleHitFx.Play(view.Figure,false,false);
            }
            if (beat.Feedback != null) PresentFloats(beat.Feedback.Select(f=>new FloatSpec {
                Unit=f.unit is int index?index:-1, IsSelf=f.unit is string key&&key=="self", Text=f.text,Cls=f.cls,Warm=f.warm }));
        }
        internal void PresentEnemyAttack(int index)
        {
            if (index<0 || index>=_foeFigures.Count || Sdt.UI.Kit.CurrentUiPreferences.ReducedMotion) return;
            string id=GameSnapshotRef.Current?.Foes[index].Id;
            BattleEnemyFrameMotion.Play(_foeFigures[index],id,"attack");
        }
    }
}
