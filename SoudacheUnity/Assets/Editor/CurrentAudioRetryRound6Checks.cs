// Explicit central-driver checks: real Resources clips and settings events; no OS input or media edits.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Sdt.Res;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Menu;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentAudioRetryRound6Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value,string message){Assertions++;if(!value)throw new InvalidOperationException("Audio retry round6: "+message);}
        static void Clear(){CurrentRunFilm.CancelActive();while(UiStack.Count>0)UiStack.Pop();}
        static T Field<T>(object owner,string name)=>(T)owner.GetType().GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(owner);
        static AudioSource Active()=>Field<AudioSource>(AudioService.I,"_activeBgm");
        static Button Button(SettingsScreen page,string name)=>page.GetComponentsInChildren<Button>().Single(button=>button.name==name);
        static Text Status(CurrentSettingsPage page)=>Field<Text>(page,"_musicStatus");
        static Button Retry(CurrentSettingsPage page)=>Field<Button>(page,"_musicRetry");
        static int Handlers()=>Field<Action>(AudioService.I,"MusicStateChanged")?.GetInvocationList().Length??0;
        static void Submit(Button button)
        {Check(button!=null&&button.isActiveAndEnabled&&button.interactable,"available real settings Submit target");ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler);}
        static void MusicSlider(SettingsScreen page,float fraction)
        {
            var slider=(RectTransform)page.GetComponentsInChildren<Transform>().Single(node=>node.name=="setMusicVol");
            var world=slider.TransformPoint(new Vector3(Mathf.Lerp(slider.rect.xMin,slider.rect.xMax,fraction),slider.rect.center.y,0));
            var pointer=new PointerEventData(EventSystem.current){button=PointerEventData.InputButton.Left,position=RectTransformUtility.WorldToScreenPoint(null,world)};
            ExecuteEvents.Execute(slider.gameObject,pointer,ExecuteEvents.pointerDownHandler);
            ExecuteEvents.Execute(slider.gameObject,pointer,ExecuteEvents.pointerUpHandler);
        }
        static bool Silent(AudioSource track)=>!track.isPlaying&&(track.clip==null||track.volume==0);
        static bool Stopped()=>Silent(Field<AudioSource>(AudioService.I,"_bgm"))&&Silent(Field<AudioSource>(AudioService.I,"_titleBgm"));
        public static IEnumerator Run()
        {
            Assertions=0;Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
            Clear();var game=GameRuntime.I;game.ResetSlot(5);game.State.runActive=false;game.State.Phase="title";game.State.entrySupply=null;
            var audio=AudioService.I;string scene=audio.MusicScene;bool muted=audio.Muted,musicMuted=audio.MusicMuted;float volume=audio.MusicVolume;
            var map=(IDictionary<string,string>)CurrentAssets.Music;string board=map["board"];
            const string missing="Audio/Current/round6-missing-bgm-0cdaea6f";
            int warnings=0;Application.LogCallback onLog=(message,stack,type)=>{if(type==LogType.Warning&&message.StartsWith("[BGM]",StringComparison.Ordinal))warnings++;};
            Application.logMessageReceived+=onLog;
            try
            {
                var titleClip=Sdt.Res.Res.Music("title");var boardClip=Sdt.Res.Res.Music("board");
                Check(titleClip!=null&&boardClip!=null&&titleClip!=boardClip,"actual current title/board Resources clips");
                audio.Mute(false);audio.SetMusicMuted(false);audio.SetMusicVolume(1);audio.PlayBgm(null);
                map["board"]=missing;Action<string> play=audio.PlayBgm;play("board");
                Check(audio.MusicLoadFailed&&audio.MusicScene=="board"&&audio.MusicAsset==null&&Stopped(),"first failed request remains silent, cached clips do not revive after clear");
                int handlers=Handlers();var settings=UiStack.Show<SettingsScreen>("Settings");
                Submit(Button(settings,"settings-tab-2"));yield return new WaitForSecondsRealtime(.4f);
                var page=settings.GetComponent<CurrentSettingsPage>();var retry=Retry(page);var firstRetry=retry.onClick;
                Check(Status(page).text.Contains("当前保持静音")&&retry.gameObject.activeSelf&&Handlers()==handlers+1,"first-load failure status and single live subscription");
                int before=warnings;for(int i=0;i<8;i++)play("board");
                Check(warnings==before&&audio.MusicLoadFailed&&Stopped(),"same-scene repeats do not reload or repeat warnings");
                Submit(Button(settings,"settings-tab-0"));yield return new WaitForSecondsRealtime(.4f);
                firstRetry.Invoke();Check(warnings==before&&Handlers()==handlers+1,"removed audio-tab retry cannot load; tab switch does not subscribe again");
                Submit(Button(settings,"settings-tab-2"));yield return new WaitForSecondsRealtime(.4f);
                page=settings.GetComponent<CurrentSettingsPage>();retry=Retry(page);
                Check(Handlers()==handlers+1,"returning to audio tab retains one page subscription");
                firstRetry.Invoke();Check(warnings==before,"old same-owner retry cannot borrow the rebuilt button");
                map["board"]=board;Submit(retry);
                Check(!audio.MusicLoadFailed&&audio.MusicAsset==boardClip.name&&Active().clip==boardClip&&!retry.gameObject.activeSelf&&Status(page).text=="音乐已就绪。","real retry recovers first track and clears failure state");
                map["board"]=missing;play("board");audio.RetryBgm();
                Check(!audio.MusicLoadFailed&&Active().clip==boardClip&&warnings==before,"ready same-scene requests and retry do not automatically reload");

                play("title");yield return new WaitForSecondsRealtime(1.2f);
                var retained=Active();float gain=retained.volume;bool playing=retained.isPlaying;
                Check(retained.clip==titleClip&&gain>0,"current valid title clip has native gain");
                play("board");
                Check(audio.MusicLoadFailed&&audio.MusicScene=="board"&&audio.MusicAsset==titleClip.name&&ReferenceEquals(Active(),retained)
                    &&retained.clip==titleClip&&retained.volume==gain&&retained.isPlaying==playing,"failed next track preserves old selected source, clip and playback");
                Check(Status(page).text.Contains("已保留上一首")&&Retry(page).gameObject.activeSelf,"load failure cannot report requested scene ready when old clip remains");
                before=warnings;Submit(Retry(page));
                Check(warnings==before+1&&audio.MusicLoadFailed&&ReferenceEquals(Active(),retained)&&retained.volume==gain&&retained.isPlaying==playing,"manual failed retry performs one attempt without clearing old track");
                MusicSlider(settings,.25f);yield return new WaitForSecondsRealtime(1.2f);
                Check(Mathf.Abs(audio.MusicVolume-.25f)<.001f&&retained.volume>0&&retained.volume<gain&&audio.MusicLoadFailed&&warnings==before+1,"real slider still adjusts retained track without retrying failed request");
                Check(game.Saves.LastWriteSucceeded&&game.Saves.Global.GetString("sdt-music-vol")=="0.25","real slider keeps the existing persisted preference contract");
                Submit(Button(settings,"setMusic"));
                Check(audio.MusicMuted&&Stopped()&&Status(page).text=="音乐已静音。"&&!Retry(page).gameObject.activeSelf,"real music switch mutes old track and hides retry");
                Check(game.Saves.LastWriteSucceeded&&game.Saves.Global.GetString("sdt-music-off")=="1","music switch persists through existing AudioWrite");
                Submit(Button(settings,"setMusic"));
                Check(!audio.MusicMuted&&audio.MusicLoadFailed&&ReferenceEquals(Active(),retained)&&Status(page).text.Contains("已保留上一首")&&Retry(page).gameObject.activeSelf,"unmuting restores retained clip and preserves failed-request receipt");
                audio.Mute(true);Check(Stopped()&&Status(page).text=="音乐已静音。"&&!Retry(page).gameObject.activeSelf,"global mute is reflected by the live event");
                audio.Mute(false);Check(audio.MusicLoadFailed&&Retry(page).gameObject.activeSelf&&warnings==before+1,"global unmute does not silently retry");
                map["board"]=board;Submit(Retry(page));
                Check(!audio.MusicLoadFailed&&audio.MusicAsset==boardClip.name&&Active().clip==boardClip&&!Retry(page).gameObject.activeSelf&&Status(page).text=="音乐已就绪。","restored resource succeeds through current retry control");
                yield return new WaitForSecondsRealtime(1.2f);
                Check(Active().volume>0&&retained.volume==0&&!retained.isPlaying,"successful switch uses existing crossfade and retires old track");
                var lastRetry=Retry(page).onClick;play(null);
                Check(audio.MusicScene==null&&!audio.MusicLoadFailed&&audio.MusicAsset==null&&Stopped()&&Status(page).text=="当前没有场景音乐。","explicit clear stops music and clears failure/selected-asset projection");
                UiStack.Close(settings);Check(Handlers()==handlers,"formal settings close immediately unsubscribes");
                map["board"]=missing;play("board");before=warnings;firstRetry.Invoke();lastRetry.Invoke();
                Check(warnings==before&&audio.MusicLoadFailed&&Stopped(),"closed retry events cannot reload the current request");
            }
            finally
            {
                Application.logMessageReceived-=onLog;map["board"]=board;Clear();
                audio.PlayBgm(null);audio.PlayBgm(scene);audio.SetMusicVolume(volume);audio.SetMusicMuted(musicMuted);audio.Mute(muted);
            }
            yield return null;
        }
    }
}
