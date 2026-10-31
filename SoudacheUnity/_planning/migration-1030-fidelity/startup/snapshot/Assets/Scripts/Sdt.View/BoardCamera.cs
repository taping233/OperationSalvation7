// ported from src/camera.js（相机数学逐行核对一致）+ game.boot.js 输入绑定段
using UnityEngine;

namespace Sdt.View
{
    /// <summary>
    /// 2D 地图相机纯数学（pan/zoom/clamp），与 src/camera.js 逐行对应：
    /// - cx/cy 为视野中心（世界坐标），zoom 限制在 0.4–2.5；
    /// - screenToWorld / panBy / zoomAt / clamp 公式照抄源码；
    /// - clamp 余量 m=160（世界像素单位，本工程 1 世界单位 = 1 源世界像素）；
    /// - 地图尺寸 1440×1440（mapData.js cols=30, rows=30, tile=48）。
    /// 另含 game.boot.js 的角度字段 cam.angle（Q/E 各 ±0.2，源 renderer 未消费，
    /// 此处通过相机 z 旋转生效）。
    /// 注意：源屏幕系 y 向下，本类沿用"y 向下"的屏幕约定；
    /// BoardView 负责在传入屏幕坐标前做 y 翻转。
    /// </summary>
    public sealed class BoardCamera
    {
        public float mapW = 1440f;  // map.cols * map.tile
        public float mapH = 1440f;  // map.rows * map.tile
        public float viewW = 800f;  // 视口尺寸（像素），由宿主 resize 时同步
        public float viewH = 600f;
        public float cx = 720f;     // 视野中心（世界坐标），初始 = 地图中心
        public float cy = 720f;
        public float zoom = 1f;
        public float angle;         // Q/E 旋转（弧度）；源为 cam.angle += ±0.2，无 quarter 概念
        public float detailInset;   // Preview reserves its envelope without changing displayed camera state.

        public void Resize(float w, float h) { viewW = w; viewH = h; }

        // camera.js screenToWorld：屏幕像素（左上原点）→ 世界坐标
        public Vector2 ScreenToWorld(float sx, float sy)
        {
            float x=(sx-viewW/2f)/zoom,y=-(sy-viewH/2f)/zoom;
            float c=Mathf.Cos(angle),s=Mathf.Sin(angle);
            return new Vector2(cx+x*c-y*s,cy+x*s+y*c);
        }

        // camera.js panBy：屏幕像素位移（y 向下约定）
        public void PanBy(float dx, float dy)
        {
            float x=dx/zoom,y=-dy/zoom,c=Mathf.Cos(angle),s=Mathf.Sin(angle);
            cx-=x*c-y*s;cy-=x*s+y*c;
            Clamp();
        }

        // camera.js zoomAt：以屏幕点 (sx,sy) 为锚缩放，缩放前后锚点世界坐标不变
        public void ZoomAt(float sx, float sy, float factor)
        {
            var before = ScreenToWorld(sx, sy);
            zoom = Mathf.Min(2.5f, Mathf.Max(0.4f, zoom * factor));
            var after = ScreenToWorld(sx, sy);
            cx += before.x - after.x;
            cy += before.y - after.y;
            Clamp();
        }

        // camera.js clamp：允许超出地图边缘 160 世界像素的空白余量；
        // 视野全宽 ≥ 地图+余量时居中，否则夹到 [-m+half, mapW+m-half]
        public void Clamp()
        {
            const float m = 160f;
            float halfW = viewW / 2f / zoom;
            float halfH = viewH / 2f / zoom;
            cx = halfW * 2f >= mapW + m * 2f ? mapW / 2f
                : Mathf.Min(mapW + m - halfW, Mathf.Max(-m + halfW, cx));
            cy = halfH * 2f >= mapH + m * 2f ? mapH / 2f
                : Mathf.Min(mapH + m - halfH, Mathf.Max(-m + halfH, cy));
        }

        // 每帧把数学状态应用到 Unity 相机（含震屏偏移）。
        // zoom 语义换算：源 screenPx = world * zoom ⇒ Unity orthographicSize = (pixelHeight/2)/zoom。
        public void ApplyTo(Transform t, float shakeX = 0f, float shakeY = 0f)
        {
            var cam = t.GetComponent<Camera>();
            if (cam != null) cam.orthographicSize = (viewH / 2f) / zoom;
            t.position = new Vector3(cx + shakeX, cy + shakeY, t.position.z);
            t.rotation = Quaternion.Euler(0f, 0f, angle * Mathf.Rad2Deg);
        }
    }
}
