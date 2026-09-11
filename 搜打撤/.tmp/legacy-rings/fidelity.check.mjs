import { CHARACTERS } from '../src/characters.js';

// This document illustrates the existing single-character game. The generated
// mood board is not an authority for gameplay, stats, names or card effects.
const head=document.querySelector('header');
head.insertAdjacentHTML('afterend',`<aside class="fidelity-banner"><b>平面设计审阅版 · 尚未进行本轮 3D 重建</b><p>每局选一位角色 → 选择入口 → 掷骰沿三环探索 → 回合制卡牌战斗 → 搜集 → 撤离整理 → 入库。<br>五人是候选角色，不是五人同时上阵。概念生成图仅用于视觉氛围，已剔除其中不符合实际玩法的内容。</p><nav><a href="#screens">首页</a><a href="#map">地图与战斗</a><a href="#system">全部辅助界面</a></nav></aside>`);
const style=document.createElement('style');style.textContent=`.fidelity-banner{max-width:1520px;margin:25px auto 0;padding:22px 28px;border-left:3px solid #d9b67c;background:#19303b}.fidelity-banner b{font-weight:500;letter-spacing:2px}.fidelity-banner p{margin:8px 0 12px}.person{cursor:pointer}.person:not(.selected){opacity:.65;border-color:#63848e}.person.selected{border:2px solid #ddc18a}.person.selected:after{content:'本局出战 ✓';position:absolute;top:8px;left:7px;padding:5px;background:#e4d0a6;color:#183443;font-size:10px}.roster{height:58%}.rule-note{font-size:10px;line-height:1.7;color:#b5c9cf;margin:8px 0}.playingcard p{font-size:9px;line-height:1.45;color:#284450;margin:4px 0}.playingcard .art{height:37%}.battle-controls{position:absolute;top:66px;left:20px;right:20px;display:flex;justify-content:space-between;color:#173543;font-size:11px}.battle-controls b{background:#e1e9e0;padding:7px 10px;border:1px solid #809da6}.map-rule{position:absolute;bottom:18px;left:20px;right:20px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#203c48}.map-rule b{background:#173441;color:#e8d3a8;padding:10px 18px}.cardrow{left:30px;right:108px;height:27%}.turn-button{position:absolute;right:15px;bottom:55px;background:#d5bb87;color:#203b47;padding:16px 10px;font-size:12px}.archive .playingcard{font-size:10px}.archive-side h3{font-size:19px}.fidelity-controls{position:absolute;bottom:10px;left:90px;right:20px;color:#bfd3d9;font-size:10px}.screen .topbar{font-size:11px}.plan{height:calc(100% - 98px)}.mini{min-height:210px}.mini .mockbutton{padding:10px;font-size:12px}@media(max-width:900px){.fidelity-banner{margin:15px 20px}.fidelity-banner p{font-size:12px}}`;document.head.append(style);
const deploy=document.querySelector('#roster').closest('.screen');deploy.querySelector('h3').textContent='本局角色 · 五选一';deploy.querySelector('.callout').innerHTML='<small>已选择：<span id="chosenCharacter">无</span> / 本局 1 人</small><strong>确认角色 →</strong>';
const crops=[[0,350],[350,320],[665,320],[998,320],[1320,352]];
document.querySelector('#roster').innerHTML=CHARACTERS.map((c,i)=>{const [left,w]=crops[i];return `<div role="button" tabindex="0" class="person${i===0?' selected':''}" data-index="${i}" aria-label="选择${c.name}"><div class="portrait" style="background-size:${1672/w*100}% 100%;background-position:${left/(1672-w)*100}% center"></div><b>${c.name}</b><small>${c.rulesetId} / ${c.role}</small></div>`;}).join('');
const choose=e=>{const el=e.target.closest('.person');if(!el)return;document.querySelectorAll('.person').forEach(p=>p.classList.toggle('selected',p===el));document.querySelector('#chosenCharacter').textContent=CHARACTERS[Number(el.dataset.index)].name;};document.querySelector('#roster').addEventListener('click',choose);document.querySelector('#roster').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(e);}});
const battle=document.querySelector('#hand').closest('.screen');battle.insertAdjacentHTML('beforeend','<div class="battle-controls"><b>无　生命 30 / 30</b><b>荒民打手　生命 4 / 4</b></div><div class="turn-button">结束回合</div>');
battle.querySelector('.topbar').innerHTML='普通战斗 / 随身可用卡<span>回合 01 · 能量 2 / 2</span>';
const sha={name:'初始攻击',cost:1,type:'武术',desc:'造成等同于攻击力的伤害。',art:'martial-melee'},training={name:'新兵操典',cost:0,type:'武术',desc:'造成 2 点固定伤害。',art:'martial-melee'},rations={name:'制式口粮',cost:0,type:'资源',desc:'获得 1 份口粮。',art:'resource-material'},key={name:'钥匙',cost:0,type:'资源',desc:'解锁神秘宝箱。',art:'resource-key'};
const card=(c)=>`<div class="playingcard"><small style="color:#4d6d78">${c.cost} / ${c.type}</small><div class="art" style="background:url('../assets/cards/${c.art}.png') center/cover"></div><b>${c.name}</b><p>${c.desc}</p></div>`;
document.querySelector('#hand').innerHTML=Array.from({length:5},()=>card(sha)).join('');
document.querySelector('#archive').innerHTML=[sha,training,rations,key,sha,training,rations,key].map(card).join('');
const side=document.querySelector('.archive-side');side.querySelector('h3').textContent='初始攻击';side.querySelector('p').textContent='1 费。造成等同于攻击力的伤害。每局固定携带 5 张；此处展示档案详情。';side.querySelectorAll('.statline b')[0].textContent='初始';side.querySelectorAll('.statline b')[1].textContent='武术';side.querySelector('.mockbutton').textContent='查看详情';
battle.closest('section').insertAdjacentHTML('beforeend','<p class="rule-note">普通战：消耗随身可用卡，不建立循环牌库。指向攻击拖到敌人，自身效果拖到角色。BOSS 战：另选 15 张非道具牌，加入 5 张初始攻击；开局抽 5 张。</p>');
// ---------- 三环平面稿的历史几何（2026-09-09 五层生成器定版后游戏内已不再使用） ----------
// 本页是旧三环布局的设计审阅稿，故自带一份数据与几何工具：数据迁自 mapData.js
// （迁移时已同步 BOSS 改名），改动只影响本页，不进游戏包。
const RINGS = {
  // buildNodePositions 依赖的世界坐标基准（与 mapData.js 的 cols/rows/tile 相同）
  cols: 30,
  rows: 30,
  tile: 48,

  // ---------- 结点布局（分布式结点地图的唯一真源） ----------
  // 为每个 (li, idx) 逻辑格确定性生成结点中心坐标（世界像素）：
  // 每环按轨道顺序在极坐标上均匀取角 + 半径按环 + hash 抖动 + 同环间距防重叠微调；
  // 中央祭坛在正中心，三只 BOSS 环绕。布局确定（无随机数），同输入必得同输出。
  nodeLayout: {
    radii: [560, 390, 225],  // 三环基础半径（外 / 中 / 内）
    radiusJitter: 44,        // 半径抖动幅度（± 一半）
    angleJitter: 0.38,       // 角度抖动（占相邻角距的比例上限）
    bossRadius: 96,          // BOSS 结点环绕祭坛的半径
    minGap: 116,             // 同环相邻结点的最小间距（含结点半径余量）
  },

  buildNodePositions(logicalCounts) {
    const T = this.tile;
    const cx = this.cols * T / 2, cy = this.rows * T / 2;
    const lay = this.nodeLayout;
    const lo = 14, hiX = this.cols * T - 14, hiY = this.rows * T - 14;   // 板内安全边界
    const layers = logicalCounts.map((n, li) => {
      const R = lay.radii[li];
      const arr = [];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2 +
          (this._hash(li * 91 + i * 7, li * 13 + 5) - 0.5) * lay.angleJitter * (Math.PI * 2 / n);
        const r = R + (this._hash(li * 17 + i * 3 + 1, li * 29 + 2) - 0.5) * lay.radiusJitter;
        arr.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      // 防重叠微调：同环内任意两点距 < minGap 时沿连线推开，迭代收敛
      for (let pass = 0; pass < 24; pass++) {
        let moved = false;
        for (let a = 0; a < n; a++) {
          for (let b = a + 1; b < n; b++) {
            const dx = arr[b].x - arr[a].x, dy = arr[b].y - arr[a].y;
            const d = Math.hypot(dx, dy);
            if (d >= lay.minGap || d < 0.001) continue;
            const push = (lay.minGap - d) / 2, ux = dx / d, uy = dy / d;
            arr[a].x -= ux * push; arr[a].y -= uy * push;
            arr[b].x += ux * push; arr[b].y += uy * push;
            moved = true;
          }
        }
        if (!moved) break;
      }
      // 拉回板内
      for (const p of arr) {
        p.x = Math.min(hiX, Math.max(lo, p.x));
        p.y = Math.min(hiY, Math.max(lo, p.y));
      }
      return arr;
    });
    // 中央区：祭坛居中，三只 BOSS 环绕（与 MAP.center 顺序一一对应）
    const center = [{ x: cx, y: cy }];
    const br = lay.bossRadius;
    [[-Math.PI / 2, -0.35], [Math.PI / 6 - 0.35, 0.3], [Math.PI * 5 / 6 + 0.35, -0.3]].forEach(([a, dj]) => {
      center.push({ x: cx + Math.cos(a + dj) * br, y: cy + Math.sin(a + dj) * br });
    });
    return { layers, center };
  },

  // 确定性 hash → [0,1)
  _hash(a, b) {
    let n = (Math.floor(a) * 374761393 + Math.floor(b) * 668265263) >>> 0;
    n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  },

  // 生成一圈顺时针轨道（inset = 向内缩进的圈层，0=外圈）
  makeRing(inset) {
    const size = 8 - inset * 2, o = inset, ring = [];
    for (let x = 0; x < size; x++) ring.push({ x: o + x, y: o });              // 上边 →
    for (let y = 1; y < size; y++) ring.push({ x: o + size - 1, y: o + y });   // 右边 ↓
    for (let x = size - 2; x >= 0; x--) ring.push({ x: o + x, y: o + size - 1 });// 下边 ←
    for (let y = size - 2; y >= 1; y--) ring.push({ x: o, y: o + y });         // 左边 ↑
    return ring;
  },

  // ---------- 三个环层 ----------
  layers: [
    {
      id: 'L1', name: '外环 · 荒地边缘', nameEn: 'The Ashen Fringe', inset: 0, color: '#6e5133',   // 铁锈沙土：荒地外环
      risk: '低', tempo: '补给与试探（战斗较少，适合整备）',

      entrances: [0, 7, 14, 21],
      entranceNames: ['清扫口A · 西北角', '清扫口B · 东北角', '清扫口C · 东南角', '清扫口D · 西南角'],
      doors: [   // 出口和下一层的入口（exit=true 表示可从此撤离）
        { pair: 'p1', at: 1,  toLayer: 1, arriveAt: 0,  exit: true },  // (1,0)↔(1,1)
        { pair: 'p2', at: 8,  toLayer: 1, arriveAt: 5,  exit: true },  // (7,1)↔(6,1)
        { pair: 'p3', at: 15, toLayer: 1, arriveAt: 10, exit: true },  // (6,7)↔(6,6)
        { pair: 'p4', at: 22, toLayer: 1, arriveAt: 15, exit: true },  // (0,6)↔(1,6)
      ],
      cells: {
        // 2:{'两个币'} 3:{'商店'} 4:{'事件'} 5:{'战斗'} 6:{'木材×1'}
        2: { type: 'coin', n: 2 },
        3: { type: 'shop' },
        4: { type: 'event' },
        5: { type: 'battle' },
        6: { type: 'wood', n: 1 },
        // 9:{'两个币'} 10:{'战斗'} 11:{'事件'} 12:{'战斗'} 13:{'战斗'}
        9:  { type: 'coin', n: 2 },
        10: { type: 'battle' },
        11: { type: 'event' },
        12: { type: 'battle' },
        13: { type: 'battle' },
        // 16:{'战斗'} 17:{'小宝箱'} 18:{'事件'} 19:{'两个币'} 20:{'战斗'}
        16: { type: 'battle' },
        17: { type: 'chest' },
        18: { type: 'event' },
        19: { type: 'coin', n: 2 },
        20: { type: 'battle' },
        // 23:{'火堆'} 24:{'火堆'} 25:{'事件'} 26:{'战斗'} 27:{'木材×1'}
        23: { type: 'fire' },
        24: { type: 'fire' },
        25: { type: 'event' },
        26: { type: 'battle' },
        27: { type: 'wood', n: 1 },
      },
    },

    {
      id: 'L2', name: '中环 · 废墟市街', nameEn: 'The Rusted Blocks', inset: 1, color: '#3d5a50',   // 锈绿残垣：中环街区
      risk: '中', tempo: '分岔与取舍（战斗、钥匙、商店交错）',

      doors: [
        { pair: 'p5', at: 13, toLayer: 2, arriveAt: 8 },   // (3,6)→(3,5) 商店，第三层入口
        { pair: 'p6', at: 18, toLayer: 2, arriveAt: 11 },  // (1,3)→(2,3) 商店，第三层入口
      ],
      cells: {
        0:  { type: 'coin', n: 2 },   // (1,1) 第二层入口，2币
        1:  { type: 'fire' },         // (2,1) 火堆
        2:  { type: 'fire' },         // (3,1) 火堆
        3:  { type: 'battle' },       // (4,1) 战斗
        4:  { type: 'event' },        // (5,1) 事件
        5:  { type: 'coin', n: 2 },   // (6,1) 2币
        6:  { type: 'battle' },       // (6,2) 战斗
        7:  { type: 'rations' },      // (6,3) 口粮
        8:  { type: 'battle' },       // (6,4) 战斗
        9:  { type: 'coin', n: 4 },   // (6,5) 4币
        10: { type: 'coin', n: 2 },   // (6,6) 2层入口，2币
        11: { type: 'battle' },       // (5,6) 战斗
        12: { type: 'key' },          // (4,6) 钥匙
        13: { type: 'shop' },         // (3,6) 商店，第三层入口
        14: { type: 'battle' },       // (2,6) 战斗
        15: { type: 'coin', n: 2 },   // (1,6) 2币
        16: { type: 'battle' },       // (1,5) 战斗
        17: { type: 'coin', n: 3 },   // (1,4) 3币
        18: { type: 'shop' },         // (1,3) 商店，第三层入口
        19: { type: 'event' },        // (1,2) 事件
      },
    },

    {
      id: 'L3', name: '内环 · 污染核心区', nameEn: 'The Contaminated Core', inset: 2, color: '#443a63',   // 病变紫岩：污染核心
      risk: '高', tempo: '高压冲刺（高价值、精英预警、紧急撤离）',

      altarEntrances: [
        { pair: 'a1', at: 1 },    // (3,2) 祭坛入口（格本身+4币）
        { pair: 'a2', at: 11 },   // (2,3) 祭坛入口（格本身是商店）
      ],
      cells: {
        0:  { type: 'battle' },          // (2,2) 战斗
        1:  { type: 'coin', n: 4 },      // (3,2) 4币，祭坛入口
        2:  { type: 'wood', n: 2 },      // (4,2) 2木材
        3:  { type: 'battle' },          // (5,2) 战斗
        4:  { type: 'fire' },            // (5,3) 火堆
        5:  { type: 'fire' },            // (5,4) 火堆
        6:  { type: 'battle' },          // (5,5) 战斗
        7:  { type: 'event' },           // (4,5) 事件
        8:  { type: 'shop' },            // (3,5) 商店
        9:  { type: 'battle' },          // (2,5) 战斗
        10: { type: 'emergencyExit' },   // (2,4) 紧急撤离点，花10币直接撤离
        11: { type: 'shop' },            // (2,3) 商店，祭坛入口
      },
    },
  ],

  // ---------- 中央 2×2（渲染与悬浮提示用；战斗经由祭坛触发） ----------
  center: [
    { x: 3, y: 3, type: 'altar', name: '污染核心' },
    { x: 4, y: 3, type: 'boss', icon: '将', name: '肃清总督 · 550HP' },
    { x: 3, y: 4, type: 'boss', icon: '能', name: '异能领主 · 400HP' },
    { x: 4, y: 4, type: 'boss', icon: '巢', name: '变异巢母 · 320HP' },
  ],
};
const counts=RINGS.layers.map(l=>RINGS.makeRing(l.inset).length),layout=RINGS.buildNodePositions(counts);const sx=x=>380+(x-720)*.46,sy=y=>190+(y-720)*.245;let svg='<defs><marker id="inward" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5 0 5" fill="#ac8854"/></marker></defs>';
for(let li=0;li<3;li++){const pts=layout.layers[li];svg+=`<path d="${pts.map((p,i)=>(i?'L':'M')+sx(p.x)+' '+sy(p.y)).join(' ')}Z" stroke="${['#607e8b','#849796','#aa9270'][li]}" stroke-width="5" fill="none"/>`;for(const d of RINGS.layers[li].doors||[]){const a=pts[d.at],b=layout.layers[d.toLayer][d.arriveAt];svg+=`<path d="M${sx(a.x)} ${sy(a.y)}L${sx(b.x)} ${sy(b.y)}" stroke="#ac8854" stroke-width="2" marker-end="url(#inward)"/>`;}pts.forEach((p,i)=>{const type=RINGS.layers[li].cells?.[i]?.type||'node',col=type==='battle'?'#b78a7b':type==='fire'?'#d3b073':type==='chest'?'#b9a06f':'#e8efeb';svg+=`<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="6" fill="${col}" stroke="#446372" stroke-width="1.5"/><text x="${sx(p.x)}" y="${sy(p.y)+17}" fill="#3e5c66" font-size="8" text-anchor="middle">${i+1}</text>`;});}
svg+='<circle cx="380" cy="190" r="18" fill="#6d8290" stroke="#e8e6d6" stroke-width="4"/><text x="380" y="194" fill="#f1e6ca" font-size="10" text-anchor="middle">祭坛</text>';layout.center.slice(1).forEach((p,i)=>svg+=`<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="8" fill="#9c7d8d"/><text x="${sx(p.x)}" y="${sy(p.y)+3}" text-anchor="middle" font-size="8" fill="#fff">${i+1}</text>`);document.querySelector('#cityGeometry').innerHTML=svg;
const map=document.querySelector('#cityPlan').closest('.screen');map.querySelector('.topbar').innerHTML='外环 · 顺时针探索<span>生命 30 / 30 · 金币 0</span>';map.insertAdjacentHTML('beforeend','<div class="map-rule"><span>掷骰移动 / 路线单向深入 / 外环门撤离</span><b>⚄ 掷骰移动</b></div>');
const legends=document.querySelectorAll('#cityPlan > g:last-child text');legends[1].textContent='外环 28 格';legends[2].textContent='中环 20 格';legends[3].textContent='内环 12 格';
map.closest('section').insertAdjacentHTML('beforeend','<p class="rule-note">按地图基础网格绘制 28 / 20 / 12 格和真实环间门。相连火堆在运行时合并为一个停留节点。中央为祭坛及三位 BOSS；不加入自由行走或塔防部署。</p>');
const extra=document.querySelector('.lowerlist');extra.insertAdjacentHTML('afterbegin',`<div class="mini"><small>14 / BASE & LOADOUT</small><h3>基地与携带整备</h3><label>标准搜打撤 / 精英突袭 / 悠闲行军</label><label>从仓库选择携带卡牌，固定 5 张初始攻击</label><p>整备 → 单角色选择 → 外环入口。人物和牌组分别确认。</p></div><div class="mini"><small>15 / BOSS LOADOUT</small><h3>BOSS 选牌</h3><label>选择 15 张非道具牌</label><label>额外加入 5 张初始攻击</label><p>循环牌库、弃牌与墓地分区；开局抽 5 张，后续每回合抽 1 张。</p></div><div class="mini"><small>16 / FAILURE</small><h3>撤离失败</h3><label>清楚列出本次丢失内容</label><label>按安全格与来源规则显示保留卡牌</label><div class="mockbutton">回基地 / 再出发</div></div>`);
document.querySelector('footer').textContent='审阅版：展示布局、视觉层次与实际操作关系，不是完成版游戏。人物外观与人设待五张立绘完成后确定，精细 3D 模型随后制作。';
style.textContent += `@media(max-width:900px){.rail{width:32%;right:5%;top:25%;gap:6px}.tile{padding:10px;min-height:54px}.tile b{font-size:clamp(11px,2.2vw,16px);letter-spacing:2px;white-space:nowrap}.tile small{font-size:6px;letter-spacing:1.5px}.tile.primary{min-height:78px}.tile.primary b{font-size:clamp(17px,3vw,23px)}.quote{bottom:11%;font-size:9px;padding-left:12px}.quote span{font-size:7px}.bottom{font-size:7px;letter-spacing:1px}.brand small{font-size:7px;letter-spacing:2px}.archive-side{padding:10px}.archive-side h3{font-size:17px;letter-spacing:1px}.archive-side p{font-size:10px}.person b{font-size:15px;letter-spacing:2px}.person small{font-size:6px;letter-spacing:0}}`;
