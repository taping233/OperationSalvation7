// Read-only resolved beats from Core. This owns presentation waits; rules never run here.
using System;
using System.Collections.Generic;
using UnityEngine;
using Sdt.Core.Battle;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Battle
{
    public sealed class BattlePresentationQueue : MonoBehaviour
    {
        readonly Queue<BattleActorCue> _beats = new Queue<BattleActorCue>();
        BattleScreen _owner;
        string _token;
        double _delay;
        BattleSnapshot _latest;
        Action _complete;
        bool _closed;
        bool _frameSynced;
        BattleActorCue _pendingHit;
        bool _applicationPaused;
        long _lastSequence;
        public bool Busy => _beats.Count > 0 || _delay > 0 || _complete != null || _pendingHit!=null;
        public int PendingBeats => _beats.Count;
        public void Init(BattleScreen owner) { _owner = owner; BattleSession.ActorPresentation += Enqueue; }
        public void Bind(string token)
        {
            if (_token == token) return;
            _beats.Clear(); _delay = 0; _latest = null; _complete = null; _token = token;
            _pendingHit=null;_frameSynced=false;_lastSequence=0;
        }
        void Enqueue(BattleActorCue cue)
        {
            if (_closed || cue.BattleToken != _token) return;
            if(cue.Sequence<=_lastSequence)return;_lastSequence=cue.Sequence;
            _beats.Enqueue(cue);
        }
        public bool Capture(BattleSnapshot snapshot)
        {
            if (!Busy || snapshot.BattleToken != _token) return false;
            _latest = snapshot; return true;
        }
        public bool WaitForResult(bool actualDeath, Action complete)
        {
            if (_closed) return false;
            if (!Busy && _owner.ActorFrames?.Running != true) return false;
            _complete += complete; return true;
        }
        public void AppendFeedback(IReadOnlyList<BattleFloat> feedback)
        {
            if (feedback.Count>0) _beats.Enqueue(new BattleActorCue { BattleToken=_token,Kind="feedback",Feedback=feedback });
        }
        static double Demo(double ms) => BattlePresentationTiming.Demo(ms,CurrentUiPreferences.BattlePace);
        void Update()
        {
            if (_closed || UiStack.Top != _owner || _applicationPaused) return;
            _delay = Math.Max(0, _delay - Time.unscaledDeltaTime * 1000d);
            if (_delay > 0) return;
            if(_pendingHit!=null){var hit=_pendingHit;_pendingHit=null;ApplyHit(hit);if(_delay>0)return;}
            while (_beats.Count > 0 && _delay <= 0)
            {
                var beat = _beats.Dequeue();
                if (beat.BattleToken != _token) continue;
                bool reduced = CurrentUiPreferences.ReducedMotion;
                if (beat.Kind == "windup")
                {
                    bool played = _owner.ActorFrames?.Play(beat.Action, beat.ReplayAttacker) == true;
                    double? impact = played ? _owner.ActorFrames.ImpactRemaining : null;
                    _frameSynced=impact.HasValue;
                    _delay = BattlePresentationTiming.Windup(beat,impact,CurrentUiPreferences.BattlePace,reduced);
                }
                else if (beat.Kind == "enemy-windup")
                {
                    _frameSynced=false;
                    _owner.PresentEnemyAttack(beat.ActorIndex);
                    _delay = reduced ? 0 : Demo(130);
                }
                else if (beat.Kind == "support") _owner.ActorFrames?.Play(beat.Action);
                else if (beat.Kind == "death") _owner.ActorFrames?.Play("death");
                else if (beat.Kind == "wait") _delay = reduced?0:Demo(beat.WindupMs);
                else if (beat.Kind == "hit" || beat.Kind == "feedback")
                {
                    double anticipate=BattlePresentationTiming.Anticipation(_frameSynced,CurrentUiPreferences.BattlePace,reduced);
                    if(anticipate>0&&beat.Kind=="hit") { _pendingHit=beat;_delay=anticipate; }
                    else ApplyHit(beat);
                }
            }
            if (_beats.Count > 0 || _delay > 0) return;
            if (_complete != null && _owner.ActorFrames?.Running == true) return;
            var latest = _latest; _latest = null;
            var complete = _complete; _complete = null;
            if (latest != null) _owner.CompletePresentationSnapshot(latest);
            complete?.Invoke();
        }
        void ApplyHit(BattleActorCue beat)
        {
            _owner.PresentResolvedHit(beat);
            double stop=BattlePresentationTiming.Stop(beat,CurrentUiPreferences.ReducedMotion);
            _owner.ActorFrames?.Hold(stop);
            _delay=stop+BattlePresentationTiming.DeathRelease(beat,CurrentUiPreferences.BattlePace,CurrentUiPreferences.ReducedMotion);
        }
        public void Release()
        {
            if (_closed) return; _closed = true;
            BattleSession.ActorPresentation -= Enqueue;
            _beats.Clear(); _latest = null; _delay = 0;_pendingHit=null;
            var complete = _complete; _complete = null; complete?.Invoke();
        }
        void OnDestroy() { Release(); }
        void OnApplicationPause(bool paused) { _applicationPaused=paused; }
    }
}
