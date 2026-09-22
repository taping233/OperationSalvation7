/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 669-824 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量），本文件零 import。 */
export function recoverySteps(s) {
  const {combat, getMode, log, heal, pushFloat, drawCards, grantStarterAttack, markNoDrawNext, randomDiscoverCard, addTempCard, queueHandSelect, restoreConsumed, random01, autoPlayHandType, armorMul, randomAcquired, esc, HAND_COST_CONSUME_RE, HAND_COST_SELECT_RE, num, HALT} = s;
  return [
      /* ============ 回复 / 护甲 / 抽牌 / 手选段 ============ */
      {
        id: 'heal.n', gate: 'always', label: '回复 N 点生命 / +N 血',
        when: (ctx) => ctx.desc.match(/回复\s*(\d+)\s*(?:点\s*生命|点?血)/) || ctx.desc.match(/\+\s*(\d+)\s*血/),
        run: (ctx, m) => {
          ctx.healed = true;
          if ((ctx.pstat.status.healban || 0) > 0) {
            log(`[[icon:heart]] 禁疗中：回复 ${m[1]} 点生命无效（还剩 ${ctx.pstat.status.healban} 回合）`, 'warn');
          } else { heal(+m[1]); pushFloat({ unit: 'self', text: '', cls: 'stk sticker-heal', warm: true }); }
          ctx.did = true;
        },
      },
      {
        id: 'heal.restoreConsumed', gate: 'always', label: '战斗内复原/复活消耗卡',
        when: (ctx) => ctx.desc.match(/(?:复原|复活)\s*(?:最多)?\s*(\d+)?\s*张/),
        run: (ctx, m) => { const c = restoreConsumed(+(m[1] || 1)); if (c) ctx.did = true; },
      },
      {
        id: 'hand.selectFamily', gate: 'fresh', label: '手选家族：选牌施放 / 复制 / 消耗+尾段',
        when: (ctx) => {
          const selPlay = ctx.desc.match(HAND_COST_SELECT_RE);   // 句式单一登记点（hand-cost-patterns.js，与预检同源）
          if (selPlay) return { kind: 'play', m: selPlay };
          if (/选择并复制你的\s*(?:1\s*|一\s*)?张?手牌/.test(ctx.desc) && typeof queueHandSelect === 'function') return { kind: 'copy' };
          const consM = ctx.desc.match(HAND_COST_CONSUME_RE);   // 句式单一登记点（hand-cost-patterns.js，与预检同源）
          if (consM) return { kind: 'consume', m: consM };
          return null;
        },
        run: (ctx, m) => {
          if (m.kind === 'play') {
            // 与旧实现同一张受限映射：这里「四/五」历史上就落回 1，保持行为不变
            const N23 = { '一': 1, '两': 2, '二': 2, '三': 3 };
            const n = N23[m.m[1]] || +m.m[1] || 1;
            queueHandSelect({ n, type: m.m[2] === '牌' ? null : m.m[2], act: 'play' });
            log(`[[icon:cards]] 从手牌选择 <b>${n}</b> 张${m.m[2] && m.m[2] !== '牌' ? m.m[2] : ''}牌打出`, 'sys');
            ctx.did = true;
            return;
          }
          if (m.kind === 'copy') {
            // 深红丝袋：选择并复制 1 张手牌（复制件置入手牌，原牌保留）
            queueHandSelect({ n: 1, type: null, act: 'copy' });
            log(`[[icon:cards]] 从手牌选择 <b>1</b> 张复制（原牌保留）`, 'sys');
            ctx.did = true;
            return;
          }
          const consM = m.m;
          const n = consM[1] === '一张' ? 1 : (num(consM[1]) || 1);
          queueHandSelect({ n, type: consM[2] === '牌' ? null : consM[2], act: 'consume', thenText: consM[3], target: ctx.curseTarget, srcCard: ctx.card });
          // 尾段效果在消耗完成后经 thenText 结算——立即段提前收口，防止同一句被后续处理器再吃一遍。
          // 2026-09-10 留言 #25：尾段已有的回复/护甲/抽卡要如实回报，否则结构化兜底会再发一次。
          const tail = consM[3];
          ctx.did = true;
          ctx.drawn = /抽\s*(?:\d+|[一二两三四])\s*张/.test(tail);
          ctx.healed = /回复|\+\s*\d+\s*血/.test(tail);
          ctx.armored = /护甲|\+\s*\d+\s*甲/.test(tail);
          return HALT({ did: true, drawn: ctx.drawn, healed: ctx.healed, armored: ctx.armored });
        },
      },
      {
        id: 'misc.mystery', gate: 'fresh', label: '随机神秘效果（神秘药水三选一）',
        when: (ctx) => /随机神秘效果/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const r = random01();
          if (r < 1 / 3) { heal(8); log('[[icon:flask]] 神秘药水：回复 <b>8</b> 点生命', 'ok'); }
          else if (r < 2 / 3) { drawCards(2); log('[[icon:flask]] 神秘药水：抽 <b>2</b> 张牌', 'ok'); }
          else {
            const c = randomDiscoverCard(null);
            if (c) {
              addTempCard(c);
              if (typeof randomAcquired === 'function') randomAcquired(c);   // 阿猫的礼物：随机获取触发
              log(`[[icon:flask]] 神秘药水：随机获得【<b>${esc(c.name)}</b>】置入手牌`, 'loot');
            }
            else log('[[icon:flask]] 神秘药水：卡牌库是空的，什么也没有发生', 'dim');
          }
          ctx.did = true;
        },
      },
      {
        id: 'def.armor', gate: 'always', label: '获得 N 点护甲 / +N 甲',
        when: (ctx) => ctx.desc.match(/获得\s*(\d+)\s*点?\s*护甲/) || ctx.desc.match(/\+\s*(\d+)\s*甲/),
        run: (ctx, m) => {
          const mul = (typeof armorMul === 'function') ? armorMul() : 1;   // 防御符文：获得护甲翻倍
          const n = Math.round(+m[1] * mul);
          ctx.armored = true; ctx.pdef.armor += n;
          log(`[[icon:plate]] 获得 ${n} 点护甲${mul > 1 ? '（防御符文翻倍）' : ''}`, 'sys'); ctx.did = true;
        },
      },
      {
        id: 'def.shield', gate: 'always', label: '获得 N 点护盾',
        when: (ctx) => ctx.desc.match(/获得\s*(\d+)\s*点?\s*护盾/),
        run: (ctx, m) => { ctx.pdef.shield += +m[1]; log(`[[icon:shield]] 获得 ${m[1]} 点护盾`, 'sys'); ctx.did = true; },
      },
      {
        id: 'def.guard', gate: 'always', label: '格挡：本回合所受伤害降为 1',
        when: (ctx) => /本回合所受伤害降为/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          ctx.pdef.guard = true;
          log('[[icon:shield]] 格挡：本回合所受伤害降为 1', 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'buff.purify', gate: 'always', label: '净化',
        when: (ctx) => /净化/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const cleared = combat.purify(ctx.pstat);
          log(cleared.length
            ? `[[icon:sparkles]] 净化：清除了身上的 ${cleared.map(k => combat.CURSE_META[k].name).join('、')}`
            : '[[icon:sparkles]] 净化：身上没有诅咒，干干净净', 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'draw.n', gate: 'always', label: '抽 N 张牌（BOSS 抽牌 / 普通战获得初始攻击）',
        when: (ctx) => {
          // 「回合开始时额外抽」=形态效果；「每释放 1 张，抽 1 张」=连弩随行抽牌，均不在此结算
          const turnExtraDraw = /回合开始时[^。]*?额外抽/.test(ctx.desc);
          const perReleaseDraw = /每(释放|打出)\s*1\s*张/.test(ctx.desc);
          const perCurseDraw = ctx.desc.match(/每有\s*1\s*种诅咒[^。]*?抽\s*(\d+)\s*张牌/);
          const dm = ctx.desc.match(/抽\s*(\d+)\s*[-—~～至]\s*(\d+)\s*张牌/) || ctx.desc.match(/抽\s*(\d+)\s*张牌/);
          if ((dm || perCurseDraw) && !turnExtraDraw && !perReleaseDraw && !/该牌时/.test(ctx.desc)
            && !/洗入牌库[^。]*然后抽/.test(ctx.desc)) return { dm, perCurseDraw };
          return null;
        },
        run: (ctx, m) => {
          let n = m.perCurseDraw ? +m.perCurseDraw[1] : +m.dm[1];
          if (m.perCurseDraw && ctx.curseTarget) {
            const kinds = combat.CURSES.filter(k => (ctx.curseTarget.status[k] || 0) > 0).length;
            n *= Math.max(1, kinds);
            log(`[[icon:skull]] 目标身上有 ${kinds} 种诅咒，抽牌量放大`, 'sys');
          }
          if (getMode() === 'boss') {
            const got = drawCards(n);
            log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：抽了 ${got} 张牌`, 'sys');
          } else {
            grantStarterAttack(n);
            log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：获得 ${n} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
          }
          ctx.did = true; ctx.drawn = true;
          // 万剑归宗：抽完后直接释放其中的武术/法术
          const autoM = ctx.desc.match(/直接释放其中(武术|法术|招式)/);
          if (autoM && typeof autoPlayHandType === 'function') {
            const played = autoPlayHandType(autoM[1] === '招式' ? '武术' : autoM[1]);
            if (played) log(`[[icon:swords]] <b>万剑归宗</b>：直接释放了其中 ${played} 张${autoM[1]}`, 'ok');
          }
        },
      },
      {
        id: 'draw.noDrawNext', gate: 'always', label: '下回合无法抽牌',
        when: (ctx) => /下回合无法抽牌|下个回合无法抽牌/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          markNoDrawNext();
          log('[[icon:cross]] 已标记：<b>下回合开始无法抽牌</b>', 'sys');
          ctx.did = true;
        },
      },
  
  ];
}
