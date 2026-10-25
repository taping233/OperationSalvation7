// Battle-only display sizes in logical pixels; alpha bounds exclude transparent margins.
// Artwork revisions match the actual baked battle files. No runtime image scanning.
// Source and geometry: docs/evidence/2026-10-25-enemy-battle-fit/receipt.json
const ENEMY_PORTRAITS = Object.freeze({
  infantry: { height: 286, aspect: 0.490541, imageScale: 1.027027, bottom: -0.010811, x: -49.424184, revision: '5ffcce039377' },
  archer: { height: 278, aspect: 0.576294, imageScale: 1.035422, bottom: -0.012262, x: -47.403846, revision: '409b05730660' },
  bandit: { height: 264, aspect: 0.499272, imageScale: 1.106259, bottom: -0.029112, x: -51.442308, revision: '9e880cbc4fee' },
  cavalry: { height: 300, aspect: 0.523874, imageScale: 1.036835, bottom: -0.010914, x: -53.269231, revision: 'e44c08e38d5d' },
  orc_jav: { height: 286, aspect: 0.511318, imageScale: 1.011984, bottom: -0.005326, x: -46.346154, revision: 'be6246884342' },
  wolf_rider: { height: 230, aspect: 0.802795, imageScale: 1.180124, bottom: -0.091615, x: -50.096154, revision: 'a46960674caa' },
  orc_axe: { height: 292, aspect: 0.666667, imageScale: 1.034014, bottom: -0.021769, x: -50.192308, revision: 'ae7f12441379' },
  fire_el: { height: 284, aspect: 0.632373, imageScale: 1.042524, bottom: -0.026063, x: -53.173077, revision: '9d2fb91d2b32' },
  water_el: { height: 290, aspect: 0.526531, imageScale: 1.034014, bottom: -0.019048, x: -57.403846, revision: '9bf01d189617' },
  grass_el: { height: 310, aspect: 0.68777, imageScale: 1.093525, bottom: -0.02446, x: -51.153846, revision: '239df57f9c58' },
  esper_crow: { height: 286, aspect: 0.511855, imageScale: 1.059972, bottom: -0.025105, x: -49.424184, revision: 'bdabc5451187' },
  esper_candle: { height: 286, aspect: 0.604278, imageScale: 1.016043, bottom: -0.010695, x: -55.47025, revision: '3b1a3915edfd' },
  esper_silence: { height: 290, aspect: 0.64682, imageScale: 1.028417, bottom: -0.014885, x: -51.247601, revision: '42d37fc523b6' },
  esper_echo: { height: 286, aspect: 0.58871, imageScale: 1.021505, bottom: -0.010753, x: -51.730769, revision: '4d31c46a5204' },
  dragon: { height: 384, aspect: 0.727401, imageScale: 1.073446, bottom: -0.049435, x: -50.288462, revision: 'cdfeaec260d7' },
  boss_general: { height: 340, aspect: 0.337317, imageScale: 1.009296, bottom: -0.002656, x: -52.884615, revision: 'd6b2e812a75b' },
  boss_orc: { height: 414, aspect: 0.671937, imageScale: 1.001318, bottom: -0.001318, x: -50.769231, revision: '237d10d83ef6' },
  boss_elem: { height: 392, aspect: 0.705056, imageScale: 1.067416, bottom: -0.026685, x: -50.0, revision: '8f5232539da9' },
  rager: { height: 282, aspect: 0.30593, imageScale: 1.024259, bottom: -0.012129, x: -48.422091, revision: 'ae35bbec4671' },
  deserter: { height: 272, aspect: 0.305707, imageScale: 1.032609, bottom: -0.021739, x: -52.761341, revision: '1d929f09a7f8' },
  greedy_imp: { height: 150, aspect: 0.905861, imageScale: 1.349911, bottom: -0.143872, x: -50.192308, revision: 'cbd3a6740d2a' },
  swaggerer: { height: 276, aspect: 0.427596, imageScale: 1.038251, bottom: -0.030055, x: -55.522682, revision: 'e8bad8479cbf' },
  tin_mute: { height: 292, aspect: 0.641304, imageScale: 1.032609, bottom: -0.014946, x: -48.653846, revision: '2423c858a28d' },
  heavy_hammer: { height: 306, aspect: 0.467026, imageScale: 1.02288, bottom: -0.016151, x: -45.66075, revision: '90e3859111c3' },
  cultist: { height: 282, aspect: 0.282432, imageScale: 1.027027, bottom: -0.008108, x: -53.557692, revision: 'b06d6a94c65c' },
  fake_apothecary: { height: 278, aspect: 0.372155, imageScale: 1.017403, bottom: -0.009371, x: -51.153846, revision: 'e8f2e9f8fde1' },
  camo_sniper: { height: 286, aspect: 0.360811, imageScale: 1.027027, bottom: -0.017568, x: -49.802761, revision: '3ddce2f923b1' },
});

export function enemyPortraitProfile(id) {
  return ENEMY_PORTRAITS[id] || null;
}
