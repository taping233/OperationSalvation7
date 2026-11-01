// Controlled native scenarios for the second parity pass; no system input or viewport changes.
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Run;
using Sdt.View;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentRound2Validation
    {
        const string Active="Sdt.Round2.Active";
        static IEnumerator _flow;
        static double _started;
        static readonly List<string> Checks=new List<string>();
        static string Output=>Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static readonly BindingFlags Private=BindingFlags.Instance|BindingFlags.NonPublic;
        static object Field(object target,string name)=>target.GetType().GetField(name,Private).GetValue(target);
        static void Invoke(object target,string name)=>target.GetType().GetMethod(name,Private).Invoke(target,null);
        static void Require(bool condition,string label)
        {if(!condition)throw new InvalidOperationException(label);Checks.Add(label);}
        static IEnumerator Wait(float seconds)
        {double until=EditorApplication.timeSinceStartup+seconds;while(EditorApplication.timeSinceStartup<until)yield return null;}
        static CurrentRound2Validation(){EditorApplication.update+=Tick;}
        public static void Run()
        {
            if(string.IsNullOrEmpty(Output))throw new InvalidOperationException("Output required");
            Directory.CreateDirectory(Output);
            Environment.SetEnvironmentVariable("SDT_UNITY_TEST_DATA",Path.Combine(Output,"profile"));
            AssetDatabase.DisallowAutoRefresh();SessionState.SetBool(Active,true);
            EditorSceneManager.OpenScene("Assets/Scenes/Bootstrap.unity");EditorApplication.EnterPlaymode();
        }
        static void Tick()
        {
            if(!SessionState.GetBool(Active,false))return;
            EditorApplication.QueuePlayerLoopUpdate();
            if(!EditorApplication.isPlaying||EditorApplication.isCompiling||App.Canvas==null)return;
            if(_started==0)_started=EditorApplication.timeSinceStartup;
            try
            {
                if(EditorApplication.timeSinceStartup-_started>100)throw new TimeoutException("Round2 native timeout");
                if(_flow==null)
                {
                    _flow=Flow();
                    UnityEngine.Object.FindAnyObjectByType<Sdt.Boot.GameBoot>().StartCoroutine(Drive());
                }
            }
            catch(Exception error){Finish(error);}
        }
        static IEnumerator Drive()
        {
            Exception failure=null;
            while(true)
            {
                object next;
                try
                {
                    if(!_flow.MoveNext())break;
                    next=_flow.Current;
                }
                catch(Exception error){failure=error;break;}
                yield return next;
            }
            Finish(failure);
        }
        static IEnumerator Flow()
        {
            var shared=Shared();while(shared.MoveNext())yield return shared.Current;
            var run=global::CurrentRunRound2Checks.Run();while(run.MoveNext())yield return run.Current;
            var hub=CurrentHubSaveRound2Checks.Run();while(hub.MoveNext())yield return hub.Current;
        }
        static IEnumerator Shared()
        {
            CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",false,out _);
            App.ShowTitle();yield return null;
            var title=UiStack.Top as TitleScreen;
            var motion=title.GetComponentInChildren<CurrentHomeMotion>();
            motion.SwitchWallpaper(1);
            motion.Leave("mGuide",()=>UiStack.Show<GuideScreen>("Round2 Guide"));
            var wait=Wait(1.3f);while(wait.MoveNext())yield return wait.Current;
            Require(UiStack.Top is GuideScreen,"real departure opens guide");
            Require((float)Field(motion,"_crossfade")==1,"wallpaper crossfade finishes behind transparent guide");
            Require((float)Field(motion,"_divePhase")==1,"finite covered departure finishes");
            float phase=(float)Field(motion,"_phaseTime"),ambient=(float)Field(motion,"_ambientTime");
            wait=Wait(.1f);while(wait.MoveNext())yield return wait.Current;
            Require(phase==(float)Field(motion,"_phaseTime")&&ambient==(float)Field(motion,"_ambientTime"),"covered title stops settled and ambient work");
            CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out _);yield return null;yield return null;
            Require((float)Field(motion,"_divePhase")==0&&(float)Field(motion,"_filterPhase")==0&&(float)Field(motion,"_flashPhase")==0,"reduced motion clears covered departure without residual filter");
            UiStack.Pop();yield return null;
            Require(UiStack.Top==title&&motion.Inner.interactable&&motion.Scene.localScale==Vector3.one,"return restores title with reduced-motion resting pose");
            CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",false,out _);
            wait=Wait(1);while(wait.MoveNext())yield return wait.Current;
            Require(!(bool)Field(motion,"_regionsAnimating"),"settled title stops rewriting entry regions");

            var parent=new GameObject("Round2 clear parent").transform;
            var child=new GameObject("old child");child.transform.SetParent(parent,false);
            UIKit.ClearChildren(parent);
            Require(parent.childCount==0&&!child.activeSelf,"clear immediately detaches and disables old children");
            UnityEngine.Object.Destroy(parent.gameObject);

            var view=BoardViewHost.View;int boardMask=BoardViewHost.BoardCamera.cullingMask;
            var map=Sdt.Core.MapModel.Build(123);view.Build(map);
            var backdrop=view.GetComponentInChildren<MapBackdrop>();
            Invoke(backdrop,"LateUpdate");
            var layers=backdrop.GetComponentsInChildren<Transform>();foreach(var layer in layers)layer.hasChanged=false;
            Invoke(backdrop,"LateUpdate");
            Require(layers.All(layer=>!layer.hasChanged),"unchanged camera and layer do not rewrite backdrop transforms");
            backdrop.SetLayer(1,1);Invoke(backdrop,"LateUpdate");
            Require(layers.Any(layer=>layer.hasChanged),"changed backdrop layer still lays out");
            var settings=UiStack.Show<SettingsScreen>("Round2 Settings");
            Require(!view.PresentationVisible&&BoardViewHost.BoardCamera.cullingMask==0,"opaque settings suppress map before render");
            Require(BoardViewHost.BoardCamera.enabled&&BoardViewHost.BoardCamera.GetComponent<AudioListener>().enabled,"covered map retains camera clearing and audio listener");
            view.MoveAlong(new[]{map.Nodes.Last().id});
            double moveUntil=EditorApplication.timeSinceStartup+3;
            while((bool)Field(view,"_moving")&&EditorApplication.timeSinceStartup<moveUntil)yield return null;
            Require(!(bool)Field(view,"_moving"),"covered map movement still completes");
            var probe=UiStack.Show<CurrentRound2Probe>("Round2 transparent probe");
            Require(UiStack.CoversBoard&&!view.PresentationVisible,"transparent dialog retains its opaque underlying owner");
            var oldChild=probe.Child;probe.Repaint();probe.Repaint();
            Require(probe.transform.childCount==1&&probe.transform.Find("probe-child")==probe.Child.transform&&!oldChild.activeSelf,"consecutive same-frame rebuilds expose only current controls");
            UiStack.Close(settings);
            Require(!settings.gameObject.activeSelf&&view.PresentationVisible&&BoardViewHost.BoardCamera.cullingMask==boardMask,"closing last opaque owner restores map in same call");
            UiStack.Close(probe);UiStack.Close(probe);
            Require(probe.DisableCalls==1,"repeated close does not repeat panel lifecycle");

            var slots=UiStack.Show<SlotPickerScreen>("Round2 Slots");
            wait=Wait(1);while(wait.MoveNext())yield return wait.Current;
            var snow=slots.GetComponentInChildren<CurrentSlotSnow>();
            var rim=slots.GetComponentInChildren<CurrentSlotRim>();
            var tint=(Func<float,float,Color>)Delegate.CreateDelegate(typeof(Func<float,float,Color>),rim,typeof(CurrentSlotRim).GetMethod("Tint",Private));
            tint(.5f,.5f);long allocated=GC.GetAllocatedBytesForCurrentThread();
            for(int i=0;i<10000;i++)tint((i%64)/64f,0);
            long tintBytes=GC.GetAllocatedBytesForCurrentThread()-allocated;
            Require(tintBytes==0,"slot rim tint hot path allocates zero managed bytes (10000 calls)");
            var populate=(Action<VertexHelper>)Delegate.CreateDelegate(typeof(Action<VertexHelper>),snow,typeof(CurrentSlotSnow).GetMethod("OnPopulateMesh",Private,null,new[]{typeof(VertexHelper)},null));
            using(var mesh=new VertexHelper())
            {
                populate(mesh);int vertices=mesh.currentVertCount;populate(mesh);
                allocated=GC.GetAllocatedBytesForCurrentThread();
                for(int i=0;i<20;i++)populate(mesh);
                long snowBytes=GC.GetAllocatedBytesForCurrentThread()-allocated;
                Require(vertices>0&&vertices==mesh.currentVertCount,"snow optimization retains populated geometry");
                Require(snowBytes==0,"warmed snow geometry hot path allocates zero managed bytes (20 builds)");
            }
            probe=UiStack.Show<CurrentRound2Probe>("Round2 slot cover");
            float snowTime=(float)Field(snow,"_time");
            wait=Wait(.1f);while(wait.MoveNext())yield return wait.Current;
            Require(snowTime==(float)Field(snow,"_time"),"covered slot snow stops advancing and requesting animated meshes");
            UiStack.Close(probe);
            CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",true,out _);yield return null;yield return null;
            snowTime=(float)Field(snow,"_time");yield return null;yield return null;
            Require(snowTime==(float)Field(snow,"_time"),"reduced slot snow remains static");
            CurrentUiPreferences.TrySetFlag("sdt-reduce-motion",false,out _);yield return null;yield return null;
            Require((float)Field(snow,"_time")>snowTime,"slot snow resumes after reduced motion is disabled");
            UiStack.Close(slots);CurrentRunFilm.CancelActive();
        }
        static void Finish(Exception error)
        {
            SessionState.SetBool(Active,false);
            File.WriteAllText(Path.Combine(Output,"result.json"),JsonConvert.SerializeObject(new{passed=error==null,error=error?.ToString(),checks=Checks,runAssertions=global::CurrentRunRound2Checks.Assertions,hubAssertions=CurrentHubSaveRound2Checks.Assertions,scope="Native controlled events and allocation/lifecycle checks; no physical input, FPS, or multi-size claim."},Formatting.Indented));
            EditorApplication.Exit(error==null?0:2);
        }
    }
    public sealed class CurrentRound2Probe:Panel
    {
        public int DisableCalls;
        public GameObject Child;
        public override void Build(){Child=new GameObject("probe-child",typeof(RectTransform));Child.transform.SetParent(transform,false);}
        public void Repaint()=>Rebuild();
        void OnDisable(){DisableCalls++;}
    }
}
