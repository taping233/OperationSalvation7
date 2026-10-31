// Presentation-only cues from the settled execution path; no rule state or RNG is read/written.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Sdt.Core.Battle
{
    public sealed class BattleActorCue
    {
        public string BattleToken, Action, Attacker, Kind, Profile, CardName, DamageType, SoundKey;
        public bool ReplayAttacker;
        public long Sequence;
        public int Unit = -1, AllyIndex=-1, ActorIndex = -1, HpBefore, HpAfter, MaxHp, WindupMs = 130;
        public bool IsSelf, Dead;
        public DefenseState DefenseBefore, DefenseAfter;
        public IReadOnlyList<BattleFloat> Feedback;
    }
    public sealed partial class BattleSession
    {
        public static event Action<BattleActorCue> ActorPresentation;
        readonly Stack<ActorCardScope> _actorCards = new Stack<ActorCardScope>();
        long _presentationSequence;
        int _actorDamageGroup;
        string _actorProfile;
        int _actorGroupCount;
        bool _actorGroupWindup;
        sealed class ActorCardScope : IDisposable
        {
            readonly BattleSession _session;
            readonly CardDef _card;
            public int Windups;
            public ActorCardScope(BattleSession session, CardDef card) { _session = session; _card = card; }
            public void Dispose()
            {
                _session._actorCards.Pop();
                if (Windups == 0) _session.EmitActorCue(_card.type == "法术" ? "cast" : _card.type == "武术" ? "atk" : null);
            }
        }
        IDisposable BeginActorCard(CardDef card)
        {
            var scope = new ActorCardScope(this, card); _actorCards.Push(scope); return scope;
        }
        sealed class PresentationScope : IDisposable
        {
            readonly Action _end;
            public PresentationScope(Action end) { _end = end; }
            public void Dispose() { _end(); }
        }
        IDisposable BeginActorDamageGroup(CardDef card, string type, int count)
        {
            string previous=_actorProfile;int previousCount=_actorGroupCount;bool previousWindup=_actorGroupWindup;
            _actorGroupCount=count;_actorGroupWindup=false;
            _actorDamageGroup++; return new PresentationScope(() => { _actorDamageGroup--;_actorProfile=previous;_actorGroupCount=previousCount;_actorGroupWindup=previousWindup; });
        }
        void PresentActorWindup(string damageKind, int windupMs = 130)
        {
            string attacker = damageKind == "spell" ? "player-spell"
                : damageKind == "attack" || damageKind == "fixed" || damageKind == "true" ? "player-attack" : null;
            if (attacker == null) return;
            bool replay = _actorCards.Count > 0 && _actorCards.Peek().Windups++ > 0;
            EmitPresentation(new BattleActorCue { Action = attacker == "player-spell" ? "cast" : "atk", Attacker = attacker,
                ReplayAttacker = replay, Kind = "windup", WindupMs = windupMs, Profile=_actorProfile });
        }
        static DefenseState CopyDefense(DefenseState defense) => defense == null ? null : new DefenseState { Armor=defense.Armor, Shield=defense.Shield, Guard=defense.Guard };
        IDisposable BeginActorHit(BattleFoe foe, CardDef card, int amount, string type)
        {
            if (_actorDamageGroup == 0 || !_actorGroupWindup)
            {
                _actorProfile=_actorDamageGroup>0&&_actorGroupCount>1?"combo":type=="spell"?"spell":amount>=10?"heavy":"light";
                int windup=_actorProfile=="combo"?90:_actorProfile=="spell"?200:_actorProfile=="heavy"?240:130;
                PresentActorWindup(type,windup);_actorGroupWindup=true;
            }
            string profile=_actorProfile;
            int start = floats.Count, before = foe.hp; var defense = CopyDefense(foe.defense);
            return new PresentationScope(() => PublishHit(false, FoeIdx(foe), before, foe.hp, foe.maxHp, defense, foe.defense, foe.dead, start,profile,card?.name,type));
        }
        IDisposable BeginPlayerHit(BattleFoe foe)
        {
            EmitPresentation(new BattleActorCue { Kind="enemy-windup", ActorIndex=FoeIdx(foe), WindupMs=130 });
            int start=floats.Count, before=G.Hp; var defense=CopyDefense(pdef);
            return new PresentationScope(() => PublishHit(true, -1, before, G.Hp, G.MaxHp, defense, pdef, G.Hp<=0, start));
        }
        IDisposable BeginPassiveHit(BattleFoe foe=null)
        {
            int start=floats.Count,before=foe?.hp??G.Hp,max=foe?.maxHp??G.MaxHp;
            var defense=CopyDefense(foe?.defense??pdef);
            return new PresentationScope(()=>
            {
                int after=foe?.hp??G.Hp; var current=foe?.defense??pdef;
                if(before!=after || floats.Count>start) PublishHit(foe==null,foe==null?-1:FoeIdx(foe),before,after,max,defense,current,foe?.dead??after<=0,start);
            });
        }
        IDisposable BeginAllyHit(BattleFoe attacker,Combatant guard,int index)
        {
            EmitPresentation(new BattleActorCue { Kind="enemy-windup",ActorIndex=FoeIdx(attacker),WindupMs=130 });
            int before=guard.hp; var defense=CopyDefense(guard.defense);
            return new PresentationScope(()=>EmitPresentation(new BattleActorCue { Kind="hit",AllyIndex=index,
                HpBefore=before,HpAfter=guard.hp,MaxHp=guard.maxHp,DefenseBefore=defense,DefenseAfter=CopyDefense(guard.defense),Dead=guard.dead }));
        }
        void PublishHit(bool self,int unit,int before,int after,int max,DefenseState defenseBefore,DefenseState defenseAfter,bool dead,int floatStart,string profile=null,string cardName=null,string damageType=null)
        {
            var feedback = floats.Skip(floatStart).Where(f=>f.presentationSequence==0).ToArray();
            var beat=new BattleActorCue { Kind="hit", IsSelf=self, Unit=unit, HpBefore=before, HpAfter=after, MaxHp=max,
                DefenseBefore=defenseBefore, DefenseAfter=CopyDefense(defenseAfter), Dead=dead, Feedback=feedback, Profile=profile, CardName=cardName, DamageType=damageType };
            foreach(var f in feedback) f.presentationSequence=_presentationSequence+1;
            EmitPresentation(beat);
        }
        void EmitActorCue(string action, string attacker = null, bool replay = false)
        {
            if (action == null) return;
            EmitPresentation(new BattleActorCue { Action = action, Attacker = attacker, ReplayAttacker = replay, Kind=action=="death"?"death":"support" });
        }
        void EmitSoundCue(string key) => EmitPresentation(new BattleActorCue { Kind="audio", SoundKey=key });
        void EmitPresentation(BattleActorCue cue)
        {
            cue.BattleToken=_battleToken; cue.Sequence=++_presentationSequence;
            var handlers = ActorPresentation;
            if (handlers == null) return;
            // A rendering failure must never interrupt costs, damage, consumption, or battle settlement.
            foreach (Action<BattleActorCue> handler in handlers.GetInvocationList())
                try { handler(cue); } catch { }
        }
    }
}
