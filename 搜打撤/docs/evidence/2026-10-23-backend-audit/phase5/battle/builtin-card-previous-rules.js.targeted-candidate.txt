import { hostedRuleSnapshot, targetedHostedRuleSnapshot } from './hosted-rule-snapshot.js';
// Former native declarations used only to recognize unedited historical rules.
export const BUILTIN_PREVIOUS_RULES = {
  "tt2-frostsword": {
    "version": 1,
    "battle": {
      "hosted": [
        "frost-sword"
      ]
    },
    "equip": {
      "passive": {
        "cond": {
          "vsFreeze": 2
        }
      }
    }
  },
  "tt3-qi-wave": hostedRuleSnapshot("draw-and-price-damage"),
  "tt3-chaos-eye": hostedRuleSnapshot("chaos-eye"),
  "tt3-silver-runesword": hostedRuleSnapshot("silver-runesword"),
  "tt7-marchrush": hostedRuleSnapshot("last-hand-repeat-all"),
  "tt7-provoke": hostedRuleSnapshot("foe-fight-select"),
  "tt7-arcanebolt": hostedRuleSnapshot("damage-and-draw"),
  "tt8-hero-assassin": hostedRuleSnapshot("assassin"),
  "tt8-hero-mage": hostedRuleSnapshot("mage"),
  "tt8-hero-descender": hostedRuleSnapshot("consume-fireball"),
  "tt3-fatal-pierce": hostedRuleSnapshot("bleed-gated-armor-break"),
  "tt3-frostfall": hostedRuleSnapshot("choose-and-cast-melee"),
  "tt3-mystery-potion": hostedRuleSnapshot("mystery-potion"),
  "tt3-magic-lamp": hostedRuleSnapshot("three-choice-lamp"),
  "tt3sp-silverthorn": hostedRuleSnapshot("infused-damage-bonus"),
  "tt3sp-flowerzhen": hostedRuleSnapshot("double-and-burst-poison"),
  "tt3sp-bloodstorm": hostedRuleSnapshot("infused-repeating-lifesteal"),
  "tt7-ghostblade": hostedRuleSnapshot("stealth-break-bonus"),
  "tt7-bloodpoison": hostedRuleSnapshot("double-target-poison-daggers"),
  "tt7-holyheal": hostedRuleSnapshot("infused-price-heal"),
  "tt7-stratagem": hostedRuleSnapshot("pouch-container"),
  "tt7-meteorstrong": hostedRuleSnapshot("infused-fireball-burst"),
  "tt8-hero-sword": hostedRuleSnapshot("sword"),
  "tt8-hero-ranger": hostedRuleSnapshot("ranger"),
  "tt8-hero-warrior": hostedRuleSnapshot("kill-transform"),
  "tt8-hero-guardian": hostedRuleSnapshot("guardian"),
  "tt8-hero-priest": hostedRuleSnapshot("priest"),
  "tt8-hero-warlock": hostedRuleSnapshot("warlock"),
  "tt8-hero-summoner": hostedRuleSnapshot("gate-choices"),
  "tt8-hero-sealer": {
    "version": 1,
    "battle": {
      "hosted": [
        "seal-chain"
      ],
      "requirements": [
        {
          "kind": "unplayable"
        }
      ]
    }
  },
  "cmtn233trmeg": hostedRuleSnapshot("keep-self-in-hand"),
  "tt7-imitate": hostedRuleSnapshot("imitate"),
  "cmtn1lbhbqi4": hostedRuleSnapshot("charge-fireball"),
  "cmtn1ntxzoc4": {
    "version": 1,
    "battle": {
      "target": {
        "side": "self",
        "area": false
      },
      "hosted": [
        "batch13-flame-form"
      ]
    },
    "triggers": {
      "onPlay": [
        {
          "op": "blessing",
          "key": "spellUp"
        }
      ]
    }
  },
  "cmtn1wnhhym": hostedRuleSnapshot("temporary-hand-cards"),
  "cc-mana-surge": hostedRuleSnapshot("mana-surge"),
  "cc-poison-burst": hostedRuleSnapshot("burst-existing-poison"),
  "cc-rot-seed": {
    "version": 1,
    "battle": {
      "hosted": [
        "rot-seed"
      ],
      "target": {
        "side": "enemy",
        "area": false
      }
    }
  },
  "tt8-abyss-sovereign": hostedRuleSnapshot("sovereign"),
  "tt12-raydragon": hostedRuleSnapshot("infused-ray"),
  "tt12-felguard": hostedRuleSnapshot("infused-immune-spell"),
  "tt12-freezeray": hostedRuleSnapshot("untouched-target-freeze"),
  "tt13-spring": targetedHostedRuleSnapshot("batch13-spring", "self"),
  "tt13-snipe": targetedHostedRuleSnapshot("batch13-snipe", "enemy"),
  "tt13-guard": targetedHostedRuleSnapshot("batch13-guard", "self"),
  "tt13-bitter-rain": targetedHostedRuleSnapshot("batch13-bitter-rain", "enemy"),
  "tt13-mind-control": targetedHostedRuleSnapshot("batch13-mind-control", "enemy"),
  "tt13-soul-contract": targetedHostedRuleSnapshot("batch13-soul-contract", "enemy"),
  "tt13-stellar-divination": targetedHostedRuleSnapshot("batch13-stellar-divination", "self"),
  "tt13-chaos-deck": targetedHostedRuleSnapshot("batch13-chaos-deck", "self"),
  "tt13-mercy": targetedHostedRuleSnapshot("batch13-mercy", "enemy")
};
