using System;
using System.Linq;
using Sdt.Boot;
using Sdt.UI.Kit;
using Sdt.UI.Screens.Run;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace Sdt.Editor
{
    public static partial class CurrentMigrationFlowValidation
    {
        static string _curtainWait;
        static CurrentRunFilm _curtainFilm;
        static double _curtainSince;
        // Wait for the actual production curtain. Never cancel/skip it to make a test action reachable.
        static bool AwaitSourceCurtain()
        {
            bool startup = StartupTransition.Stage != "not-installed" && !StartupTransition.Finished;
            var film = CurrentRunFilm.Current;
            if (!startup && !CurrentRunFilm.Active)
            {
                if (_curtainWait != null) Record("source-curtain-finished", new { owner = _curtainWait, seconds = EditorApplication.timeSinceStartup - _curtainSince });
                _curtainWait = null; _curtainFilm = null; return false;
            }
            string owner = startup ? "startup" : film == null ? "missing" : film.Kind;
            if (_curtainWait != owner || !ReferenceEquals(_curtainFilm, film))
            {
                _curtainWait = owner; _curtainFilm = film; _curtainSince = EditorApplication.timeSinceStartup;
                Record("wait-source-curtain", new { owner, startup = StartupTransition.Stage, kind = film?.Kind, duration = film?.DurationSeconds, exit = film?.ExitSeconds, stack = UiStack.Names() });
            }
            Require(EditorApplication.timeSinceStartup - _curtainSince < 20, "source curtain did not finish: " + owner);
            return true;
        }
        static bool TitleReady()
        {
            // These plates have their own animated group. Ancestors may intentionally use alpha .86.
            return new[] { "mStart", "btnCardLib" }.All(name =>
            {
                var button = UiStack.Top.GetComponentsInChildren<Button>().FirstOrDefault(item => item.name == name);
                if (button == null || !button.IsInteractable()) return false;
                var plate = button.GetComponent<CanvasGroup>();
                return (plate == null || plate.alpha > .99f) && button.GetComponentsInParent<CanvasGroup>().All(group => group.blocksRaycasts);
            });
        }
    }
}
