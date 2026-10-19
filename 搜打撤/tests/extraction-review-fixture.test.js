import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createExtractionCommands, buildExtractionReceipt, extractionPocketOutcome } from '../game/src/hub/extraction.commands.js';
import { extractionStashHTML, extractionDoneHTML } from '../game/src/ui/extraction-rewards-view.js';
import { characterFor } from '../game/src/core/characters.js';
import { addXpToProgress } from '../game/src/hub/meta-progression.js';

const source = readFileSync('game/dev/extraction-rewards-review.html', 'utf8');
const ids = ['tt12-felguard','tt3-azure-sword','tt3-ice-spike','tt2-pearlbox','tt3eq-mistbox','tt12-backupcell','tt4-woodify'];
let h;
beforeEach(async () => {
  document.body.innerHTML = source.match(/<body[^>]*>([\s\S]*?)<script type="module">/)[1];
  const script = source.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\s*$/gm, '');
  const SDT = { Icons: { rich: html => html } };
  const rulesSlice = { rarityOf: c => c.rarity, sellPrice: c => c.value };
  const dataSlice = { cards: ids.map((id,i) => ({ id, name: `夹具卡${i}`, rarity:'古朴', value:7-i })) };
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  // Execute the actual dev fixture body, with only card artwork/catalog and icon rendering substituted.
  // Commands and receipt/render functions are the production imports, and all fixture controls are real handlers.
  h = await new AsyncFunction('SDT','sdtDefine','rulesSlice','dataSlice','cardHTML',
    'createExtractionCommands','buildExtractionReceipt','extractionPocketOutcome','extractionStashHTML','extractionDoneHTML','characterFor','addXpToProgress',
    script + '\nreturn { reset, deposit, finish, state:()=>({game,base,finalReceipt}) };')(
    SDT,(key,value)=>{SDT[key]=value;},rulesSlice,dataSlice,c=>`<div class="hs-card">${c.name}</div>`,
    createExtractionCommands,buildExtractionReceipt,extractionPocketOutcome,extractionStashHTML,extractionDoneHTML,characterFor,addXpToProgress);
});

it('actual fixture bulk action deposits seven and finishes with the same receipt', async () => {
  document.querySelector('[data-act=exSmart]').click();
  await vi.waitFor(() => expect(h.state().base.data.stats.stashTotal).toBe(7));
  expect(h.state().game.pendingExtraction.remainingCards.reduce((n,s)=>n+s.count,0)).toBe(12);
  await h.finish();
  expect(h.state().finalReceipt.netTake).toMatchObject({cardsStashed:7,wood:2,rations:3,pocketKept:20});
  expect(h.state().finalReceipt.losses.lostCount).toBe(12);
  expect(document.querySelector('.exr-section-title').textContent).toContain('已入库 7 张');
  expect(document.querySelector('[data-act=goBase]')).not.toBeNull();
});

it('full storage disables deposits but still reaches an honest zero-card receipt', async () => {
  await h.reset('full');
  expect(document.querySelector('[data-act=exSmart]').disabled).toBe(true);
  expect([...document.querySelectorAll('[data-act=exStash]')].every(b=>b.disabled)).toBe(true);
  await h.finish();
  expect(h.state().finalReceipt.netTake.cardsStashed).toBe(0);
  expect(h.state().finalReceipt.losses.lostCount).toBe(19);
});

it('single stack stores two of five without swallowing the remaining three', async () => {
  await h.reset('single');
  document.querySelector('[data-act=exStash]').click();
  await vi.waitFor(() => expect(h.state().base.data.stats.stashTotal).toBe(2));
  expect(h.state().game.pendingExtraction.remainingCards[0].count).toBe(3);
  expect(document.querySelector('.exr-brought').textContent).toBe('出发曾带入 ×2');
  expect(document.querySelector('.exr-brought').title).toContain('不代表剩余卡的来源');
  await h.finish();
  expect(h.state().finalReceipt.netTake.cardsStashed).toBe(2);
  expect(h.state().finalReceipt.losses.lostCount).toBe(3);
});

it('empty rewards and the final-receipt control both complete using real commands', async () => {
  await h.reset('empty');
  await h.finish();
  expect(h.state().finalReceipt.netTake).toMatchObject({cardsStashed:0,pocketKept:0,wood:0,rations:0});
  await document.querySelector('#complete').onclick();
  expect(h.state().finalReceipt.netTake.cardsStashed).toBe(7);
  expect(h.state().game.runActive).toBe(false);
  expect(h.state().finalReceipt.growth).toMatchObject({ characterId: 'wu', characterName: '无',
    awardedXp: 168, actualXp: 168, overflowXp: 0, before: { lv: 1, xp: 40 }, after: { lv: 3, xp: 68 },
    levelsGained: 2, effects: [{ label: '出征生命加成', before: 0, after: 2 }] });
  expect(h.state().base.data.characters.wu).toEqual({ lv: 3, xp: 68 });
  expect(document.querySelector('.exr-growth').closest('details')).toBeNull();
  expect(document.querySelector('.exr-growth').textContent).toContain('撤离经验 +168');
  expect(document.querySelector('.exr-growth-effects').textContent).toContain('出征生命加成+0 → +2');
});


it('display-only controls use the real view, focus cancel and never finish fixture state', async () => {
  expect(document.querySelector('#fixtureControls').textContent).toContain('展示夹具，确认守卫由单测验证');
  await document.querySelector('#confirm').onclick();
  expect(document.activeElement.dataset.act).toBe('exCancelFinish');
  const before = JSON.stringify(h.state());
  document.querySelector('[data-act=exConfirmFinish]').click();
  expect(JSON.stringify(h.state())).toBe(before);
  expect(document.querySelector('.exr-notice').textContent).toContain('展示不执行');
  document.querySelector('[data-act=exCancelFinish]').click();
  expect(document.querySelector('.exr-confirm')).toBeNull();
  expect(JSON.stringify(h.state())).toBe(before);
  await document.querySelector('#longConfirm').onclick();
  const items=[...document.querySelectorAll('.exr-confirm-list li')];
  expect(items).toHaveLength(30);
  expect(new Set(items.map(item=>item.querySelector('span').textContent)).size).toBe(30);
  expect(document.activeElement.dataset.act).toBe('exCancelFinish');
  expect(document.querySelector('.exr-confirm-actions').closest('.exr-confirm-list')).toBeNull();
  await document.querySelector('#zero').onclick();
  expect(document.querySelector('.exr-confirm')).toBeNull();
  expect(document.querySelector('[data-act=exFinish]').textContent).toContain('展示不执行');
  const emptyBefore = JSON.stringify(h.state());
  document.querySelector('[data-act=exFinish]').click();
  expect(JSON.stringify(h.state())).toBe(emptyBefore);
  expect(source).not.toMatch(/import .*game\.session|import .*game\.run\.altar/);
});
