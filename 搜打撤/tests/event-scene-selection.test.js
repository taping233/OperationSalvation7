import { describe, expect, it } from 'vitest';
import { eventSceneHTML } from '../game/src/ui/node-scene-view.js';

const scene = body => eventSceneHTML({
  tone:'event', title:'断电终端', sub:'风雪里仍有微弱的灯。', body,
  region:'城市外缘', layer:1, status:{ hp:28, maxHp:40, coins:18, slots:7, capacity:10 },
});

describe('事件选项阅读与执行边界', () => {
  it('多项事件先展示选择状态和独立确认；已知后果仍留在各选项', () => {
    const page = document.createElement('div');
    page.innerHTML = scene('<button class="evt-opt" data-act="choose" data-i="0"><b>接通</b><span>获得补给</span></button><button class="evt-opt" data-act="choose" data-i="1"><b>离开</b><span>保持现状</span></button>');
    expect(page.querySelector('.event-scene').dataset.eventChoiceCount).toBe('2');
    expect(page.querySelector('.event-choice-confirm').disabled).toBe(true);
    expect(page.querySelectorAll('.node-summary > .evt-opt')).toHaveLength(2);
    expect(page.querySelector('.evt-opt span').textContent).toBe('获得补给');
    expect(page.querySelector('.event-resources')).toBeNull();
    expect(page.querySelector('.event-decisions .node-summary')).not.toBeNull();
    expect(page.querySelector('.event-decisions .node-foot')).not.toBeNull();
    expect(page.querySelectorAll('.event-story h2')).toHaveLength(1);
    expect(page.querySelector('.event-choice-announcement').getAttribute('aria-live')).toBe('polite');
  });

  it('单项事件保留直接继续入口', () => {
    const page = document.createElement('div');
    page.innerHTML = scene('<button class="evt-opt" data-act="continue"><b>继续</b></button>');
    expect(page.querySelector('.event-choice-confirm')).toBeNull();
    expect(page.querySelector('[data-act="continue"]')).not.toBeNull();
  });
});
