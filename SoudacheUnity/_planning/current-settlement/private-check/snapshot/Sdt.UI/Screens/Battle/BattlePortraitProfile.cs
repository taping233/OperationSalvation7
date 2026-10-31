using UnityEngine;
namespace Sdt.UI.Screens.Battle
{
    // Generated from the current enemy-portrait-presentation.js display table.
    internal readonly struct BattlePortraitProfile
    {
        public readonly float Height, Aspect, ImageScale, Bottom, X;
        public BattlePortraitProfile(float height, float aspect, float imageScale, float bottom, float x)
        { Height = height; Aspect = aspect; ImageScale = imageScale; Bottom = bottom; X = x; }
        public static BattlePortraitProfile Find(string id, bool boss)
        {
            switch (id)
            {
                case "boss_witness_pope": return new BattlePortraitProfile(350f, 0.998457f, 1.060185f, -0.027778f, -51.118421f);
                case "boss_mutation_mother": return new BattlePortraitProfile(392f, 1.49901f, 1.00396f, -0.00198f, -50.065789f);
                case "boss_mysterious_blocker": return new BattlePortraitProfile(350f, 0.880435f, 1.032609f, -0.013587f, -50.647482f);
                case "boss_necromancer": return new BattlePortraitProfile(350f, 1.210438f, 1.023569f, -0.020202f, -51.776316f);
                case "infantry": return new BattlePortraitProfile(286f, 0.490541f, 1.027027f, -0.010811f, -49.424184f);
                case "archer": return new BattlePortraitProfile(278f, 0.576294f, 1.035422f, -0.012262f, -47.403846f);
                case "bandit": return new BattlePortraitProfile(264f, 0.499272f, 1.106259f, -0.029112f, -51.442308f);
                case "cavalry": return new BattlePortraitProfile(300f, 0.523874f, 1.036835f, -0.010914f, -53.269231f);
                case "orc_jav": return new BattlePortraitProfile(286f, 0.511318f, 1.011984f, -0.005326f, -46.346154f);
                case "wolf_rider": return new BattlePortraitProfile(230f, 0.802795f, 1.180124f, -0.091615f, -50.096154f);
                case "orc_axe": return new BattlePortraitProfile(292f, 0.666667f, 1.034014f, -0.021769f, -50.192308f);
                case "fire_el": return new BattlePortraitProfile(284f, 0.632373f, 1.042524f, -0.026063f, -53.173077f);
                case "water_el": return new BattlePortraitProfile(290f, 0.526531f, 1.034014f, -0.019048f, -57.403846f);
                case "grass_el": return new BattlePortraitProfile(310f, 0.68777f, 1.093525f, -0.02446f, -51.153846f);
                case "esper_crow": return new BattlePortraitProfile(286f, 0.511855f, 1.059972f, -0.025105f, -49.424184f);
                case "esper_candle": return new BattlePortraitProfile(286f, 0.604278f, 1.016043f, -0.010695f, -55.47025f);
                case "esper_silence": return new BattlePortraitProfile(290f, 0.64682f, 1.028417f, -0.014885f, -51.247601f);
                case "esper_echo": return new BattlePortraitProfile(286f, 0.58871f, 1.021505f, -0.010753f, -51.730769f);
                case "dragon": return new BattlePortraitProfile(384f, 0.727401f, 1.073446f, -0.049435f, -50.288462f);
                case "boss_general": return new BattlePortraitProfile(340f, 0.337317f, 1.009296f, -0.002656f, -52.884615f);
                case "boss_orc": return new BattlePortraitProfile(414f, 0.671937f, 1.001318f, -0.001318f, -50.769231f);
                case "boss_elem": return new BattlePortraitProfile(392f, 0.705056f, 1.067416f, -0.026685f, -50.0f);
                case "rager": return new BattlePortraitProfile(282f, 0.30593f, 1.024259f, -0.012129f, -48.422091f);
                case "deserter": return new BattlePortraitProfile(272f, 0.305707f, 1.032609f, -0.021739f, -52.761341f);
                case "greedy_imp": return new BattlePortraitProfile(150f, 0.905861f, 1.349911f, -0.143872f, -50.192308f);
                case "swaggerer": return new BattlePortraitProfile(276f, 0.427596f, 1.038251f, -0.030055f, -55.522682f);
                case "tin_mute": return new BattlePortraitProfile(292f, 0.641304f, 1.032609f, -0.014946f, -48.653846f);
                case "heavy_hammer": return new BattlePortraitProfile(306f, 0.467026f, 1.02288f, -0.016151f, -45.66075f);
                case "cultist": return new BattlePortraitProfile(282f, 0.282432f, 1.027027f, -0.008108f, -53.557692f);
                case "fake_apothecary": return new BattlePortraitProfile(278f, 0.372155f, 1.017403f, -0.009371f, -51.153846f);
                case "camo_sniper": return new BattlePortraitProfile(286f, 0.360811f, 1.027027f, -0.017568f, -49.802761f);
                default: return new BattlePortraitProfile(boss ? 318 : 236, .65f, 1, 0, -50);
            }
        }
    }
}
