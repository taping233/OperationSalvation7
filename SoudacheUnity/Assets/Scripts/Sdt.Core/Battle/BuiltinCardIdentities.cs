// Source identity seed plus explicitly authored native card definitions.
using System.Collections.Generic;
namespace Sdt.Core.Battle {
 public static class BuiltinCardIdentities {
  static readonly HashSet<string> Ids=new HashSet<string>{
   "starter-emergency-bandage", "starter-attack", "tt-crystal", "tt-token-gold", "tt-jinchuangyao", "tt2-apollo",
   "tt2-pearlbox", "tt2-wreck", "tt2-treasuremap", "tt2-venomstaff", "tt2-frostsword", "tt2-jianghu",
   "tt2-swiftarrow", "tt2-block", "tt2-comboarrow", "tt2-piercearrow", "tt2-shoot", "tt2-turtlearmor",
   "tt2-bloodblade", "tt2-forestarrow", "tt3-blood-arrow", "tt3-fatal-pierce", "tt3-fly-arrowhawk", "tt3-frost-slash",
   "tt3-noon-duel", "tt3-armor-rush", "tt3-double-shot", "tt3-bandage", "tt3-purify-arrow", "tt3-arrow-rain",
   "tt3-wave-slash", "tt3-qi-wave", "tt3-hold-fast", "tt3-life-arrow", "tt3-dig-treasure", "tt3-reshot",
   "tt3-venom-arrow", "tt3-toxin", "tt3-frostfall", "tt3wu-shike", "tt3-mystery-potion", "tt3-blue-potion",
   "tt3-treasure-hunt", "tt3-flame-storm", "tt3-nature-form", "tt3-python-potion", "tt3-chain-lightning", "tt3-houyi-potion",
   "tt3-fireball", "tt3-holy-water", "tt3-skewer", "tt3-holy-shield", "tt3-iceheart-potion", "tt3-demon-potion",
   "tt3-nuke-ray", "tt3-petal", "tt3-magic-lamp", "tt3-thornfield", "tt3-mind-potion", "tt3-turnabout-potion",
   "tt3-firm-barrier", "tt3-ice-spike", "tt3-grope", "tt3-mixed-potion", "tt3sp-dodge", "tt3sp-devour",
   "tt3sp-doom", "tt3sp-silverthorn", "tt3sp-magicoil", "tt3sp-shadowbug", "tt3sp-flowerzhen", "tt3sp-bloodstorm",
   "tt3sp-shadowshot", "tt3-thunderblast", "tt3-flux-slash", "tt3-immortal-blade", "tt3-master-staff", "tt3-chaos-eye",
   "tt3-execute", "tt3-savior-elixir", "tt3-silver-runesword", "tt3-azure-sword", "tt3-fate-wheel", "tt3-crimson-pouch",
   "tt3-holy-staff", "tt3-staff", "tt3-wolf-bow", "tt3-sapper-bomb", "tt3-twinwater-mail", "tt3-grass-armor",
   "tt3-blooddrinker", "tt3-longsword", "tt3-element-seal", "tt3-light-mail", "tt3-reverse-bow", "tt3-deep-diary",
   "tt3eq-mistbox", "tt4-shine-token", "tt4-smoke-bomb", "tt4-woodify", "tt5-galaxy-voyage", "tt7-throwblade",
   "tt7-goldencicada", "tt7-sneak", "tt7-ghostblade", "tt7-thundergrudge", "tt7-meteorrain", "tt7-stealth",
   "tt7-swordimmortal", "cc-unmoved", "tt7-marchrush", "tt7-bulwark", "tt7-armup", "tt7-whirlwind",
   "tt7-demonbreaker", "tt7-fullstrike", "tt7-ironphalanx", "tt7-bloodpoison", "tt7-silence", "cc-demon",
   "tt7-holyglow", "tt7-holyheal", "tt7-provoke", "tt7-bloodpotion", "tt7-smite", "tt7-arcanebolt",
   "tt7-energize", "tt7-frozenight", "tt7-stratagem", "tt7-bladebloom", "tt7-recruit", "tt7-elementstorm",
   "tt7-burnharvest", "tt7-twinfireball", "tt7-abysscurse", "tt7-meteorstrong", "tt8-hero-assassin", "tt8-hero-sword",
   "tt8-hero-ranger", "tt8-hero-warrior", "tt8-hero-guardian", "tt8-hero-priest", "tt8-hero-warlock", "tt8-hero-mage",
   "tt8-hero-summoner", "tt8-hero-sealer", "tt8-hero-descender", "tt8-curse1", "tt8-curse2", "tt8-curse3",
   "tt8-curse4", "tt8-demonslay", "tt8-archdemon", "tt8-heavensword", "tt8-dragonblade", "cmtn0pbkmnvc",
   "cmtn1epgt20j", "cmtn233trmeg", "cmtn2jc142dj", "cmtna0nb1yxt", "tt7-livingwater", "tt7-naturestaff",
   "tt7-darkfort", "tt7-arcanescroll", "tt7-talisman", "tt7-ironcharge", "tt7-maxsupply", "tt7-imitate",
   "cmtmvq6ss84l", "cmtn0xt0zr7", "cmtn125e1nk0", "cmtn1gfhczzj", "cmtn1i64j7y7", "cmtn1lbhbqi4",
   "cmtn1ntxzoc4", "cmtn1p9vb5au", "cmtn1r10xnl1", "cmtn1wnhhym", "cmtn28jv33wx", "cmtn6bge52qt",
   "cc-chase-slash", "cc-cursed-blade", "cc-double-boom", "cc-dual-wield", "cc-ember-burst", "cc-last-stand",
   "cc-lava-blast", "cc-mana-surge", "cc-poison-burst", "cc-rapid-fire", "cc-rot-seed", "tt8-abyss-sovereign",
   "tt12-raydragon", "tt12-sporewall", "tt12-elemburst", "tt12-hitechrd", "tt12-barriermend", "tt12-saturate",
   "tt12-felguard", "tt12-unstableray", "tt12-infectray", "tt12-basicdev", "tt12-firecracker", "tt12-magicfind",
   "tt12-chargeray", "tt12-breakthrough", "tt12-raygun", "tt12-backupcell", "tt12-freezeray", "tt13-poor-meal",
   "tt13-spring", "tt13-magazine", "tt13-snipe", "tt13-guard", "tt13-bitter-rain", "tt13-mind-control",
   "tt13-flame-staff", "tt13-scale-armor", "tt13-astrolabe", "tt13-soul-contract", "tt13-stellar-divination", "tt13-chaos-deck",
   "tt13-mercy", "wuyu-devouring-flame", "neutral-temporary-circle",
   "wu-listen-wind", "wu-invisible-kill", "wu-unspent-sword-intent", "wu-yellow-sand-cloak",
  };
  public static bool IsExecutable(CardDef card)=>card!=null&&card.id!=null&&Ids.Contains(card.id);
  public static bool OwnsExecution(CardDef card)=>IsExecutable(card)&&card.rules!=null&&(card.rules.Get("battle")?.Items("hosted").Length??0)==0;
 }
}
