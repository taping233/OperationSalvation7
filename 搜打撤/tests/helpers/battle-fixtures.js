// Keep each suite's UID sequence independent while sharing the same battle host.
export function createBattleGameFactory() {
  let uidSeq = 0;
  return function makeGame(cards) {
    const logs = [];
    return {
      ownedCards: cards.map(card => ({ uid: 'g' + (uidSeq++), card, safe: false })),
      hp: 99999, maxHp: 99999, atk: 5, spellPower: 2, coins: 0,
      myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
      lastBattleEnd: null,
      log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
      logs,
      heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
      addItem() {}, onBattleEnd() {},
    };
  };
}

export function makeRuntimeBattleGame(cards) {
  return {
    ownedCards: cards.map((card, i) => ({ uid: `runtime-${i}`, card: { ...card }, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(message); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {},
  };
}

// A second idle snapshot spans the scheduler gap before reporting completion.
export async function drainBattle(session, maxLoops = 300) {
  for (let i = 0; i < maxLoops; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const state = session.getSnapshot();
    if (state.discovering) { session.commands.pickDiscover(0); continue; }
    if (state.choosing) { session.commands.pickChoice(0); continue; }
    if (state.handSelecting) { session.commands.skipHandSelect(); continue; }
    if (!state.busy && state.actionQueueLength === 0) {
      await new Promise(resolve => setTimeout(resolve, 30));
      const fresh = session.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
  }
  return session.getSnapshot();
}
