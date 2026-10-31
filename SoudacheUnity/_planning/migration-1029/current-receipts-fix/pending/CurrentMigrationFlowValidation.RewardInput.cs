using System;
using System.Collections.Generic;
using System.Linq;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static partial class CurrentMigrationFlowValidation
    {
        static string _rewardScrollOwner;
        static int _rewardScrollSteps;
        static object RewardPointTrace(Vector2 point)=>new {point.x,point.y};
        static object RewardBoundsTrace(Rect rect)=>new {minX=rect.xMin,minY=rect.yMin,maxX=rect.xMax,maxY=rect.yMax};
        static Vector2 RewardPoint(RectTransform rect)=>RectTransformUtility.WorldToScreenPoint(_camera,rect.TransformPoint(rect.rect.center));
        static Rect RewardBounds(RectTransform rect)
        {
            var corners=new Vector3[4];rect.GetWorldCorners(corners);var points=corners.Select(p=>RectTransformUtility.WorldToScreenPoint(_camera,p)).ToArray();
            return Rect.MinMaxRect(points.Min(p=>p.x),points.Min(p=>p.y),points.Max(p=>p.x),points.Max(p=>p.y));
        }
        static bool RewardCenterInMasks(Button button)
        {
            var point=RewardPoint((RectTransform)button.transform);
            return button.GetComponentsInParent<RectMask2D>().Where(mask=>mask.isActiveAndEnabled)
                .All(mask=>RewardBounds(mask.rectTransform).Contains(point));
        }
        static List<RaycastResult> RewardHits(Button button)
        {
            var data=new PointerEventData(EventSystem.current){position=RewardPoint((RectTransform)button.transform)};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(data,hits);
            return hits;
        }
        static GameObject RewardHit(Button button)
        {
            var hits=RewardHits(button);
            return hits.Count==0?null:ExecuteEvents.GetEventHandler<IPointerClickHandler>(hits[0].gameObject);
        }
        static void RewardInputProbe(string reason,IEnumerable<Button> buttons)
        {
            GameRuntime.I.State.nodeRewards.TryGetValue(GameRuntime.I.CurrentNodeId,out var receipt);
            Record("current-reward-input-probe",new {reason,node=GameRuntime.I.CurrentNodeId,chestIndex=receipt?.chestIndex,
                targets=buttons.Select(button=>new {name=button.name,label=string.Join(" ",button.GetComponentsInChildren<Text>().Select(t=>t.text)),
                    card=button.GetComponentInParent<CurrentRewardTile>()?.CardId,index=button.GetComponentInParent<CurrentRewardTile>()?.Index,
                    bounds=RewardBoundsTrace(RewardBounds((RectTransform)button.transform)),center=RewardPointTrace(RewardPoint((RectTransform)button.transform)),centerInMasks=RewardCenterInMasks(button),
                    receiver=RewardHit(button)?.name,hits=RewardHits(button).Take(6).Select(h=>new {h.gameObject.name,receiver=ExecuteEvents.GetEventHandler<IPointerClickHandler>(h.gameObject)?.name}).ToArray(),
                    graphics=button.GetComponentsInChildren<Graphic>().Select(g=>new {g.name,g.depth,g.raycastTarget,culled=g.canvasRenderer.cull,enabled=g.isActiveAndEnabled}).ToArray(),
                    masks=button.GetComponentsInParent<RectMask2D>().Where(mask=>mask.isActiveAndEnabled).Select(mask=>new {mask.name,bounds=RewardBoundsTrace(RewardBounds(mask.rectTransform))}).ToArray()}).ToArray()});
        }
        static void ClaimCurrentVisibleReward()
        {
            Canvas.ForceUpdateCanvases();Canvas.ForceUpdateCanvases();
            var candidates=Buttons().Where(b=>b.name=="全部收下"||b.name=="收下")
                .OrderBy(b=>b.name=="全部收下"?0:b.GetComponentInParent<CurrentRewardTile>()?.Bonus==true?2:1)
                .ThenBy(b=>b.GetComponentsInChildren<Text>().Any(t=>t.text=="整理背包")?1:0).ToArray();
            Require(candidates.Length>0,"no current reward claim button: "+UiStack.Names());
            RewardInputProbe("candidate-reachability",candidates);
            var preferred=candidates[0];
            if(RewardCenterInMasks(preferred)&&RewardHit(preferred)==preferred.gameObject){Click(preferred.gameObject);_rewardScrollOwner=null;return;}
            RewardInputProbe("before-native-render",candidates);
            // A hidden batch may create a new box between renders. Rebuild its native graphic depths before judging input.
            // This does not change page state, bypass masks, or invoke button callbacks.
            _camera.Render();Canvas.ForceUpdateCanvases();
            RewardInputProbe("after-native-render",candidates);
            if(RewardCenterInMasks(preferred))
            {
                if(RewardHit(preferred)==preferred.gameObject){Click(preferred.gameObject);_rewardScrollOwner=null;return;}
                Shot("reward-input-blocked-"+_ticks);
                throw new InvalidOperationException("first pending reward claim is inside its viewport but native raycast is blocked; other candidates cannot mask this failure");
            }
            // Alternate candidates are allowed only when the original preferred claim is genuinely outside its scrollport.
            var reachable=candidates.FirstOrDefault(b=>RewardCenterInMasks(b)&&RewardHit(b)==b.gameObject);
            if(reachable!=null){Click(reachable.gameObject);_rewardScrollOwner=null;return;}
            foreach(var button in candidates)
            {
                var scroll=button.GetComponentInParent<ScrollRect>();if(scroll==null||!scroll.vertical||scroll.content==null)continue;
                var view=scroll.viewport!=null?scroll.viewport:(RectTransform)scroll.transform;var viewport=RewardBounds(view);var point=RewardPoint((RectTransform)button.transform);
                if(point.y>=viewport.yMin&&point.y<=viewport.yMax)continue;
                GameRuntime.I.State.nodeRewards.TryGetValue(GameRuntime.I.CurrentNodeId,out var receipt);
                string owner=GameRuntime.I.State.seed+":"+GameRuntime.I.CurrentNodeId+":"+receipt?.chestIndex;
                if(_rewardScrollOwner!=owner){_rewardScrollOwner=owner;_rewardScrollSteps=0;}
                Require(++_rewardScrollSteps<=64,"reward scroll did not reveal a reachable claim");
                var pointer=new PointerEventData(EventSystem.current){position=viewport.center,scrollDelta=new Vector2(0,point.y<viewport.yMin?-40:40)};
                var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(pointer,hits);
                var first=hits.Count>0?hits[0].gameObject:null;var receiver=first==null?null:ExecuteEvents.GetEventHandler<IScrollHandler>(first);
                Require(receiver==scroll.gameObject,"reward scrollport is blocked by "+first?.name);
                var before=scroll.content.anchoredPosition;float normalized=scroll.verticalNormalizedPosition;
                Require(ExecuteEvents.Execute(receiver,pointer,ExecuteEvents.scrollHandler),"reward scroll handler did not accept event");
                Record("constructed-current-reward-scroll",new {target=button.name,card=button.GetComponentInParent<CurrentRewardTile>()?.CardId,position=RewardPointTrace(pointer.position),scrollDelta=RewardPointTrace(pointer.scrollDelta),first=first.name,receiver=receiver.name,before=RewardPointTrace(before),after=RewardPointTrace(scroll.content.anchoredPosition),normalizedBefore=normalized,normalizedAfter=scroll.verticalNormalizedPosition});
                return;
            }
            Shot("reward-input-blocked-"+_ticks);
            throw new InvalidOperationException("reward claim lies inside its viewport but native raycast cannot reach it; see current-reward-input-probe");
        }
    }
}
