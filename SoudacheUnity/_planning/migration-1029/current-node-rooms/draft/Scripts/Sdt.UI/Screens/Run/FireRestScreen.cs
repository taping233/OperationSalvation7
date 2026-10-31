// Current fire-rest-view.js and openFireRest; commands own settled effects.
using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;
using Sdt.Core;
using Sdt.Run;
namespace Sdt.UI.Screens.Run
{
    public sealed class FireRestScreen:NodeShellPanel
    {
        Action _done;bool _busy,_explain;string _error,_node;int? _seed;
        bool Current=>GameRuntime.I.State.runActive&&GameRuntime.I.CurrentNodeId==_node&&GameRuntime.I.State.seed==_seed&&UiStack.Top==this;
        public static void Open()=>OpenPocketRestore(2,null);
        public static void OpenPocketRestore(int picks,Action done)
        {
            var page=ScreenMount.Show<FireRestScreen>("FireRest");page._done=done;page._node=GameRuntime.I.CurrentNodeId;page._seed=GameRuntime.I.State.seed;
            page.Tone="fire";page.AssetKey="scene-fire-bg";page.Title="营火休整";page.Build();
        }
        protected override void OnPrepare(){Sub="";}
        protected override void OnBody()
        {
            var runtime=GameRuntime.I;var state=runtime.State;var receipt=runtime.CurrentNodeReceipt;
            int gain=Math.Max(0,Math.Min(GameRules.FireHeal,state.maxHp-state.hp));
            var heal=EventOptButton.Create(BodyRoot,"回复生命",receipt.healUsed?"已回复 "+receipt.healAmount+" 点":state.hp>=state.maxHp?"生命已满":state.hp+" → "+(state.hp+gain)+" · 实际回复 "+gain,"",()=>Perform("heal"));
            heal.interactable=!_busy&&!receipt.healUsed&&state.hp<state.maxHp;
            var pool=state.usedPocket.Where(p=>p.count>0&&p.card.type!="装备"&&p.card.type!="道具").ToArray();
            int count=pool.Sum(p=>p.count);bool fits=pool.Any(p=>runtime.CanReceiveCard(p.card));
            string restoreCopy=receipt.restoreUsed?"已复原 "+receipt.restoredIds.Count+" 张":count==0?"暂无可复原卡牌":!fits?"背包空间不足":"随机复原至多 2 张";
            var restore=EventOptButton.Create(BodyRoot,"复原卡牌",restoreCopy,"",()=>Perform("restore"));restore.interactable=!_busy&&!receipt.restoreUsed&&count>0&&fits;
            var explanation=CurrentNodeElements.Button(BodyRoot,(_explain?"▾ ":"▸ ")+"休整说明",()=>{if(!_busy){_explain=!_explain;Rebuild();}});
            if(_explain)CurrentNodeElements.Text(BodyRoot,"fire-explanation","回血、复原各可使用一次；停留当前地点时可关闭面板或整理后继续。成功前往下一地点后，剩余机会作废。\n首次成功操作有 "+Math.Round(GameRules.FireClassCardChance*100)+"% 概率获得职业卡；每处火堆仅判定一次。\n复原从消耗区随机取至多 2 张可接收卡牌，不复原道具与装备。无法复原时不消耗机会。",18,"#c9d2d7");
            var cards=receipt.restoredIds.Select(CardLibrary.FindById).Where(c=>c!=null).ToList();
            if(receipt.bonusReceived){var bonus=CardLibrary.FindById(receipt.classCardId);if(bonus!=null)cards.Add(bonus);}
            if(cards.Count>0)
            {
                var row=CurrentNodeElements.Rect(BodyRoot,"fire-result-cards");var grid=UIKit.GetOrAdd<GridLayoutGroup>(row);grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=3;grid.cellSize=new Vector2(150,250);grid.spacing=new Vector2(16,16);UIKit.GetOrAdd<LayoutElement>(row).preferredHeight=Mathf.Ceil(cards.Count/3f)*266;
                for(int i=0;i<cards.Count;i++){var card=cards[i];var item=CurrentNodeElements.Rect(row,"fire-result-card");var face=CardFace.Create(card,CardSize.Lg,item);var paper=face.transform.Find("paper-card") as RectTransform;if(paper!=null)face.transform.localScale=Vector3.one*(150f/paper.sizeDelta.x);var button=UIKit.GetOrAdd<Button>(item);button.targetGraphic=face.GetComponent<Image>();button.onClick.AddListener(()=>{if(Current&&!_busy)CurrentRewardCardZoom.Open(new CurrentRewardItem{Card=card,State="received"});});}
            }
            if(!string.IsNullOrEmpty(_error))CurrentNodeElements.Text(BodyRoot,"fire-error",_error,19,"#f0c5ad");
            bool complete=receipt.healUsed&&receipt.restoreUsed;
            if(!complete)CurrentNodeElements.Button(FootRoot,"整理背包",()=>{if(Current&&!_busy)runtime.Bus.Emit(new BagOpened());});
            CurrentNodeElements.Button(FootRoot,_error!=null?"重试保存并返回地图":complete?"继续探索":"返回地图",Finish,true);
        }
        void Perform(string kind)
        {
            if(!Current||_busy)return;var runtime=GameRuntime.I;int before=runtime.State.hp,restored=runtime.CurrentNodeReceipt.restoredIds.Count;
            _busy=true;bool success=kind=="heal"?runtime.TryFireHeal(out _error):runtime.TryFireRestore(out _error);
            if(!success){_busy=false;Rebuild();return;}
            var cards=runtime.CurrentNodeReceipt.restoredIds.Skip(restored).Select(CardLibrary.FindById).Where(c=>c!=null).ToArray();
            Rebuild();CurrentOutcomeFeedback.Play(transform,kind,before,runtime.State.hp,runtime.State.maxHp,cards,()=>{if(this!=null){_busy=false;Rebuild();}});
        }
        void Finish()
        {
            if(!Current||_busy)return;var runtime=GameRuntime.I;
            if(!runtime.TryPersistMutation(()=>{var receipt=runtime.CurrentNodeReceipt;if(receipt.healUsed&&receipt.restoreUsed){receipt.completed=true;runtime.State.settled.Add(_node);}runtime.State.Phase="idle";},out _error)){Rebuild();return;}
            var done=_done;_done=null;Close();done?.Invoke();
        }
        public override void CloseFromEscape()=>Finish();
    }
}
