import catalog from './catalog.json';
import baseline from '../../data/card-notes.json';
import { Art } from '../../src/core/art.js';
import { displayCardDescription } from '../../src/cards/card-description-text.js';
import { esc } from '../../src/core/shared.js';
const $ = id => document.getElementById(id);
const KEY = 'sdt-card-notes-review-20261026-v1';
const originals = new Set(catalog.originalIds);
const cards = catalog.cards;
let saved = {}, page = 1, type = '全部', editing = null;
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('invalid');
  for (const card of cards) {
    const row = raw[card.id];
    if (!row || typeof row !== 'object') continue;
    saved[card.id] = {};
    if (typeof row.note === 'string' && row.note.trim() && row.note.length <= 60) saved[card.id].note = row.note;
    if (['approved', 'flagged'].includes(row.status)) saved[card.id].status = row.status;
  }
} catch { $('notice').textContent = '未能读取本地审阅记录，已载入初始草稿。原存档未修改；可先导出备份。'; }
const noteFor = c => saved[c.id]?.note ?? baseline.notes[c.id] ?? '';
function store(id, update) {
  const next = { ...saved, [id]: { ...saved[id], ...update } };
  if (next[id].note === baseline.notes[id]) delete next[id].note;
  if (next[id].status === 'pending') delete next[id].status;
  if (Object.keys(next[id]).length === 0) delete next[id];
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch { $('notice').textContent = '本地保存失败，请先导出备份。'; return false; }
  saved = next;
  $('notice').textContent = '已保存在此浏览器。';
  return true;
}
function filtered() {
  const query = $('search').value.trim().toLowerCase();
  return cards.filter(c => {
    const status = saved[c.id]?.status || 'pending';
    return (type === '全部' || c.type === type)
      && ($('source').value === 'all' || originals.has(c.id) === ($('source').value === 'original'))
      && ($('status').value === 'all' || ($('status').value === 'edited' ? saved[c.id]?.note !== undefined : status === $('status').value))
      && (!query || `${c.name} ${c.id} ${noteFor(c)} ${displayCardDescription(c.desc, c.id, c)}`.toLowerCase().includes(query));
  });
}
function render() {
  const list = filtered(), pages = Math.max(1, Math.ceil(list.length / 24));
  page = Math.min(page, pages);
  $('count').textContent = `${list.length} 张卡牌 · 当前展示 ${list.length ? (page-1)*24+1 : 0}—${Math.min(page*24,list.length)}`;
  $('progress').textContent = `已看过 ${cards.filter(c=>saved[c.id]?.status === 'approved').length} / ${cards.length} · 需要修改 ${cards.filter(c=>saved[c.id]?.status === 'flagged').length}`;
  $('grid').innerHTML = list.slice((page-1)*24, page*24).map(c => `<article class="card" data-id="${esc(c.id)}"><div class="art">${Art.cardIcon(c,{low:true})}<span class="tag ${originals.has(c.id)?'original':''}">${originals.has(c.id)?'老板原文':'新增草稿'}</span></div><div class="content"><div class="meta">${esc(c.type)} / ${esc(c.rarity)} / ${Number(c.cost)||0} 费</div><h2>${esc(c.name)}</h2><p class="quote">${esc(noteFor(c))}</p>${saved[c.id]?.note !== undefined?'<p class="edited">已手动修改</p>':''}<p class="effect"><b>牌效 / </b>${esc(displayCardDescription(c.desc,c.id,c))}</p><div class="actions"><button class="edit" data-action="edit">编辑备注</button><button data-action="approved" aria-pressed="${saved[c.id]?.status==='approved'}">已看过</button><button data-action="flagged" aria-pressed="${saved[c.id]?.status==='flagged'}">需要修改</button></div></div></article>`).join('');
  for (const img of $('grid').querySelectorAll('img')) img.loading = 'lazy';
  $('empty').hidden = list.length !== 0;
  $('page').textContent = `${page} / ${pages}`;
  $('prev').disabled = page === 1;
  $('next').disabled = page === pages;
}
$('types').innerHTML = ['全部',...new Set(cards.map(c=>c.type))].map(t=>`<button aria-pressed="${t===type}">${esc(t)}</button>`).join('');
$('types').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;type=b.textContent;page=1;for(const el of $('types').children)el.setAttribute('aria-pressed',String(el===b));render();});
for(const id of ['search','source','status']) $(id).addEventListener(id==='search'?'input':'change',()=>{page=1;render();});
for(const [id,delta] of [['prev',-1],['next',1]]) $(id).onclick=()=>{page+=delta;render();$('types').scrollIntoView({block:'start'});};
$('grid').onclick=e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  const card=cards.find(c=>c.id===button.closest('[data-id]').dataset.id);if(!card)return;
  const action=button.dataset.action;
  if(action==='edit') {
    editing=card; $('edit-name').textContent=card.name;
    $('edit-effect').textContent=displayCardDescription(card.desc,card.id,card);
    $('note').value=noteFor(card);$('edit-message').textContent='';$('editor').showModal();$('note').focus();
  } else if(store(card.id,{status:saved[card.id]?.status===action?'pending':action}))render();
};
$('cancel').onclick=()=>$('editor').close();
$('form').onsubmit=e=>{e.preventDefault();const value=$('note').value.trim();if(!value){$('edit-message').textContent='请填写备注。';return;}if(store(editing.id,{note:value,status:'pending'})){$('editor').close();render();}else $('edit-message').textContent='保存失败，内容仍在输入框中。';};
$('export').onclick=()=>{
  const result={version:1,_comment:'2026-10-26卡牌备注审阅导出，包含32条老板原文及259条补齐文案。',notes:Object.fromEntries(cards.map(c=>[c.id,noteFor(c)])),review:{date:catalog.date,originalIds:catalog.originalIds,records:saved}};
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='card-notes-reviewed.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('notice').textContent='已导出完整备注与审阅进度。';
};
render();
