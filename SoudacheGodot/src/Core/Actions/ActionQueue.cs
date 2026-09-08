using System;
using System.Collections.Generic;
using Soudache;

namespace Soudache;

/// <summary>Execution context shared by ordered gameplay actions.</summary>
public sealed class ActionContext
{
    public CombatState Combat { get; }
    public ActionContext(CombatState combat) => Combat = combat ?? throw new ArgumentNullException(nameof(combat));
}

public interface IGameAction
{
    string ActionId { get; }
    void Execute(ActionContext context);
}

/// <summary>FIFO action queue. Actions added while draining run after earlier actions.</summary>
public sealed class ActionQueue
{
    private readonly Queue<IGameAction> _pending = new();
    private bool _isExecuting;

    public int Count => _pending.Count;
    public bool IsExecuting => _isExecuting;
    public event Action<IGameAction>? ActionStarted;
    public event Action<IGameAction>? ActionCompleted;

    public void Enqueue(IGameAction action)
    {
        ArgumentNullException.ThrowIfNull(action);
        _pending.Enqueue(action);
    }

    public void EnqueueRange(IEnumerable<IGameAction> actions)
    {
        ArgumentNullException.ThrowIfNull(actions);
        foreach (var action in actions) Enqueue(action);
    }

    public bool ExecuteNext(ActionContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        if (_pending.Count == 0) return false;
        var action = _pending.Dequeue();
        _isExecuting = true;
        ActionStarted?.Invoke(action);
        try
        {
            action.Execute(context);
            ActionCompleted?.Invoke(action);
        }
        finally
        {
            _isExecuting = false;
        }
        return true;
    }

    public int Drain(ActionContext context, int maxActions = 10000)
    {
        if (maxActions <= 0) throw new ArgumentOutOfRangeException(nameof(maxActions));
        var executed = 0;
        while (_pending.Count > 0)
        {
            if (executed >= maxActions)
                throw new InvalidOperationException("Action queue exceeded its safety limit.");
            ExecuteNext(context);
            executed++;
        }
        return executed;
    }
}
