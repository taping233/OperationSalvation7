# E8 真实初始化全卡清单（迁移后）

生成时间：2026-09-27T09:56:21.116Z；HEAD：`7c8e3836663fd650785a0b402cc18d5a55e8591a`。

本文件由显式生成模式输出；完整原始字段、规则、阶段变化和校验诊断见同目录 catalog-after.json。

存储：isolated in-memory Storage; fresh module cache and SDT per run；顺序：ensureStarters → ensureSha → ensureTabletop → ensureDmgTypes → ensureEffectFields。

sourceDefinitions 仅证明运行时定义按稳定 ID 匹配，不证明最终覆盖来源；observedInitChanges 为外层初始化阶段的实际快照差异。
capability 是 E6 battle-entry 预检，supported 不证明 base/bag 执行、实际消费或完整效果结构化。
仅本批三候选补有范围限定的消费端、文本与测试证据；其余保持 unknown。地图背包迁移不代表战斗背包或 onPlay 迁移，清单生成不等于实页验收。

## 初始化顺序对照

```json
{
  "bootOrder": [
    "ensureStarters",
    "ensureSha",
    "ensureTabletop",
    "ensureDmgTypes",
    "ensureEffectFields"
  ],
  "e6Order": [
    "ensureSha",
    "ensureStarters",
    "ensureTabletop",
    "ensureDmgTypes",
    "ensureEffectFields"
  ],
  "bootCount": 272,
  "e6Count": 272,
  "equivalent": true,
  "bootOnly": [],
  "e6Only": [],
  "changed": [],
  "e6Counts": {
    "withRules": 71,
    "withoutRules": 201
  },
  "e6InitStages": [
    {
      "name": "ensureSha",
      "beforeCount": 0,
      "afterCount": 1,
      "added": [
        "starter-attack"
      ],
      "removed": [],
      "changed": []
    },
    {
      "name": "ensureStarters",
      "beforeCount": 1,
      "afterCount": 1,
      "added": [],
      "removed": [],
      "changed": []
    },
    {
      "name": "ensureTabletop",
      "beforeCount": 1,
      "afterCount": 272,
      "added": [
        "tt-medneedle",
        "tt-copper",
        "tt-keys-bunch",
        "tt-rations",
        "tt-token-color",
        "tt-gold",
        "tt-econpack",
        "tt-silver",
        "tt-key",
        "tt-crystal",
        "tt-key-one",
        "tt-token-gold",
        "tt-jinchuangyao",
        "tt-wood",
        "tt-wood-lots",
        "tt2-apollo",
        "tt2-pearlbox",
        "tt2-wreck",
        "tt2-treasuremap",
        "tt2-venomstaff",
        "tt2-frostsword",
        "tt2-jianghu",
        "tt2-swiftarrow",
        "tt2-block",
        "tt2-comboarrow",
        "tt2-piercearrow",
        "tt2-shoot",
        "tt2-turtlearmor",
        "tt2-bloodblade",
        "tt2-forestarrow",
        "tt3-blood-arrow",
        "tt3-fatal-pierce",
        "tt3-fly-arrowhawk",
        "tt3-frost-slash",
        "tt3-noon-duel",
        "tt3-armor-rush",
        "tt3-double-shot",
        "tt3-bandage",
        "tt3-purify-arrow",
        "tt3-arrow-rain",
        "tt3-wave-slash",
        "tt3-qi-wave",
        "tt3-hold-fast",
        "tt3-life-arrow",
        "tt3-dig-treasure",
        "tt3-reshot",
        "tt3-venom-arrow",
        "tt3-toxin",
        "tt3-frostfall",
        "tt3wu-shike",
        "tt3-mystery-potion",
        "tt3-blue-potion",
        "tt3-treasure-hunt",
        "tt3-flame-storm",
        "tt3-nature-form",
        "tt3-python-potion",
        "tt3-chain-lightning",
        "tt3-houyi-potion",
        "tt3-fireball",
        "tt3-holy-water",
        "tt3-skewer",
        "tt3-holy-shield",
        "tt3-iceheart-potion",
        "tt3-demon-potion",
        "tt3-nuke-ray",
        "tt3-petal",
        "tt3-magic-lamp",
        "tt3-thornfield",
        "tt3-mind-potion",
        "tt3-turnabout-potion",
        "tt3-firm-barrier",
        "tt3-ice-spike",
        "tt3-grope",
        "tt3-mixed-potion",
        "tt3sp-dodge",
        "tt3sp-devour",
        "tt3sp-doom",
        "tt3sp-silverthorn",
        "tt3sp-magicoil",
        "tt3sp-shadowbug",
        "tt3sp-flowerzhen",
        "tt3sp-bloodstorm",
        "tt3sp-shadowshot",
        "tt3-thunderblast",
        "tt3-flux-slash",
        "tt3-immortal-blade",
        "tt3-diamond",
        "tt3-master-staff",
        "tt3-chaos-eye",
        "tt3-execute",
        "tt3-savior-elixir",
        "tt3-silver-runesword",
        "tt3-azure-sword",
        "tt3-deep-seal",
        "tt3-fate-wheel",
        "tt3-crimson-pouch",
        "tt3-holy-staff",
        "tt3-staff",
        "tt3-wolf-bow",
        "tt3-sapper-bomb",
        "tt3-twinwater-mail",
        "tt3-grass-armor",
        "tt3-blooddrinker",
        "tt3-longsword",
        "tt3-element-seal",
        "tt3-light-mail",
        "tt3-reverse-bow",
        "tt3-deep-diary",
        "tt3eq-boiler",
        "tt3eq-mistbox",
        "tt3-garnet-marble",
        "tt3-wood-bundle",
        "tt3-ration-double",
        "tt4-shine-token",
        "tt4-smoke-bomb",
        "tt4-woodify",
        "tt5-galaxy-voyage",
        "tt6-demondeal",
        "tt6-bandits",
        "tt6-mystery",
        "tt6-goldmine",
        "tt6-goldhammer",
        "tt6-relief",
        "tt6-airdrop",
        "tt6-chestdraw",
        "tt6-systemsupply",
        "tt7-throwblade",
        "tt7-goldencicada",
        "tt7-sneak",
        "tt7-ghostblade",
        "tt7-thundergrudge",
        "tt7-meteorrain",
        "tt7-stealth",
        "tt7-swordimmortal",
        "cc-unmoved",
        "tt7-marchrush",
        "tt7-bulwark",
        "tt7-armup",
        "tt7-whirlwind",
        "tt7-demonbreaker",
        "tt7-fullstrike",
        "tt7-ironphalanx",
        "tt7-bloodpoison",
        "tt7-silence",
        "cc-demon",
        "tt7-holyglow",
        "tt7-holyheal",
        "tt7-provoke",
        "tt7-bloodpotion",
        "tt7-smite",
        "tt7-arcanebolt",
        "tt7-energize",
        "tt7-frozenight",
        "tt7-stratagem",
        "tt7-bladebloom",
        "tt7-recruit",
        "tt7-elementstorm",
        "tt7-burnharvest",
        "tt7-twinfireball",
        "tt7-abysscurse",
        "tt7-meteorstrong",
        "tt8-hero-assassin",
        "tt8-hero-sword",
        "tt8-hero-ranger",
        "tt8-hero-warrior",
        "tt8-hero-guardian",
        "tt8-hero-priest",
        "tt8-hero-warlock",
        "tt8-hero-mage",
        "tt8-hero-summoner",
        "tt8-hero-sealer",
        "tt8-hero-descender",
        "tt8-curse1",
        "tt8-curse2",
        "tt8-curse3",
        "tt8-curse4",
        "tt8-demonslay",
        "tt8-archdemon",
        "tt8-heavensword",
        "tt8-dragonblade",
        "foe-infantry",
        "foe-archer",
        "foe-bandit",
        "foe-cavalry",
        "foe-orc_jav",
        "foe-wolf_rider",
        "foe-orc_axe",
        "foe-fire_el",
        "foe-water_el",
        "foe-esper_crow",
        "foe-esper_candle",
        "foe-grass_el",
        "foe-esper_silence",
        "foe-esper_echo",
        "foe-dragon",
        "foe-boss_general",
        "foe-boss_orc",
        "foe-boss_elem",
        "cmtn0pbkmnvc",
        "cmtn1epgt20j",
        "cmtn233trmeg",
        "cmtn2jc142dj",
        "cmtn6ulm4boj",
        "cmtn79743r2n",
        "cmtn7err0a7",
        "cmtna0nb1yxt",
        "tt7-livingwater",
        "tt7-naturestaff",
        "tt7-darkfort",
        "tt7-arcanescroll",
        "tt7-talisman",
        "tt7-ironcharge",
        "tt7-maxsupply",
        "tt7-imitate",
        "tt8-healplus",
        "tt8-energycap",
        "tt8-nofocus",
        "tt8-curseimmune",
        "cmtmvq6ss84l",
        "cmtn0xt0zr7",
        "cmtn125e1nk0",
        "cmtn1gfhczzj",
        "cmtn1i64j7y7",
        "cmtn1lbhbqi4",
        "cmtn1ntxzoc4",
        "cmtn1p9vb5au",
        "cmtn1r10xnl1",
        "cmtn1wnhhym",
        "cmtn28jv33wx",
        "cmtn6bge52qt",
        "cmtn7qttxqo4",
        "starter-emergency-bandage",
        "cc-chase-slash",
        "cc-cursed-blade",
        "cc-double-boom",
        "cc-dual-wield",
        "cc-ember-burst",
        "cc-last-stand",
        "cc-lava-blast",
        "cc-mana-surge",
        "cc-poison-burst",
        "cc-rapid-fire",
        "cc-rot-seed",
        "pet-egg",
        "tt8-abyss-sovereign",
        "ev19-vital",
        "ev19-pearlbox",
        "ev19-fireballs",
        "ev19-classchest",
        "ev19-recode",
        "ev19-potions",
        "ev19-arrows",
        "ev19-gamble",
        "ev19-quartermaster",
        "tt12-raydragon",
        "tt12-sporewall",
        "tt12-elemburst",
        "tt12-hitechrd",
        "tt12-barriermend",
        "tt12-saturate",
        "tt12-felguard",
        "tt12-unstableray",
        "tt12-infectray",
        "tt12-basicdev",
        "tt12-firecracker",
        "tt12-magicfind",
        "tt12-chargeray",
        "tt12-breakthrough",
        "tt12-raygun",
        "tt12-backupcell",
        "tt12-freezeray"
      ],
      "removed": [],
      "changed": [
        {
          "id": "starter-attack",
          "fields": [
            "value"
          ]
        }
      ]
    },
    {
      "name": "ensureDmgTypes",
      "beforeCount": 272,
      "afterCount": 272,
      "added": [],
      "removed": [],
      "changed": []
    },
    {
      "name": "ensureEffectFields",
      "beforeCount": 272,
      "afterCount": 272,
      "added": [],
      "removed": [],
      "changed": [
        {
          "id": "tt3-magic-lamp",
          "fields": [
            "armor"
          ]
        },
        {
          "id": "tt6-relief",
          "fields": [
            "heal"
          ]
        },
        {
          "id": "tt7-goldencicada",
          "fields": [
            "draw"
          ]
        },
        {
          "id": "cc-unmoved",
          "fields": [
            "armor"
          ]
        },
        {
          "id": "tt7-arcanebolt",
          "fields": [
            "draw"
          ]
        },
        {
          "id": "tt8-hero-warlock",
          "fields": [
            "draw"
          ]
        },
        {
          "id": "ev19-vital",
          "fields": [
            "heal"
          ]
        }
      ]
    }
  ]
}
```

## 迁移前后完整字段核对

```json
{
  "beforeCount": 272,
  "afterCount": 272,
  "addedIds": [],
  "removedIds": [],
  "changedIds": [
    "starter-emergency-bandage",
    "tt-jinchuangyao",
    "tt4-woodify"
  ],
  "changes": [
    {
      "id": "starter-emergency-bandage",
      "fields": [
        "rules"
      ],
      "before": {
        "id": "starter-emergency-bandage",
        "name": "应急绷带",
        "cost": 0,
        "rarity": "稀有",
        "type": "道具",
        "dmg": 0,
        "heal": 12,
        "desc": "回复12 点生命。",
        "value": 0,
        "sellable": false
      },
      "after": {
        "id": "starter-emergency-bandage",
        "name": "应急绷带",
        "cost": 0,
        "rarity": "稀有",
        "type": "道具",
        "dmg": 0,
        "heal": 12,
        "desc": "回复12 点生命。",
        "value": 0,
        "sellable": false,
        "rules": {
          "version": 1,
          "bag": {
            "use": [
              {
                "op": "heal",
                "amountField": "heal"
              }
            ]
          }
        }
      }
    },
    {
      "id": "tt-jinchuangyao",
      "fields": [
        "rules"
      ],
      "before": {
        "id": "tt-jinchuangyao",
        "name": "金疮药",
        "cost": 0,
        "rarity": "史诗",
        "type": "道具",
        "desc": "回复 20 点生命。",
        "dmg": 0,
        "heal": 20,
        "value": 4
      },
      "after": {
        "id": "tt-jinchuangyao",
        "name": "金疮药",
        "cost": 0,
        "rarity": "史诗",
        "type": "道具",
        "desc": "回复 20 点生命。",
        "dmg": 0,
        "heal": 20,
        "value": 4,
        "rules": {
          "version": 1,
          "bag": {
            "use": [
              {
                "op": "heal",
                "amountField": "heal"
              }
            ]
          }
        }
      }
    },
    {
      "id": "tt4-woodify",
      "fields": [
        "rules"
      ],
      "before": {
        "id": "tt4-woodify",
        "name": "能量饮料",
        "cost": 0,
        "rarity": "古朴",
        "type": "道具",
        "desc": "回复 6 点生命。",
        "dmg": 0,
        "heal": 6,
        "value": 2
      },
      "after": {
        "id": "tt4-woodify",
        "name": "能量饮料",
        "cost": 0,
        "rarity": "古朴",
        "type": "道具",
        "desc": "回复 6 点生命。",
        "dmg": 0,
        "heal": 6,
        "value": 2,
        "rules": {
          "version": 1,
          "bag": {
            "use": [
              {
                "op": "heal",
                "amountField": "heal"
              }
            ]
          }
        }
      }
    }
  ],
  "cardsSyncCardsUnchanged": true
}
```

原始 CARDS_SYNC 文件字节证据：

```json
{
  "path": "game/data/cards-sync.json",
  "sha256": "d2f38387dd0c49ca90628aeea5334790286de906838b34e6c7aece0652511244",
  "baselineSha256": "d2f38387dd0c49ca90628aeea5334790286de906838b34e6c7aece0652511244",
  "baselineScope": "read-only capture at start of second window; not first-window capture",
  "baselineRecordedAt": "2026-09-27T09:38:49Z",
  "bytesUnchanged": true
}
```

## 三候选的限定证据

```json
[
  {
    "id": "starter-emergency-bandage",
    "consumerStatus": {
      "status": "verified-scoped",
      "scope": "current migrated catalogue copy; map backpack only",
      "mapBag": {
        "kind": "structured",
        "references": [
          "game/src/hub/game.bag.js:26 useStructuredBagRule",
          "game/src/hub/game.bag.js:73 useOwnedCard",
          "game/src/hub/game.bag.js:707 inspectStack",
          "game/src/hub/game.bag.js:743 useDetailCard",
          "game/src/run/game.run.scenes.js:265 grantEventCard"
        ]
      },
      "battleBag": {
        "kind": "legacy-text",
        "modes": [
          "ordinary",
          "BOSS"
        ],
        "reference": "game/src/battle/battle.bag.js:44 useItem"
      },
      "battleHand": {
        "kind": "excluded-from-normal-start",
        "references": [
          "game/src/battle/battle.lifecycle.js:240",
          "game/src/battle/battle.lifecycle.js:254",
          "game/src/battle/battle.lifecycle.js:295"
        ]
      },
      "base": "unknown"
    },
    "textStatus": {
      "status": "mixed",
      "mapBag": "heal field consumed; rewritten description does not change healing or consumption",
      "battleBag": "ordinary/BOSS bag still consumes description healing; no migration",
      "oldCopies": "old two-point STARTERS/run copies retain their original legacy text behavior",
      "wholeCardDescriptionIndependent": false
    },
    "testReferences": {
      "status": "verified-scoped",
      "references": [
        {
          "path": "tests/e8-card-migration.test.js:199",
          "test": "starter-emergency-bandage acquired production copy matches old map use and ignores rewritten desc",
          "scope": "actual grantEventCard copy and showBackpack UI-bound callback, mocked session/UI host; HP 50/98/100, rewritten/no-heal/99-heal description, repeat UID"
        },
        {
          "path": "tests/e8-card-migration.test.js:216",
          "test": "starter-emergency-bandage preserves BOSS rejection and text-based battle bag behavior"
        },
        {
          "path": "tests/e8-card-migration.test.js:177",
          "test": "retains actual STARTERS and pre-existing run two-point copies in the real map bag"
        },
        {
          "path": "tests/e8-card-migration.test.js:237",
          "test": "does not rewrite an existing run copy when the catalogue gains rules"
        }
      ],
      "validation": {
        "command": "npx vitest run tests/e8-card-migration.test.js tests/e6-card-rules-capability.test.js --no-file-parallelism",
        "result": "2 files / 49 tests passed",
        "reportedBy": "E8 commander; 2026-09-27 17:48 Asia/Shanghai",
        "independentlyCheckedHere": "source paths and test assertions; no additional effect test rerun or browser acceptance"
      }
    }
  },
  {
    "id": "tt-jinchuangyao",
    "consumerStatus": {
      "status": "verified-scoped",
      "scope": "current migrated catalogue copy; map backpack only",
      "mapBag": {
        "kind": "structured",
        "references": [
          "game/src/hub/game.bag.js:26 useStructuredBagRule",
          "game/src/hub/game.bag.js:73 useOwnedCard",
          "game/src/hub/game.bag.js:707 inspectStack",
          "game/src/hub/game.bag.js:743 useDetailCard",
          "game/src/run/game.run.scenes.js:265 grantEventCard"
        ]
      },
      "battleBag": {
        "kind": "legacy-text",
        "modes": [
          "ordinary",
          "BOSS"
        ],
        "reference": "game/src/battle/battle.bag.js:44 useItem"
      },
      "battleHand": {
        "kind": "excluded-from-normal-start",
        "references": [
          "game/src/battle/battle.lifecycle.js:240",
          "game/src/battle/battle.lifecycle.js:254",
          "game/src/battle/battle.lifecycle.js:295"
        ]
      },
      "base": "unknown"
    },
    "textStatus": {
      "status": "mixed",
      "mapBag": "heal field consumed; rewritten description does not change healing or consumption",
      "battleBag": "ordinary/BOSS bag still consumes description healing; no migration",
      "oldCopies": "old two-point STARTERS/run copies retain their original legacy text behavior",
      "wholeCardDescriptionIndependent": false
    },
    "testReferences": {
      "status": "verified-scoped",
      "references": [
        {
          "path": "tests/e8-card-migration.test.js:199",
          "test": "tt-jinchuangyao acquired production copy matches old map use and ignores rewritten desc",
          "scope": "actual grantEventCard copy and showBackpack UI-bound callback, mocked session/UI host; HP 50/98/100, rewritten/no-heal/99-heal description, repeat UID"
        },
        {
          "path": "tests/e8-card-migration.test.js:216",
          "test": "tt-jinchuangyao preserves BOSS rejection and text-based battle bag behavior"
        },
        {
          "path": "tests/e8-card-migration.test.js:177",
          "test": "retains actual STARTERS and pre-existing run two-point copies in the real map bag"
        },
        {
          "path": "tests/e8-card-migration.test.js:237",
          "test": "does not rewrite an existing run copy when the catalogue gains rules"
        }
      ],
      "validation": {
        "command": "npx vitest run tests/e8-card-migration.test.js tests/e6-card-rules-capability.test.js --no-file-parallelism",
        "result": "2 files / 49 tests passed",
        "reportedBy": "E8 commander; 2026-09-27 17:48 Asia/Shanghai",
        "independentlyCheckedHere": "source paths and test assertions; no additional effect test rerun or browser acceptance"
      }
    }
  },
  {
    "id": "tt4-woodify",
    "consumerStatus": {
      "status": "verified-scoped",
      "scope": "current migrated catalogue copy; map backpack only",
      "mapBag": {
        "kind": "structured",
        "references": [
          "game/src/hub/game.bag.js:26 useStructuredBagRule",
          "game/src/hub/game.bag.js:73 useOwnedCard",
          "game/src/hub/game.bag.js:707 inspectStack",
          "game/src/hub/game.bag.js:743 useDetailCard",
          "game/src/run/game.run.scenes.js:265 grantEventCard"
        ]
      },
      "battleBag": {
        "kind": "legacy-text",
        "modes": [
          "ordinary",
          "BOSS"
        ],
        "reference": "game/src/battle/battle.bag.js:44 useItem"
      },
      "battleHand": {
        "kind": "excluded-from-normal-start",
        "references": [
          "game/src/battle/battle.lifecycle.js:240",
          "game/src/battle/battle.lifecycle.js:254",
          "game/src/battle/battle.lifecycle.js:295"
        ]
      },
      "base": "unknown"
    },
    "textStatus": {
      "status": "mixed",
      "mapBag": "heal field consumed; rewritten description does not change healing or consumption",
      "battleBag": "ordinary/BOSS bag still consumes description healing; no migration",
      "oldCopies": "old two-point STARTERS/run copies retain their original legacy text behavior",
      "wholeCardDescriptionIndependent": false
    },
    "testReferences": {
      "status": "verified-scoped",
      "references": [
        {
          "path": "tests/e8-card-migration.test.js:199",
          "test": "tt4-woodify acquired production copy matches old map use and ignores rewritten desc",
          "scope": "actual grantEventCard copy and showBackpack UI-bound callback, mocked session/UI host; HP 50/98/100, rewritten/no-heal/99-heal description, repeat UID"
        },
        {
          "path": "tests/e8-card-migration.test.js:216",
          "test": "tt4-woodify preserves BOSS rejection and text-based battle bag behavior"
        },
        {
          "path": "tests/e8-card-migration.test.js:177",
          "test": "retains actual STARTERS and pre-existing run two-point copies in the real map bag"
        },
        {
          "path": "tests/e8-card-migration.test.js:237",
          "test": "does not rewrite an existing run copy when the catalogue gains rules"
        }
      ],
      "validation": {
        "command": "npx vitest run tests/e8-card-migration.test.js tests/e6-card-rules-capability.test.js --no-file-parallelism",
        "result": "2 files / 49 tests passed",
        "reportedBy": "E8 commander; 2026-09-27 17:48 Asia/Shanghai",
        "independentlyCheckedHere": "source paths and test assertions; no additional effect test rerun or browser acceptance"
      }
    }
  }
]
```

## production

```json
{
  "total": 272,
  "withRules": 71,
  "withoutRules": 201,
  "schema": {
    "valid": 272
  },
  "schemaPending": 0,
  "capability": {
    "legacy": 201,
    "supported": 71
  },
  "domains": {
    "bag": 6,
    "base": 8,
    "battle": 57,
    "triggers": 56
  },
  "triggers": {
    "onPlay": 56
  },
  "ops": {
    "acquire": 12,
    "armor": 9,
    "blessing": 3,
    "curse": 10,
    "damage": 33,
    "discover": 1,
    "draw": 3,
    "energy": 1,
    "heal": 6,
    "restoreConsumed": 2,
    "status": 1
  }
}
```

分类完整性：{"missing":0,"unknownCards":269,"unknownByField":{"sourceDefinitions":0,"consumerStatus":269,"textStatus":269,"testReferences":269}}

| ID | 名称 | 类型 | rules | schema | capability | 域 | triggers / ops | 定义引用 | 未知分类 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cc-chase-slash | 追斩 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[0] | consumerStatus, textStatus, testReferences |
| cc-cursed-blade | 诅咒之刃 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[1] | consumerStatus, textStatus, testReferences |
| cc-demon | 恶魔之力 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[18] | consumerStatus, textStatus, testReferences |
| cc-double-boom | 二次爆炸 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/data/cards-sync.json:cards[2] | consumerStatus, textStatus, testReferences |
| cc-dual-wield | 二刀流 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / acquire | game/data/cards-sync.json:cards[3] | consumerStatus, textStatus, testReferences |
| cc-ember-burst | 余烬爆裂 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/data/cards-sync.json:cards[4] | consumerStatus, textStatus, testReferences |
| cc-last-stand | 破釜沉舟 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[5] | consumerStatus, textStatus, testReferences |
| cc-lava-blast | 熔岩爆破 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, acquire | game/data/cards-sync.json:cards[6] | consumerStatus, textStatus, testReferences |
| cc-mana-surge | 法力奔涌 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[7] | consumerStatus, textStatus, testReferences |
| cc-poison-burst | 毒爆 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[8] | consumerStatus, textStatus, testReferences |
| cc-rapid-fire | 连续射击 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[9] | consumerStatus, textStatus, testReferences |
| cc-rot-seed | 腐化之种 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[10] | consumerStatus, textStatus, testReferences |
| cc-unmoved | 不变应万变 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / armor | game/src/cards/cards.data.js:dataSlice.TABLETOP7[8] | consumerStatus, textStatus, testReferences |
| cmtmvq6ss84l | 员工通行证A | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[12] | consumerStatus, textStatus, testReferences |
| cmtn0pbkmnvc | 流光照影 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP10[168] | consumerStatus, textStatus, testReferences |
| cmtn0xt0zr7 | 闪金之锤 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[13] | consumerStatus, textStatus, testReferences |
| cmtn125e1nk0 | 神秘召唤 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP11[14] | consumerStatus, textStatus, testReferences |
| cmtn1epgt20j | 灵能召唤 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP10[169] | consumerStatus, textStatus, testReferences |
| cmtn1gfhczzj | 厄运 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP11[15] | consumerStatus, textStatus, testReferences |
| cmtn1i64j7y7 | 盗宝 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP11[16] | consumerStatus, textStatus, testReferences |
| cmtn1lbhbqi4 | 充能火球 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[17] | consumerStatus, textStatus, testReferences |
| cmtn1ntxzoc4 | 火焰形态 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / blessing | game/src/cards/cards.data.js:dataSlice.TABLETOP11[18] | consumerStatus, textStatus, testReferences |
| cmtn1p9vb5au | 千变万化 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[19] | consumerStatus, textStatus, testReferences |
| cmtn1r10xnl1 | 黑暗形态 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[20] | consumerStatus, textStatus, testReferences |
| cmtn1wnhhym | 江湖救急-改 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[21]; game/data/cards-sync.json:cards[46] | consumerStatus, textStatus, testReferences |
| cmtn233trmeg | 不朽斩 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP10[170] | consumerStatus, textStatus, testReferences |
| cmtn28jv33wx | 搜索大宝箱 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[22] | consumerStatus, textStatus, testReferences |
| cmtn2jc142dj | 刀剑形态 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP10[171] | consumerStatus, textStatus, testReferences |
| cmtn6bge52qt | 复原药水 | 道具 | true | valid (pending=0) | supported | bag |  / restoreConsumed | game/src/cards/cards.data.js:dataSlice.TABLETOP11[23] | consumerStatus, textStatus, testReferences |
| cmtn6ulm4boj | 步兵 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP10[172]; game/data/cards-sync.json:cards[11] | consumerStatus, textStatus, testReferences |
| cmtn79743r2n | 末日浩劫之门 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP10[173]; game/data/cards-sync.json:cards[12] | consumerStatus, textStatus, testReferences |
| cmtn7err0a7 | 天国之门 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP10[174]; game/data/cards-sync.json:cards[13] | consumerStatus, textStatus, testReferences |
| cmtn7qttxqo4 | 巷口修鞋匠 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[9]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[24] | consumerStatus, textStatus, testReferences |
| cmtna0nb1yxt | 法力光波 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP10[175] | consumerStatus, textStatus, testReferences |
| ev19-arrows | 海堤箭库 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[16] | consumerStatus, textStatus, testReferences |
| ev19-classchest | 黑箱调拨 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[13] | consumerStatus, textStatus, testReferences |
| ev19-fireballs | 双焰走私 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[12] | consumerStatus, textStatus, testReferences |
| ev19-gamble | 地下商场黑市 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[17] | consumerStatus, textStatus, testReferences |
| ev19-pearlbox | 遗落的珍珠匣 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[11] | consumerStatus, textStatus, testReferences |
| ev19-potions | 避难市集药摊 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[15] | consumerStatus, textStatus, testReferences |
| ev19-quartermaster | 装备征用令 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[18] | consumerStatus, textStatus, testReferences |
| ev19-recode | 故障重编 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[14] | consumerStatus, textStatus, testReferences |
| ev19-vital | 高压急救 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[10] | consumerStatus, textStatus, testReferences |
| foe-archer | 联邦射手 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[1] | consumerStatus, textStatus, testReferences |
| foe-bandit | 反抗组织拾荒者 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[2] | consumerStatus, textStatus, testReferences |
| foe-boss_elem | 异能领主 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[17] | consumerStatus, textStatus, testReferences |
| foe-boss_general | 肃清总督 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[15] | consumerStatus, textStatus, testReferences |
| foe-boss_orc | 变异巢母 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[16] | consumerStatus, textStatus, testReferences |
| foe-cavalry | 联邦机动兵 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[3] | consumerStatus, textStatus, testReferences |
| foe-dragon | 巨兽「荒渊」 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[14] | consumerStatus, textStatus, testReferences |
| foe-esper_candle | 烛火 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[10] | consumerStatus, textStatus, testReferences |
| foe-esper_crow | 白鸦 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[9] | consumerStatus, textStatus, testReferences |
| foe-esper_echo | 回声 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[13] | consumerStatus, textStatus, testReferences |
| foe-esper_silence | 静默 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[12] | consumerStatus, textStatus, testReferences |
| foe-fire_el | 灼热异变体 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[7]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[47] | consumerStatus, textStatus, testReferences |
| foe-grass_el | 滋生异变体 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[11]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[49] | consumerStatus, textStatus, testReferences |
| foe-infantry | 联邦巡防兵 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[0] | consumerStatus, textStatus, testReferences |
| foe-orc_axe | 甲壳变异体 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[6]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[45] | consumerStatus, textStatus, testReferences |
| foe-orc_jav | 反抗组织掷弹兵 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[4] | consumerStatus, textStatus, testReferences |
| foe-water_el | 腐蚀异变体 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[8]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[48] | consumerStatus, textStatus, testReferences |
| foe-wolf_rider | 变异雪狼 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.BESTIARY[5]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[46] | consumerStatus, textStatus, testReferences |
| pet-egg | 宠物蛋 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[14] | consumerStatus, textStatus, testReferences |
| starter-attack | 初始攻击 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP10[0]; game/src/cards/cards.rules.js:rulesSlice.SHA[0] | consumerStatus, textStatus, testReferences |
| starter-emergency-bandage | 应急绷带 | 道具 | true | valid (pending=0) | supported | bag |  / heal | game/src/cards/cards.data.js:dataSlice.TABLETOP11[25]; game/src/cards/cards.rules.js:rulesSlice.STARTERS[0] |  |
| tt-copper | 铜币 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[1]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[2] | consumerStatus, textStatus, testReferences |
| tt-crystal | 能源结晶 | 道具 | true | valid (pending=0) | supported | bag |  / restoreConsumed | game/src/cards/cards.data.js:dataSlice.TABLETOP[9]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[8]; game/data/cards-sync.json:cards[15] | consumerStatus, textStatus, testReferences |
| tt-econpack | 经济卡包 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[6]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[27] | consumerStatus, textStatus, testReferences |
| tt-gold | 金币 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[5]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[5] | consumerStatus, textStatus, testReferences |
| tt-jinchuangyao | 金疮药 | 道具 | true | valid (pending=0) | supported | bag |  / heal | game/src/cards/cards.data.js:dataSlice.TABLETOP[12]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[11] |  |
| tt-key | 一把钥匙 | 资源 | true | valid (pending=0) | supported | base |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[8]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[7]; game/data/cards-sync.json:cards[16] | consumerStatus, textStatus, testReferences |
| tt-key-one | 三把钥匙 | 资源 | true | valid (pending=0) | supported | base |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[10]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[9]; game/data/cards-sync.json:cards[17] | consumerStatus, textStatus, testReferences |
| tt-keys-bunch | 两把钥匙 | 资源 | true | valid (pending=0) | supported | base |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[2]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[3]; game/data/cards-sync.json:cards[18] | consumerStatus, textStatus, testReferences |
| tt-medneedle | 急救合剂 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[1] | consumerStatus, textStatus, testReferences |
| tt-rations | 口粮 | 资源 | true | valid (pending=0) | supported | base |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[3]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[4] | consumerStatus, textStatus, testReferences |
| tt-silver | 银币 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[7]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[6] | consumerStatus, textStatus, testReferences |
| tt-token-color | 员工通行证A | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[4]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[26] | consumerStatus, textStatus, testReferences |
| tt-token-gold | 员工通行证B | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[11]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[10]; game/data/cards-sync.json:cards[53] | consumerStatus, textStatus, testReferences |
| tt-wood | 木材 | 资源 | true | valid (pending=0) | supported | base |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[13]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[12] | consumerStatus, textStatus, testReferences |
| tt-wood-lots | 大量木材 | 资源 | true | valid (pending=0) | supported | base |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP[14]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[13] | consumerStatus, textStatus, testReferences |
| tt12-backupcell | 后备能源 | 法术 | true | valid (pending=0) | supported | battle |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP12[15] | consumerStatus, textStatus, testReferences |
| tt12-barriermend | 屏障修复 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / armor | game/src/cards/cards.data.js:dataSlice.TABLETOP12[4] | consumerStatus, textStatus, testReferences |
| tt12-basicdev | 基础开发 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP12[9] | consumerStatus, textStatus, testReferences |
| tt12-breakthrough | 突破进展 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP12[13] | consumerStatus, textStatus, testReferences |
| tt12-chargeray | 充能射线 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP12[12] | consumerStatus, textStatus, testReferences |
| tt12-elemburst | 元素爆裂 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP12[2] | consumerStatus, textStatus, testReferences |
| tt12-felguard | 邪能护体 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP12[6] | consumerStatus, textStatus, testReferences |
| tt12-firecracker | 违禁烟火 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP12[10] | consumerStatus, textStatus, testReferences |
| tt12-freezeray | 冷冻射线 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP12[16] | consumerStatus, textStatus, testReferences |
| tt12-hitechrd | 高端研发 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / discover | game/src/cards/cards.data.js:dataSlice.TABLETOP12[3] | consumerStatus, textStatus, testReferences |
| tt12-infectray | 感染射线 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, curse | game/src/cards/cards.data.js:dataSlice.TABLETOP12[8] | consumerStatus, textStatus, testReferences |
| tt12-magicfind | 魔法新发现 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP12[11] | consumerStatus, textStatus, testReferences |
| tt12-raydragon | 龙焰射线 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP12[0] | consumerStatus, textStatus, testReferences |
| tt12-raygun | 射线枪 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP12[14] | consumerStatus, textStatus, testReferences |
| tt12-saturate | 饱和打击 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP12[5] | consumerStatus, textStatus, testReferences |
| tt12-sporewall | 孢子城墙 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP12[1] | consumerStatus, textStatus, testReferences |
| tt12-unstableray | 不稳定射线 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP12[7] | consumerStatus, textStatus, testReferences |
| tt2-apollo | 阿猫的礼物 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[14] | consumerStatus, textStatus, testReferences |
| tt2-block | 格挡 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / armor | game/src/cards/cards.data.js:dataSlice.TABLETOP2[8]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[21] | consumerStatus, textStatus, testReferences |
| tt2-bloodblade | 嗜血刃 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP2[13]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[26] | consumerStatus, textStatus, testReferences |
| tt2-comboarrow | 连击箭 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[9]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[22] | consumerStatus, textStatus, testReferences |
| tt2-forestarrow | 绿化箭 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[14]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[27] | consumerStatus, textStatus, testReferences |
| tt2-frostsword | 寒冰剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[5]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[18] | consumerStatus, textStatus, testReferences |
| tt2-jianghu | 江湖救急 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[6]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[19] | consumerStatus, textStatus, testReferences |
| tt2-pearlbox | 珍珠盒 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[1]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[15] | consumerStatus, textStatus, testReferences |
| tt2-piercearrow | 破甲箭 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[10]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[23] | consumerStatus, textStatus, testReferences |
| tt2-shoot | 射击 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP2[11]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[24] | consumerStatus, textStatus, testReferences |
| tt2-swiftarrow | 迅疾箭 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[7]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[20] | consumerStatus, textStatus, testReferences |
| tt2-treasuremap | 寻宝图 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[3]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[28] | consumerStatus, textStatus, testReferences |
| tt2-turtlearmor | 铸甲 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[12]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[25] | consumerStatus, textStatus, testReferences |
| tt2-venomstaff | 毒杖 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[4]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[17] | consumerStatus, textStatus, testReferences |
| tt2-wreck | 沉船宝盒 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP2[2]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[16] | consumerStatus, textStatus, testReferences |
| tt3-armor-rush | 破甲急袭 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, curse | game/src/cards/cards.data.js:dataSlice.TABLETOP3[5]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[33] | consumerStatus, textStatus, testReferences |
| tt3-arrow-rain | 箭雨 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP3[9]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[37] | consumerStatus, textStatus, testReferences |
| tt3-azure-sword | 百炼青虹剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[62]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[86] | consumerStatus, textStatus, testReferences |
| tt3-bandage | 包扎 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / heal, armor | game/src/cards/cards.data.js:dataSlice.TABLETOP3[7]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[35] | consumerStatus, textStatus, testReferences |
| tt3-blood-arrow | 血箭 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, curse | game/src/cards/cards.data.js:dataSlice.TABLETOP3[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[28] | consumerStatus, textStatus, testReferences |
| tt3-blooddrinker | 饮血剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[72]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[96] | consumerStatus, textStatus, testReferences |
| tt3-blue-potion | 恢复药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[21]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[49] | consumerStatus, textStatus, testReferences |
| tt3-chain-lightning | 闪电链 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP3[26]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[53] | consumerStatus, textStatus, testReferences |
| tt3-chaos-eye | 混沌之眼 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[58]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[82] | consumerStatus, textStatus, testReferences |
| tt3-crimson-pouch | 深红丝袋 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[65]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[89] | consumerStatus, textStatus, testReferences |
| tt3-deep-diary | 深海咒印 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[77]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[101] | consumerStatus, textStatus, testReferences |
| tt3-deep-seal | 深海印记 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[63]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[87] | consumerStatus, textStatus, testReferences |
| tt3-demon-potion | 法力药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[33]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[59] | consumerStatus, textStatus, testReferences |
| tt3-diamond | 钻石 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[56]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[80] | consumerStatus, textStatus, testReferences |
| tt3-dig-treasure | 挖宝 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[14]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[42] | consumerStatus, textStatus, testReferences |
| tt3-double-shot | 连射 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP3[6]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[34] | consumerStatus, textStatus, testReferences |
| tt3-element-seal | 元素符印 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[74]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[98] | consumerStatus, textStatus, testReferences |
| tt3-execute | 斩杀 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP3[59]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[83] | consumerStatus, textStatus, testReferences |
| tt3-fatal-pierce | 致命穿刺 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[1]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[29] | consumerStatus, textStatus, testReferences |
| tt3-fate-wheel | 命运钟表 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[64]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[88] | consumerStatus, textStatus, testReferences |
| tt3-fireball | 火球 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP3[28]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[30]; game/data/cards-sync.json:cards[42] | consumerStatus, textStatus, testReferences |
| tt3-firm-barrier | 坚冰结界 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[40]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[64] | consumerStatus, textStatus, testReferences |
| tt3-flame-storm | 风暴火球 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[23]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[29] | consumerStatus, textStatus, testReferences |
| tt3-flux-slash | 流光斩 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, curse, acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP3[54]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[78] | consumerStatus, textStatus, testReferences |
| tt3-fly-arrowhawk | 飞身劈 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[2]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[30] | consumerStatus, textStatus, testReferences |
| tt3-frost-slash | 霜月斩 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, curse, curse | game/src/cards/cards.data.js:dataSlice.TABLETOP3[3]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[31] | consumerStatus, textStatus, testReferences |
| tt3-frostfall | 剑荡妖邪 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[18]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[46] | consumerStatus, textStatus, testReferences |
| tt3-garnet-marble | 石榴弹珠 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[80]; game/data/cards-sync.json:cards[19] | consumerStatus, textStatus, testReferences |
| tt3-grass-armor | 草甲 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[71]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[95] | consumerStatus, textStatus, testReferences |
| tt3-grope | 摸索 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[42]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[66] | consumerStatus, textStatus, testReferences |
| tt3-hold-fast | 坚守 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / armor, draw | game/src/cards/cards.data.js:dataSlice.TABLETOP3[12]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[40] | consumerStatus, textStatus, testReferences |
| tt3-holy-shield | 圣盾 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / armor | game/src/cards/cards.data.js:dataSlice.TABLETOP3[31]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[57]; game/data/cards-sync.json:cards[47] | consumerStatus, textStatus, testReferences |
| tt3-holy-staff | 圣杖 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[66]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[90] | consumerStatus, textStatus, testReferences |
| tt3-holy-water | 治愈 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[29]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[55]; game/data/cards-sync.json:cards[20] | consumerStatus, textStatus, testReferences |
| tt3-houyi-potion | 狂暴药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[27]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[54] | consumerStatus, textStatus, testReferences |
| tt3-ice-spike | 冰刺 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, curse | game/src/cards/cards.data.js:dataSlice.TABLETOP3[41]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[65] | consumerStatus, textStatus, testReferences |
| tt3-iceheart-potion | 冰冻药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[32]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[58] | consumerStatus, textStatus, testReferences |
| tt3-immortal-blade | 骷髅王剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[55]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[79]; game/data/cards-sync.json:cards[48] | consumerStatus, textStatus, testReferences |
| tt3-life-arrow | 生命箭 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP3[13]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[41] | consumerStatus, textStatus, testReferences |
| tt3-light-mail | 急速跑鞋 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[75]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[99] | consumerStatus, textStatus, testReferences |
| tt3-longsword | 长剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[73]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[97] | consumerStatus, textStatus, testReferences |
| tt3-magic-lamp | 神灯 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[36]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[60] | consumerStatus, textStatus, testReferences |
| tt3-master-staff | 大法师之杖 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[57]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[81] | consumerStatus, textStatus, testReferences |
| tt3-mind-potion | 精神药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[38]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[62] | consumerStatus, textStatus, testReferences |
| tt3-mixed-potion | 流血药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[43]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[67] | consumerStatus, textStatus, testReferences |
| tt3-mystery-potion | 神秘药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[20]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[48] | consumerStatus, textStatus, testReferences |
| tt3-nature-form | 自然形态 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[24]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[51] | consumerStatus, textStatus, testReferences |
| tt3-noon-duel | 正午决战 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[4]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[32] | consumerStatus, textStatus, testReferences |
| tt3-nuke-ray | 致命射线 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, curse | game/src/cards/cards.data.js:dataSlice.TABLETOP3[34]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[31] | consumerStatus, textStatus, testReferences |
| tt3-petal | 花瓣法阵 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[35]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[32] | consumerStatus, textStatus, testReferences |
| tt3-purify-arrow | 净化箭 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[8]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[36] | consumerStatus, textStatus, testReferences |
| tt3-python-potion | 火焰药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[25]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[52] | consumerStatus, textStatus, testReferences |
| tt3-qi-wave | 气功波 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[11]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[39] | consumerStatus, textStatus, testReferences |
| tt3-ration-double | 双份口粮 | 资源 | true | valid (pending=0) | supported | base |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[82]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[105] | consumerStatus, textStatus, testReferences |
| tt3-reshot | 重斩 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP3[15]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[43] | consumerStatus, textStatus, testReferences |
| tt3-reverse-bow | 连弩 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[76]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[100] | consumerStatus, textStatus, testReferences |
| tt3-sapper-bomb | 矿工炸药 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[69]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[93] | consumerStatus, textStatus, testReferences |
| tt3-savior-elixir | 斗神酒 | 道具 | true | valid (pending=0) | supported | bag |  / heal | game/src/cards/cards.data.js:dataSlice.TABLETOP3[60]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[84]; game/data/cards-sync.json:cards[21] | consumerStatus, textStatus, testReferences |
| tt3-silver-runesword | 诅咒之剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[61]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[85] | consumerStatus, textStatus, testReferences |
| tt3-skewer | 穿刺 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[30]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[56] | consumerStatus, textStatus, testReferences |
| tt3-staff | 法杖 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[67]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[91] | consumerStatus, textStatus, testReferences |
| tt3-thornfield | 棘刺之地 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / curse | game/src/cards/cards.data.js:dataSlice.TABLETOP3[37]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[61] | consumerStatus, textStatus, testReferences |
| tt3-thunderblast | 雷殛 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[53]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[77] | consumerStatus, textStatus, testReferences |
| tt3-toxin | 毒药 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[17]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[45] | consumerStatus, textStatus, testReferences |
| tt3-treasure-hunt | 寻宝 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP3[22]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[50] | consumerStatus, textStatus, testReferences |
| tt3-turnabout-potion | 剧毒药水 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[39]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[63] | consumerStatus, textStatus, testReferences |
| tt3-twinwater-mail | 冰甲 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[70]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[94] | consumerStatus, textStatus, testReferences |
| tt3-venom-arrow | 毒箭 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, curse | game/src/cards/cards.data.js:dataSlice.TABLETOP3[16]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[44] | consumerStatus, textStatus, testReferences |
| tt3-wave-slash | 破浪斩 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[10]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[38] | consumerStatus, textStatus, testReferences |
| tt3-wolf-bow | 天狼长弓 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[68]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[92] | consumerStatus, textStatus, testReferences |
| tt3-wood-bundle | 一捆木材 | 资源 | true | valid (pending=0) | supported | base |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[81]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[104] | consumerStatus, textStatus, testReferences |
| tt3eq-boiler | 魔法锅炉 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[78]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[102]; game/data/cards-sync.json:cards[54] | consumerStatus, textStatus, testReferences |
| tt3eq-mistbox | 迷之匣 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[79]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[103]; game/data/cards-sync.json:cards[22] | consumerStatus, textStatus, testReferences |
| tt3sp-bloodstorm | 血蝠风暴 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[51]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[75] | consumerStatus, textStatus, testReferences |
| tt3sp-devour | 吞噬 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[45]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[69] | consumerStatus, textStatus, testReferences |
| tt3sp-dodge | 闪避 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / blessing | game/src/cards/cards.data.js:dataSlice.TABLETOP3[44]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[68] | consumerStatus, textStatus, testReferences |
| tt3sp-doom | TNT | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[46]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[70]; game/data/cards-sync.json:cards[23] | consumerStatus, textStatus, testReferences |
| tt3sp-flowerzhen | 花鸩 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[50]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[74] | consumerStatus, textStatus, testReferences |
| tt3sp-magicoil | 药水魔法 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[48]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[72] | consumerStatus, textStatus, testReferences |
| tt3sp-shadowbug | 影噬 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[49]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[73] | consumerStatus, textStatus, testReferences |
| tt3sp-shadowshot | 暗影射击 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[52]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[76] | consumerStatus, textStatus, testReferences |
| tt3sp-silverthorn | 镭射 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[47]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[71] | consumerStatus, textStatus, testReferences |
| tt3wu-shike | 割蚀 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP3[19]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[47] | consumerStatus, textStatus, testReferences |
| tt4-shine-token | 员工通行证C | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP4[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[106] | consumerStatus, textStatus, testReferences |
| tt4-smoke-bomb | 烟雾弹 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP4[1]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[107] | consumerStatus, textStatus, testReferences |
| tt4-woodify | 能量饮料 | 道具 | true | valid (pending=0) | supported | bag |  / heal | game/src/cards/cards.data.js:dataSlice.TABLETOP4[2]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[108] |  |
| tt5-galaxy-voyage | 银河之旅 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP5[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[109]; game/data/cards-sync.json:cards[49] | consumerStatus, textStatus, testReferences |
| tt6-airdrop | 污染空投箱 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[6]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[6]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[114] | consumerStatus, textStatus, testReferences |
| tt6-bandits | 暴雨劫道 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[1]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[1]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[111] | consumerStatus, textStatus, testReferences |
| tt6-chestdraw | 熔断双箱 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[7]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[7]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[115] | consumerStatus, textStatus, testReferences |
| tt6-demondeal | 隧道血契 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[110] | consumerStatus, textStatus, testReferences |
| tt6-goldhammer | 满电动力锤 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[4]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[4]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[33]; game/data/cards-sync.json:cards[52] | consumerStatus, textStatus, testReferences |
| tt6-goldmine | 塌方采掘点 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[3]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[3]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[113] | consumerStatus, textStatus, testReferences |
| tt6-mystery | 实验室余粮 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[2]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[2]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[112]; game/data/cards-sync.json:cards[24] | consumerStatus, textStatus, testReferences |
| tt6-relief | 临时救护站 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[5]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[5] | consumerStatus, textStatus, testReferences |
| tt6-systemsupply | 末班配送无人机 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.EVENTS_0919[8]; game/src/cards/cards.data.js:dataSlice.TABLETOP6[8]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[116]; game/data/cards-sync.json:cards[25] | consumerStatus, textStatus, testReferences |
| tt7-abysscurse | 深渊诅咒 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[33]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[134] | consumerStatus, textStatus, testReferences |
| tt7-arcanebolt | 奥术弹 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[24] | consumerStatus, textStatus, testReferences |
| tt7-arcanescroll | 奥术残卷 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[3] | consumerStatus, textStatus, testReferences |
| tt7-armup | 武装 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[11]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[145] | consumerStatus, textStatus, testReferences |
| tt7-bladebloom | 永恒绽放 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[28]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[129] | consumerStatus, textStatus, testReferences |
| tt7-bloodpoison | 血毒双镖 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[16]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[126] | consumerStatus, textStatus, testReferences |
| tt7-bloodpotion | 噬血术 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP7[22]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[125] | consumerStatus, textStatus, testReferences |
| tt7-bulwark | 坚盾 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / armor | game/src/cards/cards.data.js:dataSlice.TABLETOP7[10]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[143] | consumerStatus, textStatus, testReferences |
| tt7-burnharvest | 爆燃火球 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[31]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[137] | consumerStatus, textStatus, testReferences |
| tt7-darkfort | 黑暗吊坠 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[2] | consumerStatus, textStatus, testReferences |
| tt7-demonbreaker | 破甲重斩 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[13]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[146]; game/data/cards-sync.json:cards[51] | consumerStatus, textStatus, testReferences |
| tt7-elementstorm | 元素风暴 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[30]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[130]; game/data/cards-sync.json:cards[26] | consumerStatus, textStatus, testReferences |
| tt7-energize | 聚能 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / energy | game/src/cards/cards.data.js:dataSlice.TABLETOP7[25]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[133] | consumerStatus, textStatus, testReferences |
| tt7-frozenight | 冰封千里 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / status | game/src/cards/cards.data.js:dataSlice.TABLETOP7[26]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[141] | consumerStatus, textStatus, testReferences |
| tt7-fullstrike | 全力一击 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[14]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[142] | consumerStatus, textStatus, testReferences |
| tt7-ghostblade | 鬼魅之刃 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[3]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[119] | consumerStatus, textStatus, testReferences |
| tt7-goldencicada | 金蝉脱壳 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[1]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[120] | consumerStatus, textStatus, testReferences |
| tt7-holyglow | 沐愈光辉 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / heal | game/src/cards/cards.data.js:dataSlice.TABLETOP7[19]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[131] | consumerStatus, textStatus, testReferences |
| tt7-holyheal | 圣光治愈 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[20]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[132] | consumerStatus, textStatus, testReferences |
| tt7-imitate | 不变应万变-改 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[7] | consumerStatus, textStatus, testReferences |
| tt7-ironcharge | 厉兵秣马 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / armor, draw | game/src/cards/cards.data.js:dataSlice.TABLETOP11[5]; game/data/cards-sync.json:cards[27] | consumerStatus, textStatus, testReferences |
| tt7-ironphalanx | 铁甲阵 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / armor, acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP7[15]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[124] | consumerStatus, textStatus, testReferences |
| tt7-livingwater | 圣光之源 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[0] | consumerStatus, textStatus, testReferences |
| tt7-marchrush | 急行军 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[9]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[148] | consumerStatus, textStatus, testReferences |
| tt7-maxsupply | 法力补给 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[6] | consumerStatus, textStatus, testReferences |
| tt7-meteorrain | 流星箭雨 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP7[5]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[144] | consumerStatus, textStatus, testReferences |
| tt7-meteorstrong | 星陨之力 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[34]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[139]; game/data/cards-sync.json:cards[50] | consumerStatus, textStatus, testReferences |
| tt7-naturestaff | 自然法杖 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[1]; game/data/cards-sync.json:cards[43] | consumerStatus, textStatus, testReferences |
| tt7-provoke | 扰敌 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[21]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[127] | consumerStatus, textStatus, testReferences |
| tt7-recruit | 征召 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[29]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[140] | consumerStatus, textStatus, testReferences |
| tt7-silence | 禁言术 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[17]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[136] | consumerStatus, textStatus, testReferences |
| tt7-smite | 惩击 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP7[23]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[135] | consumerStatus, textStatus, testReferences |
| tt7-sneak | 偷袭 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP7[2]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[122] | consumerStatus, textStatus, testReferences |
| tt7-stealth | 潜匿 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / blessing, draw | game/src/cards/cards.data.js:dataSlice.TABLETOP7[6]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[118] | consumerStatus, textStatus, testReferences |
| tt7-stratagem | 法师锦囊 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[27]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[128] | consumerStatus, textStatus, testReferences |
| tt7-swordimmortal | 剑仙形态 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[7]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[123] | consumerStatus, textStatus, testReferences |
| tt7-talisman | 灵符 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[4]; game/data/cards-sync.json:cards[44] | consumerStatus, textStatus, testReferences |
| tt7-throwblade | 飞刃偷袭 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP7[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[117] | consumerStatus, textStatus, testReferences |
| tt7-thundergrudge | 快意恩仇 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP7[4]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[121] | consumerStatus, textStatus, testReferences |
| tt7-twinfireball | 三重火球 | 法术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage, acquire | game/src/cards/cards.data.js:dataSlice.TABLETOP7[32]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[138] | consumerStatus, textStatus, testReferences |
| tt7-whirlwind | 旋风斩 | 武术 | true | valid (pending=0) | supported | battle, triggers | onPlay / damage | game/src/cards/cards.data.js:dataSlice.TABLETOP7[12]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[147]; game/data/cards-sync.json:cards[45] | consumerStatus, textStatus, testReferences |
| tt8-abyss-sovereign | 深渊主宰·妲莉薇特 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[28] | consumerStatus, textStatus, testReferences |
| tt8-archdemon | 天启诛魔剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[16]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[165] | consumerStatus, textStatus, testReferences |
| tt8-curse1 | 禁咒I | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[11]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[160]; game/data/cards-sync.json:cards[36] | consumerStatus, textStatus, testReferences |
| tt8-curse2 | 禁咒II | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[12]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[161]; game/data/cards-sync.json:cards[37] | consumerStatus, textStatus, testReferences |
| tt8-curse3 | 禁咒III | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[13]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[162]; game/data/cards-sync.json:cards[38] | consumerStatus, textStatus, testReferences |
| tt8-curse4 | 禁咒IV | 法术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[14]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[163]; game/data/cards-sync.json:cards[39] | consumerStatus, textStatus, testReferences |
| tt8-curseimmune | 封印肢体1 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[11]; game/data/cards-sync.json:cards[29] | consumerStatus, textStatus, testReferences |
| tt8-demonslay | 诛魔剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[15]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[164] | consumerStatus, textStatus, testReferences |
| tt8-dragonblade | 青龙偃月斩 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[18]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[167] | consumerStatus, textStatus, testReferences |
| tt8-energycap | 封印肢体2 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[9]; game/data/cards-sync.json:cards[30] | consumerStatus, textStatus, testReferences |
| tt8-healplus | 封印肢体4 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[8]; game/data/cards-sync.json:cards[31] | consumerStatus, textStatus, testReferences |
| tt8-heavensword | 天启剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[17]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[166] | consumerStatus, textStatus, testReferences |
| tt8-hero-assassin | 白梅落影·妄 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[0]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[149]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[34] | consumerStatus, textStatus, testReferences |
| tt8-hero-descender | 充能火山 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[10]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[155]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[40]; game/data/cards-sync.json:cards[32] | consumerStatus, textStatus, testReferences |
| tt8-hero-guardian | 圣剑化身 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[4]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[157]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[42] | consumerStatus, textStatus, testReferences |
| tt8-hero-mage | 博览者的狂语 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[7]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[152]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[37]; game/data/cards-sync.json:cards[33] | consumerStatus, textStatus, testReferences |
| tt8-hero-priest | 浪掷风吟 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[5]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[153]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[38] | consumerStatus, textStatus, testReferences |
| tt8-hero-ranger | 天剑诛魔·云阳 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[2]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[158]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[43] | consumerStatus, textStatus, testReferences |
| tt8-hero-sealer | 受缚之残影 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[9]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[154]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[39]; game/data/cards-sync.json:cards[34] | consumerStatus, textStatus, testReferences |
| tt8-hero-summoner | 花开两面 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[8]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[156]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[41]; game/data/cards-sync.json:cards[40] | consumerStatus, textStatus, testReferences |
| tt8-hero-sword | 无量仙剑·云风 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[1]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[150]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[35] | consumerStatus, textStatus, testReferences |
| tt8-hero-warlock | 禁术解放 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[6]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[151]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[36]; game/data/cards-sync.json:cards[35] | consumerStatus, textStatus, testReferences |
| tt8-hero-warrior | 青龙化身 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP8[3]; game/src/cards/cards.data.js:dataSlice.TABLETOP10[159]; game/src/cards/cards.data.js:dataSlice.TABLETOP11[44] | consumerStatus, textStatus, testReferences |
| tt8-nofocus | 封印肢体3 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/src/cards/cards.data.js:dataSlice.TABLETOP11[10]; game/data/cards-sync.json:cards[41] | consumerStatus, textStatus, testReferences |

## cardsSync

```json
{
  "total": 55,
  "withRules": 0,
  "withoutRules": 55,
  "schema": {
    "valid": 55
  },
  "schemaPending": 0,
  "capability": {
    "legacy": 55
  },
  "domains": {},
  "triggers": {},
  "ops": {}
}
```

分类完整性：{"missing":0,"unknownCards":55,"unknownByField":{"sourceDefinitions":0,"consumerStatus":55,"textStatus":55,"testReferences":55}}

| ID | 名称 | 类型 | rules | schema | capability | 域 | triggers / ops | 定义引用 | 未知分类 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cc-chase-slash | 追斩 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[0] | consumerStatus, textStatus, testReferences |
| cc-cursed-blade | 诅咒之刃 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[1] | consumerStatus, textStatus, testReferences |
| cc-double-boom | 二次爆炸 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[2] | consumerStatus, textStatus, testReferences |
| cc-dual-wield | 二刀流 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[3] | consumerStatus, textStatus, testReferences |
| cc-ember-burst | 余烬爆裂 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[4] | consumerStatus, textStatus, testReferences |
| cc-last-stand | 破釜沉舟 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[5] | consumerStatus, textStatus, testReferences |
| cc-lava-blast | 熔岩爆破 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[6] | consumerStatus, textStatus, testReferences |
| cc-mana-surge | 法力奔涌 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[7] | consumerStatus, textStatus, testReferences |
| cc-poison-burst | 毒爆 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[8] | consumerStatus, textStatus, testReferences |
| cc-rapid-fire | 连续射击 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[9] | consumerStatus, textStatus, testReferences |
| cc-rot-seed | 腐化之种 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[10] | consumerStatus, textStatus, testReferences |
| cmtn1wnhhym | 江湖救急-改 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[46] | consumerStatus, textStatus, testReferences |
| cmtn6ulm4boj | 步兵 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[11] | consumerStatus, textStatus, testReferences |
| cmtn79743r2n | 末日浩劫之门 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[12] | consumerStatus, textStatus, testReferences |
| cmtn7err0a7 | 天国之门 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[13] | consumerStatus, textStatus, testReferences |
| pet-egg | 宠物蛋 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[14] | consumerStatus, textStatus, testReferences |
| tt-crystal | 能源结晶 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[15] | consumerStatus, textStatus, testReferences |
| tt-key | 一把钥匙 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[16] | consumerStatus, textStatus, testReferences |
| tt-key-one | 三把钥匙 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[17] | consumerStatus, textStatus, testReferences |
| tt-keys-bunch | 两把钥匙 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[18] | consumerStatus, textStatus, testReferences |
| tt-token-gold | 员工通行证B | 道具 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[53] | consumerStatus, textStatus, testReferences |
| tt3-fireball | 火球 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[42] | consumerStatus, textStatus, testReferences |
| tt3-garnet-marble | 石榴弹珠 | 资源 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[19] | consumerStatus, textStatus, testReferences |
| tt3-holy-shield | 圣盾 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[47] | consumerStatus, textStatus, testReferences |
| tt3-holy-water | 治愈 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[20] | consumerStatus, textStatus, testReferences |
| tt3-immortal-blade | 骷髅王剑 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[48] | consumerStatus, textStatus, testReferences |
| tt3-savior-elixir | 斗神酒 | 道具 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[21] | consumerStatus, textStatus, testReferences |
| tt3eq-boiler | 魔法锅炉 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[54] | consumerStatus, textStatus, testReferences |
| tt3eq-mistbox | 迷之匣 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[22] | consumerStatus, textStatus, testReferences |
| tt3sp-doom | TNT | 道具 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[23] | consumerStatus, textStatus, testReferences |
| tt5-galaxy-voyage | 银河之旅 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[49] | consumerStatus, textStatus, testReferences |
| tt6-goldhammer | 满电动力锤 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[52] | consumerStatus, textStatus, testReferences |
| tt6-mystery | 神秘补给 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[24] | consumerStatus, textStatus, testReferences |
| tt6-systemsupply | 系统补给 | 事件 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[25] | consumerStatus, textStatus, testReferences |
| tt7-demonbreaker | 破甲重斩 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[51] | consumerStatus, textStatus, testReferences |
| tt7-elementstorm | 元素风暴 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[26] | consumerStatus, textStatus, testReferences |
| tt7-ironcharge | 厉兵秣马 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[27] | consumerStatus, textStatus, testReferences |
| tt7-meteorstrong | 星陨之力 | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[50] | consumerStatus, textStatus, testReferences |
| tt7-naturestaff | 自然法杖 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[43] | consumerStatus, textStatus, testReferences |
| tt7-talisman | 灵符 | 装备 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[44] | consumerStatus, textStatus, testReferences |
| tt7-whirlwind | 旋风斩 | 武术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[45] | consumerStatus, textStatus, testReferences |
| tt8-abyss-sovereign | 深渊主宰·妲莉薇特 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[28] | consumerStatus, textStatus, testReferences |
| tt8-curse1 | 禁咒I | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[36] | consumerStatus, textStatus, testReferences |
| tt8-curse2 | 禁咒II | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[37] | consumerStatus, textStatus, testReferences |
| tt8-curse3 | 禁咒III | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[38] | consumerStatus, textStatus, testReferences |
| tt8-curse4 | 禁咒IV | 法术 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[39] | consumerStatus, textStatus, testReferences |
| tt8-curseimmune | 封印肢体1 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[29] | consumerStatus, textStatus, testReferences |
| tt8-energycap | 封印肢体2 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[30] | consumerStatus, textStatus, testReferences |
| tt8-healplus | 封印肢体4 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[31] | consumerStatus, textStatus, testReferences |
| tt8-hero-descender | 充能火山 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[32] | consumerStatus, textStatus, testReferences |
| tt8-hero-mage | 博览者的狂语 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[33] | consumerStatus, textStatus, testReferences |
| tt8-hero-sealer | 受缚之残影 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[34] | consumerStatus, textStatus, testReferences |
| tt8-hero-summoner | 花开两面 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[40] | consumerStatus, textStatus, testReferences |
| tt8-hero-warlock | 禁术解放 | 能力卡 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[35] | consumerStatus, textStatus, testReferences |
| tt8-nofocus | 封印肢体3 | 生物 | false | valid (pending=0) | legacy |  |  /  | game/data/cards-sync.json:cards[41] | consumerStatus, textStatus, testReferences |

