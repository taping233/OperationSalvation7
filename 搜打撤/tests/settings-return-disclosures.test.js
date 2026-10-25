import { afterEach, expect, it } from 'vitest';
import { settingsLayoutHTML, initSettingsNavigation, captureSettingsNavigation } from '../game/src/ui/settings-navigation.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from '../game/src/ui/overlay-return-state.js';

afterEach(() => { document.body.innerHTML = ''; document.body.className = ''; });

it('restores the specific settings disclosure, reading position and child-entry focus after rebuilding', () => {
  document.body.className = 'reduce-motion';
  const mount = context => {
    document.body.innerHTML = `<div id="overlay"><section class="settings-page settings-tabbed">${settingsLayoutHTML({
      general: '<p>常用设置</p>', display: '', audio: '', input: '',
      records: '<button data-act="openInbox">留言信箱</button>', danger: '<button>危险动作</button>', credits: '<p>来源</p>',
    })}</section></div>`;
    const root = document.querySelector('.settings-page');
    initSettingsNavigation(root, context);
    return root;
  };
  const first = mount();
  first.querySelector('#settings-extra-records').open = true;
  first.querySelector('.settings-content').scrollTop = 175;
  const entry = first.querySelector('[data-act="openInbox"]');
  entry.focus();
  const snapshot = captureOverlayReturnState(first, entry, {readContext: () => captureSettingsNavigation(first)});
  const returned = mount(snapshot.context);
  restoreOverlayReturnState(returned, snapshot);
  expect(returned.querySelector('#settings-extra-records').open).toBe(true);
  expect(returned.querySelector('#settings-extra-danger').open).toBe(false);
  expect(returned.querySelector('#settings-extra-credits').open).toBe(false);
  expect(returned.querySelector('.settings-content').scrollTop).toBe(175);
  expect(document.activeElement).toBe(returned.querySelector('[data-act="openInbox"]'));
});
