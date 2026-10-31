using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Sdt.Core.Battle
{
    // Current Vite saves entry checkpoints, not partially resolved combat state.
    // The Run assembly owns the matching pre-battle player/inventory snapshot.
    [Serializable]
    public sealed class BattleRestartOptions
    {
        public bool isBoss;
        public int layer;
        public string returnTo,name,risk,runMode;
    }
    [Serializable]
    public sealed class BattleRestartCheckpoint
    {
        public const string CurrentRulesVersion="unity-current-2026-10-29-v1";
        public int restartVersion=1;
        public string rulesVersion=CurrentRulesVersion;
        public List<EnemyInput> enemyDefs=new List<EnemyInput>();
        public BattleRestartOptions opts;
        public string rngState;
        public List<string> selectedDeck;
    }
    public sealed partial class BattleSession
    {
        BattleRestartCheckpoint restartCheckpoint;
        bool restoringRestartCheckpoint;
        static EnemyInput CopyEnemy(EnemyInput e)=>new EnemyInput{id=e.id,name=e.name,hp=e.hp,atk=e.atk,affix=e.affix,affixName=e.affixName,
            behavior=e.behavior,elite=e.elite,eliteSkill=e.eliteSkill,desc=e.desc,damageCap=e.damageCap,evenAttack=e.evenAttack,noFirstAttack=e.noFirstAttack};
        static BattleRestartCheckpoint CopyCheckpoint(BattleRestartCheckpoint source)=>source==null?null:new BattleRestartCheckpoint{
            restartVersion=source.restartVersion,rulesVersion=source.rulesVersion,rngState=source.rngState,
            enemyDefs=source.enemyDefs.Select(CopyEnemy).ToList(),selectedDeck=source.selectedDeck?.ToList(),
            opts=new BattleRestartOptions{isBoss=source.opts.isBoss,layer=source.opts.layer,returnTo=source.opts.returnTo,name=source.opts.name,risk=source.opts.risk,runMode=source.opts.runMode}};
        void CaptureBattleEntry(BattleStartContext context)
        {
            tmpSeq=0;
            normalStarterUids.Clear();
            if(restoringRestartCheckpoint)return;
            restartCheckpoint=PrepareCheckpoint(context);
        }
        public static BattleRestartCheckpoint PrepareCheckpoint(BattleStartContext context)
        {
            if(context?.host==null)throw new ArgumentException("战斗宿主不可用");
            return new BattleRestartCheckpoint{enemyDefs=(context.enemies??Array.Empty<EnemyInput>()).Select(CopyEnemy).ToList(),
                opts=new BattleRestartOptions{isBoss=context.isBoss,layer=context.layer,returnTo=context.returnTo,name=context.name,risk=context.risk,runMode=context.runMode},rngState=(context.rng??Rng.Default).SaveState()};
        }
        public BattleRestartCheckpoint CaptureCheckpoint()=>over?null:CopyCheckpoint(restartCheckpoint);
        public static bool ValidateCheckpoint(BattleRestartCheckpoint data,out string reason)
        {
            reason=null;
            if(data==null||data.restartVersion!=1||data.rulesVersion!=BattleRestartCheckpoint.CurrentRulesVersion){reason="战斗检查点版本不受支持；原档保留";return false;}
            if(data.opts==null||data.opts.layer<0||data.opts.layer>=4||data.enemyDefs==null||data.enemyDefs.Count==0||data.enemyDefs.Count>30||data.enemyDefs.Any(e=>e==null||e.hp<=0||e.atk<0||string.IsNullOrEmpty(e.name))){reason="战斗检查点敌人或选项无效；原档保留";return false;}
            if(string.IsNullOrEmpty(data.rngState)||!Regex.IsMatch(data.rngState,@"^seed=\d+;v=2(?:;s=[a-zA-Z0-9_]+:\d+(?:,[a-zA-Z0-9_]+:\d+)*)?$")){reason="战斗随机检查点无效；原档保留";return false;}
            if(!uint.TryParse(data.rngState.Substring(5).Split(';')[0],out _)
                ||data.rngState.Split(';').Last().StartsWith("s=")&&data.rngState.Split(';').Last().Substring(2).Split(',').Any(pair=>!uint.TryParse(pair.Split(':')[1],out _))){reason="战斗随机检查点超出范围；原档保留";return false;}
            if(data.selectedDeck!=null&&(data.selectedDeck.Count>100||data.selectedDeck.Any(string.IsNullOrEmpty)||data.selectedDeck.Distinct().Count()!=data.selectedDeck.Count)){reason="首脑战编组记录无效；原档保留";return false;}
            return true;
        }
        /// <summary>The caller first restores its saved pre-battle Run state, within a persistence transaction.</summary>
        public bool RestoreCheckpoint(BattleHost host,BattleRestartCheckpoint data,Rng random,out string reason)
        {
            if(!ValidateCheckpoint(data,out reason))return false;
            if(host==null||random==null){reason="战斗宿主或随机服务不可用";return false;}
            if(data.selectedDeck!=null&&data.selectedDeck.Any(uid=>!host.OwnedCards.Any(o=>o.uid==uid))){reason="首脑战编组卡牌不在入场背包中；原档保留";return false;}
            try{
                restoringRestartCheckpoint=true;restartCheckpoint=CopyCheckpoint(data);random.LoadState(data.rngState);
                Start(new BattleStartContext{host=host,rng=random,enemies=data.enemyDefs.Select(CopyEnemy).ToList(),isBoss=data.opts.isBoss,layer=data.opts.layer,returnTo=data.opts.returnTo,name=data.opts.name,risk=data.opts.risk,runMode=data.opts.runMode});
                if(data.opts.isBoss&&data.selectedDeck!=null){
                    sel.Clear();
                    foreach(string uid in data.selectedDeck){var result=SelectDeckCard(uid);if(!result.Ok)throw new InvalidOperationException(result.Reason);}
                    var begun=ConfirmDeck();if(!begun.Ok)throw new InvalidOperationException(begun.Reason);
                }
                return true;
            }catch(Exception error){reason="战斗检查点恢复失败；原档保留："+error.Message;return false;}
            finally{restoringRestartCheckpoint=false;}
        }
    }
}
