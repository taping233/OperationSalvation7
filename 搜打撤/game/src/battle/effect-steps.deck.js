/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 1130-1228 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量），本文件零 import。 */
export function deckSteps(s) {
  const {getMode, log, drawCards, grantStarterAttack, randomDiscoverCard, addTempCard, addDeckCard, allCards, shuffleDeck, randomAcquired, esc, POOL_NUM_MAP} = s;
  return [
      /* ============ 牌库操作段 ============ */
      {
        id: 'deck.insert', gate: 'always', label: '洗入牌库（随机 N 张 / 指名卡，含「然后抽 N 张」）',
        when: (ctx) => {
          const shR = ctx.desc.match(/洗入\s*(\d+)\s*张随机卡牌/) || ctx.desc.match(/将\s*(\d+)\s*张随机卡牌洗入牌库/);
          // shR 命中时 shN 不再参与，防止同一句双结算
          const shN = !shR ? ctx.desc.match(/将\s*(?:(\d+|[一二两三四五])\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?(?:洗入|放入|置入)牌库/) : null;
          return (shR || shN) ? { shR, shN } : null;
        },
        run: (ctx, m) => {
          const added = [];
          // 铁甲阵：洗入随机卡时使其费用均 -1（2026-09-08 老板指定补实装）
          const cheap = /费用均?\s*[-－]\s*1/.test(ctx.desc);
          if (m.shR) {
            for (let i = 0; i < +m.shR[1]; i++) {
              const discovered = randomDiscoverCard(null);
              if (discovered) {
                addDeckCard(cheap ? { ...discovered, cost: Math.max(0, (discovered.cost || 0) - 1) } : discovered);
                if (typeof randomAcquired === 'function') randomAcquired(discovered);   // 阿猫的礼物：随机获取触发
                added.push(discovered.name);
              }
            }
            if (cheap && added.length) log(`[[icon:bolt]] 洗入的 ${added.length} 张随机卡牌费用均已 -1`, 'sys');
          }
          if (m.shN) {
            // 去引号；「A与B」「A、B」多卡名拆分；「禁咒」等系列名按前缀整组洗入
            const rawName = m.shN[2].replace(/[‘’“”「」]/g, '');
            const count = m.shN[1] ? (POOL_NUM_MAP[m.shN[1]] != null ? POOL_NUM_MAP[m.shN[1]] : +m.shN[1]) : 1;
            rawName.split(/[与和、]/).forEach(nm => {
              const exact = allCards().find(candidate => candidate.name === nm);
              const series = !exact ? allCards().filter(candidate => String(candidate.name || '').startsWith(nm)) : [exact];
              if (series.length) {
                for (let i = 0; i < count; i++) {
                  const tpl = series[i % series.length];
                  addDeckCard(tpl); added.push(tpl.name);
                }
              } else {
                log(`[[icon:question]] 【${esc(ctx.card.name)}】找不到可洗入牌库的卡牌「${esc(nm)}」（占位）`, 'warn');
              }
            });
          }
          if (added.length) {
            const deckSize = shuffleDeck();
            const counts = {};
            added.forEach(name => { counts[name] = (counts[name] || 0) + 1; });
            log(`[[icon:recycle]] <b>${esc(ctx.card.name)}</b>：将 ${Object.keys(counts).map(name => `【${esc(name)}】×${counts[name]}`).join('、')} 洗入牌库` +
              `（牌库 ${deckSize} 张，已洗混）`, 'sys');
            // 洗混后结算「然后抽 N 张牌」（无极梦魇）：若在此前先抽，抽到的是洗入前的旧牌（2026-09-11 英雄卡审计）
            const afterDraw = ctx.desc.match(/洗入牌库[^。]*然后抽\s*(\d+|[一二两三四五])\s*张牌/);
            if (afterDraw) {
              const n2 = POOL_NUM_MAP[afterDraw[1]] != null ? POOL_NUM_MAP[afterDraw[1]] : +afterDraw[1];
              if (getMode() === 'boss') {
                const got = drawCards(n2);
                log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：洗入后抽了 ${got} 张牌`, 'sys');
              } else {
                grantStarterAttack(n2);
                log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：洗入后获得 ${n2} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
              }
            }
            ctx.did = true;
          }
        },
      },
      {
        id: 'deck.insertHand', gate: 'always', label: '将 N 张【指名卡】置入手牌',
        when: (ctx) => ctx.desc.match(/将\s*(?:(\d+|[一二两三四五])\s*张)?\s*([^\s，,。；;、]+?)(?:复制)?置入手牌/),
        run: (ctx, m) => {
          const nm = m[2].replace(/[‘’“”「」]/g, '');
          const tpl = allCards().find(candidate => candidate.name === nm);
          const count = m[1] ? (POOL_NUM_MAP[m[1]] != null ? POOL_NUM_MAP[m[1]] : +m[1]) : 1;
          if (tpl) {
            for (let i = 0; i < count; i++) addTempCard(tpl);
            log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：将 ${count} 张【${esc(tpl.name)}】置入手牌（战斗内临时卡，战后消散）`, 'loot');
          } else {
            log(`[[icon:question]] 【${esc(ctx.card.name)}】找不到可置入手牌的卡牌「${esc(nm)}」（占位）`, 'warn');
          }
          ctx.did = true;
        },
      },
      {
        id: 'deck.gainNamed', gate: 'fresh', label: '获得 N 张指名道姓的卡（置句末才识别）',
        when: (ctx) => {
          const gn = ctx.desc.match(/获得\s*(?:(\d+|[一两二三四五])\s*张)\s*[‘“「]?([^\s，。；,、‘’“”「」]{1,6})[’”」]?(?=[。，；;]|$)/);
          return (gn && !['随机', '等量'].includes(gn[2])) ? gn : null;
        },
        run: (ctx, gn) => {
          const nm = gn[2].replace(/[‘’“”「」]/g, '');
          const tpl = allCards().find(candidate => candidate.name === nm);
          const count = POOL_NUM_MAP[gn[1]] != null ? POOL_NUM_MAP[gn[1]] : +gn[1];
          if (tpl) {
            for (let i = 0; i < count; i++) addTempCard(tpl);
            log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：获得 ${count} 张【${esc(tpl.name)}】（置入手牌）`, 'loot');
          } else {
            log(`[[icon:question]] 【${esc(ctx.card.name)}】找不到卡牌「${esc(nm)}」（占位）`, 'warn');
          }
          ctx.did = true;
        },
      },
  
  ];
}
