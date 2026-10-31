using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Hub
{
    // base-home-v7: intrinsic content height with max-height:calc(100% - 80px), overflow:auto.
    public sealed class HubCurrentHomeCard : MonoBehaviour
    {
        public RectTransform Content;
        void LateUpdate()=>Fit();
        public void Fit(bool rebuild=false)
        {
            if(Content==null)return;
            if(rebuild)LayoutRebuilder.ForceRebuildLayoutImmediate(Content);
            var host=(RectTransform)transform;
            float height=Mathf.Min(LayoutUtility.GetPreferredHeight(Content),Mathf.Max(0,((RectTransform)host.parent).rect.height-80));
            if(Mathf.Abs(host.rect.height-height)>.1f)host.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical,height);
        }
    }
}
