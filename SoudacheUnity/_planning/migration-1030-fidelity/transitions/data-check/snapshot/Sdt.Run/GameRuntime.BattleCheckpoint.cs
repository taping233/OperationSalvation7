using System;
using Sdt.Core.Battle;

namespace Sdt.Run
{
    public sealed class RunBattleCheckpoint
    {
        public BattleRestartCheckpoint battle;
        public RunSaveData run;
    }
    public sealed partial class GameRuntime
    {
        public RunBattleCheckpoint BattleCheckpoint {get;private set;}
        public Func<RunBattleCheckpoint,bool> RestoreBattleCheckpoint;
        public RunSaveData CaptureBattleEntryRun()
        {
            var entry=SaveJson.Read<RunSaveData>(SaveJson.Stringify(CaptureRunSave()));entry.battleRestartCheckpoint=null;return entry;
        }
        public bool TryBeginBattleCheckpoint(BattleRestartCheckpoint battle,out string reason)=>TryBeginBattleCheckpoint(battle,CaptureBattleEntryRun(),out reason);
        public bool TryBeginBattleCheckpoint(BattleRestartCheckpoint battle,RunSaveData entryRun,out string reason)=>TryPersistMutation(()=>{
            if(!BattleSession.ValidateCheckpoint(battle,out var error))throw new InvalidOperationException(error);
            if(BattleCheckpoint!=null)throw new InvalidOperationException("上一场战斗尚未结束");
            if(entryRun==null||entryRun.slot!=ActiveSlot||entryRun.seed!=State.seed)throw new InvalidOperationException("战斗入场对局已经变化");
            var entry=SaveJson.Read<RunSaveData>(SaveJson.Stringify(entryRun));entry.battleRestartCheckpoint=null;
            BattleCheckpoint=new RunBattleCheckpoint{battle=SaveJson.Read<BattleRestartCheckpoint>(SaveJson.Stringify(battle)),run=entry};
        },out reason);
        public bool TryUpdateBattleCheckpoint(BattleRestartCheckpoint battle,out string reason)=>TryPersistMutation(()=>{
            if(BattleCheckpoint==null||!BattleSession.ValidateCheckpoint(battle,out var error))throw new InvalidOperationException("战斗入场记录不可用");
            BattleCheckpoint.battle=SaveJson.Read<BattleRestartCheckpoint>(SaveJson.Stringify(battle));
        },out reason);
        public void ClearBattleCheckpoint(){BattleCheckpoint=null;}
    }
}
