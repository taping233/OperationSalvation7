// Central third-pass native checks; child enumerators run on the real player loop.
using System;
using System.Collections;
using System.IO;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.SceneManagement;

namespace Sdt.Editor
{
    [InitializeOnLoad]
    public static class CurrentRound3Validation
    {
        const string Active="Sdt.Round3.Active";
        static double _started;static bool _running;
        static string Output=>Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
        static CurrentRound3Validation(){EditorApplication.update+=Tick;}
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
            if(!EditorApplication.isPlaying||EditorApplication.isCompiling||Sdt.UI.Kit.App.Canvas==null)return;
            if(_started==0)_started=EditorApplication.timeSinceStartup;
            if(EditorApplication.timeSinceStartup-_started>100){Finish(new TimeoutException("Round3 native timeout"));return;}
            if(!_running){_running=true;UnityEngine.Object.FindAnyObjectByType<Sdt.Boot.GameBoot>().StartCoroutine(Drive());}
        }
        static IEnumerator Flow()
        {
            var child=CurrentRewardRound3Checks.Run();while(child.MoveNext())yield return child.Current;
            child=global::CurrentShopRound3Checks.Run();while(child.MoveNext())yield return child.Current;
            child=global::CurrentBattleRound3Checks.Run();while(child.MoveNext())yield return child.Current;
            child=CurrentArchiveRound3Checks.Run();while(child.MoveNext())yield return child.Current;
        }
        static IEnumerator Drive()
        {
            var flow=Flow();Exception failure=null;
            while(true)
            {
                object next;
                try{if(!flow.MoveNext())break;next=flow.Current;}
                catch(Exception error){failure=error;break;}
                yield return next;
            }
            Finish(failure);
        }
        static void Finish(Exception error)
        {
            SessionState.SetBool(Active,false);
            File.WriteAllText(Path.Combine(Output,"result.json"),JsonConvert.SerializeObject(new{
                passed=error==null,error=error?.ToString(),rewardAssertions=CurrentRewardRound3Checks.Assertions,
                shopAssertions=global::CurrentShopRound3Checks.Assertions,battleAssertions=global::CurrentBattleRound3Checks.Assertions,archiveAssertions=CurrentArchiveRound3Checks.Assertions,
                scope="Native constructed submit and lifetime checks in isolated profile; no OS input, multi-size or FPS claim."
            },Formatting.Indented));
            EditorApplication.Exit(error==null?0:2);
        }
    }
}
