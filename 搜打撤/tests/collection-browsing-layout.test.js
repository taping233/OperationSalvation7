import { afterEach, expect, it, vi } from 'vitest';
import data from '../game/data/achievements.json';
import { achievementGalleryHTML, bindAchievementGallery } from '../game/src/ui/achievement-gallery.js';
import { mountPreparationView } from '../game/src/hub/preparation.view.js';

afterEach(() => { document.body.replaceChildren(); document.body.className=''; vi.useRealTimers(); });

it('reopens the latest medal when an unfinished content switch was cancelled by closing', () => {
  vi.useFakeTimers();
  document.body.className='';
  document.body.innerHTML=achievementGalleryHTML({achievements:data.achievements,base:null,slot:null,isUnlocked:()=>false,backs:[],cards:[],random:()=>0});
  const root=document.querySelector('.achievement-gallery');
  const control=bindAchievementGallery(root);
  root.querySelector('[data-medal-id="kill10"]').click();
  root.querySelector('[data-medal-id="firstBoss"]').click();
  control.closeDetail();
  root.querySelector('[data-medal-id="firstBoss"]').click();
  expect(root.querySelector('.ag-detail h3').textContent).toBe('破壁者');
  expect(root.querySelector('.ag-detail-content').dataset.medalId).toBe('firstBoss');
  control.closeDetail();
});

it('keeps medal browsing and filters usable while distinguishing pending and claimed rewards', () => {
  document.body.className='reduce-motion';
  const base={unlocked:['kill10','firstExtract'],achClaimed:{firstExtract:true}};
  const before=JSON.stringify(base);
  document.body.innerHTML=achievementGalleryHTML({achievements:data.achievements,base,slot:1,isUnlocked:(entry,snapshot)=>snapshot.unlocked.includes(entry.id),backs:[],cards:[],random:()=>0});
  const root=document.querySelector('.achievement-gallery');
  bindAchievementGallery(root);
  const click=selector=>root.querySelector(selector).click();
  const visible=()=>[...root.querySelectorAll('[data-gallery-item]')].filter(tile=>!tile.hidden);
  const scroll=root.querySelector('.ag-scroll');scroll.scrollTop=181;
  click('[data-medal-id="kill10"]');
  click('[data-gallery-next]');
  expect(root.querySelector('.ag-detail h3').textContent).toBe('破壁者');
  expect(root.querySelector('[data-medal-id="firstBoss"]').getAttribute('aria-pressed')).toBe('true');
  expect(root.querySelector('.ag-header').inert).not.toBe(true);
  expect(root.querySelector('.ag-detail').hasAttribute('aria-modal')).toBe(false);
  click('[data-gallery-filter="pending"]');
  expect(visible().map(tile=>tile.dataset.medalId)).toEqual(['kill10']);
  expect(root.querySelector('.ag-detail').hidden).toBe(true);
  click('[data-gallery-filter="claimed"]');
  expect(visible().map(tile=>tile.dataset.medalId)).toEqual(['firstExtract']);
  expect(JSON.stringify(base)).toBe(before);
});

it('keeps preset decision facts outside its editor and preserves local expansion when data refreshes', () => {
  const root=document.createElement('div');document.body.append(root);
  const preview={canStart:false,costs:{stashCards:3,slotsUsed:4,bagCapacity:8,extraStackSlots:0},missing:[{}],forbidden:[],qualification:null,errors:[]};
  const model={goals:[],targetOptions:[],presets:[{id:'preset-1',name:'远行',characterId:'wu',petId:'',picks:[],preview}],characterOptions:[{id:'wu',name:'无'}],petOptions:[],cardOptions:[],busy:false,error:''};
  const view=mountPreparationView(root,{model});
  const editor=root.querySelector('details');
  expect(editor.open).toBe(false);
  expect(root.querySelector('.prep-summary').textContent).toContain('占 4/8 格');
  expect(root.querySelector('.prep-summary').closest('details')).toBeNull();
  expect(root.querySelector('.prep-preset-head').textContent).not.toContain('preset-1');
  expect(root.querySelector('[data-action="preset-apply"]').disabled).toBe(true);
  editor.open=true;
  view.update({...model,busy:true});
  expect(root.querySelector('details').open).toBe(true);
  expect(root.querySelector('[data-action="preset-preview"]').disabled).toBe(true);
  view.dispose();
});
