import { describe, expect, it } from 'vitest';
import { eventNarrative, parseChoice } from '../game/src/narrative.js';
import { EVENT_SCENE_META } from '../game/src/game.run.data.js';

describe('inkjs event narrative bridge', () => {
  it('parses hidden choice metadata without leaking it into the label', () => {
    expect(parseChoice('冒险挖深@@effect=deep@@detail=高风险@@tone=danger')).toEqual({
      label: '冒险挖深', effect: 'deep', detail: '高风险', tone: 'danger',
    });
  });

  it('loads a branching event and advances the selected branch', () => {
    const narrative = eventNarrative('tt6-goldmine');
    expect(narrative.intro).toContain('矿井');
    expect(narrative.choices.map(choice => choice.label)).toEqual(['收下 3 币', '冒险挖深']);
    expect(narrative.choices[1].choose()).toContain('富矿');
  });

  it('keeps unsupported legacy events on the existing fallback path', () => {
    expect(eventNarrative('legacy-custom-event')).toBeNull();
  });

  it('covers every tt6 event with an ink knot whose choices all carry effects', () => {
    const ids = Object.keys(EVENT_SCENE_META);
    expect(ids).toHaveLength(10);
    for (const id of ids) {
      const narrative = eventNarrative(id);
      expect(narrative, `${id} 应有 ink 剧情潜文本`).not.toBeNull();
      expect(narrative.intro.length, `${id} 开场叙事不应为空`).toBeGreaterThan(0);
      expect(narrative.choices.length, `${id} 至少有一个选项`).toBeGreaterThan(0);
      for (const choice of narrative.choices) {
        expect(choice.effect, `${id} 选项「${choice.label}」应绑定效果端口`).toBeTruthy();
      }
    }
  });
});
