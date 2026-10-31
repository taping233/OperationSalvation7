// Generated from the current rule-config.js; top-level aliases preserve existing callers.
namespace Sdt.Core { public static class GameRules {
 public static class Map {
  public const int DiceSides = 6;
  public const int StepMs = 340;
  public const int EmergencyExitCost = 10;
  public const int FireHeal = 8;
  public const double FireClassCardChance = 0.3;
 }
 public static class Battle {
  public const int Energy = 2;
  public const int StartDraw = 5;
  public const int TurnDraw = 1;
  public const int HandMax = 8;
  public const int BossDeckSize = 15;
  public const int StarterAttack = 5;
  public const int NormalStarterDeckSize = 5;
 }
 public static class Backpack {
  public const int Start = 16;
  public const int Max = 30;
  public const int UpgradeWood = 2;
  public const int SafeStart = 2;
  public const int SafeMax = 6;
  public const int SafeUpgradeRations = 2;
 }
 public static class Base {
  public const int StashStart = 25;
  public const int StashMax = 100;
  public const int StashUpgradeWood = 2;
  public const int StashUpgradeSlots = 3;
  public const int StashRuneSlotCost = 2;
  public const int StashRuneSlotFrom = 50;
 }
 public static class Growth {
  public const int PlayerMaxHp = 30;
  public const int PlayerAtk = 4;
 }
 public static class Extraction {
  public const double PocketKeepChance = 0.3333333333333333;
 }
 public static class Rewards {
  public const double BeastLegendaryChance = 0.3;
  public const double PetEggBaseChance = 0.007;
 }
        // 顶层别名保留给 v0.51 现有模块与 window.SDT 调试脚本；新代码优先使用分组字段。
        public const int DiceSides = Map.DiceSides;
        public const int StepMs = Map.StepMs;
        public const int EmergencyExitCost = Map.EmergencyExitCost;
        public const int FireHeal = Map.FireHeal;
        public const double FireClassCardChance = Map.FireClassCardChance;
        public const int PlayerMaxHp = Growth.PlayerMaxHp;
        public const int PlayerAtk = Growth.PlayerAtk;
        public const int BagSize = Backpack.Start;
        public const int BagMax = Backpack.Max;
        public const int BagUpgradeWood = Backpack.UpgradeWood;
        public const int SafeStart = Backpack.SafeStart;
        public const int SafeMax = Backpack.SafeMax;
        public const int SafeUpgradeRations = Backpack.SafeUpgradeRations;
        public const int StashStart = Base.StashStart;
        public const int StashMax = Base.StashMax;
        public const int StashUpgradeWood = Base.StashUpgradeWood;
        public const int StashUpgradeSlots = Base.StashUpgradeSlots;
        public const int BattleEnergy = Battle.Energy;
        public const int BattleStartDraw = Battle.StartDraw;
        public const int BattleTurnDraw = Battle.TurnDraw;
        public const int BattleHandMax = Battle.HandMax;
        public const int BossDeckSize = Battle.BossDeckSize;
        public const int StarterSha = Battle.StarterAttack;
    }
}
