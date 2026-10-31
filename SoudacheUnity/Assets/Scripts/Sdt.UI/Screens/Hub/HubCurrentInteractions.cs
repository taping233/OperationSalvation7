using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using Sdt.UI.Kit;
namespace Sdt.UI.Screens.Hub
{
    public sealed partial class HubScreen
    {
        sealed class HubResourceHint : MonoBehaviour,IPointerEnterHandler,IPointerExitHandler,ISelectHandler,IDeselectHandler
        {
            public string Caption;GameObject _hint;
            void Show()
            {
                if(_hint!=null)return;
                var box=Area(transform,"base-resource-tooltip",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(-80,-58),new Vector2(80,-10));
                Surface(box,.99f,8);box.GetComponent<Image>().raycastTarget=false;
                var canvas=box.gameObject.AddComponent<Canvas>();canvas.overrideSorting=true;canvas.sortingOrder=80;
                var text=UIKit.Label(box,Caption,20,InkColor);text.alignment=TextAnchor.MiddleCenter;Fill(text.rectTransform);_hint=box.gameObject;
            }
            void Hide(){if(_hint!=null)Destroy(_hint);_hint=null;}
            public void OnPointerEnter(PointerEventData data)=>Show();public void OnPointerExit(PointerEventData data)=>Hide();
            public void OnSelect(BaseEventData data)=>Show();public void OnDeselect(BaseEventData data)=>Hide();
            void OnDisable()=>Hide();
        }
        sealed class HubPartnerPlay : MonoBehaviour
        {
            static readonly string[][] Replies={new[]{"歪头看着你。","开心地晃了晃。","又凑近了一点。"},new[]{"偏过头来瞧你。","轻轻抖了抖翅膀。","安静地陪着你。"},new[]{"嗯？","伸了个小懒腰。","眯起了眼睛。"},new[]{"滴，收到。","天线晃了晃。","陪伴模式，已就位。"},new[]{"小火苗歪了歪。","噗，跳了一下。","暖乎乎地靠过来。"},new[]{"歪头瞧了瞧。","摇摇摆摆。","挨着你坐一会儿。"}};
            public RectTransform Art;public Text Reply;public string PetId;int _next,_reaction;float _until;Vector2 _origin;bool _started;
            void Awake(){_origin=((RectTransform)transform).anchoredPosition;}
            public void Play()
            {
                if(!_started){_origin=Art.anchoredPosition;_started=true;}
                int pet=Array.IndexOf(new[]{"dog","falcon","cat","robot","fire","penguin"},PetId);_reaction=_next++%3;Reply.text=Replies[Math.Max(0,pet)][_reaction];_until=Time.unscaledTime+1.4f;
            }
            void Update()
            {
                if(_until<=0||Art==null)return;float remaining=_until-Time.unscaledTime;
                if(remaining<=0){Reset();return;}float t=1.4f-remaining;Art.anchoredPosition=_origin;Art.localEulerAngles=Vector3.zero;Art.localScale=Vector3.one;
                if(Sdt.Run.GameRuntime.I.Saves.Global.GetString("sdt-reduce-motion")=="1")return;
                if(_reaction==0)Art.localEulerAngles=new Vector3(0,0,Frame(t/.62f,new[]{0f,.4f,.7f,1f},new[]{0f,7f,-3f,0f}));
                else if(_reaction==1){float v=t/.56f;Art.anchoredPosition=_origin+new Vector2(0,Frame(v,new[]{0f,.3f,.58f,.8f,1f},new[]{0f,-3f,10f,-1f,0f}));Art.localScale=new Vector3(Frame(v,new[]{0f,.3f,1f},new[]{1f,1.02f,1f}),Frame(v,new[]{0f,.3f,1f},new[]{1f,.98f,1f}),1);}
                else{float v=t/.62f,shift=Frame(v,new[]{0f,.5f,1f},new[]{0f,1f,0f});Art.anchoredPosition=_origin+new Vector2(5*shift,0);Art.localEulerAngles=new Vector3(0,0,-3*shift);Art.localScale=Vector3.one*(1+.035f*shift);}
            }
            static float Frame(float time,float[] times,float[] values)
            {
                if(time>=1)return values[values.Length-1];int index=1;while(index<times.Length-1&&time>times[index])index++;
                float t=Mathf.Clamp01((time-times[index-1])/(times[index]-times[index-1])),lo=0,hi=1,v=t;
                for(int n=0;n<9;n++){v=(lo+hi)*.5f;float u=1-v,x=3*u*u*v*.42f+3*u*v*v*.58f+v*v*v;if(x<t)lo=v;else hi=v;}float curve=3*(1-v)*v*v+v*v*v;return Mathf.Lerp(values[index-1],values[index],curve);
            }
            void Reset(){_until=0;if(Art!=null){Art.anchoredPosition=_origin;Art.localEulerAngles=Vector3.zero;Art.localScale=Vector3.one;}if(Reply!=null)Reply.text="";}
            void OnApplicationFocus(bool focus){if(!focus)Reset();}void OnDisable()=>Reset();
        }
    }
}
