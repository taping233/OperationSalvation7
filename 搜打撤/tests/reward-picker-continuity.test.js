import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreRewardActionFocus } from '../game/src/ui/reward-scene-view.js';

vi.mock('../game/src/ui/reward-card-feedback.js', () => ({ showRewardCardFeedback:vi.fn() }));
let body, overlay, game, acts, chests;
const cards = Array.from({length:6}, (_, index) => ({id:`continuity-${index}`,name:`测试奖励${index}`,type:'法术',rarity:'稀有',desc:'测试',cost:0}));
const action = (name, index) => body.querySelector(`[data-act="${name}"]${index == null ? '' : `[data-i="${index}"]`}`);
function activate(name, index) { const button = action(name,index); button.focus(); button.click(); }
function restore({choice = false, count = 6, battleSummary} = {}) {
  const reward = {kind:'large',source:'连续领奖测试',title:'领取奖励',cards:cards.slice(0,count),coins:0,coinsReceived:true,
    claimMode:choice ? 'one' : 'all',choiceCount:choice ? 3 : count,taken:[],lost:[],rewardStage:'cards',selected:null,battleSummary};
  const saved = {version:1,seed:7,layerIdx:0,trackPos:0,queue:[{kind:'large',reward}],index:1,current:reward,screen:'cards',context:{onCell:true}};
  expect(chests.restore(game,saved,vi.fn())).toBe(true);
}
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  body = document.querySelector('#ovBody'); overlay = document.querySelector('#overlay'); acts = {};
  body.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button && !button.disabled) acts[button.dataset.act]?.(button.dataset); });
  game = {seed:7,layerIdx:0,trackPos:0,discoveredPairs:{},state:'idle',inventory:[],ownedCards:[],usedSlots:() => game.ownedCards.length,
    bagCap:() => 16,canReceiveCard:() => true,grantCard:vi.fn(card => {game.ownedCards.push({card});return true;}),persistSave:vi.fn(),gainCoins:vi.fn()};
  window.SDT = {UI:{el:{ovBody:body,overlay,ovTitle:document.querySelector('#ovTitle')},act:(name,fn) => {acts[name] = fn;},
    showOverlay:(_,html) => {body.innerHTML = html;overlay.hidden = false;},hideOverlay:() => {overlay.hidden = true;},refresh:vi.fn(),log:vi.fn()},
    Base:{slot:null,bagCap:() => 16},MAP:{chestKinds:{large:{name:'大型物资箱',cards:6}}},Sound:{sfx:vi.fn()},Icons:{rich:html => html},
    Cards:{rarityOf:card => card.rarity,cardHTML:card => `<div class="hs-card"><img src="/${card.id}.webp" alt="">${card.name}</div>`}};
  chests = (await import('../game/src/run/chests.js')).SDT.Chests;
});
afterEach(() => { delete window.SDT; document.body.innerHTML = ''; });

describe('奖励连续领取', () => {
  it.each([false, true])('领取及择一按钮和放大动作都含实际卡名 choice=%s', choice => {
    restore({ choice, count:3 });
    const act = choice ? 'chestPick' : 'chestTake1';
    const label = choice ? '选择这张' : '收下';
    for (let i = 0; i < 3; i++) {
      expect(action(act, i).getAttribute('aria-label')).toBe(`${label}：${cards[i].name}`);
      expect(action(act, i).textContent).toBe(label);
    }
    const zoom = window.SDT.UI.showCardZoom = vi.fn();
    acts.chestSelect({ i:'1' });
    const footer = document.createElement('div');
    footer.innerHTML = zoom.mock.calls[0][1].footer;
    expect(footer.querySelector('button').getAttribute('aria-label')).toBe(`${label}：${cards[1].name}`);
    expect(footer.querySelector('button').dataset.act).toBe(act);
    expect(game.grantCard).not.toHaveBeenCalled();
  });
  it('领取更新状态时保留所有卡面、图片、横竖滚动容器和位置，并聚焦下一张', () => {
    restore();
    const faces = [...body.querySelectorAll('.reward-card')], images = [...body.querySelectorAll('.reward-card img')];
    const stage = body.querySelector('.loot-scroll'), row = body.querySelector('.reward-objects');
    expect(body.querySelector('.reward-main .loot-actions')).toBeNull();
    expect(body.querySelector('.reward-foot > .loot-actions [data-act="chestTake"]')).not.toBeNull();
    expect(body.querySelector('.reward-foot > .reward-footer-info .reward-capacity')).not.toBeNull();
    stage.scrollTop = 140; row.scrollLeft = 260;
    activate('chestTake1',0);
    expect([...body.querySelectorAll('.reward-card')]).toEqual(faces);
    expect([...body.querySelectorAll('.reward-card img')]).toEqual(images);
    expect(body.querySelector('.loot-scroll')).toBe(stage); expect(stage.scrollTop).toBe(140);
    expect(body.querySelector('.reward-objects')).toBe(row); expect(row.scrollLeft).toBe(260);
    expect(document.activeElement).toBe(action('chestTake1',1));
    expect(body.querySelectorAll('[data-act="chestTake"]')).toHaveLength(1);
    document.activeElement.click();
    expect(game.grantCard).toHaveBeenCalledTimes(2); expect(document.activeElement).toBe(action('chestTake1',2));
  });
  it('同一页面的旧领取闭包在更新后失效，不能重复发奖或领取下一张', () => {
    restore(); const previous = acts.chestTake1;
    activate('chestTake1',0); previous({i:'1'});
    expect(game.grantCard).toHaveBeenCalledTimes(1);
    activate('chestTake1',1); expect(game.grantCard).toHaveBeenCalledTimes(2);
  });
  it('择一后只保留附赠操作焦点，不因焦点恢复自动领牌', () => {
    restore({choice:true,count:4}); activate('chestPick',1);
    expect(document.activeElement).toBe(action('chestTake1',3));
    expect(game.grantCard).toHaveBeenCalledTimes(1);
    expect(body.querySelectorAll('.reward-unit.dropped')).toHaveLength(2);
    expect(body.querySelectorAll('.reward-unit.got')).toHaveLength(1);
  });
  it('取消放弃回到放弃入口，卡面不重建且不发生领取或丢弃', () => {
    restore(); const faces = [...body.querySelectorAll('.reward-card')];
    activate('chestSkip'); expect(document.activeElement).toBe(action('chestStay'));
    activate('chestStay'); expect(document.activeElement).toBe(action('chestSkip'));
    expect([...body.querySelectorAll('.reward-card')]).toEqual(faces); expect(game.grantCard).not.toHaveBeenCalled();
    expect(chests.serialize(game).current.lost).toEqual([]);
  });
  it('展开的战斗去向在领取时保留，切换不同奖励快照时更新详情', () => {
    restore({battleSummary:{cardOutcome:{pocket:['旧牌'],gone:[],retained:[]}}});
    const details = body.querySelector('.loot-outcome'); details.open = true;
    activate('chestTake1',0); expect(body.querySelector('.loot-outcome')).toBe(details); expect(details.open).toBe(true);
    restore({battleSummary:{cardOutcome:{pocket:['新牌'],gone:[],retained:[]}}});
    expect(body.querySelector('.loot-outcome').textContent).toContain('新牌');
    expect(body.querySelector('.loot-outcome').textContent).not.toContain('旧牌');
  });
  it('长横排的下一张操作仅在奖励滚动容器内移动到可视边缘', () => {
    body.innerHTML = '<div class="loot-scroll"><div class="reward-objects"><button data-act="chestTake1" data-i="5">收下</button></div></div>';
    const row = body.querySelector('.reward-objects'), button = action('chestTake1',5);
    Object.defineProperties(row,{scrollWidth:{value:1600},clientWidth:{value:1000},scrollHeight:{value:400},clientHeight:{value:400}});
    row.getBoundingClientRect = () => ({left:0,right:500,top:0,bottom:200,width:500,height:200});
    button.getBoundingClientRect = () => ({left:580,right:630,top:120,bottom:140,width:50,height:20});
    restoreRewardActionFocus(body,{action:'chestTake1',index:'4'});
    expect(document.activeElement).toBe(button); expect(row.scrollLeft).toBe(260); expect(row.scrollTop).toBe(0);
  });
});
