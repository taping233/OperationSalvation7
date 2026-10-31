// Native GPU and lifecycle assertions, driven as a real player-loop coroutine by CurrentParityValidation.
using System;
using System.Collections;
using System.Reflection;
using UnityEngine;
using UnityEngine.UI;
using Sdt.UI.Kit;

public static class CurrentArenaFilterChecks
{
    public static string Step { get; private set; }
    static readonly BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
    static T Field<T>(CurrentArenaFilter filter, string name) => (T)typeof(CurrentArenaFilter).GetField(name, Private).GetValue(filter);
    static void Require(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
    static Image Face(Transform parent, Color color)
    {
        var go = new GameObject("filter-alpha-fixture", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
        go.transform.SetParent(parent, false); var image = go.GetComponent<Image>(); image.color = color;
        var rect = image.rectTransform; rect.anchorMin = rect.anchorMax = rect.pivot = Vector2.one * .5f;
        rect.sizeDelta = new Vector2(160,160); return image;
    }
    static Color Pixel(RenderTexture source)
    {
        var previous = RenderTexture.active; var pixel = new Texture2D(1,1,TextureFormat.RGBA32,false);
        try { RenderTexture.active = source; pixel.ReadPixels(new Rect(source.width / 2,source.height / 2,1,1),0,0); pixel.Apply(); return pixel.GetPixel(0,0); }
        finally { RenderTexture.active = previous; UnityEngine.Object.Destroy(pixel); }
    }
    public static IEnumerator Run()
    {
        var owner = new GameObject("arena-filter-check",typeof(RectTransform),typeof(Canvas));
        owner.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
        var arenaObject = new GameObject("arena-under-test",typeof(RectTransform));
        var arena = (RectTransform)arenaObject.transform; arena.SetParent(owner.transform,false);
        arena.anchorMin = arena.anchorMax = arena.pivot = Vector2.one * .5f; arena.sizeDelta = new Vector2(256,256);
        arena.anchoredPosition3D = new Vector3(11,13,0); arena.localScale = new Vector3(.9f,.9f,1);
        var red = Face(arena,new Color(1,0,0,.5f)); var green = Face(arena,new Color(0,1,0,.5f));
        Material redMaterial=red.material, greenMaterial=green.material;
        int originalLayer=arenaObject.layer, redLayer=red.gameObject.layer, sibling=arena.GetSiblingIndex();
        Vector3 position=arena.anchoredPosition3D, scale=arena.localScale;
        try
        {
            Step="enable and explicit native canvas render";
            CurrentArenaFilter.Set(arena,true); CurrentArenaFilter.Set(arena,true);
            var filter=owner.GetComponentInChildren<CurrentArenaFilter>();
            Require(filter!=null && arena.parent!=owner.transform,"Enabled filter must move the original arena exactly once.");
            var camera=Field<Camera>(filter,"_camera");
            Require(camera!=null && !camera.enabled,"Capture camera must never auto-render.");
            yield return null; Canvas.ForceUpdateCanvases(); yield return new WaitForSecondsRealtime(.05f);
            var capture=Field<RenderTexture>(filter,"_capture"); var result=Field<RenderTexture>(filter,"_result");
            Require(capture!=null && result!=null,"Capture must own live textures.");
            Step="GPU premultiplied pixels";
            Color captured=Pixel(capture), blurred=Pixel(result);
            Require(Mathf.Abs(captured.r-.25f)<.035f && Mathf.Abs(captured.g-.5f)<.035f && Mathf.Abs(captured.a-.75f)<.035f,
                "Separate-alpha capture must produce premultiplied (.25,.5,0,.75), independent of external background; actual=" + captured);
            Require(blurred.r<=blurred.a+.01f && blurred.g<=blurred.a+.01f,"Blur must preserve premultiplied alpha.");
            Step="new and moved-out graphics";
            var added=Face(arena,Color.clear); var addedMaterial=added.material; int addedLayer=added.gameObject.layer;
            yield return new WaitForSecondsRealtime(.05f); yield return null; Canvas.ForceUpdateCanvases();
            Require(added.material!=addedMaterial && added.gameObject.layer==31,"New graphics must join capture.");
            added.transform.SetParent(owner.transform,false);
            yield return new WaitForSecondsRealtime(.05f); yield return null; Canvas.ForceUpdateCanvases();
            Require(added.material==addedMaterial && added.gameObject.layer==addedLayer,"Moved-out graphics must recover immediately.");
            Step="restore and release";
            CurrentArenaFilter.Set(arena,false);
            Require(arena.parent==owner.transform && arena.GetSiblingIndex()==sibling,"Close must restore the original parent and sibling.");
            Require(arena.anchoredPosition3D==position && arena.localScale==scale && arena.sizeDelta==new Vector2(256,256),"Close must restore original rect values.");
            Require(arenaObject.layer==originalLayer && red.gameObject.layer==redLayer && red.material==redMaterial && green.material==greenMaterial,
                "Close must restore layers and UI materials.");
            Require(!capture.IsCreated() && !result.IsCreated(),"Close must release render textures synchronously.");
            yield return null;
            Require(camera==null && filter==null,"Closed helper objects must be destroyed.");
            CurrentArenaFilter.Set(arena,true); yield return null; Canvas.ForceUpdateCanvases();
            filter=owner.GetComponentInChildren<CurrentArenaFilter>();
            var pausedCapture=Field<RenderTexture>(filter,"_capture");
            var pausedRoot=Field<RectTransform>(filter,"_captureRoot");
            var proxy=filter.GetComponent<RawImage>();
            Step="disabled and destroyed owner";
            owner.SetActive(false);
            Require(!proxy.isActiveAndEnabled&&!pausedRoot.GetComponent<Canvas>().enabled&&!pausedCapture.IsCreated(),"Disabled owner must immediately hide both outputs and release GPU targets.");
            int disabledFrame=Time.frameCount;
            while(Time.frameCount<=disabledFrame+1)yield return null;
            Require(arena.parent==owner.transform,"Disabling the owner must restore its arena.");
            Require(arena.anchoredPosition3D==position&&arena.localScale==scale&&arena.GetSiblingIndex()==sibling,"Disabled owner must recover its complete original layout.");
            owner.SetActive(true); CurrentArenaFilter.Set(arena,true); yield return null; Canvas.ForceUpdateCanvases();
            Step="same-frame disable and reopen";
            owner.SetActive(false); owner.SetActive(true); CurrentArenaFilter.Set(arena,true);
            int reopenedFrame=Time.frameCount;
            while(Time.frameCount<=reopenedFrame+1)yield return null;
            filter=owner.GetComponentInChildren<CurrentArenaFilter>();
            Require(filter!=null&&Field<Transform>(filter,"_parent")==owner.transform,"Reopen must retain the original owner, not an offscreen parent.");
            CurrentArenaFilter.Set(arena,false);
            Require(arena.parent==owner.transform&&arena.anchoredPosition3D==position&&arena.localScale==scale,"Reopened filter must restore the same original layout.");
            yield return null;
            CurrentArenaFilter.Set(arena,true); yield return null; Canvas.ForceUpdateCanvases();
            filter=owner.GetComponentInChildren<CurrentArenaFilter>();
            var destroyedRoot=Field<RectTransform>(filter,"_captureRoot"); var destroyedCamera=Field<Camera>(filter,"_camera");
            UnityEngine.Object.Destroy(owner); int destroyedFrame=Time.frameCount;
            while(Time.frameCount<=destroyedFrame+2)yield return null;
            Require(arena==null&&destroyedRoot==null&&destroyedCamera==null,"Destroying the original parent must not leave arena, camera or private root orphans.");
        }
        finally { if(arena!=null)CurrentArenaFilter.Set(arena,false); if(owner!=null)UnityEngine.Object.Destroy(owner); }
    }
}
