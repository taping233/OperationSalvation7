using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Sdt.Core;

namespace Sdt.Run
{
    // Read-only payloads for the active photo-studio exports; no profile or output-file writes.
    public static class PhotoStudioExport
    {
        public static string CardsJson() => new JObject
        {
            ["game"] = "sdt", ["format"] = "cards", ["version"] = 2,
            ["cards"] = SaveJson.Token(CardLibrary.All())
        }.ToString(Formatting.Indented);

        public static string NotesJson(SaveSystem saves, IReadOnlyDictionary<string, string> pending)
        {
            if (saves == null) throw new ArgumentNullException(nameof(saves));
            if (pending == null) throw new ArgumentNullException(nameof(pending));
            var saved = BaseData.ReadPhotoNotes(saves);
            if (saves.HasReadError || saved == null)
                throw new InvalidDataException("照片备注读取失败，尚未生成完整导出；原档和会话编辑已保留。");
            var handwritten = new Dictionary<string, string>(saved, StringComparer.Ordinal);
            foreach (var entry in pending)
            {
                if (string.IsNullOrEmpty(entry.Value)) handwritten.Remove(entry.Key);
                else handwritten[entry.Key] = entry.Value;
            }
            var notes = new Dictionary<string, string>(HubCatalog.Current.baseNotes, StringComparer.Ordinal);
            foreach (var entry in handwritten) notes[entry.Key] = entry.Value;
            return new JObject
            {
                ["version"] = 1,
                ["_comment"] = "Unity照片备注导出：合并底稿、已保存手写与本次会话未保存编辑；清空手写后回落到底稿。",
                ["notes"] = SaveJson.Token(notes)
            }.ToString(Formatting.Indented);
        }
    }
}
