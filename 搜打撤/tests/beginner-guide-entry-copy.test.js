import { describe, expect, it } from 'vitest';
import guide from '../game/data/beginner-guide.json';
import { actionModeName } from '../game/src/hub/hub.home-v3.js';

describe('新手指南入口与当前操作文案', () => {
  it('模式名称使用基地当前显示名称，指向实际整备入口', () => {
    const prepare = guide.pages.find(page => page.id === 'prepare');
    const text = prepare.steps.map(step => step.text).join('\n');
    for (const mode of ['normal', 'elite']) expect(text).toContain(actionModeName(mode));
    expect(text).toContain('出征整备');
    expect(text).not.toContain('点击“选择人物”');
  });
  it('说明地图预览后的确认动作，而非承诺单击直接移动', () => {
    expect(guide.pages.find(page => page.id === 'map').steps[0].text).toContain('进入该地点');
  });
});
