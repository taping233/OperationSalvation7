import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { eventSceneHTML } from '../game/src/ui/node-scene-view.js';

const css = postcss.parse(readFileSync(resolve('game/css/entry-events.css'), 'utf8'));
const shell = '#overlay .card.page .event-themed';
const page = '#overlay .card.page .pg.node-pg.event-themed';
const node = '#overlay .card.page .pg.node-pg.event-scene:not(.event-themed)';
function declarations(selector) {
  const values = {};
  css.walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(decl => { values[decl.prop] = decl.value; });
  });
  return values;
}
function fontSize(selector) {
  return Number(declarations(selector).font.match(/(?:^|\s)(\d+)px\//)?.[1]);
}
function scene(tone, body = '', foot = '', sub = '风雪被隔在火光之外。') {
  const root = document.createElement('div');
  root.innerHTML = `<div id="overlay"><div class="card page">${eventSceneHTML({
    tone, title:'营火休整', sub, region:'外周营地', layer:0, body, foot,
  })}</div></div>`;
  return root;
}

// Static CSS/DOM contracts; clipping, text contrast and gameplay still need the built-in browser.
describe('事件共用场景阅读层', () => {
  it('右侧阅读底随内容收拢，长内容单独滚动而页脚保持可用', () => {
    expect(declarations(`${shell} .event-decisions`)).toMatchObject({
      'align-self':'center', 'box-sizing':'border-box', 'max-height':'100%', 'min-height':'0',
      padding:'24px', 'border-left':'2px solid #99c6bb80',
    });
    expect(declarations(`${shell} .event-decisions`).background).toContain('linear-gradient');
    expect(declarations(`${shell} .event-decisions`).height).toBeUndefined();
    expect(declarations(`${shell} .event-decisions > .node-main`)).toMatchObject({
      flex:'0 1 auto', 'min-height':'0', overflow:'auto', 'overscroll-behavior':'contain',
    });
    expect(declarations(`${shell} .event-decisions > .node-foot`)).toMatchObject({
      flex:'none', display:'flex', 'flex-wrap':'wrap', gap:'12px',
    });
    expect(declarations(`${page} .event-story`).background).toContain('#0a141b');
  });

  it('叙事、后果和裸提示统一22px，标题26px在1188窗口仍可读', () => {
    for (const selector of [
      `${page} .event-narrative`, `${page} .evt-opt > span`,
      `${shell} .node-summary > :is(p,.ov-note,.ov-empty)`, `${shell} .reward-notice`,
    ]) {
      expect(fontSize(selector)).toBe(22);
      expect(fontSize(selector) * 1188 / 1920).toBeGreaterThanOrEqual(13);
    }
    expect(fontSize(`${page} .event-story > .pg-head h2`)).toBe(26);
    expect(fontSize(`${page} .evt-opt > b`)).toBe(26);
    expect(declarations(`${shell} .reward-notice:empty`).display).toBe('none');
  });

  it('主要行动和底部按钮至少60px，确认与次要操作保持明暗层级', () => {
    for (const selector of [
      `${page} .evt-opt`, `${page} .evt-opt > b`, `${shell} .node-foot .ov-btn`,
      `${shell} .event-choice-clear`, `${shell} .event-choice-confirm`,
    ]) {
      expect(parseFloat(declarations(selector)['min-height'])).toBeGreaterThanOrEqual(60);
    }
    expect(declarations(`${shell} .node-foot .ov-btn.ok`)).toMatchObject({
      background:'var(--node-accent)', color:'#10282a',
    });
    expect(declarations(`${shell} .node-foot .ov-btn`).background)
      .not.toBe(declarations(`${shell} .node-foot .ov-btn.ok`).background);
    expect(declarations(`${shell} .event-choice-clear`).background)
      .not.toBe(declarations(`${shell} .event-choice-confirm`).background);
    expect(declarations(`${shell} .event-choice-state`)).toMatchObject({
      'flex-basis':'100%', visibility:'hidden',
    });
  });

  it('火堆长说明和整理/离开操作进入同一局部阅读层', () => {
    const root = scene('fire',
      '<button class="evt-opt" data-act="fireRestGo"><b>休整</b><span>回复生命，随机复原至多2张卡牌</span></button><p class="reward-notice" role="status">背包5/16格；实际复原数量受卡牌叠放及剩余容量限制。</p>',
      '<button class="ov-btn" data-act="fireBag">先整理背包</button><button class="ov-btn" data-act="fireLeave">离开火堆</button>');
    expect(root.querySelector(`${shell} .node-summary > p.reward-notice`)).not.toBeNull();
    expect(root.querySelectorAll(`${shell} .node-foot .ov-btn`)).toHaveLength(2);
    expect(root.querySelector('[data-act="fireRestGo"] > span').textContent).toContain('至多2张');
  });

  it('阅读层只接四类themed场景，不进入补给条列或闸门/祭坛/撤离', () => {
    for (const tone of ['event', 'entry', 'fire', 'pickup']) {
      expect(scene(tone).querySelector(`${shell} .event-decisions`)).not.toBeNull();
    }
    for (const tone of ['door', 'altar', 'extract']) {
      expect(scene(tone).querySelector(`${shell} .event-decisions`)).toBeNull();
    }
    const root = document.createElement('div');
    root.innerHTML = '<div id="overlay"><div class="card page"><div class="entry-supply-strips reward-replica"><p class="reward-notice">尚有补给</p></div></div></div>';
    expect(root.querySelector(`${shell} .reward-notice`)).toBeNull();
  });
});

describe('非themed节点的长规则阅读边界', () => {
  it('与事件同用22px正文和26px标题，结算嵌套提示也不回落到小字', () => {
    for (const selector of [
      `${node} .event-narrative`, `${node} .evt-opt > span`, `${node} .reward-notice`,
      `${node} .node-summary > :is(p,.ov-note,.ov-empty)`,
      `${node} .extraction-outcome :is(.result-line,.ov-note)`,
    ]) expect(fontSize(selector)).toBe(22);
    expect(fontSize(`${node} .event-story > .pg-head h2`)).toBe(26);
    expect(fontSize(`${node} .evt-opt > b`)).toBe(26);
  });

  it('四项长规则在限高主区内可滚动，换行与固定页脚避免被长文本挤出', () => {
    expect(declarations(`${node} .event-decisions`)).toMatchObject({
      'align-self':'center', 'box-sizing':'border-box', 'max-height':'100%', 'min-height':'0', padding:'24px',
    });
    expect(declarations(`${node} .event-decisions`).background).toContain('#0a141b');
    expect(declarations(`${node} .event-decisions`).height).toBeUndefined();
    expect(declarations(`${node} .event-decisions > .node-main`)).toMatchObject({
      flex:'0 1 auto', 'min-width':'0', 'min-height':'0', overflow:'auto', 'scrollbar-gutter':'stable',
    });
    expect(declarations(`${node} .evt-opt`)).toMatchObject({
      'min-width':'0', 'white-space':'normal', 'overflow-wrap':'anywhere', background:'none',
    });
    expect(declarations(`${node} .evt-opt > span`)['max-height']).toBeUndefined();
    expect(declarations(`${node} .event-decisions > .node-foot`)).toMatchObject({
      flex:'none', display:'flex', 'flex-wrap':'wrap',
    });
    expect(declarations(`${node} .node-foot .ov-btn`)).toMatchObject({
      'min-height':'60px', 'max-width':'100%', 'white-space':'normal', 'overflow-wrap':'anywhere',
    });
    expect(declarations(`${node} .evt-opt.ok > b`)).toMatchObject({ background:'var(--node-accent)', color:'#10282a' });
    expect(declarations(`${node} .evt-opt:disabled`).opacity).toBe('1');
    expect(declarations(`${node} .evt-opt:disabled::after`).content).toBe("'不可选'");
  });

  it('祭坛四项保留完整消耗、奖励、容量和每处限次，不增加事件式确认步骤', () => {
    const details = [
      '激活后二选一：① 复原 3 张消耗卡 + 回复 10 血；② 随机获取 1 张传说卡和 1 张装备卡',
      '获得 1 张本职业随机能力卡（现有碎片 2）；需能放下能力卡，背包 16/16 格，放不下时不扣碎片',
      '献祭 1 张道具卡，从消耗区复原 2 张卡牌（每座祭坛限一次）',
      '祭坛保持沉睡——回到当前格子，稍后再来',
    ];
    const labels = ['弃 3 张 · 激活祭坛', '献上 2 枚员工通行证A碎片（不弃牌）', '献祭道具 · 复原卡牌', '离开'];
    const root = scene('altar', details.map((detail, i) => `<button class="evt-opt${i < 2 ? ' ok' : ''}" data-act="altar${i}"><b>${labels[i]}</b><span>${detail}</span></button>`).join(''),
      '<button class="ov-btn" data-act="altarBag">整理背包</button>');
    expect([...root.querySelectorAll(`${node} .evt-opt > span`)].map(el => el.textContent)).toEqual(details);
    expect(root.querySelectorAll(`${node} .node-summary > .evt-opt`)).toHaveLength(4);
    expect(root.querySelector(`${node} .node-foot [data-act="altarBag"]`)).not.toBeNull();
    expect(root.querySelector('.event-choice-confirm')).toBeNull();
  });

  it('闸门保留进入、整理与返回当前层，长目的地标题允许换行', () => {
    const label = '进入第4层 · 污染核心与终局撤离信标所在区域';
    const narrative = '穿过闸门后进入下一层。确认前可返回当前层检查遗漏，或先整理背包。';
    const root = scene('door', `<button class="evt-opt ok" data-act="goDoor"><b>${label}</b></button>`,
      '<button class="ov-btn" data-act="doorBag">整理背包</button><button class="ov-btn" data-act="doorBack">返回当前层</button>', narrative);
    expect(root.querySelector(`${node} .event-narrative`).textContent).toBe(narrative);
    expect(root.querySelector('[data-act="goDoor"] > b').textContent).toBe(label);
    expect([...root.querySelectorAll(`${node} .node-foot [data-act]`)].map(el => el.dataset.act)).toEqual(['doorBag', 'doorBack']);
    expect(root.querySelector('.event-choice-confirm')).toBeNull();
  });

  it('紧急撤离不足条件和长结算不被省略，返回与再出发主次仍独立', () => {
    const hint = '提醒：随身 999 币不会带回基地——离开前记得回商店花掉。';
    const unavailable = '卡牌不足（现有 2/3）——至少需要 3 张卡牌';
    const confirm = scene('exit', `<p class="ov-note">${hint}</p><button class="evt-opt" data-act="payExit" disabled><b>紧急撤离（献祭 3 张卡牌）</b><span>${unavailable}</span></button><button class="evt-opt" data-act="stayHere"><b>继续深入</b><span>留在地图上，继续选择相邻节点</span></button>`);
    expect(confirm.querySelector(`${node} .node-summary > .ov-note`).textContent).toBe(hint);
    expect(confirm.querySelector('[data-act="payExit"]').disabled).toBe(true);
    expect(confirm.querySelector('[data-act="payExit"] > span').textContent).toBe(unavailable);
    const longResult = '下次出发时可以从仓库选择卡牌携带；储备币 999 币留在基地（不进局，用于孵蛋与基地建设）。';
    const result = scene('exit', `<div class="extraction-outcome"><p class="result-line"><span class="ov-note">本局真实入库 10 张 · 仓库总持有 240/240 张</span></p><p class="ov-note">${longResult}</p></div>`,
      '<button class="ov-btn" data-act="goBase">回基地</button><button class="ov-btn ok" data-act="again">再出发</button>');
    expect(result.querySelector(`${node} .extraction-outcome > .ov-note`).textContent).toBe(longResult);
    expect(result.querySelectorAll(`${node} .node-foot .ov-btn`)).toHaveLength(2);
    expect(declarations(`${node} .node-foot .ov-btn.ok`).background).toBe('var(--node-accent)');
  });
});
