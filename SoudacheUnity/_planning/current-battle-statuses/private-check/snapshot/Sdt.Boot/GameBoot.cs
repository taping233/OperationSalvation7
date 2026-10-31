// 启动组装；领域规则和页面分别由 Core/Run 与 UI 维护。
using UnityEngine;

namespace Sdt.Boot
{
    [DefaultExecutionOrder(-1000)]
    public sealed class GameBoot : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void AutoCreate()
        {
            if (FindFirstObjectByType<GameBoot>() != null) return;
            var go = new GameObject("~GameBoot");
            DontDestroyOnLoad(go);
            go.AddComponent<GameBoot>();
        }

        void Awake()
        {
            if (!Application.isEditor)
                Screen.SetResolution(Screen.currentResolution.width, Screen.currentResolution.height, FullScreenMode.FullScreenWindow);
            Application.targetFrameRate = 120;
            QualitySettings.vSyncCount = 0;
            try
            {
                Sdt.Core.CardLibrary.Init(() => Sdt.Core.CardDatabase.All);
                Sdt.UI.Kit.App.Launch();
                BattleBridge.Install();
                RunLoopBridge.Install();
                Application.wantsToQuit += SaveBeforeQuit;
            }
            catch (System.Exception exception)
            {
                Debug.LogException(exception);
            }
        }

        void Update()
        {
            var game = Sdt.Run.GameRuntime.I;
            if (game.State.runActive) game.Tick(Time.unscaledDeltaTime);
        }

        bool SaveBeforeQuit()
        {
            var game = Sdt.Run.GameRuntime.I;
            if (!game.State.runActive) return true;
            game.SaveCurrent();
            return game.Saves.LastWriteSucceeded;
        }

        void OnDestroy() { Application.wantsToQuit -= SaveBeforeQuit; }
    }
}
