// One-time native authoring for the shared sound.js SFX compressor. Never runs on import.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json;
using UnityEditor;
using UnityEngine;
using UnityEngine.Audio;

namespace Sdt.Editor
{
    public static class CurrentSfxMixerAuthoring
    {
        public const string AssetPath = "Assets/Resources/CurrentSfxMixer.mixer";
        const string NativeEffect = "Duck Volume";
        const BindingFlags Access = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static;
        static readonly Assembly EditorAssembly = typeof(UnityEditor.Editor).Assembly;
        static readonly ParameterTarget[] Targets =
        {
            new ParameterTarget("Threshold", "dB", 1, -6),
            // Accepted backend boundary: native Duck Volume supports ratio <= 10; WebAudio uses 12.
            new ParameterTarget("Ratio", "%", 100, 10),
            new ParameterTarget("Knee", "dB", 1, 8),
            new ParameterTarget("Attack Time", "ms", 1000, .003f),
            new ParameterTarget("Release Time", "ms", 1000, .18f),
            new ParameterTarget("Make-up Gain", "dB", 1, 0),
            new ParameterTarget("Sidechain Mix", "%", 100, 0)
        };

        public static void Inspect() => Execute(false);
        public static void Generate()
        {
            try { Execute(true); if (Application.isBatchMode) EditorApplication.Exit(0); }
            catch (Exception error)
            {
                if (!Application.isBatchMode) throw;
                Debug.LogException(error); EditorApplication.Exit(2);
            }
        }

        static void Execute(bool generate)
        {
            string output = Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
            if (string.IsNullOrWhiteSpace(output)) throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT is required for the native effect report.");
            Directory.CreateDirectory(output);
            string reportPath = Path.Combine(output, "sfx-mixer-authoring.json");
            var report = new Dictionary<string, object>
            {
                ["unityVersion"] = Application.unityVersion, ["mode"] = generate ? "generate" : "inspect",
                ["assetPath"] = AssetPath, ["groupName"] = "SFX", ["nativeEffect"] = NativeEffect,
                ["sourceRatio"] = 12, ["nativeRatio"] = 10,
                ["backendBoundary"] = "Native Duck Volume Ratio raw maximum is 10; source WebAudio ratio is 12. This explicit backend choice does not claim sample-identical dynamics.",
                ["routing"] = "Ten reusable SFX sources -> SFX Attenuation -> shared source-detected Duck Volume -> Master. BGM sources stay outside this mixer.",
                ["status"] = "enumerating"
            };
            try
            {
                Type definitions = EditorType("UnityEditor.Audio.MixerEffectDefinitions");
                Call(definitions, null, "Refresh");
                var names = (string[])Call(definitions, null, "GetEffectList");
                report["nativeEffectNames"] = Call(definitions, null, "GetAudioEffectNames");
                var effects = new List<EffectDefinition>();
                foreach (string name in names)
                {
                    var parameters = new List<ParameterDefinition>();
                    foreach (object value in (Array)Call(definitions, null, "GetEffectParameters", name)) parameters.Add(ReadParameter(value));
                    effects.Add(new EffectDefinition { name = name, parameters = parameters });
                }
                report["effects"] = effects; report["status"] = "enumerated";
                WriteReport(reportPath, report); // Persist actual names/units/ranges even if any validation below fails.
                if (!generate) return;
                Require(!EditorApplication.isPlaying, "Generate the mixer outside Play mode.");
                Require(!File.Exists(AssetPath) && AssetDatabase.LoadMainAssetAtPath(AssetPath) == null,
                    "One-time authoring refuses to overwrite an existing mixer: " + AssetPath);
                var definition = effects.SingleOrDefault(effect => effect.name == NativeEffect);
                Require(definition != null, "Native Duck Volume definition was not registered.");
                foreach (var target in Targets)
                {
                    var parameter = definition.parameters.SingleOrDefault(value => value.name == target.Name);
                    Require(parameter != null, "Missing exact native parameter: " + target.Name);
                    Require(parameter.units == target.Units && Near(parameter.displayScale, target.Scale), "Unconfirmed native units/displayScale: " + target.Name);
                    Require(Finite(parameter.minRange) && Finite(parameter.maxRange) && target.Raw >= parameter.minRange && target.Raw <= parameter.maxRange,
                        "Requested native raw value is outside the actual range: " + target.Name);
                }
                var ratio = definition.parameters.Single(parameter => parameter.name == "Ratio");
                Require(Near(ratio.maxRange, 10), "Native ratio boundary changed; review the explicit 12 -> 10 decision.");
                var sidechain = definition.parameters.Single(parameter => parameter.name == "Sidechain Mix");
                Require(sidechain.minRange == 0 && sidechain.maxRange == 1
                    && sidechain.description == "Sidechain/source mix. If set to 100% the compressor detects level entirely from sidechain signal.",
                    "Local-source detection semantics have not been confirmed for this native effect.");
                report["detection"] = "Sidechain Mix raw 0 selects the group's summed source signal; no SendTarget and no external sidechain routing.";

                Type mixerType = EditorType("UnityEditor.Audio.AudioMixerController");
                Type effectType = EditorType("UnityEditor.Audio.AudioMixerEffectController");
                var mixer = (AudioMixer)Call(mixerType, null, "CreateMixerControllerAtPath", AssetPath);
                report["createdAssetPath"] = AssetPath;
                object master = Property(mixer, "masterGroup");
                object snapshot = ((Array)Property(mixer, "snapshots")).GetValue(0);
                object sfx = Call(mixerType, mixer, "CreateNewGroup", "SFX", false);
                Call(mixerType, mixer, "AddChildToParent", sfx, master);
                Call(master.GetType(), master, "SetValueForVolume", mixer, snapshot, 0f);
                Call(sfx.GetType(), sfx, "SetValueForVolume", mixer, snapshot, 0f);
                var compressor = (UnityEngine.Object)Activator.CreateInstance(effectType, Access, null, new object[] { NativeEffect }, CultureInfo.InvariantCulture);
                Call(effectType, compressor, "PreallocateGUIDs");
                SetProperty(compressor, "sendTarget", null); SetProperty(compressor, "enableWetMix", false); SetProperty(compressor, "bypass", false);
                AssetDatabase.AddObjectToAsset(compressor, mixer);
                Call(sfx.GetType(), sfx, "InsertEffect", compressor, 1);
                var readback = new List<object>();
                foreach (var target in Targets)
                {
                    Call(effectType, compressor, "SetValueForParameter", mixer, snapshot, target.Name, target.Raw);
                    float actual = (float)Call(effectType, compressor, "GetValueForParameter", mixer, snapshot, target.Name);
                    readback.Add(new { name = target.Name, units = target.Units, displayScale = target.Scale, requestedRaw = target.Raw, actualRaw = actual,
                        actualDisplay = actual * target.Scale });
                    report["readback"] = readback;
                    Require(Finite(actual) && Near(actual, target.Raw), "Native parameter readback mismatch: " + target.Name);
                }
                Require(Property(compressor, "sendTarget") == null && !(bool)Property(compressor, "enableWetMix") && !(bool)Property(compressor, "bypass"),
                    "Shared compressor must have no external SendTarget, no dry/wet bypass and no bypass flag.");
                var chain = ((Array)Property(sfx, "effects")).Cast<object>().Select(effect => (string)Property(effect, "effectName")).ToArray();
                Require(chain.SequenceEqual(new[] { "Attenuation", NativeEffect }), "Unexpected SFX effect order.");
                report["sfxChain"] = chain;
                foreach (var asset in AssetDatabase.LoadAllAssetsAtPath(AssetPath)) EditorUtility.SetDirty(asset);
                AssetDatabase.SaveAssets(); AssetDatabase.ImportAsset(AssetPath, ImportAssetOptions.ForceSynchronousImport);
                var stored = AssetDatabase.LoadAssetAtPath<AudioMixer>(AssetPath);
                var groups = stored.FindMatchingGroups("SFX");
                Require(groups.Length == 1 && groups[0].name == "SFX", "Stored runtime SFX group is not unique.");
                var storedEffects = ((Array)Property(groups[0], "effects")).Cast<object>().ToArray();
                object storedSnapshot = ((Array)Property(stored, "snapshots")).GetValue(0);
                foreach (var target in Targets)
                    Require(Near((float)Call(effectType, storedEffects[1], "GetValueForParameter", stored, storedSnapshot, target.Name), target.Raw),
                        "Saved mixer parameter readback mismatch: " + target.Name);
                report["assetGuid"] = AssetDatabase.AssetPathToGUID(AssetPath);
                report["status"] = "generated-and-readback-verified";
                WriteReport(reportPath, report);
                Debug.Log("[sfx-mixer-authoring] Generated " + AssetPath + "; report=" + reportPath);
            }
            catch (Exception error)
            {
                var failure = error is TargetInvocationException invocation && invocation.InnerException != null ? invocation.InnerException : error;
                report["status"] = "failed"; report["error"] = failure.ToString();
                WriteReport(reportPath, report);
                throw new InvalidOperationException("SFX mixer authoring failed; see " + reportPath, failure);
            }
        }

        static ParameterDefinition ReadParameter(object value)
        {
            object Field(string name) => value.GetType().GetField(name, Access).GetValue(value);
            return new ParameterDefinition { name = (string)Field("name"), description = (string)Field("description"), units = (string)Field("units"),
                displayScale = (float)Field("displayScale"), displayExponent = (float)Field("displayExponent"),
                minRange = (float)Field("minRange"), maxRange = (float)Field("maxRange"), defaultValue = (float)Field("defaultValue") };
        }
        static Type EditorType(string name) => EditorAssembly.GetType(name, true);
        static object Call(Type type, object target, string name, params object[] values)
            => type.GetMethods(Access).Single(method => method.Name == name && method.GetParameters().Length == values.Length).Invoke(target, values);
        static object Property(object target, string name) => target.GetType().GetProperty(name, Access).GetValue(target);
        static void SetProperty(object target, string name, object value) => target.GetType().GetProperty(name, Access).SetValue(target, value);
        static void WriteReport(string path, object report) => File.WriteAllText(path, JsonConvert.SerializeObject(report, Formatting.Indented));
        static bool Finite(float value) => !float.IsNaN(value) && !float.IsInfinity(value);
        static bool Near(float left, float right) => Math.Abs(left - right) <= .00001f;
        static void Require(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
        readonly struct ParameterTarget
        {
            public readonly string Name, Units; public readonly float Scale, Raw;
            public ParameterTarget(string name, string units, float scale, float raw) { Name = name; Units = units; Scale = scale; Raw = raw; }
        }
        sealed class EffectDefinition { public string name; public List<ParameterDefinition> parameters; }
        sealed class ParameterDefinition
        {
            public string name, description, units;
            public float displayScale, displayExponent, minRange, maxRange, defaultValue;
        }
    }
}
