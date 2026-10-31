// ported from src/game.session.js（configureGameRuntime hooks → 显式事件）
using System;
using System.Collections.Generic;

namespace Sdt.Run
{
    /// <summary>
    /// 类型化事件总线，替代原版 configureGameRuntime(hooks) 注入 + UI.act 回调的隐式控制流。
    /// UI/View 订阅事件呈现界面，再把玩家的选择调回 GameRuntime 的对应方法。
    /// </summary>
    public sealed class EventBus
    {
        readonly Dictionary<Type, Delegate> _handlers = new Dictionary<Type, Delegate>();
        List<Action> _deferred;
        public void BeginDeferred(){if(_deferred!=null)throw new InvalidOperationException("事件事务已经开始");_deferred=new List<Action>();}
        public void CancelDeferred(){_deferred=null;}
        public void CommitDeferred()
        {
            var pending=_deferred;_deferred=null;if(pending==null)return;
            foreach(var action in pending)try{action();}catch(Exception e){UnityEngine.Debug.LogException(e);}
        }

        public void On<T>(Action<T> h)
        {
            var t = typeof(T);
            _handlers[t] = _handlers.TryGetValue(t, out var d) ? Delegate.Combine(d, h) : h;
        }

        public void Emit<T>(T e)
        {
            if(_deferred!=null){_deferred.Add(()=>Emit(e));return;}
            if (_handlers.TryGetValue(typeof(T), out var d)) ((Action<T>)d)(e);
        }
    }

    // ---------- 事件负载定义 ----------
    // 各事件在类注释标明对应原版触发点。

    /// <summary>game.session.js newRun() 开局完成（含日志欢迎语已生成）。</summary>
    public sealed class RunStarted { public int Slot; public string Mode; public string CharacterId; }

    /// <summary>game.session.js loadGame() 读档完成。</summary>
    public sealed class RunLoaded { public int Slot; }

    /// <summary>game.run.js roll() 掷骰完成并已逻辑移动到目标格（UI 负责播放 640ms 翻滚与逐格动画）。</summary>
    public sealed class RollCompleted { public RollResult Result; }
    public sealed class NodeMovementCompleted { public int LayerIdx; public string NodeId; public List<string> Path = new List<string>(); }

    /// <summary>game.run.js resolveCell() 落脚触发节点（NodeResult 内含 UI 需要呈现的全部数据）。</summary>
    public sealed class NodeEntered { public NodeResult Node; }

    /// <summary>game.run.js openBattleCell / bandits_fight / fightBoss / goldhammer_strike：请求开启战斗。</summary>
    public sealed class BattleRequested { public BattleRequest Request; }

    /// <summary>game.run.js openShop()（商店页内容属 W7，这里只发开页请求）。</summary>
    public sealed class ShopOpened { }

    /// <summary>game.run.js openClassChoice()：开局/读档缺职业时请求选角页。</summary>
    public sealed class ClassChoiceOpened { }

    /// <summary>game.hub.js openBaseHub(tab) 经 runtime hook 注入的等价事件。</summary>
    public sealed class HubOpened { public string Tab; }

    /// <summary>背包页开关请求（game.bag.js showBackpack 等价）。</summary>
    public sealed class BagOpened { }

    /// <summary>game.session.js saveGame() 写档成功。</summary>
    public sealed class SaveCompleted { public int Slot; }

    /// <summary>对局结束。Reason = win(撤离) / dead(死亡) / abandon(放弃)。</summary>
    public sealed class RunEnded { public string Reason; }

    /// <summary>UI.log 等价：text 为原版 sdt 富文本（[[icon:x]] 标记由 UI 解析），tone 对应原版日志色（sys/ok/warn/loot/coin/dim/heal）。</summary>
    public sealed class LogRequested { public string Text; public string Tone; public bool SuppressNotice; }

    /// <summary>非阻塞提示（UI 自行决定 toast 形式；text 逐字来自原版文案）。</summary>
    public sealed class ToastRequested
    {
        public string Text; public string Tone;
        public ToastRequested() { }
        public ToastRequested(string text) { Text = text; }
    }

    /// <summary>game.heal / game.damage 结算后（飘字由 View 层做）。</summary>
    public sealed class PlayerHealed { public int Amount; public int Hp; public int MaxHp; }
    public sealed class PlayerDamaged { public int Amount; public string Reason; public int Hp; public int MaxHp; }

    /// <summary>game.addItem / gainCoins / grantEventCard。</summary>
    public sealed class ItemAdded { public string Name; public int Count; public bool Rejected; }
    public sealed class CoinsGained { public int Amount; public int Total; }
    public sealed class CardGranted { public string CardName; public bool Rejected; }

    /// <summary>game.run.js openPocketRestore 里「复原一张」成功。</summary>
    public sealed class PocketRestored { public string CardName; }

    /// <summary>撤离整理页数据变化（doExtract / 入库操作后由 UI 重绘）。</summary>
    public sealed class ExtractStashChanged { public ExtractResult Result; }

    /// <summary>meta.js addXP 升级 / checkUnlocks 新成就（文案逐字照抄源码）。</summary>
    public sealed class LevelUp { public string CharacterName; public int Level; public string PerkText; }
    public sealed class AchievementUnlocked { public string Id; public string Name; public string Desc; }
}
