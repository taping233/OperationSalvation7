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
        static CurrentRewardScene _rewardReadyOwner;
        static string _rewardReadyRevision;
        static int _rewardReadyFrame;
        static double _rewardReadySince;
        static bool _rewardReadyRecorded;
        static object RewardPointTrace(Vector2 point)=>new {point.x,point.y};
        static object RewardBoundsTrace(Rect rect)=>new {minX=rect.xMin,minY=rect.yMin,maxX=rect.xMax,maxY=rect.yMax};
        static Vector2 RewardPoint(RectTransform rect)=>RectTransformUtility.WorldToScreenPoint(_camera,rect.TransformPoint(rect.rect.center));
        static Rect RewardBounds(RectTransform rect)
        {
            var corners=new Vector3[4];rect.GetWorldCorners(corners);var points=corners.Select(p=>RectTransformUtility.WorldToScreenPoint(_camera,p)).ToArray();
            return Rect.MinMaxRect(points.Min(p=>p.x),points.Min(p=>p.y),points.Max(p=>p.x),points.Max(p=>p.y));
        }
        static bool RewardPageReady()
        {
            var scene=UiStack.Top==null?null:UiStack.Top.GetComponentsInChildren<CurrentRewardScene>().FirstOrDefault(view=>view.IsCurrent);
            if(scene==null){_rewardReadyOwner=null;_rewardReadyRevision=null;return true;}
            // A new box can reuse the same scene. Watch actual card/button content as well as the owner.
            string revision=string.Join("|",scene.GetComponentsInChildren<CurrentRewardTile>().Select(tile=>tile.Key)) + ":" +
                string.Join("|",scene.GetComponentsInChildren<Button>().Select(button=>button.name+":"+button.IsInteractable()));
            if(!ReferenceEquals(_rewardReadyOwner,scene)||_rewardReadyRevision!=revision)
            {
                _rewardReadyOwner=scene;_rewardReadyRevision=revision;_rewardReadyFrame=Time.frameCount;
                _rewardReadySince=UnityEditor.EditorApplication.timeSinceStartup;_rewardReadyRecorded=false;
                Record("wait-current-reward-native-layout",new{node=GameRuntime.I.CurrentNodeId,frame=Time.frameCount,scene.CanSubmit,root=RewardBoundsTrace(RewardBounds((RectTransform)scene.transform))});
            }
            if(Time.frameCount<_rewardReadyFrame+2||!scene.CanSubmit)
            {
                if(UnityEditor.EditorApplication.timeSinceStartup-_rewardReadySince>10)
                    RewardInputBlocked("reward page did not reach two real frames and its production CanSubmit gate",Buttons());
                return false;
            }
            if(!_rewardReadyRecorded)
            {
                _rewardReadyRecorded=true;
                Record("current-reward-native-layout-ready",new{node=GameRuntime.I.CurrentNodeId,firstFrame=_rewardReadyFrame,frame=Time.frameCount,scene.CanSubmit,
                    root=RewardBoundsTrace(RewardBounds((RectTransform)scene.transform)),scrolls=scene.GetComponentsInChildren<ScrollRect>().Select(scroll=>new{scroll.name,
                        viewport=RewardBoundsTrace(RewardBounds(scroll.viewport!=null?scroll.viewport:(RectTransform)scroll.transform)),
                        content=scroll.content==null?null:RewardBoundsTrace(RewardBounds(scroll.content))}).ToArray()});
            }
            return true;
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
            var scene=UiStack.Top==null?null:UiStack.Top.GetComponentInChildren<CurrentRewardScene>();
            Record("current-reward-input-probe",new {reason,frame=Time.frameCount,node=GameRuntime.I.CurrentNodeId,chestIndex=receipt?.chestIndex,
                root=scene==null?null:RewardBoundsTrace(RewardBounds((RectTransform)scene.transform)),canSubmit=scene!=null&&scene.CanSubmit,
                scrolls=scene==null?null:scene.GetComponentsInChildren<ScrollRect>().Select(scroll=>new{scroll.name,scroll.vertical,scroll.horizontal,
                    viewport=RewardBoundsTrace(RewardBounds(scroll.viewport!=null?scroll.viewport:(RectTransform)scroll.transform)),
                    content=scroll.content==null?null:RewardBoundsTrace(RewardBounds(scroll.content))}).ToArray(),
                pageButtons=Buttons().Select(button=>new{button.name,label=string.Join(" ",button.GetComponentsInChildren<Text>().Select(text=>text.text)),bounds=RewardBoundsTrace(RewardBounds((RectTransform)button.transform))}).ToArray(),
                targets=buttons.Select(button=>new {name=button.name,label=string.Join(" ",button.GetComponentsInChildren<Text>().Select(t=>t.text)),
                    card=button.GetComponentInParent<CurrentRewardTile>()?.CardId,index=button.GetComponentInParent<CurrentRewardTile>()?.Index,
                    bounds=RewardBoundsTrace(RewardBounds((RectTransform)button.transform)),center=RewardPointTrace(RewardPoint((RectTransform)button.transform)),centerInMasks=RewardCenterInMasks(button),
                    receiver=RewardHit(button)?.name,hits=RewardHits(button).Take(6).Select(h=>new {h.gameObject.name,receiver=ExecuteEvents.GetEventHandler<IPointerClickHandler>(h.gameObject)?.name}).ToArray(),
                    graphics=button.GetComponentsInChildren<Graphic>().Select(g=>new {g.name,g.depth,g.raycastTarget,culled=g.canvasRenderer.cull,enabled=g.isActiveAndEnabled}).ToArray(),
                    masks=button.GetComponentsInParent<RectMask2D>().Where(mask=>mask.isActiveAndEnabled).Select(mask=>new {mask.name,bounds=RewardBoundsTrace(RewardBounds(mask.rectTransform))}).ToArray()}).ToArray()});
        }
        static void RewardInputBlocked(string reason,IEnumerable<Button> buttons)
        {
            RewardInputProbe(reason,buttons);
            Shot("reward-input-blocked-"+_ticks);
            throw new InvalidOperationException(reason+"; see current-reward-input-probe and blocked screenshot");
        }
        static void ClaimCurrentVisibleReward()
        {
            Canvas.ForceUpdateCanvases();Canvas.ForceUpdateCanvases();
            var candidates=Buttons().Where(b=>b.name=="全部收下"||b.name=="收下")
                .OrderBy(b=>b.name=="全部收下"?0:b.GetComponentInParent<CurrentRewardTile>()?.Bonus==true?2:1)
                .ThenBy(b=>b.GetComponentsInChildren<Text>().Any(t=>t.text=="整理背包")?1:0).ToArray();
            if(candidates.Length==0)RewardInputBlocked("no current reward claim button: "+UiStack.Names(),candidates);
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
                RewardInputBlocked("first pending reward claim is inside its viewport but native raycast is blocked; other candidates cannot mask this failure",candidates);
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
                if(++_rewardScrollSteps>64)RewardInputBlocked("reward scroll did not reveal a reachable claim",candidates);
                var pointer=new PointerEventData(EventSystem.current){position=viewport.center,scrollDelta=new Vector2(0,point.y<viewport.yMin?-40:40)};
                var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(pointer,hits);
                var first=hits.Count>0?hits[0].gameObject:null;var receiver=first==null?null:ExecuteEvents.GetEventHandler<IScrollHandler>(first);
                if(receiver!=scroll.gameObject)
                {
                    Record("current-reward-scroll-pointer-blocked",new{position=RewardPointTrace(pointer.position),viewport=RewardBoundsTrace(viewport),first=first?.name,receiver=receiver?.name,
                        hits=hits.Take(8).Select(hit=>new{hit.gameObject.name,scrollReceiver=ExecuteEvents.GetEventHandler<IScrollHandler>(hit.gameObject)?.name}).ToArray()});
                    RewardInputBlocked("reward scrollport is blocked by "+first?.name,candidates);
                }
                var before=scroll.content.anchoredPosition;float normalized=scroll.verticalNormalizedPosition;
                if(!ExecuteEvents.Execute(receiver,pointer,ExecuteEvents.scrollHandler))RewardInputBlocked("reward scroll handler did not accept event",candidates);
                Record("constructed-current-reward-scroll",new {target=button.name,card=button.GetComponentInParent<CurrentRewardTile>()?.CardId,position=RewardPointTrace(pointer.position),scrollDelta=RewardPointTrace(pointer.scrollDelta),first=first.name,receiver=receiver.name,before=RewardPointTrace(before),after=RewardPointTrace(scroll.content.anchoredPosition),normalizedBefore=normalized,normalizedAfter=scroll.verticalNormalizedPosition});
                return;
            }
            RewardInputBlocked("reward claim lies inside its viewport but native raycast cannot reach it",candidates);
        }
    }
}
