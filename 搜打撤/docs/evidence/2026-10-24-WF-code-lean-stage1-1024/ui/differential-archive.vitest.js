import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esc, escAttr } from '../../../../game/src/core/shared.js';

const filename = 'game/src/hub/hub.archive-v3.js';
function loadArchive(path) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import .+;\r?\n/gm, '').replace(/export function/g, 'function');
  const ports = { esc, escAttr, bindRewardFeedback:() => {}, bindCollectionCards:() => {} };
  return new Function(...Object.keys(ports), `${source}\nreturn { archiveV3HTML, bindArchiveV3 };`)(...Object.values(ports));
}
function exercise(path, view, state) {
  const archive = loadArchive(path), actions = new Map();
  const entries = state === 'empty' ? [] : [
    { id:'one&"', name:'甲<&"', desc:'第一项目标 < &', need:1, reward:{wood:3,card:'card'}, back:'back' },
    { id:'all', name:'乙', desc:'第二项目标', need:3, reward:{keys:2} },
  ];
  const meta = {
    ACHIEVEMENTS:entries, COLL_MILESTONES:entries, isUnlocked:() => state !== 'locked', isClaimed:() => state === 'claimed',
    collMsReached:entry => state !== 'locked' && entry.need === 1, isCollClaimed:() => state === 'claimed',
    collMsNeed:entry => entry.need, collTotal:() => 3, collProgress:() => state === 'locked' ? 0 : 2,
    collRewardText:entry => `<span>${entry.id === 'all' ? '钥匙' : '木材'} ×3</span>`,
  };
  const base = { slot:1 }, cards = { all:() => [{id:'card',name:'奖励<&'}], CARD_BACKS:[{id:'back',name:'卡背<&'}] };
  const rawHTML = archive.archiveV3HTML({base,meta,cards,view});
  document.body.innerHTML = `<main id="hubMain">${rawHTML}</main>`;
  archive.bindArchiveV3({base,meta,cards,ui:{act:(name, action) => actions.set(name,action)}});
  const root = document.querySelector('.hub-archive-v3');
  const receipts = [];
  for (const button of root.querySelectorAll('[data-act="archiveV12Record"]')) {
    const detail = root.querySelector('.av12-record-detail');
    button.focus();
    actions.get('archiveV12Record')(button.dataset);
    receipts.push({ detail:detail.innerHTML, retained:detail === root.querySelector('.av12-record-detail'),
      focus:document.activeElement === button,
      selection:[...root.querySelectorAll('[data-act="archiveV12Record"]')].map(row => [row.className,row.getAttribute('aria-pressed')]) });
  }
  actions.get('archiveV12Record')({index:'invalid'});
  return { rawHTML, dom:root.outerHTML, receipts };
}

describe('stage 1 archive record templates against frozen source', () => {
  for (const view of ['rewards','classes']) {
    it.each(['empty','locked','pending','claimed'])('%s archive records retain exact HTML, selection and focused nodes: ' + view, state => {
      expect(exercise(filename,view,state)).toEqual(exercise(`node_modules/.cache/lean-stage1-1024/before/${filename}`,view,state));
    });
  }
});
