using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Misc;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static class CurrentPhotoExportRound5Checks
    {
        public static int Assertions { get; private set; }
        static void Check(bool value,string message) { Assertions++; if(!value)throw new InvalidOperationException("Photo export round5: "+message); }
        static void Clear() { CurrentRunFilm.CancelActive(); while(UiStack.Count>0)UiStack.Pop(); }
        static Button Button(Panel page,string name) => page.GetComponentsInChildren<Button>(true).Single(button=>button.name==name);
        static T Field<T>(object owner,string name) => (T)owner.GetType().GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(owner);
        static void Submit(Panel page,string name)
        {
            var button=Button(page,name); Check(button.IsActive()&&button.IsInteractable(),"available action "+name);
            EventSystem.current.SetSelectedGameObject(button.gameObject);
            Check(ExecuteEvents.Execute(button.gameObject,new BaseEventData(EventSystem.current),ExecuteEvents.submitHandler),"actual submit "+name);
        }
        static bool Inside(string path) => Path.GetFullPath(path).StartsWith(Path.GetFullPath(SaveSystem.Dir)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase);
        public static IEnumerator Run()
        {
            Assertions=0; Check(!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SDT_UNITY_TEST_DATA")),"isolated profile required");
            var game=GameRuntime.I; bool developer=game.DevMode; Clear(); game.ResetSlot(5);
            try
            {
                game.DevMode=false; CardLibraryScreen.Open(); yield return null; CurrentRunFilm.CancelActive();
                var hidden=(CardLibraryScreen)UiStack.Top;
                Check(!Button(hidden,"photoExportTools").IsActive()&&!Button(hidden,"photoExportCards").IsActive(),"normal browsing hides developer exports");
                UiStack.Close(hidden); game.DevMode=true; CardLibraryScreen.Open();
                var wall=(CardLibraryScreen)UiStack.Top;
                Check(game.State.Phase=="modal","same-frame replacement owns modal state immediately");
                yield return null; CurrentRunFilm.CancelActive(); Canvas.ForceUpdateCanvases();
                Check(game.State.Phase=="modal","old wall destruction cannot restore phase over replacement");
                var content=Field<RectTransform>(wall,"_content"); var search=wall.GetComponentsInChildren<InputField>().Single();
                search.text="round5-missing-photo-f42381bc8fe5";
                yield return new WaitForSecondsRealtime(.2f);
                Check(!wall.GetComponentsInChildren<Button>().Any(button=>button.name.StartsWith("Photo-",StringComparison.Ordinal)),"controlled filter has no visible card");
                Submit(wall,"photoExportTools");
                Check(Field<RectTransform>(wall,"_content")==content&&search.text.Contains("round5-missing"),"tool toggle retains current wall and query");
                Submit(wall,"photoExportCards"); var page=(PhotoStudioExportScreen)UiStack.Top;
                string payload=Field<string>(page,"_payload"), disk=File.ReadAllText(SaveSystem.ProfilePath), rng=game.Rng.SaveState();
                var document=JObject.Parse(payload); var area=page.GetComponentsInChildren<InputField>().Single();
                Check((string)document["game"]=="sdt"&&(string)document["format"]=="cards"&&(int)document["version"]==2,"formal cards envelope");
                Check(document["cards"].Count()==CardLibrary.All().Count&&document["cards"].Count()>0,"export uses complete catalog despite empty page filter");
                Check(area.readOnly&&area.text.Length<=8100&&payload.Length>area.text.Length,"large JSON has a bounded read-only preview and complete backing payload");
                Check(Button(page,"photoExportCopy").IsInteractable(),"full-copy action is available without exercising OS clipboard");
                string file=Path.Combine(SaveSystem.Dir,"exports","photo-studio","round5-fault","sdt-cards.json");
                string marker=file+".writing", held=marker+"-held";
                Check(Inside(file)&&Inside(marker)&&Inside(held),"fault marker and move remain within isolated profile");
                Directory.CreateDirectory(marker); typeof(PhotoStudioExportScreen).GetField("_file",BindingFlags.Instance|BindingFlags.NonPublic).SetValue(page,file);
                Submit(page,"photoExportFile");
                Check(!File.Exists(file)&&Field<string>(page,"_payload")==payload&&area.text.Length<=8100,"failed output preserves payload and preview");
                Check(page.GetComponentsInChildren<Text>().Any(text=>text.name=="photoExportNotice"&&text.text.StartsWith("导出未完成",StringComparison.Ordinal)),"failed output has actual error receipt");
                Check(File.ReadAllText(SaveSystem.ProfilePath)==disk&&game.Rng.SaveState()==rng,"output failure does not touch profile or RNG");
                Directory.Move(marker,held); Submit(page,"photoExportFile");
                Check(File.ReadAllText(file)==payload&&!File.Exists(file+".previous")&&!Button(page,"photoExportFile").IsInteractable(),"retry writes full JSON once without unnecessary backup");
                var oldFile=Button(page,"photoExportFile").onClick; var written=File.GetLastWriteTimeUtc(file);
                oldFile.Invoke(); Check(File.GetLastWriteTimeUtc(file)==written,"disabled action replay does not rewrite output");
                Submit(page,"photoExportBack"); Check(UiStack.Top==wall&&Field<RectTransform>(wall,"_content")==content&&search.text.Contains("round5-missing"),"back preserves wall/filter");
                oldFile.Invoke(); Check(File.GetLastWriteTimeUtc(file)==written&&UiStack.Top==wall,"closed export callback cannot act");

                var card=CardLibrary.FindById("tt3-fireball"); Check(game.Base.TrySavePhotoNote(card.id,"persisted original",out var reason),reason);
                disk=File.ReadAllText(SaveSystem.ProfilePath);
                PhotoDetailScreen.Open(new List<CardDef>{card},card.id); var detail=(PhotoDetailScreen)UiStack.Top;
                var note=detail.GetComponentsInChildren<InputField>().Single(); note.text="pending exported without saving";
                using(var locked=new FileStream(SaveSystem.ProfilePath,FileMode.Open,FileAccess.Read,FileShare.Read)) { note.onEndEdit.Invoke(note.text); UiStack.Close(detail); }
                Submit(wall,"photoExportNotes"); page=(PhotoStudioExportScreen)UiStack.Top;
                document=JObject.Parse(Field<string>(page,"_payload"));
                Check((int)document["version"]==1&&(string)document["notes"][card.id]=="pending exported without saving","actual failed session draft participates in note export");
                Check(File.ReadAllText(SaveSystem.ProfilePath)==disk&&game.Base.PhotoNote(card.id)=="persisted original","note export does not silently persist pending draft");
                var stale=Button(page,"photoExportFile").onClick; game.DevMode=false; stale.Invoke();
                Check(Field<string>(page,"_file")==null,"revoked developer capability cannot write output");
                game.DevMode=true; Submit(page,"photoExportBack");
                PhotoDetailScreen.Open(new List<CardDef>{card},card.id); detail=(PhotoDetailScreen)UiStack.Top;
                note=detail.GetComponentsInChildren<InputField>().Single(); note.onEndEdit.Invoke(note.text); UiStack.Close(detail);
                Check(game.Base.PhotoNote(card.id)=="pending exported without saving","pending remains retryable after export");
            }
            finally { game.DevMode=developer; Clear(); }
            yield return null;
        }
    }
}
