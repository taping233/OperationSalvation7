// Mounted on the permanent player figure; snapshots and settings do not recreate the actor.
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Sdt.Res;
using Sdt.Core.Battle;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Battle
{
    public sealed class BattleUnitFrames : MonoBehaviour
    {
        CurrentUnitFrames.Lease _lease;
        readonly Dictionary<string, UnitFrameAction> _available = new Dictionary<string, UnitFrameAction>();
        BattleActorClock _clock;
        Image _image;
        BattleScreen _owner;
        string _token, _painted;
        bool _focused = true, _closed;
        double _hold, _nextPaint;
        public string Role => _lease?.Catalog.id;
        public string CurrentAction => _clock?.Action;
        public string CurrentFrame => _clock?.Frame;
        public int FrameIndex => _clock?.Index ?? 0;
        public bool DeathComplete => _clock?.DeathComplete == true && _painted == _clock.Frame;
        public bool Running => _clock?.Running == true;
        public double? ImpactRemaining => _clock?.ImpactRemaining(Catalog?.contactFrame);
        public bool IsPaused => !_focused || UiStack.Top != _owner;
        public UnitFrameCatalog Catalog => _lease?.Catalog;

        public bool Bind(BattleScreen owner, Image image, string role, string token)
        {
            role = CurrentUnitFrames.Find(role)?.id ?? role;
            if (!_closed && _lease != null && Role == role && _token == token) return true;
            Release(); _closed = false; _owner = owner; _image = image; _token = token;
            _lease = CurrentUnitFrames.Acquire(role);
            if (_lease == null) return false;
            var idle = Timeline("idle");
            if (idle == null) { Release(); return false; }
            _clock = new BattleActorClock(); _clock.Play(idle); Paint();
            return true;
        }
        UnitFrameAction Timeline(string action)
        {
            if (_available.TryGetValue(action, out var cached)) return cached;
            var source = _lease?.Catalog.Find(action);
            if (source == null) return null;
            var frames = new List<string>(); var times = new List<float>();
            // Keep repeated timeline slots and their original time steps. Failed frames are skipped as in source.
            int count = action == "idle" ? 1 : source.frames.Length;
            for (int i = 0; i < count; i++)
                if (_lease.Frame(source.frames[i]) != null) { frames.Add(source.frames[i]); times.Add(source.milliseconds[i]); }
            if (frames.Count == 0) return null;
            cached = new UnitFrameAction { name = action, frames = frames.ToArray(), milliseconds = times.ToArray(), loop = source.loop, hold = source.hold };
            _available[action] = cached; return cached;
        }
        public bool Play(string action, bool continueActive = false)
        {
            if (_closed || _clock == null || IsPaused || (CurrentUiPreferences.ReducedMotion && action != "death")) return false;
            if (CurrentUiPreferences.ReducedMotion && action == "death") return false;
            bool played = _clock.Play(Timeline(action), CurrentUiPreferences.BattlePace, continueActive);
            if (played) Paint(true);
            return played;
        }
        public bool Hurt(FloatSpec feedback)
        {
            string cls = feedback.Cls ?? "";
            return feedback.IsSelf && !feedback.Warm && !cls.Contains("stk") && !cls.Contains("block")
                && !cls.Contains("windupfx") && Play("hurt");
        }
        public void Hold(double milliseconds) { _hold=Math.Max(_hold,milliseconds); }
        void Update()
        {
            if (_closed || _clock == null || IsPaused) return;
            if (_hold>0) { _hold=Math.Max(0,_hold-Time.unscaledDeltaTime*1000d); return; }
            if (CurrentUiPreferences.ReducedMotion)
            {
                if (_clock.Dying) { _clock.Finish(); Paint(true); }
                else { _clock.Play(Timeline("idle")); Paint(true); }
                return;
            }
            _clock.Advance(Time.unscaledDeltaTime * 1000d, Timeline("idle")); Paint();
        }
        void Paint(bool force = false)
        {
            if (_image == null || _clock?.Frame == null || _painted == _clock.Frame) return;
            var sprite = _lease.Frame(_clock.Frame); if (sprite == null) return;
            double now=Time.unscaledTimeAsDouble,interval=1d/Math.Min(60,CurrentUiPreferences.FrameLimit);
            if(!force&&now<_nextPaint-.0005)return;
            _nextPaint=now+interval;
            _image.sprite = sprite; _painted = _clock.Frame;
            _image.preserveAspect = false;
            var rt = _image.rectTransform;
            float height = Catalog.FigureHeight;
            BattleScreen.Fixed(rt, new Vector2(.5f, 0), new Vector2(.5f, 0), Vector2.zero,
                new Vector2(height * Catalog.width / Catalog.height, height));
        }
        void OnApplicationPause(bool paused) { _focused = !paused; }
        public void Release()
        {
            if (_image != null && _lease != null) _image.sprite = null;
            _lease?.Dispose(); _lease = null; _available.Clear(); _clock = null; _painted = null;
            _nextPaint=0;_closed = true;
        }
        void OnDestroy() { Release(); }
    }
}
