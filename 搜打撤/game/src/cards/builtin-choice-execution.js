export const BUILTIN_CHOICE_PREVIOUS_RULES = {
  'tt3-magic-lamp': { version:1, battle:{ hosted:['three-choice-lamp'] } },
  'tt8-hero-summoner': { version:1, battle:{ hosted:['gate-choices'] } },
};

export const BUILTIN_CHOICE_REVISIONS = {
  'tt3-magic-lamp': { rules:{ version:1, battle:{ target:{ side:'enemy', area:false } }, triggers:{ onPlay:[
    { op:'choice', options:[
      { label:'发现 1 张牌并将其释放', ops:[{ op:'acquire', n:1, pool:{ kind:'随机' }, dest:'discover', act:'play' }] },
      { label:'消灭 1 名受伤敌人（非 BOSS）', ops:[{ op:'execute', cap:{ wounded:true }, count:1 }] },
      { label:'冰冻 2 名角色，获得 5 点护甲', ops:[{ op:'freezeFirstEnemies', count:2, duration:1 }, { op:'armor', amount:5 }] },
    ] },
  ] } } },
  'tt8-hero-summoner': { rules:{ version:1, battle:{ target:{ side:null, area:false } }, triggers:{ onPlay:[
    { op:'choice', otherAfterTurns:2, options:[
      { label:'打开末日浩劫之门', repeat:'turnStart', ops:[
        { op:'randomCurse', target:'allEnemies', curses:['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban'], stacks:1, preferMissing:true },
      ] },
      { label:'打开天国之门', repeat:'turnStart', ops:[
        { op:'randomBlessing', target:'allAllies', choices:['stealth', 'atkUp', 'spellUp', 'reduce', 'armor', 'purify'], preferMissing:true },
      ] },
    ] },
  ] } } },
};
