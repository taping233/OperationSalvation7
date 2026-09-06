import { describe, expect, it } from 'vitest';
import { Story } from 'inkjs';
import storyContent from '../game/src/generated/narrative-events.js';
import { KNOTS } from '../game/src/narrative.js';

// ink 分支全量走查（dialogue-systems / procedural-gen 验证纪律）：
// 对每个事件 knot，按选择序列 BFS 展开全部路径，断言
// ① 每条路径都到达终点（无死路：没有内容也没有选项）；
// ② 路径数在深度上限内收敛（无无限循环分支）。

const MAX_DEPTH = 8;

// 沿选择序列走一个 knot，返回 { terminal, dead, choices }
function walk(knot, path) {
  const story = new Story(storyContent);
  story.ChoosePathString(knot);
  story.ContinueMaximally();
  for (const idx of path) {
    if (idx >= story.currentChoices.length) return { dead: true, choices: 0 };
    story.ChooseChoiceIndex(idx);
    story.ContinueMaximally();
    if (story.hasError) return { dead: true, choices: 0 };
  }
  const terminal = !story.canContinue && story.currentChoices.length === 0;
  return { terminal, dead: false, choices: story.currentChoices.length };
}

describe('ink 事件分支全量走查', () => {
  for (const [cardId, knot] of Object.entries(KNOTS)) {
    it(`【${cardId}】所有分支可达终点且深度收敛`, () => {
      let paths = [[]];
      let terminals = 0;
      let deadPaths = [];
      for (let depth = 0; depth <= MAX_DEPTH; depth++) {
        const next = [];
        for (const path of paths) {
          const r = walk(knot, path);
          if (r.dead) deadPaths.push(path.join('>'));
          else if (r.terminal) terminals++;
          else for (let i = 0; i < r.choices; i++) next.push([...path, i]);
        }
        if (deadPaths.length) break;
        if (!next.length) break;   // 全部路径已到终点
        paths = next;
        expect(depth, `${cardId} 分支深度超过 ${MAX_DEPTH}（疑似循环分支）`).toBeLessThan(MAX_DEPTH);
      }
      expect(deadPaths, `${cardId} 存在死分支：${deadPaths.join(' / ')}`).toEqual([]);
      expect(terminals, `${cardId} 至少应有一条可达终点路径`).toBeGreaterThan(0);
    });
  }
});
