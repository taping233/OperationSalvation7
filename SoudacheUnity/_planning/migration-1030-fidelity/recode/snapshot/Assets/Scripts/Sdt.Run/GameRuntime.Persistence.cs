using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    public sealed partial class GameRuntime
    {
        public bool TryPersistMutation(Action mutation,out string reason)
            =>TryPersistMutation(mutation,out reason,false,out _);

        // Shop transactions and event dice keep an already completed in-memory action
        // when only checkpoint I/O fails, as in the source. Other callers retain the
        // default atomic rollback. Return value means saved; applied also describes
        // the retained, unsaved case. Nested actions belong to their outer transaction.
        public bool TryPersistMutation(Action mutation,out string reason,bool retainAppliedOnSaveFailure,out bool applied)
        {
            reason=null;applied=false;
            if(Saves.InTransaction){try{mutation();applied=true;return true;}catch(Exception e){reason=e.Message;throw;}}
            string state=SaveJson.Stringify(State),baseData=SaveJson.Stringify(Base),random=Rng.SaveState(),left=SaveJson.Stringify(_extractLeft),battle=SaveJson.Stringify(BattleCheckpoint);
            int? slot=ActiveSlot;var originalBase=Base;bool events=false;
            var notices=Meta.CaptureNoticeState();
            try
            {
                Saves.BeginTransaction();Bus.BeginDeferred();events=true;mutation();applied=true;
                if(ActiveSlot!=null)
                {
                    SyncPlayTime();Base.Save();
                    if(State.runActive&&State.Phase!="title"&&State.Phase!="done"&&State.Phase!="boot")
                    {
                        if(!Saves.WriteSlot(ActiveSlot.Value,CaptureRunSave()))throw new System.IO.IOException(Saves.LastError);
                    }
                }
                if(!Saves.CommitTransaction())throw new System.IO.IOException(Saves.LastError);
                if(ActiveSlot!=null&&State.runActive&&State.Phase!="title"&&State.Phase!="done"&&State.Phase!="boot")
                    Bus.Emit(new SaveCompleted{Slot=ActiveSlot.Value});
            }
            catch(Exception e)
            {
                if(retainAppliedOnSaveFailure&&applied&&e is System.IO.IOException)
                {
                    Saves.CancelTransaction();
                    reason="本次操作已在当前局生效，但保存失败；请重试保存后离开："+e.Message;
                    // Deliver the completed action's ordinary observers, keeping their
                    // profile writes buffered rather than accidentally saving only part
                    // of a failed checkpoint. A later SaveCurrent persists live state.
                    if(events){Saves.BeginTransaction();try{Bus.CommitDeferred();}finally{Saves.CancelTransaction();}}
                    Bus.Emit(new ToastRequested{Text=reason,Tone="warn"});return false;
                }
                applied=false;
                Saves.CancelTransaction();if(events)Bus.CancelDeferred();
                SaveJson.Populate(state,State);Base=originalBase;SaveJson.Populate(baseData,Base);ActiveSlot=slot;
                Rng.LoadState(random);_extractLeft=SaveJson.Read<List<StashStack>>(left);BattleCheckpoint=SaveJson.Read<RunBattleCheckpoint>(battle);_lastNode=null;_lastNodeKey=null;
                Meta.RestoreNoticeState(notices);
                if(State.mapSnapshot!=null)BuildDerived();
                reason=e is System.IO.IOException?"保存失败，请重试；原存档与操作前状态已保留："+e.Message:e.Message;
                Bus.Emit(new ToastRequested{Text=reason,Tone="warn"});return false;
            }
            Bus.CommitDeferred();return true;
        }

        RunSaveData CaptureRunSave()
        {
            if(BattleCheckpoint!=null){
                var entry=SaveJson.Read<RunSaveData>(SaveJson.Stringify(BattleCheckpoint.run));
                entry.battleRestartCheckpoint=SaveJson.Read<RunBattleCheckpoint>(SaveJson.Stringify(BattleCheckpoint));
                entry.elapsed=State.elapsed;entry.savedAt=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                entry.battleRestartCheckpoint.run.elapsed=entry.elapsed;entry.battleRestartCheckpoint.run.savedAt=entry.savedAt;
                return entry;
            }
            var g=State;
            return new RunSaveData
            {
                seed=g.seed??0,mapSnapshot=g.mapSnapshot,explored=new List<string>(g.explored),revealed=new List<string>(g.revealed),settled=new List<string>(g.settled),closed=new List<string>(g.closed),
                altarActivated=g.altarActivated,bossDefeated=g.bossDefeated,nodeRewards=g.nodeRewards,entrySupply=g.entrySupply,spellPower=g.spellPower,fragments=g.fragments,
                rngState=JToken.FromObject(Rng.SaveState()),layerIdx=g.layerIdx,trackPos=g.trackPos,hp=g.hp,maxHp=g.maxHp,coins=g.coins,turn=g.turn,atk=g.atk,mode=g.mode,myClass=g.myClass,characterId=g.characterId,
                inventory=g.inventory.ConvertAll(x=>new InventorySlot{name=x.name,value=x.value,tier=x.tier,count=x.count}),ownedCards=g.ownedCards,cardOrder=g.cardOrder,usedPocket=g.usedPocket,eventLog=g.eventLog,
                discovered=new List<string>(g.discoveredPairs),diceHistory=g.diceHistory,elapsed=g.elapsed,slot=ActiveSlot??g.slot,savedAt=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };
        }
        string RunIdentity=>(ActiveSlot??State.slot)+":"+(State.seed??0);
        SettlementRecord ActiveSettlement()
        {
            if(ActiveSlot==null)return null;var receipt=Saves.GetSettlement(ActiveSlot.Value);return receipt?.identity==RunIdentity?receipt:null;
        }
        bool IsPendingExtraction(SettlementRecord receipt)=>receipt?.reason=="extract"&&receipt.status=="sorting";
    }
}
