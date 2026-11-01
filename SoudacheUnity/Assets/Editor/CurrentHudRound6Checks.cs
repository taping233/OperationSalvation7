// Real retained header with isolated run state and controlled scene owners; no OS input or frame-timing claim.
using System;
using System.Collections;
using System.Reflection;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentHudRound6Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value,string label) { Assertions++; if(!value)throw new InvalidOperationException("HUD round6: "+label); }
        static T Get<T>(object owner,string name)=>(T)owner.GetType().GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(owner);
        static void Tick(CurrentRunTopBar bar)=>typeof(CurrentRunTopBar).GetMethod("Update",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(bar,null);
        static void Clear() { CurrentRunFilm.CancelActive(); while(UiStack.Count>0)UiStack.Pop(); }
        public static IEnumerator Run()
        {
            Assertions=0;
            Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
            Clear();var game=GameRuntime.I;game.NewRun(5,"wu");Clear();
            var bar=App.Canvas.GetComponentInChildren<CurrentRunTopBar>(true);
            Check(bar!=null,"formal retained header exists");
            var group=bar.GetComponent<CanvasGroup>();
            var shade=Get<CurrentRunTopShade>(bar,"_shade").gameObject;
            var chapter=Get<Text>(bar,"_chapter").transform.parent.gameObject;
            var coins=Get<Text>(bar,"_coins");var detail=Get<GameObject>(bar,"_detail");
            Tick(bar);
            Check(CurrentRunTopBar.Visible&&group.alpha==1&&group.interactable&&group.blocksRaycasts,"map header visible and interactive");
            Check(!shade.activeSelf&&chapter.activeSelf,"map has chapter without illustrated shade");
            var gold=bar.transform.Find("resHud/run-gold").GetComponent<Button>();
            ExecuteEvents.Execute(gold.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler);
            Check(detail.activeSelf,"real gold control opens header detail");
            UiStack.Show<SettingsScreen>("Settings");CurrentRunFilm.CancelActive();Tick(bar);
            Check(CurrentRunTopBar.Covered()&&!CurrentRunTopBar.Visible&&group.alpha==0&&!group.interactable&&!group.blocksRaycasts,"formal settings covers header and its input");
            Check(!detail.activeSelf,"covered header closes its open detail");
            string oldCoins=coins.text;game.State.coins+=7;Tick(bar);
            Check(coins.text==oldCoins,"covered header defers hidden data presentation");
            UiStack.Pop();Tick(bar);
            Check(group.alpha==1&&group.interactable&&coins.text==game.State.coins.ToString(),"uncover resumes latest live values");
            EmergencyModal.Open();var fixture=UiStack.Top;
            var scene=new GameObject("illustrated",typeof(RectTransform));scene.transform.SetParent(fixture.transform,false);
            scene.AddComponent<CurrentIllustratedNode>().enabled=false;
            var reward=new GameObject("rewards",typeof(RectTransform));reward.transform.SetParent(fixture.transform,false);
            reward.AddComponent<CurrentRewardScene>().enabled=false;
            Tick(bar);
            Check(shade.activeSelf&&!chapter.activeSelf,"visible scene markers still select shade and reward chapter presentation");
            game.State.runActive=false;Tick(bar);
            Check(!CurrentRunTopBar.Visible&&group.alpha==0&&!group.interactable&&!group.blocksRaycasts,"inactive run hides header");
            scene.SetActive(false);reward.SetActive(false);game.State.coins+=11;Tick(bar);
            Check(shade.activeSelf&&!chapter.activeSelf,"hidden header does not rescan and rewrite scene presentation");
            Check(coins.text!=game.State.coins.ToString(),"inactive run also defers numeric presentation");
            game.State.runActive=true;Tick(bar);
            Check(group.alpha==1&&!shade.activeSelf&&chapter.activeSelf&&coins.text==game.State.coins.ToString(),"reactivation observes current components and state");
            Clear();game.State.runActive=false;Tick(bar);
            yield return null;
        }
    }
}
