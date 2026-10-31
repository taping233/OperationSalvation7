// 构建脚本：命令行出 Windows 独立包（老板双击即玩，不必开 Unity 编辑器）
// 用法: Unity.exe -batchmode -projectPath <工程> -executeMethod Sdt.Editor.BuildGame.BuildWin64 -quit -logFile <日志>
using UnityEditor;
using UnityEngine;
using UnityEditor.Build.Reporting;
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;

namespace Sdt.Editor
{
    public static class BuildGame
    {
        public static void BuildWin64()
            => BuildWindows("Build/Desktop");
        public static void BuildFidelityWin64()
            => BuildWindows("Build/DesktopFidelity");
        static void BuildWindows(string directory)
        {
            Directory.CreateDirectory(directory);
            string executable=Path.Combine(directory,"代号柒.exe");
            var inputs = InputHashes();
            var scenes = new[] { "Assets/Scenes/Bootstrap.unity" };
            var report = BuildPipeline.BuildPlayer(scenes, executable,
                BuildTarget.StandaloneWindows64, BuildOptions.None);
            Debug.Log("[Build] result=" + report.summary.result +
                      " size=" + report.summary.totalSize +
                      " errors=" + report.summary.totalErrors);
            var currentInputs = InputHashes();
            bool unchanged = inputs.Count == currentInputs.Count && inputs.All(pair => currentInputs.TryGetValue(pair.Key, out var hash) && hash == pair.Value);
            File.WriteAllText(Path.Combine(directory,"build-info.json"), JsonConvert.SerializeObject(new {
                builtAt = DateTime.UtcNow.ToString("o"), unity = Application.unityVersion,
                result = report.summary.result.ToString(), bytes = report.summary.totalSize,
                errors = report.summary.totalErrors, inputsUnchanged = unchanged,
                inputScope = "all Assets files including shipped media and import metadata / all project settings / package JSON / current asset receipt",
                inputs, executableSha256 = File.Exists(executable) ? Hash(executable) : null
            }, Formatting.Indented), new UTF8Encoding(false));
            bool succeeded = report.summary.result == BuildResult.Succeeded && unchanged;
            if (!unchanged) Debug.LogError("构建过程中源码发生变化，当前产物待重新构建。");
            if (Application.isBatchMode) EditorApplication.Exit(succeeded ? 0 : 2);
            else if (report.summary.result != BuildResult.Succeeded) throw new System.InvalidOperationException("桌面构建失败，查看 Unity 日志。");
        }
        static Dictionary<string, string> InputHashes()
        {
            var paths = Directory.GetFiles("Assets", "*", SearchOption.AllDirectories).ToList();
            paths.AddRange(Directory.GetFiles("ProjectSettings", "*", SearchOption.AllDirectories));
            paths.AddRange(Directory.GetFiles("Packages", "*.json"));
            string receipt = "_planning/migration-1029/ui/assets-receipt.json";
            if (File.Exists(receipt)) paths.Add(receipt);
            return paths.OrderBy(path => path, StringComparer.Ordinal).ToDictionary(path => path.Replace('\\', '/'), Hash);
        }
        static string Hash(string path)
        {
            using (var algorithm = SHA256.Create())
            using (var stream = File.OpenRead(path))
                return BitConverter.ToString(algorithm.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }
    }
}
