(async()=>{const q=window.__ArtVisMore;q.reset();const SDT=window.SDT,B=SDT.Base,game=q.game,nodeShell=q.scenes.nodeShell;const {esc}=await import('/src/core/shared.js');const r={actions:12,layersReached:3,runCoins:10,firstExplore:{xp:30}},net={cardsStashed:3,pocketKept:2,wood:2,rations:1},loss={lostCount:2,pocketLost:1,lostNotable:[{name:'格挡',count:2}]},wasClear=false,timeStr='10:00';  const gainRow = `<p class="result-line"><span class="ov-note">[[icon:sparkles]] 本局真实入库 <b>${net.cardsStashed ?? 0}</b> 张 · 口袋带回 <b>${net.pocketKept ?? 0}</b> 张 ·
    [[icon:wood]] 木材 ×<b>${net.wood ?? 0}</b> · [[icon:bread]] 口粮 ×<b>${net.rations ?? 0}</b> · [[icon:medal]] 首探经验 <b class="gold">+${r.firstExplore?.xp ?? 0}</b></span></p>`;
  const lossRow = (loss.lostCount || loss.pocketLost)
    ? `<p class="ov-note">[[icon:cross]] 散失：未入库 ${loss.lostCount || 0} 张${loss.lostNotable?.length ? `（${loss.lostNotable.map(c => `【${esc(c.name)}】×${c.count}`).join('、')}）` : ''} · 口袋散失 ${loss.pocketLost || 0} 张</p>`
    : '';
  nodeShell({
    tone: 'exit',
    icon: wasClear ? '[[icon:trophy]]' : '[[icon:home]]',
    title: wasClear ? '首脑突破 · 满载而归' : '保本返回 · 撤离成功',
    sub: `${wasClear ? '击破第四层首脑，从终局撤离点凯旋' : '见好就收，带着战利品安全返回基地'} ·
      用时 <b>${timeStr}</b> · 行动 <b>${r.actions ?? 0}</b> 次 · 抵达 <b>第 ${r.layersReached ?? '-'} 层</b> · 剩余生命 <b style="color:#7fdd9c">${game.hp}/${game.maxHp}</b> ·
      本局携带 <b class="gold">${r.runCoins ?? game.coins ?? 0} 币</b>（留在局中）`,
    body: `
      ${gainRow}${lossRow}
      <p class="result-line"><span class="ov-note">[[icon:home]] 已运回基地：[[icon:wood]] 木材 ×${net.wood ?? 0} · [[icon:bread]] 口粮 ×${net.rations ?? 0} · [[icon:archive]] 仓库总持有 <b>${B.stashUsed()}/${B.stashCap()}</b> 张（含往局） ·
        [[icon:sparkles]] 图鉴 <b>${Object.keys(B.data.collection).length}</b></span></p>
      <p class="ov-note">下次出发时可以从仓库选择卡牌携带；储备币 <b>${B.data.coins}</b> 币留在基地（不进局，用于孵蛋与基地建设）。</p>`,
    foot: `
      <button class="ov-btn" data-act="goBase">[[icon:home]] 回基地</button>
      <button class="ov-btn ok" data-act="again">[[icon:runner]] 再出发</button>`,
  });
return {originalTemplate:true,noReceiptTransaction:true};})()