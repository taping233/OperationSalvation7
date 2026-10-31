// ported from src/battle.view.js aimArrowUpdate()（#aimArrow canvas → uGUI 顶点绘制）
// 二次贝塞尔「上弓」箭头：外层半透明粗带(α.2/w14) + 主箭身(α.95/w7) + 实心箭头三角 + 起点圆。
// 控制点算法逐行照抄 JS：bow = min(90, len*0.3)，弓背朝上；敌红 #e0523c / 己绿 #4ecf8e。
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.UI.Screens.Battle
{
    /// <summary>指向施法箭头（挂在 fx 层，整屏大小，raycastTarget=false）。</summary>
    public class AimArrow : MaskableGraphic
    {
        private Vector2 _a, _b;          // 起点（卡顶）/ 终点（指针或目标中心）
        private bool _visible;
        private Color _color;

        public override Texture mainTexture => s_WhiteTexture;

        protected override void Awake()
        {
            base.Awake();
            raycastTarget = false;
            useLegacyMeshGeneration = false;
        }

        public void Hide() { _visible = false; SetVerticesDirty(); }

        /// <summary>aimArrowUpdate(x1,y1,x2,y2,color)：局部坐标（本组件铺满 fx 层）。</summary>
        public void Show(Vector2 a, Vector2 b, Color color)
        {
            _a = a; _b = b; _color = color; _visible = true;
            SetVerticesDirty();
        }

        // —— 控制点（照抄 aimArrowUpdate）：中点法向偏移，弓背朝上 ——
        private Vector2 ControlPoint(Vector2 a, Vector2 b)
        {
            var m = (a + b) * 0.5f;
            var d = b - a; float len = Mathf.Max(1f, d.magnitude);
            float px = -d.y / len, py = d.x / len;
            if (py < 0) { px = -px; py = -py; }                       // Unity Y向上；CSS Y向下
            float bow = Mathf.Min(90f, len * 0.3f);
            return m + new Vector2(px, py) * bow;
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            if (!_visible) return;
            var c = ControlPoint(_a, _b);
            Vector2 Eval(float t) => (1 - t) * (1 - t) * _a + 2 * (1 - t) * t * c + t * t * _b;
            // 终点方向（贝塞尔在 t=1 处的切线 = 终点 − 控制点），箭头三角按 JS ux/uy/wx/wy
            var tv = (_b - c); float tl = Mathf.Max(1f, tv.magnitude);
            var u = tv / tl; var w = new Vector2(-u.y, u.x);

            const int SEG = 36;
            // 外层半透明粗带 + 主箭身：同一折线两种宽度（先粗后细，细的盖在上面）
            Stroke(vh, Eval, SEG, 14f, _color * new Color(1, 1, 1, 0.2f), offsetEnd: 0f);
            Stroke(vh, Eval, SEG, 7f, _color * new Color(1, 1, 1, 0.95f), offsetEnd: 9f);

            // 箭头三角（JS：17 长 / ±8 宽，深色描边省略为同色填充）
            var tip = _b;
            var p1 = _b - u * 17f + w * 8f;
            var p2 = _b - u * 17f - w * 8f;
            Tri(vh, tip, p1, p2, _color);

            // 起点圆（r=6）
            Circle(vh, _a, 6f, _color);
        }

        // 沿贝塞尔折线生成带宽度的四边形条带；offsetEnd = 终端回缩（主箭身终点 −u*9）
        private void Stroke(VertexHelper vh, System.Func<float, Vector2> eval, int seg, float width, Color col, float offsetEnd)
        {
            Vector2 prev = eval(0f);
            int start = vh.currentVertCount;
            for (int i = 1; i <= seg; i++)
            {
                float t = i / (float)seg;
                var cur = eval(t);
                if (i == seg && offsetEnd > 0f)
                {
                    var back = (_b - ControlPoint(_a, _b)).normalized * offsetEnd;
                    cur -= back;
                }
                var dir = (cur - prev).normalized;
                var n = new Vector2(-dir.y, dir.x);
                AddQuad(vh, prev, cur, n * (width * 0.5f), col);
                prev = eval(t);
            }
        }

        private void AddQuad(VertexHelper vh, Vector2 p0, Vector2 p1, Vector2 nHalf, Color col)
        {
            int s = vh.currentVertCount;
            vh.AddVert(p0 - nHalf, col, Vector2.zero);
            vh.AddVert(p0 + nHalf, col, Vector2.zero);
            vh.AddVert(p1 + nHalf, col, Vector2.zero);
            vh.AddVert(p1 - nHalf, col, Vector2.zero);
            vh.AddTriangle(s, s + 1, s + 2); vh.AddTriangle(s, s + 2, s + 3);
        }

        private void Tri(VertexHelper vh, Vector2 a, Vector2 b, Vector2 c, Color col)
        {
            int s = vh.currentVertCount;
            vh.AddVert(a, col, Vector2.zero); vh.AddVert(b, col, Vector2.zero); vh.AddVert(c, col, Vector2.zero);
            vh.AddTriangle(s, s + 1, s + 2);
        }

        private void Circle(VertexHelper vh, Vector2 center, float r, Color col)
        {
            const int N = 16;
            int s = vh.currentVertCount;
            vh.AddVert(center, col, Vector2.zero);
            for (int i = 0; i <= N; i++)
            {
                float ang = i / (float)N * Mathf.PI * 2f;
                vh.AddVert(center + new Vector2(Mathf.Cos(ang), Mathf.Sin(ang)) * r, col, Vector2.zero);
            }
            for (int i = 1; i <= N; i++) vh.AddTriangle(s, s + i, s + i + 1);
        }
    }
}
