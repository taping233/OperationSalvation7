using System;
using Sdt.Core;
namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        bool OwnsBossGate(out string reason)
        {
            reason=null;
            if(!State.runActive||State.battleActive||CurLayer.logical[State.trackPos].type!="boss"||State.closed.Contains(CurrentNodeId)||!State.altarActivated)
            {reason="当前首脑入口已失效，需先激活祭坛并抵达首脑地点。";return false;}
            return true;
        }
        // Called after the actual boss film, exactly where source enterNode('boss', done) draws bossPlan.
        public bool TryBeginBossGate(out string reason)
        {
            if(!OwnsBossGate(out reason))return false;
            return TryPersistMutation(()=>
            {
                if(!OwnsBossGate(out var changed))throw new InvalidOperationException(changed);
                var receipt=CurrentNodeReceipt;string id=receipt.bossId;
                // Earlier native migration drafts stored this choice in eventCardId. Read once without rerolling.
                if(string.IsNullOrEmpty(id)&&Array.Exists(MapData.AltarBosses,b=>b.id==receipt.eventCardId))id=receipt.eventCardId;
                int index=string.IsNullOrEmpty(id)?(int)(Rng.Random("boss","enemy")*MapData.AltarBosses.Length):Array.FindIndex(MapData.AltarBosses,b=>b.id==id);
                if(index<0)throw new InvalidOperationException("首脑记录无法恢复，原存档已保留。");
                receipt.bossId=MapData.AltarBosses[index].id;State.Phase="modal";
                FightBoss(index);
            },out reason);
        }
        public bool TryLeaveBossGate(out string reason)
        {
            if(!OwnsBossGate(out reason))return false;
            // Returning does not settle/consume a boss node; it can be entered again.
            return TryPersistMutation(()=>{if(!OwnsBossGate(out var changed))throw new InvalidOperationException(changed);State.Phase="idle";},out reason);
        }
    }
}
