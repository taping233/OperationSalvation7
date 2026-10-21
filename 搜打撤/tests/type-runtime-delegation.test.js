import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindCardBrowser, cardBrowserHTML } from '../game/src/ui/card-browser.js';

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
const click = element => element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('typed delegated UI keeps SVG event targets', () => {
  it('opens the same card for its HTML label and nested SVG path', () => {
    window.SDT = {};
    document.body.innerHTML = cardBrowserHTML('svg-delegation', '卡片', '<button data-browser-key="one"><span>文字</span><svg viewBox="0 0 10 10"><g><path d="M0 0h10v10z"></path></g></svg></button>');
    const root = document.querySelector('[data-card-browser]');
    const onOpen = vi.fn();
    bindCardBrowser(root, { onOpen });
    click(root.querySelector('span:not(.card-browser-position)'));
    click(root.querySelector('path'));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen.mock.calls[0]).toEqual(['one', root.querySelector('[data-browser-key]')]);
    expect(onOpen.mock.calls[1]).toEqual(onOpen.mock.calls[0]);
  });

  it('forwards overlay actions and hover from nested SVG without filtering the target', async () => {
    document.body.innerHTML = '<main id="viewport"><div id="heroAva"></div><div id="overlay"><div id="ovTitle"></div><div id="ovBody"><button data-act="svgAction"><span>文字</span><svg><g><path></path></g></svg></button></div></div></main>';
    window.SDT = { Icons: { rich: value => value }, Motion: {}, Sound: { sfx() {} } };
    const { UI } = await import('../game/src/ui/ui.js');
    UI.init();
    const action = vi.fn(), hover = vi.fn();
    UI.act('svgAction', action);
    UI._hoverHandler = hover;
    const path = document.querySelector('#ovBody path');
    click(document.querySelector('#ovBody span'));
    click(path);
    path.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[1][0].act).toBe('svgAction');
    expect(hover).toHaveBeenCalledOnce();
    expect(hover.mock.calls[0][0].target).toBe(path);
    UI._hoverHandler = undefined;
  });
});
