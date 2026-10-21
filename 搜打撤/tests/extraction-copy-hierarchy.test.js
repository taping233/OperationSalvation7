import { expect, it } from 'vitest';
import { extractionStashHTML, extractionDoneHTML } from '../game/src/ui/extraction-rewards-view.js';

const card = { id:'copy-card', name:'测试卡', rarity:'古朴' };
const stack = { card, count:2 };
const cardHTML = () => '<div class="hs-card">测试卡</div>';

it('keeps pending counts and saved confirmation without repeating selection instructions', () => {
  document.body.innerHTML = extractionStashHTML({ cardHTML, remainingCards:[stack], room:2 });
  expect(document.querySelector('.exr-section-title').textContent).toContain('待入库 2 张');
  expect(document.querySelector('.exr-section-title').textContent).not.toContain('选择要留下');
  document.body.innerHTML = extractionStashHTML({ cardHTML, savedCards:[stack] });
  expect(document.querySelector('.exr-section-title').textContent).not.toContain('选择要留下');
  expect(document.querySelector('.exr-store').textContent).not.toContain('卡牌整理完毕');
  expect(document.querySelector('.exr-empty').textContent).toContain('卡牌已妥善入库');
  expect(document.querySelector('.exr-finish-note').textContent).toContain('已保存至基地仓库');
  expect(document.querySelector('[data-act="exFinish"]').textContent).toContain('完成整理');
});

it('keeps zero-loot wording truthful and leaves irreversible warnings visible', () => {
  document.body.innerHTML = extractionStashHTML({ cardHTML });
  expect(document.querySelector('.exr-empty').textContent).toContain('本次没有待入库卡牌');
  expect(document.body.textContent).not.toContain('卡牌整理完毕');
  document.body.innerHTML = extractionStashHTML({ cardHTML, remainingCards:[stack], room:0, confirmFinish:true });
  expect(document.querySelector('.exr-confirm').textContent).toContain('永久散失');
  expect(document.querySelector('.exr-confirm').textContent).toContain('出发带入卡同样适用');
  expect(document.querySelector('[data-act="exConfirmFinish"]').textContent).toContain('放弃 2 张');
  expect(document.querySelector('[data-act="exCancelFinish"]')).not.toBeNull();
});

it('receipt gallery shows the count once in its heading and keeps final save confirmation', () => {
  document.body.innerHTML = extractionDoneHTML({ cardHTML, receipt:{ savedCards:[stack], netTake:{ cardsStashed:2 } } });
  expect(document.querySelector('.exr-section-title').textContent).toContain('已入库 2 张');
  expect(document.querySelector('.exr-section-title p')).toBeNull();
  expect(document.querySelector('.exr-eyebrow').textContent).toContain('收获已保存');
  expect(document.querySelector('.exr-finish-note').textContent).toContain('本次收获已保存');
  expect(document.querySelector('[data-act="goBase"]')).not.toBeNull();
});
