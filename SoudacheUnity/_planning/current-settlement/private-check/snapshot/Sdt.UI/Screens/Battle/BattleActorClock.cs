// Pure presentation clock mirroring battle.frames.js buildTimeline/play/advance.
using System;
using Sdt.Res;

namespace Sdt.UI.Screens.Battle
{
    public sealed class BattleActorClock
    {
        UnitFrameAction _timeline;
        double _remaining;
        float _pace = 1;
        public string Action { get; private set; } = "idle";
        public int Index { get; private set; }
        public bool Dying { get; private set; }
        public bool Running { get; private set; }
        public bool DeathComplete => Dying && !Running;
        public string Frame => _timeline?.frames[Index];
        public bool Play(UnitFrameAction timeline, float pace = 1, bool continueActive = false)
        {
            if (timeline?.frames == null || timeline.frames.Length == 0 || Dying) return false;
            if (continueActive && Running && Action == timeline.name && !_timeline.loop) return true;
            _timeline = timeline; Action = timeline.name; Index = 0;
            _pace = Action == "idle" ? 1 : Math.Max(.01f, pace);
            Dying = Action == "death";
            // The current source overrides the catalog's breathing loop: idle holds its first frame.
            Running = Action != "idle";
            _remaining = timeline.milliseconds[0] / _pace;
            return true;
        }
        public void Advance(double milliseconds, UnitFrameAction idle)
        {
            if (!Running || milliseconds <= 0) return;
            _remaining -= milliseconds;
            while (Running && _remaining <= 0)
            {
                if (++Index == _timeline.frames.Length)
                {
                    if (_timeline.hold) { Index--; Running = false; return; }
                    if (_timeline.loop) Index = 0;
                    else { Play(idle); return; }
                }
                _remaining += _timeline.milliseconds[Index] / _pace;
            }
        }
        public double? ImpactRemaining(string contactFrame)
        {
            if (_timeline == null || _timeline.frames.Length < 2 || !Running) return null;
            int contact = Array.IndexOf(_timeline.frames, contactFrame);
            if (contact < 0) return null;
            if (Index >= contact) return 0;
            double remaining = _remaining;
            for (int i = Index + 1; i < contact; i++) remaining += _timeline.milliseconds[i] / _pace;
            return Math.Max(0, remaining);
        }
        public void Finish()
        { if(_timeline==null)return;Index=_timeline.frames.Length-1;Running=false; }
    }
}
