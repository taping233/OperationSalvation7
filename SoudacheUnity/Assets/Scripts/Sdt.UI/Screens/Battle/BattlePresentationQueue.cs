// Read-only resolved beats from Core. This owns presentation waits; rules never run here.
using System;
using System.Collections.Generic;
using UnityEngine;
using Sdt.Core;
using Sdt.Core.Battle;
using Sdt.UI.Kit;

namespace Sdt.UI.Screens.Battle
{
    public sealed class BattlePresentationQueue : MonoBehaviour
    {
        readonly Queue<BattleActorCue> _beats = new Queue<BattleActorCue>();
        readonly Stack<CardDef> _automaticCards = new Stack<CardDef>();
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
        bool _actualDeath;
        double _resultFrameWait,_resultHold=-1;
        public bool Busy => _beats.Count > 0 || _delay > 0 || _complete != null || _pendingHit!=null;
        public int PendingBeats => _beats.Count;
        public void Init(BattleScreen owner) { _owner = owner; BattleSession.ActorPresentation += Enqueue; }
        public void Bind(string token)
        {
            if (_token == token) return;
            _beats.Clear(); _delay = 0; _latest = null; _complete = null; _token = token;
            _pendingHit=null;_frameSynced=false;_lastSequence=0;
            _automaticCards.Clear();_owner?.ReleaseAutomaticCard();
            _actualDeath=false;_resultFrameWait=0;_resultHold=-1;
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
            if(_complete==null){_resultFrameWait=0;_resultHold=-1;}
            _actualDeath|=actualDeath;_complete += complete; return true;
        }
        public void AppendFeedback(IReadOnlyList<BattleFloat> feedback)
        {
            if (feedback.Count>0) _beats.Enqueue(new BattleActorCue { BattleToken=_token,Kind="feedback",Feedback=feedback });
        }
        void Update()
        {
            if (_closed || UiStack.Top != _owner || _applicationPaused || (!Busy&&_latest==null)) return;
            double elapsed=Time.unscaledDeltaTime*1000d;
            _delay = Math.Max(0, _delay - elapsed);
            if (_delay > 0) return;
            bool hasBeat=_pendingHit!=null||_beats.Count>0;
            bool reduced=false;float pace=1;
            if(hasBeat){reduced=CurrentUiPreferences.ReducedMotion;pace=CurrentUiPreferences.BattlePace;}
            if(_pendingHit!=null){var hit=_pendingHit;_pendingHit=null;ApplyHit(hit,reduced,pace);if(_delay>0)return;}
            while (_beats.Count > 0 && _delay <= 0)
            {
                var beat = _beats.Dequeue();
                if (beat.BattleToken != _token) continue;
                if (beat.Kind == "audio") Sdt.Run.AudioService.I.PlaySfx(beat.SoundKey);
                else if(beat.Kind=="card")
                {
                    if(beat.Card==null)continue;
                    _automaticCards.Push(beat.Card);_owner.PresentAutomaticCard(beat.Card);
                    _frameSynced=false;_delay=BattlePresentationTiming.AutomaticCardLead(pace,reduced);
                }
                else if(beat.Kind=="card-end")
                {
                    if(_automaticCards.Count>0)_automaticCards.Pop();
                    if(_automaticCards.Count>0)_owner.PresentAutomaticCard(_automaticCards.Peek());else _owner.HideAutomaticCard();
                    _delay=BattlePresentationTiming.AutomaticCardTail(pace);
                }
                else if (beat.Kind == "windup")
                {
                    bool played = _owner.ActorFrames?.Play(beat.Action, beat.ReplayAttacker) == true;
                    double? impact = played ? _owner.ActorFrames.ImpactRemaining : null;
                    _frameSynced=impact.HasValue;
                    _delay = BattlePresentationTiming.Windup(beat,impact,pace,reduced);
                }
                else if (beat.Kind == "enemy-windup")
                {
                    Sdt.Run.AudioService.I.PlaySfx("foeLunge",null,pace > 1 ? 1.5f : 1);
                    _frameSynced=false;
                    _owner.PresentEnemyAttack(beat.ActorIndex);
                    _delay = reduced ? 0 : BattlePresentationTiming.Demo(130,pace);
                }
                else if (beat.Kind == "support") _owner.ActorFrames?.Play(beat.Action);
                else if (beat.Kind == "death") _owner.ActorFrames?.Play("death");
                else if (beat.Kind == "wait") _delay = reduced?0:BattlePresentationTiming.Demo(beat.WindupMs,pace);
                else if (beat.Kind == "hit" || beat.Kind == "feedback")
                {
                    double anticipate=BattlePresentationTiming.Anticipation(_frameSynced,pace,reduced);
                    if(anticipate>0&&beat.Kind=="hit") { _pendingHit=beat;_delay=anticipate; }
                    else ApplyHit(beat,reduced,pace);
                }
            }
            if (_beats.Count > 0 || _delay > 0) return;
            if(_complete!=null)
            {
                var frames=_owner.ActorFrames;
                bool pending=frames?.Running==true||(_actualDeath&&frames?.CurrentAction=="death"&&!frames.DeathComplete);
                // Never cap or discard queued casts/hits. Only a finished queue's actor tail is bounded.
                if(pending&&_resultFrameWait<BattlePresentationTiming.ResultFrameLimit){_resultFrameWait+=elapsed;return;}
                if(_resultHold<0){_resultHold=BattlePresentationTiming.ResultHold(_actualDeath,hasBeat?reduced:CurrentUiPreferences.ReducedMotion);return;}
                _resultHold=Math.Max(0,_resultHold-elapsed);if(_resultHold>0)return;
            }
            var latest = _latest; _latest = null;
            var complete = _complete; _complete = null;
            _actualDeath=false;_resultFrameWait=0;_resultHold=-1;
            if (latest != null) _owner.CompletePresentationSnapshot(latest);
            complete?.Invoke();
        }
        void ApplyHit(BattleActorCue beat,bool reduced,float pace)
        {
            _owner.PresentResolvedHit(beat);
            double stop=BattlePresentationTiming.Stop(beat,reduced);
            _owner.ActorFrames?.Hold(stop);
            _delay=stop+BattlePresentationTiming.DeathRelease(beat,pace,reduced);
        }
        public void Release()
        {
            if (_closed) return; _closed = true;
            BattleSession.ActorPresentation -= Enqueue;
            _beats.Clear(); _latest = null; _delay = 0;_pendingHit=null;
            _automaticCards.Clear();_owner?.ReleaseAutomaticCard();
            _actualDeath=false;_resultFrameWait=0;_resultHold=-1;
            var complete = _complete; _complete = null; complete?.Invoke();
        }
        void OnDestroy() { Release(); }
        void OnApplicationPause(bool paused) { _applicationPaused=paused; }
    }
}
