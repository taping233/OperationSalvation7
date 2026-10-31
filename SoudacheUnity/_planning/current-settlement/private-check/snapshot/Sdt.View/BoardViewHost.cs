// ported from src/game.boot.js（Camera 创建 / resize / bindInput 装配段）
// 职责（TODO 契约协调者补充 1/2）：
// - Attach(uiRoot)：创建正交相机（layer "Board"=8，取不到回退 8）+ BoardView 常驻对象（DontDestroyOnLoad）；
// - 暴露 FocusNode / PanTo / FitAll / SetRotation / FitPlayer / SetNodeLabelsVisible 转发；
// - OnNodeClicked 事件桥接（View 不引用 Run，由 App 绑定）。
using System;
using UnityEngine;

namespace Sdt.View
{
    /// <summary>地图棋盘宿主：静态装配入口（由 Sdt.UI.Kit.App.Launch 调用 Attach）。</summary>
    public static class BoardViewHost
    {
        public static BoardView View { get; private set; }
        public static Camera BoardCamera { get; private set; }
        static BoardCamera _cam;

        /// <summary>节点点击事件（转发 BoardView.OnNodeClicked，由 App 桥接到 GameRuntime/UI）。</summary>
        public static event Action<string> OnNodeClicked
        {
            add { if (View != null) View.OnNodeClicked += value; }
            remove { if (View != null) View.OnNodeClicked -= value; }
        }

        /// <summary>创建棋盘相机与视图（幂等）。uiRoot 为 UI 根 Canvas（用于把 UI 事件相机排除在棋盘 layer 之外）。</summary>
        public static void Attach(Transform uiRoot)
        {
            if (View != null) return;

            int layer = LayerMask.NameToLayer("Board");
            if (layer < 0) layer = 8; // TagManager 已定义 Board=8；取不到时直接用 8
            int mask = 1 << layer;

            // 常驻棋盘根（DontDestroyOnLoad）
            var root = new GameObject("Sdt.BoardRoot");
            root.layer = layer;
            UnityEngine.Object.DontDestroyOnLoad(root);
            View = root.AddComponent<BoardView>();

            // 专用正交相机：SolidColor 深色背景 #0F1820，只渲染 Board layer
            var camGo = new GameObject("Sdt.BoardCamera");
            camGo.layer = layer;
            UnityEngine.Object.DontDestroyOnLoad(camGo);
            var cam = camGo.AddComponent<Camera>();
            camGo.AddComponent<AudioListener>();   // 场景无 AudioListener 时 BGM/Sfx 无法出声（唯一监听器挂棋盘相机）
            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0x0F / 255f, 0x18 / 255f, 0x20 / 255f, 1f);
            cam.cullingMask = mask;
            cam.nearClipPlane = -500f;
            cam.farClipPlane = 500f;
            cam.depth = 0f;                      // 棋盘世界层在 UI Canvas（Overlay）之下
            BoardCamera = cam;

            _cam = new BoardCamera { viewW = cam.pixelWidth > 0 ? cam.pixelWidth : 800f, viewH = cam.pixelHeight > 0 ? cam.pixelHeight : 600f };
            View.Initialize(_cam);
            View.SetLayerRecursive(layer);
            View.BindCamera(camGo.transform, cam);

            // game.boot.js 启动段：zoom=1.1、居中、clamp
            _cam.zoom = 1.1f;
            _cam.cx = _cam.mapW / 2f;
            _cam.cy = _cam.mapH / 2f;
            _cam.Clamp();
        }

        // ---------- TODO 契约要求的转发 API ----------
        public static void FocusNode(string nodeId) => View?.FocusNode(nodeId);
        public static void PanTo(Vector2 world) => View?.PanTo(world);
        public static void FitAll() => View?.FitAll();
        public static void FitPlayer() => View?.FitPlayer();
        public static void SetRotation(int quarter) => View?.SetRotation(quarter);
        public static void SetNodeLabelsVisible(bool visible) => View?.SetNodeLabelsVisible(visible);
    }
}
