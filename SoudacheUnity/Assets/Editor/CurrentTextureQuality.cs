using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json;
using UnityEditor;
using UnityEngine;

namespace Sdt.EditorTools
{
    /// <summary>Explicit native import check. No load-time hooks: preserves the original before evidence.</summary>
    public static class CurrentTextureQuality
    {
        const string Root = "Assets/Resources/Art/";
        sealed class Sample
        {
            public string path, sha256, npotScale, textureType, compression, filterMode;
            public int sourceWidth, sourceHeight, importedWidth, importedHeight, maxSize, effectiveMaxSize;
            public bool standaloneOverride, mipmaps, readable, alphaIsTransparency, dimensionsExact, aspectPreserved;
            public double sourceAspect, importedAspect;
        }

        static string Output()
        {
            var output = Environment.GetEnvironmentVariable("SDT_UNITY_CHECK_OUTPUT");
            if (string.IsNullOrWhiteSpace(output)) throw new InvalidOperationException("SDT_UNITY_CHECK_OUTPUT is required.");
            Directory.CreateDirectory(output);
            return output;
        }
        static void Write(string output, string file, object value) => File.WriteAllText(Path.Combine(output, file), JsonConvert.SerializeObject(value, Formatting.Indented));
        static int BigEndian(byte[] data, int offset) => checked((int)(((uint)data[offset] << 24) | ((uint)data[offset + 1] << 16) | ((uint)data[offset + 2] << 8) | data[offset + 3]));
        static List<Sample> Snapshot()
        {
            var samples = new List<Sample>();
            var project = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            foreach (var file in Directory.GetFiles(Path.Combine(project, Root), "*.png", SearchOption.AllDirectories).OrderBy(p => p, StringComparer.Ordinal))
            {
                var path = file.Substring(project.Length + 1).Replace('\\', '/');
                if (!path.StartsWith(Root + "Current", StringComparison.Ordinal)) continue;
                var bytes = File.ReadAllBytes(file);
                if (bytes.Length < 24 || bytes[0] != 137 || bytes[1] != 80 || bytes[2] != 78 || bytes[3] != 71 || BigEndian(bytes, 12) != 0x49484452)
                    throw new InvalidDataException("Invalid PNG IHDR: " + path);
                var importer = AssetImporter.GetAtPath(path) as TextureImporter;
                var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
                if (importer == null || texture == null) throw new InvalidOperationException("Native texture unavailable: " + path);
                int width = BigEndian(bytes, 16), height = BigEndian(bytes, 20);
                if (width <= 0 || height <= 0) throw new InvalidDataException("Invalid PNG dimensions: " + path);
                var platform = importer.GetPlatformTextureSettings("Standalone");
                int effectiveMax = platform.overridden ? platform.maxTextureSize : importer.maxTextureSize;
                string hash;
                using (var sha = SHA256.Create()) hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
                samples.Add(new Sample {
                    path = path, sha256 = hash, sourceWidth = width, sourceHeight = height,
                    importedWidth = texture.width, importedHeight = texture.height,
                    sourceAspect = (double)width / height, importedAspect = (double)texture.width / texture.height,
                    npotScale = importer.npotScale.ToString(), maxSize = importer.maxTextureSize, effectiveMaxSize = effectiveMax,
                    standaloneOverride = platform.overridden, textureType = importer.textureType.ToString(),
                    compression = importer.textureCompression.ToString(), filterMode = importer.filterMode.ToString(),
                    mipmaps = importer.mipmapEnabled, readable = importer.isReadable, alphaIsTransparency = importer.alphaIsTransparency,
                    dimensionsExact = width == texture.width && height == texture.height,
                    // A proportional max-size reduction may round at most one destination pixel.
                    aspectPreserved = Math.Abs((long)texture.width * height - (long)texture.height * width) <= Math.Max(width, height)
                });
            }
            if (samples.Count == 0) throw new InvalidOperationException("No Current PNGs found.");
            return samples;
        }

        static string[] Failures(List<Sample> samples)
        {
            return samples.Where(s => !s.aspectPreserved || !s.dimensionsExact || s.compression != TextureImporterCompression.Uncompressed.ToString() || s.mipmaps)
                .Select(s => s.path + ": source=" + s.sourceWidth + "x" + s.sourceHeight + ", imported=" + s.importedWidth + "x" + s.importedHeight + ", npot=" + s.npotScale + ", max=" + s.effectiveMaxSize).ToArray();
        }

        /// <summary>Read-only formal check: validates native dimensions, not only file hashes.</summary>
        public static object Verify()
        {
            var samples = Snapshot();
            var failures = Failures(samples);
            return new { passed = failures.Length == 0, scope = Root, nativeImport = true, count = samples.Count, failures, samples };
        }
        public static void NormalizeSourceQualityAndProbe()
        {
            var output=Output();
            try
            {
                var before=Snapshot();Write(output,"before.json",before);
                var changed=new List<string>();
                foreach(var sample in before.Where(s=>s.compression!=TextureImporterCompression.Uncompressed.ToString()||s.mipmaps||!s.dimensionsExact||s.npotScale!=TextureImporterNPOTScale.None.ToString()))
                {
                    var importer=(TextureImporter)AssetImporter.GetAtPath(sample.path);
                    importer.npotScale=TextureImporterNPOTScale.None;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.mipmapEnabled=false;
                    int maximum=Mathf.NextPowerOfTwo(Mathf.Max(sample.sourceWidth,sample.sourceHeight));importer.maxTextureSize=Mathf.Max(importer.maxTextureSize,maximum);
                    var platform=importer.GetPlatformTextureSettings("Standalone");
                    if(platform.overridden){platform.format=TextureImporterFormat.RGBA32;platform.maxTextureSize=Mathf.Max(platform.maxTextureSize,maximum);importer.SetPlatformTextureSettings(platform);}
                    importer.SaveAndReimport();changed.Add(sample.path);
                }
                var after=Snapshot();var failures=Failures(after).ToList();
                foreach(var sample in after){var original=before.Single(item=>item.path==sample.path);if(sample.sha256!=original.sha256)failures.Add("Source pixels changed: "+sample.path);}
                Write(output,"result.json",new{passed=failures.Count==0,policy="current source dimensions; no additional GPU compression or mipmaps",before,after,changed,failures});
                EditorApplication.Exit(failures.Count==0?0:2);
            }
            catch(Exception error){File.WriteAllText(Path.Combine(output,"failure.txt"),error.ToString());EditorApplication.Exit(2);}
        }

        /// <summary>Execute explicitly in a background editor, with a fresh output directory.</summary>
        public static void NormalizeAndProbe()
        {
            var output = Output();
            // Refuse to overwrite a prior run's before evidence.
            if (File.Exists(Path.Combine(output, "before.json"))) throw new InvalidOperationException("Use a fresh output directory; before.json already exists.");
            var before = new List<Sample>();
            var changed = new List<string>();
            try
            {
                before = Snapshot();
                Write(output, "before.json", before);
                Write(output, "before-after.json", new { phase = "before-preserved", before, after = new Sample[0], changed });
                // Only mutate after every original native dimension has been recorded on disk.
                bool distortionConfirmed = before.Any(s => !s.aspectPreserved);
                if (distortionConfirmed)
                    foreach (var sample in before.Where(s => s.npotScale != TextureImporterNPOTScale.None.ToString()))
                    {
                        var importer = (TextureImporter)AssetImporter.GetAtPath(sample.path);
                        importer.npotScale = TextureImporterNPOTScale.None;
                        importer.SaveAndReimport();
                        changed.Add(sample.path);
                    }
                var after = Snapshot();
                var failures = Failures(after).ToList();
                foreach (var sample in after)
                {
                    var old = before.Single(s => s.path == sample.path);
                    if (sample.sha256 != old.sha256) failures.Add("Source bytes changed: " + sample.path);
                    if (sample.maxSize != old.maxSize || sample.effectiveMaxSize != old.effectiveMaxSize || sample.standaloneOverride != old.standaloneOverride || sample.textureType != old.textureType || sample.compression != old.compression || sample.filterMode != old.filterMode || sample.mipmaps != old.mipmaps || sample.readable != old.readable || sample.alphaIsTransparency != old.alphaIsTransparency)
                        failures.Add("Non-NPOT importer setting changed: " + sample.path);
                }
                Write(output, "before-after.json", new { phase = "complete", distortionConfirmed, before, after, changed });
                bool passed = failures.Count == 0;
                Write(output, "result.json", new { passed, scope = Root, nativeImport = true, beforeCount = before.Count, afterCount = after.Count, distortedBefore = before.Count(s => !s.aspectPreserved), distortedAfter = after.Count(s => !s.aspectPreserved), changedCount = changed.Count, failures });
                Debug.Log("Current texture import check: passed=" + passed + ", changed=" + changed.Count + ", output=" + output);
                if (Application.isBatchMode) EditorApplication.Exit(passed ? 0 : 1);
            }
            catch (Exception exception)
            {
                Write(output, "result.json", new { passed = false, scope = Root, error = exception.ToString(), changed, beforeCount = before.Count });
                Debug.LogException(exception);
                if (Application.isBatchMode) EditorApplication.Exit(1);
                else throw;
            }
        }
    }
}
