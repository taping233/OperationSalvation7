(async()=>{const names=[];const q=window.__ArtVisMore;q.reset();const SDT=window.SDT,UI=SDT.UI,B=SDT.Base,game=q.game,MAP=q.session.MAP;const {escAttr}=await import('/src/core/shared.js');B.data.stash=[];const extractLeft=names.map(name=>({card:{...SDT.Cards.all().find(c=>c.name===name)},count:3}));const room=B.stashRoom(),shaN=0,woodN=2,ratN=1,otherN=0,pocketNote='每张 1/3 概率保留 · 带回 2 张（基地可复原）· 散失 3 张',broughtByName=new Map(),totalLeft=extractLeft.reduce((a,b)=>a+b.count,0);  const rows = `<div class="ext-cards">${extractLeft.map((s, i) => {
    const fits = s.count <= Math.max(0, room);
    const broughtN = broughtByName.get(s.card.name) || 0;
    const broughtTip = broughtN ? `；含出发带入 ${broughtN} 张——带入卡未入库即永久损失` : '';
    return `<div class="ext-card${fits ? '' : ' off'}" data-act="exStash" data-i="${i}" role="button" tabindex="0"
      aria-label="入库 ${escAttr(s.card.name)}${broughtN ? '（含带入卡）' : ''}" title="${fits ? '点击入库' : '仓库容量不足'}——【${escAttr(s.card.name)}】×${s.count}${broughtTip}">
      ${SDT.Cards.cardHTML(s.card, 'sm')}
      ${s.count > 1 ? `<span class="bt-count" title="同名卡牌 ${s.count} 张">×${s.count}</span>` : ''}
      ${broughtN ? `<span class="ext-brought" title="出发时带入 ${broughtN} 张——未入库将永久损失">带入 ×${broughtN}</span>` : ''}
      ${fits ? '' : '<span class="ext-noroom">容量不足</span>'}
    </div>`;
  }).join('') || '<p class="ov-empty" style="margin:6px 0 0">背包里没有可入库的卡牌。</p>'}</div>`;
  const shaRow = shaN
    ? `<div class="pk-row dep-row locked"><span>[[icon:cards]] [[icon:lock]] <b>初始攻击</b> ×${shaN}
        <span class="dim">· 初始牌不可入库（每局自动携带 ${MAP.rules.starterSha} 张）</span></span>
        <span class="dim">遗落</span></div>`
    : '';
  UI.showOverlay('', `
    <div class="pg hub result-pg" id="exMain">
      <header class="hub-head">
        <h2>[[icon:exit]] 撤离成功 · 整理入库</h2>
        ${UI.helpBtn('extract')}
        <span class="sub">把背包中的物品放回仓库——未入库的卡牌将在撤离中丢失</span>
        <span class="pg-spacer"></span>
        <span class="hub-res">
          <span class="res-chip">[[icon:archive]] 仓库容量 <b class="${room <= 0 ? 'fulled' : ''}">${B.stashUsed()}/${B.stashCap()}</b> 张</span>
          <span class="res-chip">[[icon:coin]] 随身币不带回（<b>${game.coins}</b> 币留在局中）</span>
        </span>
      </header>
      <div class="result-summary"><span class="result-kicker">EXTRACTION REPORT</span><b>战利品已回收，正在等待你的入库决定</b><span>容量 ${B.stashUsed()}/${B.stashCap()} · 未入库卡牌会在完成整理时丢失</span></div>
      <div class="dep-body result-columns">
        <section class="hub-card">
          <h3>[[icon:bag]] 背包卡牌 <span class="hub-card-tip">点击卡面放入仓库</span></h3>
          <div class="dep-list">${rows}${shaRow}</div>
        </section>
        <section class="hub-card">
          <h3>[[icon:archive]] 自动入库</h3>
          <div class="pk-row"><span>[[icon:wood]] 木材 ×<b>${woodN}</b></span><span class="dim">已入库（扩建背包/仓库用）</span></div>
          <div class="pk-row"><span>[[icon:bread]] 口粮 ×<b>${ratN}</b></span><span class="dim">已入库（升级安全格用）</span></div>
          ${otherN ? `<div class="pk-row"><span>[[icon:bag]] 其余物资 ×<b>${otherN}</b></span><span class="dim">未能带出 · 价值已计入本局得分</span></div>` : ''}
          <div class="pk-row"><span>[[icon:pocket]] 消耗口袋</span><span class="dim">${pocketNote}</span></div>
          ${extractLeft.length ? `<button class="ov-btn ok" data-act="exAll" ${room > 0 && totalLeft <= room ? '' : 'disabled'}
            style="width:100%">[[icon:archive]] 全部入库（${Math.min(totalLeft, room)}/${totalLeft} 张可入）</button>` : ''}
          <div class="dep-foot" style="margin-top:10px">
            <button class="ov-btn ok" data-act="exSmart" style="width:100%;margin-top:8px">[[icon:sparkles]] 智能整理（优先价值最高 · 上限仓库空格）</button>
            <button id="btnDeploy" data-act="exFinish">[[icon:check]] 完成整理${extractLeft.length ? `（${totalLeft} 张将丢失）` : ''}</button>
          </div>
        </section>
      </div>
    </div>`, 'page');return {template:true,noTransaction:true};})()