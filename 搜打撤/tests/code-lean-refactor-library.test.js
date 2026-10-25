import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren(); });

async function setup() {
  vi.resetModules();
  const acts = {}, UI = { act:(name, action) => { acts[name] = action; }, log:vi.fn(),
    showOverlay:vi.fn((title, html) => { document.body.innerHTML = html; }) };
  const cards = [{id:'one',name:'保留<&"',rules:{version:1}}];
  window.SDT = {UI,Cards:{all:() => cards}};
  const deps = {openCardLibrary:vi.fn(() => 'opened'),closeLibPage:vi.fn(() => false),setCardPageOpen:vi.fn()};
  const {createCardDesigner} = await import('../game/src/hub/game.cardslib.designer.js');
  return {tools:createCardDesigner(deps),deps,UI,acts,cards};
}

describe('read-only library compatibility boundary', () => {
  it('keeps frozen creation/import entry points and close return receipts', async () => {
    const {tools,deps,UI} = await setup();
    expect(Object.keys(tools).sort()).toEqual(['closeDesigner','openCardDesigner','showCardsExportOverlay','showCardsImportOverlay']);
    expect(tools.openCardDesigner({id:'ignored'})).toBeUndefined();
    expect(tools.showCardsImportOverlay()).toBeUndefined();
    expect(deps.openCardLibrary).toHaveBeenCalledTimes(2);
    expect(tools.closeDesigner()).toBeUndefined();
    expect(deps.closeLibPage).toHaveBeenCalledTimes(1);
    expect(UI.showOverlay).not.toHaveBeenCalled();
    expect(deps.setCardPageOpen).not.toHaveBeenCalled();
  });
  it('preserves export format, escaped JSON, clipboard results and download cleanup', async () => {
    const {tools,deps,UI,acts,cards} = await setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator',{clipboard:{writeText}});
    const createObjectURL = vi.fn(() => 'blob:export'),revokeObjectURL = vi.fn();
    vi.stubGlobal('URL',{createObjectURL,revokeObjectURL});
    const click = vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(() => {});
    tools.showCardsExportOverlay();
    const json = document.getElementById('ovExport').value;
    expect(JSON.parse(json)).toEqual({game:'sdt',format:'cards',version:2,cards});
    expect(document.getElementById('ovExport').readOnly).toBe(true);
    expect(document.querySelector('textarea').textContent).toBe(json);
    expect(deps.setCardPageOpen).toHaveBeenCalledWith(false);
    await acts.copyCards();
    expect(writeText).toHaveBeenCalledWith(json);
    expect(UI.log).toHaveBeenLastCalledWith('卡牌 JSON 已复制','ok');
    writeText.mockRejectedValueOnce(new Error('denied')); await acts.copyCards();
    expect(UI.log).toHaveBeenLastCalledWith('复制失败，请手动全选复制','warn');
    acts.downloadCards();
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/json');
    expect(click.mock.instances[0].download).toBe('sdt-cards.json');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
    acts.backLib(); expect(deps.openCardLibrary).toHaveBeenCalledTimes(1);
  });
});
