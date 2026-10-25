import { afterEach, describe, expect, it, vi } from 'vitest';
import { installExpeditionFeedback } from '../game/src/ui/expedition-feedback.js';

let dispose;
afterEach(() => { dispose?.(); vi.useRealTimers(); document.body.innerHTML = ''; document.body.className=''; });
const emit = detail => window.dispatchEvent(new CustomEvent('sdt:expedition-feedback', { detail }));
function setup() {
  document.body.innerHTML = '<main id="viewport"></main><div id="overlay" hidden></div><section id="routePanel"><button>路线</button></section>';
  dispose = installExpeditionFeedback({ isCurrentCell:key => key === '0,2', cardHTML:card => `<article class="hs-card">${card.name}</article>` });
}
describe('远征临时反馈', () => {
  it('拒绝过期营火，只显示实际收益并按时清理', () => {
    vi.useFakeTimers(); setup();
    emit({kind:'fire',cellKey:'0,1',hpGain:8,hp:35,maxHp:35});
    expect(document.querySelector('.expedition-feedback')).toBeNull();
    emit({kind:'fire',cellKey:'0,2',hpGain:0,hp:35,maxHp:35,cards:[],reason:'生命已满'});
    expect(document.querySelector('.expedition-feedback').textContent).toContain('生命 +0');
    vi.advanceTimersByTime(6000);
    expect(document.querySelector('.expedition-feedback').classList.contains('expedition-feedback-leaving')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.expedition-feedback')).toBeNull();
  });
  it('入城不再生成小条，营火在新节点立即清理', async () => {
    setup(); const cards = [{id:'actual',name:'实际职业卡'}];
    emit({kind:'entry',cards,characterName:'无'});
    expect(document.querySelector('.expedition-feedback')).toBeNull();
    expect(cards).toEqual([{id:'actual',name:'实际职业卡'}]);
    emit({kind:'fire',cellKey:'0,2',hpGain:2,hp:32,maxHp:35,cards:[]});
    expect(document.querySelector('.expedition-feedback').textContent).toContain('生命 +2');
    document.getElementById('overlay').hidden = false;
    await Promise.resolve();
    expect(document.querySelector('.expedition-feedback')).toBeNull();
  });
  it('手动关闭退场后重开，旧完成回调不能移除新提示', () => {
    vi.useFakeTimers(); setup();
    const detail={kind:'fire',cellKey:'0,2',hpGain:1,hp:30,maxHp:35};
    emit(detail);
    const old=document.querySelector('.expedition-feedback');
    old.querySelector('button').click();
    expect(old.classList.contains('expedition-feedback-leaving')).toBe(true);
    emit({...detail,hpGain:2});
    const fresh=document.querySelector('.expedition-feedback');
    expect(old.isConnected).toBe(false);
    vi.advanceTimersByTime(200);
    expect(fresh.isConnected).toBe(true);
    expect(fresh.textContent).toContain('生命 +2');
  });
  it('减少动态模式立即清理，不挂视觉尾巴', () => {
    vi.useFakeTimers(); setup(); document.body.classList.add('reduce-motion');
    emit({kind:'fire',cellKey:'0,2',hpGain:1,hp:30,maxHp:35});
    document.querySelector('.expedition-feedback button').click();
    expect(document.querySelector('.expedition-feedback')).toBeNull();
  });
});
