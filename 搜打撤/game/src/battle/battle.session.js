/* Owns the identity and cancellation boundary for one battle lifetime. */
function createBattleSessionManager(onRetire = () => {}) {
  let sequence = 0;
  let current = null;

  function retire(session, reason) {
    if (!session || session.closed) return false;
    session.closed = true;
    session.controller.abort(reason || new Error('battle session ended'));
    onRetire(session, reason);
    if (current === session) current = null;
    return true;
  }

  function begin(reason = new Error('battle session replaced')) {
    if (current) retire(current, reason);
    const controller = new AbortController();
    const session = {
      id: ++sequence,
      controller,
      signal: controller.signal,
      closed: false,
      isCurrent: () => current === session && !session.closed && !controller.signal.aborted,
    };
    current = session;
    return session;
  }

  function finish(session = current, reason = new Error('battle session finished')) {
    return retire(session, reason);
  }

  return Object.freeze({
    begin,
    finish,
    isCurrent: session => !!session && session.isCurrent(),
    get current() { return current; },
  });
}

export { createBattleSessionManager };
