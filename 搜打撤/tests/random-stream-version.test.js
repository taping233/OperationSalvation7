import { describe, expect, it } from 'vitest';
import { SeededRandomService, hashSeed, nextRandom } from '../game/src/core/random.js';
import { createDeckOperations } from '../game/src/battle/bag/battle.deck.factory.js';
import { NON_RULE_RANDOM_STREAMS, rulesRandomSnapshot } from '../game/src/core/random-streams.js';

describe('versioned rule random streams', () => {
  it('legacy snapshots without a version consume the original named streams in exact order', () => {
    const source=new SeededRandomService(7);
    const oldCardState=nextRandom(hashSeed('7:card')).state;
    const oldBattleState=nextRandom(hashSeed('7:battle')).state;
    source.restore({seed:7,streams:{card:oldCardState,battle:oldBattleState}});
    const first=nextRandom(oldCardState),second=nextRandom(first.state);
    expect(source.random('card','reward')).toBe(first.value);
    expect(source.random('card','shuffle')).toBe(second.value);
    const battleFirst=nextRandom(oldBattleState),battleSecond=nextRandom(battleFirst.state);
    expect(source.random('battle','generation')).toBe(battleFirst.value);
    expect(source.random('battle','target')).toBe(battleSecond.value);
    expect(source.snapshot()).toMatchObject({version:1,streams:{card:second.state,battle:battleSecond.state}});
    expect(source.snapshot().streams).not.toHaveProperty('shuffle');
  });
  it('new runs isolate real deck shuffles from reward, target, enemy and FX draws and preserve round-trip continuation', () => {
    const noisy=new SeededRandomService(919),baseline=new SeededRandomService(919);
    for(let i=0;i<40;i++){
      noisy.random('card','reward');noisy.random('loot','reward');noisy.random('battle','target');
      noisy.random('battle','generation');noisy.random('battle','enemy');noisy.random('fx');
    }
    const cards=Array.from({length:20},(_,i)=>i);
    expect(createDeckOperations(noisy).shuffleCards([...cards])).toEqual(createDeckOperations(baseline).shuffleCards([...cards]));
    expect(noisy.snapshot().version).toBe(2);
    const saved=noisy.snapshot(),restored=new SeededRandomService(1);restored.restore(saved);
    for(const purpose of ['shuffle','reward','target','generation','enemy'])expect(restored.random('battle',purpose)).toBe(noisy.random('battle',purpose));
  });
  it('map/unannotated stream keys retain the same sequence regardless of random version', () => {
    const modern=new SeededRandomService(20261023),legacy=new SeededRandomService();legacy.restore({seed:20261023,streams:{}});
    for(const stream of ['map','gameplay','layout'])expect(Array.from({length:30},()=>modern.random(stream))).toEqual(Array.from({length:30},()=>legacy.random(stream)));
  });
  it('the replay rule projection shares the cosmetic stream list and still includes every rule stream', () => {
    const snapshot={seed:31,version:2,streams:Object.fromEntries([...NON_RULE_RANDOM_STREAMS,'shuffle','reward','target','generation','enemy'].map((key,i)=>[key,i]))};
    const before=structuredClone(snapshot),projected=rulesRandomSnapshot(snapshot);
    expect(Object.keys(projected.streams)).toEqual(['shuffle','reward','target','generation','enemy']);
    expect(snapshot).toEqual(before);
    expect(NON_RULE_RANDOM_STREAMS).toContain('fx');
  });
});
