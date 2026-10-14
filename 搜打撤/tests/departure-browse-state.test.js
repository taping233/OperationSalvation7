import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const ports = vi.hoisted(() => ({ choice: vi.fn(), start: vi.fn(), hub: vi.fn(), handoff: vi.fn(), cut:vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { starterSha: 5 } }, MODES: { standard: { id: 'standard', name: '标准', ckpt: '无修正', desc: '探索' } },
  game: { stackCapOf: () => 3 }, newRun: ports.start, requestClassChoice: ports.choice,
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: {}, _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/hub/game.hub.bridge.js', () => ({ slots: { renderHub: ports.hub } }));
vi.mock('../game/src/hub/departure.view-updates.js', () => ({ bindDepartureFilters: vi.fn(), updateDepartureView: vi.fn() }));
vi.mock('../game/src/ui/departure-transition.js', () => ({ enterDepartureCut: ports.cut, startDepartureHandoff: ports.handoff }));
let actions, base, departure;
beforeEach(async () => {
  vi.resetModules(); ports.choice.mockReset(); ports.start.mockReset(); ports.hub.mockClear(); ports.handoff.mockReset(); ports.cut.mockReset();
  actions = {};
  base = { slot: 1, data: { selMode: 'standard', pocket: [], stash: [{ card: { name: '甲', rarity: '古朴' }, count: 2 }] },
    PETS: [], bagCap: () => 16, carriedPet: () => null, ownedPets: () => [] };
  const overlay = document.createElement('div'); document.body.replaceChildren(overlay);
  const ui = { el: { overlay }, act: (id, handler) => { actions[id] = handler; },
    showOverlay: (_title, html) => { overlay.innerHTML = html; }, log: vi.fn() };
  window.SDT = { UI: ui, Base: base, Cards: { SHA: { name: '初始攻击' }, cardHTML: card => `<span>${card.name}</span>` },
    Icons: { rich: html => html }, Sound: { sfx: vi.fn() } };
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  departure = await import('../game/src/hub/game.hub.depart.js');
});
afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });
function choose(character = '侠客') {
  const options = ports.choice.mock.lastCall[0];
  options.onSelect(character, () => options.beforeConfirm());
}
it('更换人物与返回模式保留草稿，重新进入可继续整备', () => {
  departure.openDepartPrep(); choose(); actions.pickAdd({ name: '甲' });
  expect(departure.deployPick).toEqual({ 甲: 1 });
  actions.depBack();
  expect(ports.choice.mock.lastCall[0].initialCharacter).toBe('侠客');
  expect(departure.deployPick).toEqual({ 甲: 1 });
  choose('法师'); actions.depMode();
  expect(ports.hub).toHaveBeenCalledTimes(1);
  const calls = ports.choice.mock.calls.length;
  departure.openDepartPrep();
  expect(ports.choice).toHaveBeenCalledTimes(calls);
  expect(departure.deployPick).toEqual({ 甲: 1 });
  expect(document.body.textContent).toContain('本次人物：白塔');
  expect(ports.start).not.toHaveBeenCalled();
});
it('换档清除上档整备草稿，预设导入仍保留选择', () => {
  departure.openDepartPrep(); choose(); actions.pickAdd({ name: '甲' });
  base.slot = 2; departure.openDepartPrep();
  expect(departure.deployPick).toEqual({});
  expect(ports.choice.mock.lastCall[0].initialCharacter).toBeNull();
  departure.setDeployPick({ 甲: 2 }); departure.openDepartPrep();
  expect(departure.deployPick).toEqual({ 甲: 2 });
});
it('最终出发只提交一次，提交前浏览不扣卡，保存失败可继续修改', () => {
  departure.openDepartPrep(); choose(); actions.pickAdd({ name: '甲' });
  ports.start.mockReturnValue(false); actions.confirmDeploy();
  expect(ports.start).not.toHaveBeenCalled();
  ports.handoff.mock.lastCall[0]();
  expect(departure.deployPick).toEqual({ 甲: 1 });
  expect(document.querySelector('[data-act="confirmDeploy"]').disabled).toBe(false);
  expect(base.data.stash[0].count).toBe(2);
  ports.start.mockReturnValue(true); actions.confirmDeploy();
  ports.handoff.mock.lastCall[0](); actions.confirmDeploy();
  expect(ports.start).toHaveBeenCalledTimes(2);
  expect(ports.start.mock.lastCall[1]).toEqual({ 甲: 1 });
  expect(departure.deployPick).toBeNull();
});

it('整备不显示规则说明，保存失败不标记，成功开局复用已有教学标记', () => {
  base.markAmmoTaught = vi.fn(() => { base.data.ammoTaught = true; });
  departure.openDepartPrep(); choose();
  expect(document.querySelector('.dep-rules')).toBeNull();
  ports.start.mockReturnValue(false); actions.confirmDeploy();
  expect(base.markAmmoTaught).not.toHaveBeenCalled();
  ports.handoff.mock.lastCall[0]();
  expect(base.markAmmoTaught).not.toHaveBeenCalled();
  ports.start.mockReturnValue(true); actions.confirmDeploy();
  ports.handoff.mock.lastCall[0]();
  expect(base.markAmmoTaught).toHaveBeenCalledTimes(1);
});
it('火焰精灵整备显示实际火球且详情可到达', () => {
  const fireball = { id: 'tt3-fireball', name: '火球' };
  base.carriedPet = () => ({ name: '火焰精灵', desc: '转换火球', effect: { shaToFireball: true } });
  window.SDT.Cards.all = () => [fireball];
  window.SDT.UI.showCardZoom = vi.fn();
  departure.openDepartPrep(); choose();
  expect(document.querySelector('#depBag [data-name="火球"]')).not.toBeNull();
  expect(document.querySelector('#depSummary').textContent).toContain('火球 ×5');
  actions.bagZoom({ name: '火球' });
  expect(window.SDT.UI.showCardZoom.mock.lastCall[0]).toBe(fireball);
});


it('人物切幕等待实际DOM就绪，同入口重复请求共用Promise，换档旧结果不切幕', async () => {
  let finishOld, finishNext;
  const old = new Promise(resolve => { finishOld = resolve; });
  const next = new Promise(resolve => { finishNext = resolve; });
  ports.choice.mockReturnValueOnce(old).mockReturnValueOnce(next);
  const first = departure.openDepartPrep();
  expect(departure.openDepartPrep()).toBe(first); expect(ports.choice).toHaveBeenCalledOnce();
  expect(ports.cut).not.toHaveBeenCalled();
  base.slot = 2; const second = departure.openDepartPrep();
  finishOld(true); expect(await first).toBe(false); expect(ports.cut).not.toHaveBeenCalled();
  const cls = document.createElement('section'); cls.className = 'cls2-page';
  window.SDT.UI.el.overlay.id = 'overlay'; window.SDT.UI.el.overlay.replaceChildren(cls);
  finishNext(true); expect(await second).toBe(true); expect(ports.cut).toHaveBeenCalledOnce();
  expect(ports.cut).toHaveBeenCalledWith(cls);
});
it('人物入口失败可从原入口重试，换档后旧onSelect/beforeConfirm不会扣新档卡', async () => {
  ports.choice.mockReturnValueOnce(Promise.resolve(false));
  expect(await departure.openDepartPrep()).toBe(false);
  ports.choice.mockReturnValueOnce(Promise.resolve(true));
  expect(await departure.openDepartPrep()).toBe(true);
  expect(ports.choice).toHaveBeenCalledTimes(2);
  const old = ports.choice.mock.lastCall[0];
  base.slot = 2; await departure.openDepartPrep();
  old.onSelect('侠客', vi.fn()); expect(old.beforeConfirm()).toBe(false);
  expect(ports.start).not.toHaveBeenCalled(); expect(departure.deployPick).toEqual({});
});
