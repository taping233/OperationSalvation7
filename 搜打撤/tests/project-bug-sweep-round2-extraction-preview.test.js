import { expect, it } from 'vitest';
import { previewExtraction } from '../game/src/run/extraction-preview.js';
import { extractionPocketOutcome } from '../game/src/hub/extraction.commands.js';
import { RULE_CONFIG } from '../game/src/core/rule-config.js';

const sha = { id:'sha', name:'初始攻击', type:'武术', rarity:'初始' };
const career = { id:'career', name:'职业招式', type:'法术', rarity:'职业' };
const spell = { id:'spell', name:'可复原法术', type:'法术', rarity:'史诗' };
const Base = { isSha:card => card.id === sha.id };

it.each([
  [[{ card:sha, count:3 }], 3, 0],
  [[{ card:career, count:2 }], 2, 0],
  [[{ card:spell, count:3 }], 3, 3],
  [[{ card:sha, count:3 }, { card:career, count:2 }, { card:spell, count:3 }], 8, 3],
  [[], 0, 0],
])('pocket preview keeps total size but applies the real eligibility rule (%j)', (usedPocket, total, eligible) => {
  const game = { usedPocket, ownedCards:[], inventory:[] };
  const before = JSON.stringify(game);
  const preview = previewExtraction(game, Base);
  const allRollsKept = extractionPocketOutcome({ keptPocket:usedPocket, totalPocketCount:total, lostPocketCount:0 }, Base.isSha);
  expect(preview.pocketTotal).toBe(total);
  expect(allRollsKept.keptCount).toBe(eligible);
  expect(preview.expectedKept).toBeCloseTo(allRollsKept.keptCount * RULE_CONFIG.extraction.pocketKeepChance);
  expect(JSON.stringify(game)).toBe(before);
});
