/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）。原第 1303-1448 行，逐字搬迁。
 * 铁律：顺序即语义——本分节在壳 effect-steps.js 的 concat 顺序即旧 if 链物理顺序，勿重排。
 * 共享端口由壳经参数 s 注入（deps 展开 + esc/hitFoe + 模块级常量），本文件零 import。 */
export function auditSteps(s) {
  const {combat, getMode, log, drawCards, grantStarterAttack, queueDiscover, queueHandSelect, getHandSize, releaseHandMatches, getPriceOfLastDrawn, dealAoeFixed, replaceShaInDeck, summonAlly, setExtraTurn, queuePouchCast, registerGrowthCard, esc, parsePoolNoun} = s;
  return [
      /* ============ 2026-09-09 机制审计补实装（Q1-Q8 老板定向批次） ============ */
      {
        id: 'draw.untilN', gate: 'fresh', label: '抽牌直到有 N 张手牌（法力补给）',
        when: (ctx) => ctx.desc.match(/抽牌[^。；]*?直到[有满]\s*(\d+)\s*张手牌/),
        run: (ctx, m) => {
          const want = +m[1];
          let gotN = 0;
          if (getMode() === 'boss') {
            let guard = 0;
            while (getHandSize() < want && guard++ < 30) {
              const g = drawCards(1);
              if (!g) break;
              gotN += g;
            }
            log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：抽了 ${gotN} 张牌（手牌 ${getHandSize()} 张）`, 'sys');
          } else {
            const lack = Math.max(0, want - getHandSize());
            grantStarterAttack(lack);
            log(`[[icon:cards]] <b>${esc(ctx.card.name)}</b>：获得 ${lack} 张【初始攻击】（普通战斗抽牌效果改为获得初始攻击）`, 'sys');
          }
          ctx.did = true;
        },
      },
      {
        id: 'dmg.seizeAtk', gate: 'fresh', label: '夺取敌人攻击力（禁咒I）',
        when: (ctx) => ctx.desc.match(/夺取\s*(?:一名|1\s*名)?\s*敌人的?\s*(\d+)\s*点?攻击力/),
        run: (ctx, m) => {
          const t = ctx.curseTarget;
          if (t && !t.dead) {
            const n = +m[1];
            t.atk = Math.max(0, (t.atk || 0) - n);
            combat.addBlessing(ctx.pstat, 'atkUp', n);
            log(`[[icon:arrow]] <b>夺取攻击</b>：${esc(t.name)} 攻击力 -${n}，你的攻击力 +${n}`, 'sys');
            ctx.did = true;
          }
        },
      },
      {
        id: 'dmg.priceAoe', gate: 'always', label: '对全体造成等同于抽到卡牌价格的固定伤害（气功波）',
        // 注意不判 did：同一句里的「抽 1 张牌」会先置 did，价格伤害是同一效果的后续部分
        when: (ctx) => /造成等同于(?:其|该卡|该牌)价格的固定伤害/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          const price = typeof getPriceOfLastDrawn === 'function' ? getPriceOfLastDrawn() : 0;
          if (price > 0 && typeof dealAoeFixed === 'function') {
            dealAoeFixed(price);
            log(`[[icon:play]] <b>${esc(ctx.card.name)}</b>：对全体敌人造成 <b>${price}</b> 点固定伤害（按抽到卡牌的价格）`, 'sys');
          } else {
            log(`[[icon:question]] 没有抽到可折算价格的卡牌（占位）`, 'dim');
          }
          ctx.did = true;
        },
      },
      {
        id: 'dmg.growth', gate: 'fresh', label: '回合开始时本牌伤害 +N（充能火球）',
        when: (ctx) => /回合开始时[，,]?\s*本牌伤害\s*\+\s*\d+/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          if (typeof registerGrowthCard === 'function') registerGrowthCard(ctx.card);
          log(`[[icon:fire]] <b>${esc(ctx.card.name)}</b>：每经过 1 回合，本牌伤害 +1`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'deck.replaceSha', gate: 'always', label: '对战开始时将 N 张杀替换为随机卡牌（迷之匣）',
        when: (ctx) => ctx.desc.match(/将\s*(\d+)\s*张(?:杀|初始攻击)替换为随机卡牌/),
        run: (ctx, m) => {
          if (typeof replaceShaInDeck !== 'function') return;
          const n = replaceShaInDeck(+m[1]);
          log(`[[icon:recycle]] <b>${esc(ctx.card.name)}</b>：已将牌库中 ${n} 张「杀」替换为随机卡牌`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'deck.capUp', gate: 'always', label: '牌库上限 +N（BOSS 编组时生效，仅识别）',
        when: (ctx) => ctx.desc.match(/牌库上限\s*\+\s*(\d+)/),
        run: (ctx, m) => {
          log(`[[icon:cards]] 牌库上限 +${m[1]}（BOSS 编组时生效）`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'summon.ally', gate: 'always', label: '召唤随从「名（X-Y）×N」（征召）',
        when: (ctx) => ctx.desc.match(/召唤\s*([^\s（(，。；;、]+?)\s*[（(]\s*(\d+)\s*[-－]\s*(\d+)\s*[）)]\s*(?:[×xX]\s*(\d+))?/),
        run: (ctx, m) => {
          if (typeof summonAlly !== 'function') return;
          const n = m[4] ? +m[4] : 1;
          summonAlly(m[1], +m[2], +m[3], n);
          log(`[[icon:runner]] <b>${esc(ctx.card.name)}</b>：召唤 ${esc(m[1])}（${m[2]}-${m[3]}）×${n} ——优先替你承受伤害并自动战斗`, 'loot');
          ctx.did = true;
        },
      },
      {
        id: 'turn.extra', gate: 'always', label: '获得 1 个额外回合（命运钟表）',
        // 不判 did：同句「消耗所有手牌」先行置位，额外回合是同一效果的后续部分
        when: (ctx) => /获得\s*1\s*个额外回合/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          if (typeof setExtraTurn !== 'function') return;
          setExtraTurn(true);
          log(`[[icon:hourglass]] <b>${esc(ctx.card.name)}</b>：获得 1 个额外回合（敌人不会行动）`, 'ok');
          ctx.did = true;
        },
      },
      {
        id: 'hand.pouchCast', gate: 'fresh', label: '法师锦囊容器：选 1 张直接施放（Q5）',
        when: (ctx) => (/自带\s*1\s*[*×]\s*3\s*空间|可以置入\s*3\s*张法术牌/.test(ctx.desc) &&
          typeof queuePouchCast === 'function' && ctx.flags.uid) ? true : null,
        run: (ctx) => { queuePouchCast(ctx.flags.uid); ctx.did = true; },
      },
      {
        id: 'hand.pouchPassive', gate: 'fresh', label: '珍珠盒：持有即扩容背包（仅识别）',
        when: (ctx) => /内置\s*3\s*[*×]\s*3\s*空间|容纳所有.{0,6}资源卡牌/.test(ctx.desc) ? true : null,
        run: (ctx) => {
          log(`[[icon:plate]] <b>珍珠盒</b>：持有即扩容背包 9 格（扩格仅收资源卡），无需打出`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'hand.zeroCostSelect', gate: 'fresh', label: '自然法杖：选 1 张卡下回合变 0 费（Q5）',
        when: (ctx) => (/选择\s*(?:1|一)\s*张卡牌[^。]*?下回合将其变为\s*0\s*费/.test(ctx.desc) && typeof queueHandSelect === 'function') ? true : null,
        run: (ctx) => {
          queueHandSelect({ n: 1, type: null, act: 'zero' });
          log(`[[icon:bolt]] <b>${esc(ctx.card.name)}</b>：选择 1 张卡牌，下回合它将变为 0 费`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'discover.form', gate: 'fresh', label: '发现一种形态并释放（千变万化）',
        when: (ctx) => ctx.desc.match(/发现\s*(?:一|1)\s*种(形态)并(?:直接)?释放/),
        run: (ctx, m) => {
          queueDiscover({ n: 1, pred: parsePoolNoun(m[1], ctx.myClass), act: 'play' });
          log(`[[icon:question]] <b>${esc(ctx.card.name)}</b>：发现一种【形态】并直接施放`, 'sys');
          ctx.did = true;
        },
      },
      {
        id: 'release.oneSha', gate: 'fresh', label: '立即释放一次「杀」（百炼青虹剑，消耗该牌时触发）',
        when: (ctx) => (!/该牌时/.test(ctx.desc) && typeof releaseHandMatches === 'function')
          ? ctx.desc.match(/立即释放(?:一次|1\s*次)?[‘'“]?杀/) : null,
        run: (ctx, m) => {
          const released = releaseHandMatches('杀', 0, 1);
          log(released
            ? `[[icon:swords]] <b>${esc(ctx.card.name)}</b>：立即释放了 1 次「初始攻击」`
            : `[[icon:cross]] 手牌中没有「杀」可释放`, released ? 'ok' : 'dim');
          ctx.did = true;
        },
      },
  
  ];
}
