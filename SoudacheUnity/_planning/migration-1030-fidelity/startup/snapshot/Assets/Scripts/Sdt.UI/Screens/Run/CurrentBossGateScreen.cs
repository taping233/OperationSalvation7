// game.run.altar.js openBossGate: prepare inventory, return, then the independently owned boss film.
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using UnityEngine;
namespace Sdt.UI.Screens.Run
{
    public sealed class CurrentBossGateScreen : NodeShellPanel
    {
        int? _seed; string _node; bool _entering; string _error;
        bool Current=>this!=null&&GameRuntime.I.State.runActive&&GameRuntime.I.State.seed==_seed&&GameRuntime.I.CurrentNodeId==_node&&UiStack.Top==this;
        public override bool CanCloseWithEscape=>!_entering;
        public static void Open()
        {
            var screen=ScreenMount.Show<CurrentBossGateScreen>("BossGate");screen._seed=GameRuntime.I.State.seed;screen._node=GameRuntime.I.CurrentNodeId;
            screen.Tone="battle";screen.AssetKey="scene-battle-bg";screen.TitleIcon="[[icon:skull]]";screen.Title="首脑迎战";screen.Build();
        }
        protected override void OnPrepare()
        {
            Sub=$"首脑战使用独立牌库：开战前整理并选择 {GameRules.BossDeckSize} 张招式、装备或能力卡，不足时全部编入；另加入 {GameRules.StarterSha} 张初始攻击。背包其余卡牌不会消失。";
        }
        protected override void OnBody()
        {
            CurrentEncounterOpening.Create(BodyRoot,"boss");
            if(!string.IsNullOrEmpty(_error))CurrentNodeElements.Text(BodyRoot,"boss-gate-error",_error,18,"#e4b79d");
            var fight=EventOptButton.Create(BodyRoot,"继续迎战",$"起手抽 {GameRules.BattleStartDraw} 张，每回合抽 {GameRules.BattleTurnDraw} 张，手牌上限 {GameRules.BattleHandMax} 张。请先检查随身卡牌。","ok",Begin);
            fight.name="bossGateFight";fight.interactable=!_entering;
            CurrentNodeElements.Text(BodyRoot,"boss-gate-notice","先看敌方意图，高伤回合先用护盾、护甲或格挡减伤；对方有防护或元素庇幕时，如有破甲牌，可施加破甲再集中攻击。",18,"#b9c9d2");
            var bag=CurrentNodeElements.Button(FootRoot,"整理背包",()=>{if(Current&&!_entering)GameRuntime.I.Bus.Emit(new BagOpened());});bag.name="bossGateBag";
            var back=CurrentNodeElements.Button(FootRoot,"返回地图",Return);back.name="bossGateBack";
        }
        void Begin()
        {
            if(!Current||_entering)return;_entering=true;
            var runtime=GameRuntime.I;int? seed=_seed;string node=_node;
            CurrentRunFilm.Play("boss",()=>
            {
                if(!runtime.TryBeginBossGate(out _error) || runtime.State.runActive && !runtime.State.battleActive && !runtime.CurrentNodeReceipt.battleWon)
                {_error=_error??runtime.Saves.LastError??"未能进入战斗，请重试。";_entering=false;Rebuild();return;}
                Close();
            },()=>runtime.State.runActive&&runtime.State.seed==seed&&runtime.CurrentNodeId==node&&!runtime.State.closed.Contains(node));
        }
        void Return()
        {
            if(!Current||_entering)return;
            if(!GameRuntime.I.TryLeaveBossGate(out _error)){Rebuild();return;}Close();
        }
        public override void CloseFromEscape()=>Return();
    }
}
