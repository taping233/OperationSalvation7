// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { rewardCardState, rewardProgress } from '../../game/src/ui/reward-state.js';
import { claimResourceReward, resourceRewardAt } from '../../game/src/run/node-reward-state.js';
import { createRewardOrganizer } from '../../game/src/hub/game.reward-organizer.js';
import { openRewardCapacityOrganizer } from '../../game/src/ui/reward-capacity-organizer.js';

const seed = 20261019;
const steps = fc.array(fc.record({ action: fc.constantFrom('take', 'lose', 'reload'), index: fc.integer({ min: -2, max: 22 }) }), { minLength: 1, maxLength: 60 });

describe('real reward modules: generated sequences', () => {
  it('presentation partitions every card exactly once, even with repeated/overlapping settled indices', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 20 }), steps, (count, sequence) => {
      const cards = Array.from({ length: count }, (_, id) => Object.freeze({ id: `card-${id}` }));
      let taken = new Set(), lost = new Set();
      for (const step of sequence) {
        if (step.action === 'take') taken.add(step.index);
        if (step.action === 'lose') lost.add(step.index);
        if (step.action === 'reload') {
          taken = new Set(JSON.parse(JSON.stringify([...taken])));
          lost = new Set(JSON.parse(JSON.stringify([...lost])));
        }
        const before = JSON.stringify([[...taken], [...lost], cards]);
        const result = rewardProgress(cards, taken, lost);
        const states = cards.map((_, index) => rewardCardState(taken, lost, index));
        expect(result.takenCount + result.lostCount + result.pending.length).toBe(count);
        expect(result.takenCount).toBe(states.filter(state => state === 'received').length);
        expect(result.lostCount).toBe(states.filter(state => state === 'forfeited').length);
        expect(new Set([...result.received, ...result.pending]).size).toBe(result.received.length + result.pending.length);
        expect(result.received).toEqual(cards.filter((_, index) => taken.has(index)));
        expect(result.pending).toEqual(cards.filter((_, index) => !taken.has(index) && !lost.has(index)));
        expect(JSON.stringify([[...taken], [...lost], cards])).toBe(before);
      }
    }), { seed, numRuns: 400 });
  });

  it('resource grants succeed at most once across failures, invalid indices, repeated confirmations and reloads', () => {
    const action = fc.record({ index: fc.oneof(fc.integer({ min: -3, max: 5 }), fc.constant(0.5)), accepts: fc.boolean(), reload: fc.boolean() });
    fc.assert(fc.property(fc.array(action, { minLength: 1, maxLength: 60 }), sequence => {
      let game = { layerIdx: 0, trackPos: 2 };
      let drawCalls = 0, receiveCalls = 0, grants = 0;
      const draw = () => { drawCalls++; return [{ id: 'a' }, { id: 'b' }]; };
      let record = resourceRewardAt(game, draw);
      for (const step of sequence) {
        const wasTaken = record.taken;
        const callsBefore = receiveCalls, grantsBefore = grants;
        const accepted = claimResourceReward(record, step.index, () => {
          receiveCalls++;
          if (step.accepts) grants++;
          return step.accepts;
        });
        const valid = Number.isInteger(step.index) && step.index >= 0 && step.index < 2;
        expect(accepted).toBe(wasTaken === null && valid && step.accepts);
        expect(receiveCalls - callsBefore).toBe(wasTaken === null && valid ? 1 : 0);
        expect(grants - grantsBefore).toBe(accepted ? 1 : 0);
        expect(grants).toBeLessThanOrEqual(1);
        expect(record.taken).toBe(accepted ? step.index : wasTaken);
        if (step.reload) game = JSON.parse(JSON.stringify(game));
        record = resourceRewardAt(game, draw);
        expect(record.cardIds).toEqual(['a', 'b']);
        expect(drawCalls).toBe(1);
        expect(record.taken === null ? 0 : 1).toBe(grants);
      }
    }), { seed: seed + 1, numRuns: 400 });
  });

  it('production inventory adapter keeps double-confirm discard and repeated final claim idempotent', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 2, max: 4 }), { minLength: 1, maxLength: 4 }),
      fc.nat({ max: 20 }), fc.integer({ min: 2, max: 8 }), (counts, selection, repeats) => {
        document.body.innerHTML = '<div id="overlay"><div id="reward-body"></div></div>';
        const UI = { el: { overlay: document.querySelector('#overlay'), ovBody: document.querySelector('#reward-body') },
          showOverlay: (_, html) => { UI.el.ovBody.innerHTML = html; } };
        const game = { battleActive: false, ownedCards: counts.flatMap((count, index) =>
          Array.from({ length: count }, (_, item) => ({ uid: `${index}:${item}`, card: { name: `stack-${index}` } }))),
        stackCapOf: () => 99 };
        const usedSlots = () => new Set(game.ownedCards.filter(item => !item.safe).map(item => item.card.name)).size;
        game.canReceiveCard = () => usedSlots() < counts.length;
        let discards = 0, moves = 0, grants = 0, claimCalls = 0;
        const open = createRewardOrganizer({ UI, game, shaName: '杀', usedSlots, bagCap: () => counts.length,
          safeUsed: () => new Set(game.ownedCards.filter(item => item.safe).map(item => item.card.name)).size,
          safeCap: () => 100,
          moveStackSafe: (name, safe, { uids }) => {
            moves++;
            for (const item of game.ownedCards) if (uids.includes(item.uid)) item.safe = safe;
            return true;
          },
          discardOwnedCard: (name, safe, uid) => {
            const index = game.ownedCards.findIndex(item => item.uid === uid && item.card.name === name && !!item.safe === safe);
            if (index < 0) return false;
            game.ownedCards.splice(index, 1); discards++; return true;
          },
        });
        const reward = { cardIds: ['reward'], taken: null };
        const root = open({ card: { name: 'reward' }, current: () => true,
          onReturn: () => { throw new Error('No automatic return is allowed'); },
          onFullBag: () => { throw new Error('No automatic full-bag navigation is allowed'); },
          onClaim: () => { claimCalls++; claimResourceReward(reward, 0, () => {
            grants++; game.ownedCards.push({ uid: 'claimed-reward', card: { name: 'reward' } }); return true;
          }); },
        });
        const index = selection % counts.length;
        root.querySelector(`[data-organize="discard"][data-index="${index}"]`).click();
        const confirm = root.querySelector('[data-organize="confirm"]');
        for (let repeat = 0; repeat < repeats; repeat++) confirm.click();
        expect(discards).toBe(1);
        expect(grants).toBe(0);
        expect(root.querySelector('[data-organize="claim"]').disabled).toBe(true);
        const safe = root.querySelector(`[data-organize="safe"][data-index="${index}"]`);
        for (let repeat = 0; repeat < repeats; repeat++) safe.click();
        expect(moves).toBe(1);
        expect(grants).toBe(0);
        const claim = root.querySelector('[data-organize="claim"]');
        expect(claim.disabled).toBe(false);
        game.battleActive = true; claim.click();
        expect(claimCalls).toBe(0);
        game.battleActive = false;
        for (let repeat = 0; repeat < repeats; repeat++) claim.click();
        expect(claimCalls).toBe(1);
        expect(grants).toBe(1);
        expect(reward.taken).toBe(0);
        expect(game.ownedCards.length).toBe(counts.reduce((sum, count) => sum + count, 0));
        expect(new Set(game.ownedCards.map(item => item.uid)).size).toBe(game.ownedCards.length);
        document.body.innerHTML = '';
      }), { seed: seed + 3, numRuns: 120 });
  });

  it('real organizer never grants implicitly or repeats terminal callbacks/committed discard under stale UI sequences', () => {
    const action = fc.record({
      kind: fc.constantFrom('discard', 'confirm', 'keep', 'safe', 'claim', 'return', 'bag', 'capacity', 'safe-capacity', 'current', 'reorder', 'replay'),
      index: fc.nat({ max: 10 }), value: fc.boolean(),
    });
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 4 }),
      fc.array(action, { minLength: 1, maxLength: 35 }), (counts, sequence) => {
        document.body.innerHTML = '<div id="overlay"><div id="reward-body"></div></div>';
        const UI = { el: { overlay: document.querySelector('#overlay'), ovBody: document.querySelector('#reward-body') },
          showOverlay: (_, html) => { UI.el.ovBody.innerHTML = html; } };
        let stacks = counts.map((count, index) => ({ card: { name: `stack-${index}` }, count,
          uids: Array.from({ length: count }, (_, item) => `${index}:${item}`) }));
        const initial = counts.reduce((sum, count) => sum + count, 0);
        const moved = new Set(), discarded = new Set();
        let fits = false, safeFits = true, current = true, terminal = 0, claimCalls = 0, grants = 0;
        const record = { cardIds: ['reward'], taken: null };
        const root = openRewardCapacityOrganizer({
          UI, card: { name: '待领取' }, readStacks: () => [...stacks], canReceive: () => fits,
          capacity: () => '受控容量', current: () => current,
          safeAvailability: () => ({ ok: safeFits, reason: safeFits ? '' : '安全格满' }),
          moveToSafe: stack => { for (const uid of stack.uids) { expect(moved.has(uid) || discarded.has(uid)).toBe(false); moved.add(uid); } stacks = stacks.filter(item => item !== stack); return true; },
          discardOne: stack => { const uid = stack.uids.shift(); expect(discarded.has(uid) || moved.has(uid)).toBe(false); discarded.add(uid); stack.count--; stacks = stacks.filter(item => item.count); return true; },
          onReturn: () => { terminal++; }, onFullBag: () => { terminal++; },
          onClaim: () => { terminal++; claimCalls++; claimResourceReward(record, 0, () => { grants++; return true; }); },
        });
        const history = [];
        // Capture real generated nodes before every event, including subsequently detached buttons.
        for (const step of sequence) {
          const beforeGrant = grants, beforeTerminal = terminal;
          const beforeMoved = moved.size, beforeDiscarded = discarded.size;
          const beforeLive = current;
          let clicked = null;
          if (step.kind === 'capacity') fits = step.value;
          else if (step.kind === 'safe-capacity') safeFits = step.value;
          else if (step.kind === 'current') current = step.value;
          else if (step.kind === 'reorder') stacks.reverse();
          else {
            const candidates = step.kind === 'replay' ? history : [...root.querySelectorAll(`[data-organize="${step.kind}"]`)];
            clicked = candidates[step.index % candidates.length] || null;
            history.push(...root.querySelectorAll('[data-organize]'));
            clicked?.click();
          }
          if (grants > beforeGrant) {
            expect(clicked?.dataset.organize).toBe('claim');
            expect(fits && beforeLive).toBe(true);
          }
          if (discarded.size > beforeDiscarded) expect(clicked?.dataset.organize).toBe('confirm');
          if (moved.size > beforeMoved) expect(clicked?.dataset.organize).toBe('safe');
          if (!beforeLive && clicked) {
            expect([grants, terminal, moved.size, discarded.size]).toEqual([beforeGrant, beforeTerminal, beforeMoved, beforeDiscarded]);
          }
          expect(terminal).toBeLessThanOrEqual(1);
          expect(claimCalls).toBeLessThanOrEqual(1);
          expect(grants).toBe(claimCalls);
          const remaining = stacks.flatMap(stack => stack.uids);
          expect(remaining.length + moved.size + discarded.size).toBe(initial);
          expect(new Set([...remaining, ...moved, ...discarded]).size).toBe(initial);
          for (const stack of stacks) expect(stack.count).toBe(stack.uids.length);
        }
        // A deterministic suffix ensures every generated nonterminal page exercises actual
        // enabled claim + repeated confirm, instead of relying on random coverage alone.
        if (!terminal) {
          current = true; fits = true;
          root.querySelector('[data-organize="discard"]')?.click();
          root.querySelector('[data-organize="keep"]')?.click();
          const claim = root.querySelector('[data-organize="claim"]');
          if (claim && !claim.disabled) {
            claim.click(); claim.click();
            expect(claimCalls).toBe(1);
            expect(grants).toBe(1);
          }
        }
        document.body.innerHTML = '';
      }), { seed: seed + 2, numRuns: 120 });
  });
});
