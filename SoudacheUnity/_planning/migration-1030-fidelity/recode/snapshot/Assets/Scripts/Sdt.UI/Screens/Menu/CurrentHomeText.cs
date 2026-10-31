using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Menu
{
    // CSS letter-spacing in layout pixels; keeps the original source strings.
    public sealed class CurrentHomeText : Text
    {
        public float Tracking;
        public override float preferredWidth => base.preferredWidth + Mathf.Max(0, VisibleCount() - 1) * Tracking;
        int VisibleCount()
        {
            bool tag=false;int count=0;
            foreach(char c in text){if(supportRichText && c=='<')tag=true;else if(tag && c=='>')tag=false;else if(!tag)count++;}
            return count;
        }
        protected override void OnPopulateMesh(VertexHelper helper)
        {
            base.OnPopulateMesh(helper);
            if (Tracking == 0 || helper.currentVertCount == 0) return;
            int count = helper.currentVertCount / 4;
            float offset = alignment == TextAnchor.MiddleRight || alignment == TextAnchor.UpperRight ? -(count - 1) * Tracking
                : alignment == TextAnchor.MiddleCenter || alignment == TextAnchor.UpperCenter ? -(count - 1) * Tracking / 2 : 0;
            UIVertex vertex = default;
            for (int i = 0; i < helper.currentVertCount; i++)
            {
                helper.PopulateUIVertex(ref vertex, i);
                vertex.position.x += i / 4 * Tracking + offset;
                helper.SetUIVertex(vertex, i);
            }
        }
    }
}
