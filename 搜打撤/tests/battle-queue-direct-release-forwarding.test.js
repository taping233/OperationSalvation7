import { afterEach, describe, expect, it, vi } from 'vitest';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 8, bossDeckSize: 1, starterSha: 0, battleStartDraw: 0, battleTurnDraw: 0, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const cards = window.SDT.Cards;
cards.ensureSha(); cards.ensureStarters(); cards.ensureTabletop(); cards.ensureDmgTypes(); cards.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');

let game;
const pure = { id: 'facade-pure', name: '透传纯注能牌', type: '法术', cost: 2, infuse: 1, heal: 7, desc: '注能（1）：回复7点生命' };
function begin(card = pure) {
  game = { ownedCards: [{ uid: 'cast', card }, { uid: 'material', card: { id: 'facade-material', name: '保留材料', type: '法术', cost: 1, desc: '无效果' } }],
    hp: 50, maxHp: 100, atk: 1, spellPower: 0, coins: 0, myClass: '法师', state: 'idle', battleActive: false,
    log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'facade-foe', name: '透传靶', hp: 1000, atk: 1 }], { isBoss: false });
  return card;
}
const observer = () => ({ queued: vi.fn(), commit: vi.fn(), reject: vi.fn(), needsInput: vi.fn(), error: vi.fn() });
afterEach(() => { if (game?.battleActive) BattleSession.commands.flee(); game = null; });

describe('real engine queue facade forwards submission and direct-release ownership', () => {
  it('freeCost alone does not grant infusion and the ninth argument observes rejection', () => {
    const card = begin(), submission = observer(), hand = [...runtime.hand], energy = runtime.energy;
    expect(engine.queueCardExecution('cast', card, [], runtime.foes[0], true, false, [], null, submission)).toBe(false);
    expect(submission.reject).toHaveBeenCalledWith('INFUSION_REQUIRED', expect.any(String));
    expect(submission.queued).not.toHaveBeenCalled();
    expect(submission.commit).not.toHaveBeenCalled();
    expect(game.hp).toBe(50); expect(runtime.hand).toEqual(hand); expect(runtime.energy).toBe(energy); expect(runtime.infuseFuels).toBe(0);
  });
  it('the tenth argument grants direct-release infusion without spending materials and preserves submission callbacks', async () => {
    const card = begin(), submission = observer(), resolved = vi.fn(), energy = runtime.energy;
    await engine.queueCardExecution('cast', card, [], runtime.foes[0], true, false, [], resolved, submission, true);
    await vi.waitFor(() => expect(resolved).toHaveBeenCalledTimes(1));
    expect(game.hp).toBe(57); expect(runtime.hand).toContain('material'); expect(runtime.hand).not.toContain('cast');
    expect(runtime.energy).toBe(energy); expect(runtime.infuseFuels).toBe(0);
    expect(submission.queued).toHaveBeenCalledTimes(1); expect(submission.commit).toHaveBeenCalledTimes(1);
    expect(submission.reject).not.toHaveBeenCalled(); expect(submission.error).not.toHaveBeenCalled(); expect(resolved).toHaveBeenCalledTimes(1);
  });
  it('legacy five-argument free casts retain ordinary effects and defaults', async () => {
    const card = begin({ id: 'facade-normal', name: '普通回复', type: '法术', cost: 2, heal: 3, desc: '回复3点生命' }), energy = runtime.energy;
    await engine.queueCardExecution('cast', card, [], runtime.foes[0], true);
    expect(game.hp).toBe(53); expect(runtime.energy).toBe(energy); expect(runtime.hand).toContain('material'); expect(runtime.infuseFuels).toBe(0);
  });
});
