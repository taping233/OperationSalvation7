import { beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music: vi.fn(), sfx: vi.fn(), setDucked: vi.fn() },
  FX: { feedback: vi.fn() }, UI: { log: vi.fn(), refresh: vi.fn(), showOverlay: vi.fn(), hideOverlay: vi.fn(), act: vi.fn() },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10,
    bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 } },
};
await import('../game/src/cards.js');
await import('../game/src/base.js');
await import('../game/src/meta.js');
const { RunStorage } = await import('../game/src/game.storage.js');
const { createRecoveryCommands } = await import('../game/src/recovery.commands.js');
const { createTerminalCommands } = await import('../game/src/terminal.commands.js');
const Base = window.SDT.Base;

function lockManager() { return { request: (_name, _options, callback) => callback() }; }

async function harness(slotId, failAt = null) {
  localStorage.clear();
  Base.use(slotId);
  Base.reset(slotId);
  RunStorage.write(slotId, { seed: 'terminal-test', hp: 0, maxHp: 30, inventory: [], ownedCards: [], myClass: '侠客' });
  let activeSlot = slotId;
  let shouldFail = !!failAt;
  const storage = {
    getItem: key => localStorage.getItem(key),
    setItem(key, value) {
      if (shouldFail && failAt === 'journal' && key === `sdt-tx-v1-slot${slotId}`) { shouldFail = false; throw new Error('journal write'); }
      if (shouldFail && failAt === 'base' && key === Base.SLOT_KEY(slotId)) { shouldFail = false; throw new Error('base write'); }
      localStorage.setItem(key, value);
    },
    removeItem(key) {
      if (shouldFail && failAt === 'run' && key === RunStorage.key(slotId)) { shouldFail = false; throw new Error('run delete'); }
      localStorage.removeItem(key);
    },
  };
  const recovery = createRecoveryCommands({ storage, lockManager: lockManager(), baseApi: Base, runStore: RunStorage });
  const deps = {
    getBase: () => Base,
    getRunStorage: () => RunStorage,
    getRecovery: () => recovery,
    getActiveSlot: () => activeSlot,
    syncPlayTime: vi.fn(),
  };
  return {
    recovery,
    commands: createTerminalCommands(deps),
    newCommands: () => createTerminalCommands(deps),
    runId: RunStorage.readIdentity(slotId).value.runId,
    slotId,
    setActiveSlot(value) { activeSlot = value; },
  };
}

const safeCard = { id: 'qa-terminal-persist', name: '终局测试安全卡', type: '法术', rarity: '古朴' };

beforeEach(() => {
  window.SDT.Meta.checkUnlocks = vi.fn();
});

describe('死亡/放弃两键终局事务', () => {
  for (const failAt of ['journal', 'base', 'run']) {
    it(`${failAt} 写入故障不提前清局，恢复后收据重放只入库和记死亡一次`, async () => {
      const h = await harness(2, failAt);
      const created = await h.commands.createAttempt({
        slotId: h.slotId, command: 'run.death', cards: [{ card: safeCard, count: 1 }], deathClass: '侠客',
      });
      expect(created.ok).toBe(true);
      const attempt = JSON.parse(JSON.stringify(created.attempt));
      const beforeRunRaw = localStorage.getItem(RunStorage.key(h.slotId));
      const failed = await h.commands.commitAttempt(created.attempt);
      expect(failed.ok).toBe(false);
      expect(localStorage.getItem(RunStorage.key(h.slotId))).not.toBeNull();
      if (failAt === 'journal') expect(localStorage.getItem(RunStorage.key(h.slotId))).toBe(beforeRunRaw);

      const retried = await h.newCommands().commitAttempt(attempt);
      expect(retried.ok).toBe(true);
      expect(localStorage.getItem(RunStorage.key(h.slotId))).toBeNull();
      const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(h.slotId)));
      expect(base.stats.deaths).toBe(1);
      expect(base.characters.wu.xp).toBe(5);
      expect(base.stash.find(s => s.card.id === safeCard.id).count).toBe(1);

      const replay = await h.newCommands().commitAttempt(attempt);
      expect(replay.ok).toBe(true);
      expect(replay.replay).toBe(true);
      const afterReplay = JSON.parse(localStorage.getItem(Base.SLOT_KEY(h.slotId)));
      expect(afterReplay.stats.deaths).toBe(1);
      expect(afterReplay.stash.find(s => s.card.id === safeCard.id).count).toBe(1);
    });
  }

  it('attempt等待恢复时同档换runId，旧卡牌快照被拒绝', async () => {
    const h = await harness(3);
    const oldRunId = h.runId;
    let release;
    const waitingRecovery = { ...h.recovery, recoverSlot: vi.fn(() => new Promise(resolve => { release = resolve; })) };
    const commands = createTerminalCommands({
      getBase: () => Base, getRunStorage: () => RunStorage, getRecovery: () => waitingRecovery,
      getActiveSlot: () => h.slotId, syncPlayTime: () => {},
    });
    const creating = commands.createAttempt({ slotId: h.slotId, command: 'run.death', cards: [{ card: safeCard }], deathClass: '侠客' });
    RunStorage.remove(h.slotId);
    RunStorage.write(h.slotId, { seed: 'replacement', hp: 30, maxHp: 30, inventory: [], ownedCards: [] });
    release({ ok: true, value: null });
    const result = await creating;
    expect(result.ok).toBe(false);
    expect(result.code).toBe('STALE_RUN');
    expect(RunStorage.readIdentity(h.slotId).value.runId).not.toBe(oldRunId);
    expect(JSON.parse(localStorage.getItem(Base.SLOT_KEY(h.slotId))).stats.deaths).toBe(0);
  });

  it('新request身份可结算后续新局，不受旧run收据阻塞', async () => {
    const h = await harness(4);
    const first = await h.commands.createAttempt({ slotId: 4, command: 'run.abandon', cards: [{ card: safeCard }] });
    expect((await h.commands.commitAttempt(first.attempt)).ok).toBe(true);
    RunStorage.write(4, { seed: 'second-run', hp: 20, maxHp: 30, inventory: [], ownedCards: [] });
    const second = await h.newCommands().createAttempt({ slotId: 4, command: 'run.abandon', cards: [{ card: safeCard }] });
    expect(second.ok).toBe(true);
    expect(second.attempt.runId).not.toBe(first.attempt.runId);
    expect((await h.newCommands().commitAttempt(second.attempt)).ok).toBe(true);
    const base = JSON.parse(localStorage.getItem(Base.SLOT_KEY(4)));
    expect(base.stash.find(s => s.card.id === safeCard.id).count).toBe(2);
    expect(base.stats.deaths).toBe(0);
  });
});
