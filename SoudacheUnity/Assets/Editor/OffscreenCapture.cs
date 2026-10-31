using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Sdt.UI.Kit;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Editor
{
    /// <summary>固定单一参考帧的后台原生渲染，不创建或操控前台窗口。</summary>
    public static class OffscreenCapture
    {
        public const int Width = 1920, Height = 1080;
        static RenderTexture _reference;
        /// <summary>Establish the single test viewport before pages measure their layout.</summary>
        public static void PrepareReference()
        {
            var canvas=App.Canvas;var camera=Sdt.View.BoardViewHost.BoardCamera;
            if(canvas==null||camera==null)throw new InvalidOperationException("原生画布和相机尚未建立");
            if(_reference==null)_reference=new RenderTexture(Width,Height,24);
            var scaler=canvas.GetComponent<CanvasScaler>();if(scaler!=null)scaler.enabled=false;
            camera.targetTexture=_reference;camera.aspect=Width/(float)Height;
            canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=1;canvas.scaleFactor=1;
            Canvas.ForceUpdateCanvases();Canvas.ForceUpdateCanvases();
        }
        public static object Write(string path)
        {
            var canvas = App.Canvas;
            var camera = Sdt.View.BoardViewHost.BoardCamera;
            if (canvas == null || camera == null) throw new InvalidOperationException("原生画布和相机尚未建立");
            var scaler = canvas.GetComponent<CanvasScaler>();
            var oldMode = canvas.renderMode; var oldCamera = canvas.worldCamera; var oldPlane = canvas.planeDistance;
            var measuredBefore=((RectTransform)canvas.transform).rect;
            var oldTarget = camera.targetTexture; var oldActive = RenderTexture.active; var oldMask = camera.cullingMask;
            var oldSize = camera.orthographicSize; var oldAspect = camera.aspect;
            var oldOverride = canvas.overrideSorting; var oldLayer = canvas.sortingLayerID; var oldOrder = canvas.sortingOrder;
            float oldScale = canvas.scaleFactor; bool oldScaler = scaler != null && scaler.enabled;
            var target = new RenderTexture(Width, Height, 24);
            var image = new Texture2D(Width, Height, TextureFormat.RGBA32, false);
            try
            {
                if (scaler != null) scaler.enabled = false;
                camera.targetTexture = target; camera.aspect = Width / (float)Height;
                if (Sdt.View.BoardViewHost.View?.Cam != null)
                    camera.orthographicSize = Height / (2f * Sdt.View.BoardViewHost.View.Cam.zoom);
                foreach (var backdrop in UnityEngine.Object.FindObjectsByType<Sdt.View.MapBackdrop>(FindObjectsSortMode.None))
                    backdrop.SendMessage("LateUpdate", SendMessageOptions.DontRequireReceiver);
                canvas.renderMode = RenderMode.ScreenSpaceCamera; canvas.worldCamera = camera; canvas.planeDistance = 1;
                canvas.scaleFactor = 1;
                canvas.overrideSorting = true;
                canvas.sortingLayerID = SortingLayer.layers.OrderBy(layer => SortingLayer.GetLayerValueFromID(layer.id)).Last().id;
                canvas.sortingOrder = 32767;
                camera.cullingMask |= (1 << 0) | (1 << 5);
                foreach (var text in canvas.GetComponentsInChildren<Text>()) text.SetAllDirty();
                Canvas.ForceUpdateCanvases();
                Canvas.ForceUpdateCanvases();
                var leakedIcons=canvas.GetComponentsInChildren<Text>().Where(text=>text.GetComponentInParent<InputField>()==null)
                    .Where(text=>(text is InlineIconText inline?inline.RenderedText:text.text)?.Contains("[[icon:")==true)
                    .Select(text=>text.name+": "+text.text).ToArray();
                if(leakedIcons.Length>0)throw new InvalidOperationException("界面仍有未绘制的图标标记："+string.Join("; ",leakedIcons));
                var rect = ((RectTransform)canvas.transform).rect;
                if (Math.Abs(rect.width - Width) > 2 || Math.Abs(rect.height - Height) > 2)
                    throw new InvalidOperationException("离屏画布参考尺寸不符：" + rect);
                camera.Render(); RenderTexture.active = target;
                image.ReadPixels(new Rect(0, 0, Width, Height), 0, 0); image.Apply();
                File.WriteAllBytes(path, image.EncodeToPNG());
                return new { width = Width, height = Height, canvasWidth = rect.width, canvasHeight = rect.height, measuredBeforeWidth=measuredBefore.width,measuredBeforeHeight=measuredBefore.height, input = "offscreen-native-render", sortingLayer = canvas.sortingLayerID,
                    icons = canvas.GetComponentsInChildren<InlineIconText>().Select(text => new { text.SourceText, text.RenderedIconCount,
                        rectangles = text.IconRects.Select(bounds => new { bounds.x, bounds.y, bounds.width, bounds.height }).ToArray() }).ToArray(),
                    buttons = canvas.GetComponentsInChildren<Button>().Where(button => button.isActiveAndEnabled).Select(button => new {
                        label = string.Join(" ", button.GetComponentsInChildren<Text>().Select(text => text.text)),
                        width = ((RectTransform)button.transform).rect.width, height = ((RectTransform)button.transform).rect.height,
                        bounds = ScreenBounds((RectTransform)button.transform, camera) }).ToArray() };
            }
            finally
            {
                canvas.renderMode = oldMode; canvas.worldCamera = oldCamera; canvas.planeDistance = oldPlane;
                canvas.overrideSorting = oldOverride; canvas.sortingLayerID = oldLayer; canvas.sortingOrder = oldOrder;
                canvas.scaleFactor = oldScale; if (scaler != null) scaler.enabled = oldScaler;
                camera.targetTexture = oldTarget; camera.cullingMask = oldMask; camera.orthographicSize = oldSize; camera.aspect = oldAspect;
                foreach (var backdrop in UnityEngine.Object.FindObjectsByType<Sdt.View.MapBackdrop>(FindObjectsSortMode.None))
                    backdrop.SendMessage("LateUpdate", SendMessageOptions.DontRequireReceiver);
                RenderTexture.active = oldActive;
                UnityEngine.Object.DestroyImmediate(image); target.Release(); UnityEngine.Object.DestroyImmediate(target);
                foreach (var text in canvas.GetComponentsInChildren<Text>()) text.SetAllDirty();
                Canvas.ForceUpdateCanvases();
            }
        }
        static object ScreenBounds(RectTransform transform, Camera camera)
        {
            var corners = new Vector3[4]; transform.GetWorldCorners(corners);
            var points = corners.Select(point => RectTransformUtility.WorldToScreenPoint(camera, point)).ToArray();
            return new { minX = points.Min(point => point.x), minY = points.Min(point => point.y), maxX = points.Max(point => point.x), maxY = points.Max(point => point.y) };
        }
        public static void ProbeFont()
        {
            string output = Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT"); Directory.CreateDirectory(output);
            var font = Sdt.Res.Res.Sans;
            var settings = new TextGenerationSettings { font = font, fontSize = 20, fontStyle = FontStyle.Normal,
                color = Color.white, richText = true, lineSpacing = 1, scaleFactor = 1, generationExtents = new Vector2(600, 100),
                textAnchor = TextAnchor.UpperLeft, horizontalOverflow = HorizontalWrapMode.Wrap, verticalOverflow = VerticalWrapMode.Overflow };
            var rows = new[] { "A　B", "A<color=red>　</color>B", "A\u2001B", "文字　图标" }.Select(text => {
                var generator = new TextGenerator(); generator.Populate(text, settings);
                return new { text, characters = generator.characters.Select(c => new { x = c.cursorPos.x, y = c.cursorPos.y, c.charWidth }), vertices = generator.verts.Count };
            }).ToArray();
            File.WriteAllText(Path.Combine(output, "font-probe.json"), JsonConvert.SerializeObject(rows, Formatting.Indented));
            EditorApplication.Exit(0);
        }
    }
}
