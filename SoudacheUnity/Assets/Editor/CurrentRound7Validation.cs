using System;
using System.Collections;
using System.IO;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.SceneManagement;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentRound7Validation
    {
        const string Active="Sdt.Round7.Active";
        static double _started;
        static bool _running;
        static Exception _observed;
        static string Output=>Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static CurrentRound7Validation()
        {
            EditorApplication.update+=Tick;
            UnityEngine.Application.logMessageReceived+=(message,stack,type)=>
            {
                if(SessionState.GetBool(Active,false)&&(type==UnityEngine.LogType.Error||type==UnityEngine.LogType.Exception))
                    _observed=new InvalidOperationException(message+"\n"+stack);
            };
        }
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
            if(_observed!=null){Finish(_observed);return;}
            EditorApplication.QueuePlayerLoopUpdate();
            if(!EditorApplication.isPlaying||EditorApplication.isCompiling||Sdt.UI.Kit.App.Canvas==null)return;
            if(_started==0)_started=EditorApplication.timeSinceStartup;
            if(EditorApplication.timeSinceStartup-_started>180){Finish(new TimeoutException("Round7 native timeout"));return;}
            if(!_running){_running=true;UnityEngine.Object.FindAnyObjectByType<Sdt.Boot.GameBoot>().StartCoroutine(Drive());}
        }
        static IEnumerator Flow()
        {
            var child=CurrentDiscoveryRetainedRound7Checks.Run();while(child.MoveNext())yield return child.Current;
            child=CurrentBattleRound7Checks.Run();while(child.MoveNext())yield return child.Current;
            child=CurrentBagDiscoveryRound7Checks.Run();while(child.MoveNext())yield return child.Current;
            child=CurrentHubRound7Checks.Run();while(child.MoveNext())yield return child.Current;
        }
        static IEnumerator Drive()
        {
            var flow=Flow();Exception failure=null;
            while(true)
            {
                object next;
                try{if(_observed!=null)throw _observed;if(!flow.MoveNext())break;next=flow.Current;}
                catch(Exception error){failure=error;break;}
                yield return next;
            }
            Finish(failure);
        }
        static void Finish(Exception error)
        {
            SessionState.SetBool(Active,false);
            File.WriteAllText(Path.Combine(Output,"result.json"),JsonConvert.SerializeObject(new
            {
                passed=error==null,error=error?.ToString(),discoveryAssertions=CurrentDiscoveryRetainedRound7Checks.Assertions,
                battleAssertions=CurrentBattleRound7Checks.Assertions,bagAssertions=CurrentBagDiscoveryRound7Checks.Assertions,
                hubAssertions=CurrentHubRound7Checks.Assertions,
                scope="Isolated production components, formal commands and constructed native UI events. No OS hardware input, natural unassisted play, multi-size or whole-frame performance claim."
            },Formatting.Indented));
            EditorApplication.Exit(error==null?0:2);
        }
    }
}
