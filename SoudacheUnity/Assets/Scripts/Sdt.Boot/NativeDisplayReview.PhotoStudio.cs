using System;
using System.Collections;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;
using Sdt.Core;
using Sdt.Run;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Misc;
using Sdt.UI.Screens.Run;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Boot
{
    public sealed partial class NativeDisplayReview
    {
        IEnumerator ReviewPhotoStudioExports()
        {
            var game=GameRuntime.I; bool developer=game.DevMode;
            try
            {
                if(!Guard(()=>{Clear();game.DevMode=true;CardLibraryScreen.Open();}))yield break;
                float deadline=Time.realtimeSinceStartup+8;
                while(CurrentRunFilm.Active&&Time.realtimeSinceStartup<deadline)yield return null;
                if(!Guard(()=>{if(CurrentRunFilm.Active)throw new TimeoutException("Photo export entry film did not drain.");ClickNamed("photoExportTools");}))yield break;
                yield return Capture("player-photo-export-tools",false);
                if(!Guard(()=>ClickNamed("photoExportCards")))yield break;
                yield return Capture("player-photo-export-cards",false);
                if(!Guard(()=>
                {
                    var input=App.Canvas.GetComponentsInChildren<InputField>().Single(field=>field.name=="photoExportJson");
                    if(!input.readOnly||input.text.Length>8100)throw new InvalidOperationException("Photo card preview must be bounded and read-only.");
                    ClickNamed("photoExportFile");
                    string path=Directory.GetFiles(Path.Combine(SaveSystem.Dir,"exports","photo-studio"),"sdt-cards.json",SearchOption.AllDirectories).Single();
                    var json=JObject.Parse(File.ReadAllText(path));
                    if((string)json["format"]!="cards"||json["cards"].Count()!=CardLibrary.All().Count)throw new InvalidOperationException("Photo file omitted catalog cards.");
                    _records.Add(new{kind="actual-player-photo-card-export",cards=json["cards"].Count(),relative=Path.GetRelativePath(SaveSystem.Dir,path),previewCharacters=input.text.Length,osHardwareInput=false});
                }))yield break;
                yield return Capture("player-photo-export-written",false);
                if(!Guard(()=>{ClickNamed("photoExportBack");ClickNamed("photoExportNotes");}))yield break;
                yield return Capture("player-photo-export-notes",false);
                if(!Guard(()=>
                {
                    ClickNamed("photoExportFile");
                    string path=Directory.GetFiles(Path.Combine(SaveSystem.Dir,"exports","photo-studio"),"card-notes.json",SearchOption.AllDirectories).Single();
                    var json=JObject.Parse(File.ReadAllText(path));
                    if((int)json["version"]!=1||!(json["notes"] is JObject notes)||notes.Count<HubCatalog.Current.baseNotes.Count)
                        throw new InvalidOperationException("Photo note export omitted base notes.");
                    _records.Add(new{kind="actual-player-photo-notes-export",notes=notes.Count,relative=Path.GetRelativePath(SaveSystem.Dir,path),osHardwareInput=false});
                    ClickNamed("photoExportBack");
                }))yield break;
                yield return Capture("player-photo-export-returned",false);
            }
            finally { game.DevMode=developer; }
        }
    }
}
