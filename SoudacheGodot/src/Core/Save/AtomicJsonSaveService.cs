using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Soudache;

public sealed class AtomicJsonSaveService
{
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        AllowTrailingCommas = false,
        Converters = { new JsonStringEnumConverter() }
    };

    public string RootDirectory { get; }
    public int MaxSlots { get; }

    public AtomicJsonSaveService(string rootDirectory, int maxSlots = SaveSchema.MaxSlots)
    {
        if (string.IsNullOrWhiteSpace(rootDirectory)) throw new ArgumentException("Save directory is required.", nameof(rootDirectory));
        if (maxSlots <= 0 || maxSlots > SaveSchema.MaxSlots) throw new ArgumentOutOfRangeException(nameof(maxSlots), "The Godot save contract has exactly five slots.");
        RootDirectory = Path.GetFullPath(rootDirectory);
        MaxSlots = maxSlots;
        Directory.CreateDirectory(RootDirectory);
    }

    public string GetSlotPath(int slot) => Path.Combine(RootDirectory, $"save_{ValidateSlot(slot)}.json");
    public string GetBackupPath(int slot) => GetSlotPath(slot) + ".bak";
    public IEnumerable<string> GetAllSlotPaths()
    {
        for (var slot = 0; slot < MaxSlots; slot++) yield return GetSlotPath(slot);
    }

    public void Save(int slot, SaveGameDto snapshot)
    {
        ValidateSlot(slot);
        ArgumentNullException.ThrowIfNull(snapshot);
        snapshot.Version = SaveSchema.CurrentVersion;
        snapshot.Slot = slot;
        snapshot.SavedAtUtc = DateTimeOffset.UtcNow.ToString("O");
        snapshot.Validate();

        var path = GetSlotPath(slot);
        var backup = GetBackupPath(slot);
        var temp = path + ".tmp";
        var json = JsonSerializer.Serialize(snapshot, _jsonOptions);
        try
        {
            using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            using (var writer = new StreamWriter(stream, new System.Text.UTF8Encoding(false), 4096, leaveOpen: true))
            {
                writer.Write(json);
                writer.Flush();
                stream.Flush(true);
            }

            if (File.Exists(path))
            {
                try
                {
                    File.Replace(temp, path, backup, ignoreMetadataErrors: true);
                }
                catch (PlatformNotSupportedException)
                {
                    FallbackReplace(temp, path, backup);
                }
                catch (IOException)
                {
                    FallbackReplace(temp, path, backup);
                }
            }
            else
            {
                File.Move(temp, path);
            }
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
    }

    public SaveGameDto Load(int slot)
    {
        ValidateSlot(slot);
        var path = GetSlotPath(slot);
        try
        {
            return ReadAndValidate(path);
        }
        catch (FileNotFoundException)
        {
            return ReadAndValidate(GetBackupPath(slot));
        }
        catch (DirectoryNotFoundException)
        {
            return ReadAndValidate(GetBackupPath(slot));
        }
        catch (JsonException)
        {
            return ReadAndValidate(GetBackupPath(slot));
        }
        catch (SaveFormatException ex) when (ex is not SaveVersionException)
        {
            return ReadAndValidate(GetBackupPath(slot));
        }
    }

    public bool TryLoad(int slot, out SaveGameDto? snapshot, out bool usedBackup)
    {
        ValidateSlot(slot);
        usedBackup = false;
        snapshot = null;
        try
        {
            snapshot = ReadAndValidate(GetSlotPath(slot));
            return true;
        }
        catch (FileNotFoundException) { return TryBackup(slot, out snapshot, out usedBackup); }
        catch (DirectoryNotFoundException) { return TryBackup(slot, out snapshot, out usedBackup); }
        catch (JsonException) { return TryBackup(slot, out snapshot, out usedBackup); }
        catch (SaveFormatException ex) when (ex is not SaveVersionException) { return TryBackup(slot, out snapshot, out usedBackup); }
        catch (IOException) { return TryBackup(slot, out snapshot, out usedBackup); }
    }

    public bool HasSave(int slot) => File.Exists(GetSlotPath(slot)) || File.Exists(GetBackupPath(slot));

    /// <summary>
    /// 清空存档槽（含 .bak 备份；对照网页 game.menu.js clearSlot——「删除」与「覆盖重开」共用）。
    /// 返回是否确实存在过存档；槽号越界由 ValidateSlot 抛出。
    /// </summary>
    public bool ClearSlot(int slot)
    {
        var path = GetSlotPath(slot);
        var backup = GetBackupPath(slot);
        var existed = File.Exists(path) || File.Exists(backup);
        if (File.Exists(path)) File.Delete(path);
        if (File.Exists(backup)) File.Delete(backup);
        return existed;
    }

    private bool TryBackup(int slot, out SaveGameDto? snapshot, out bool usedBackup)
    {
        snapshot = null;
        usedBackup = true;
        try
        {
            snapshot = ReadAndValidate(GetBackupPath(slot));
            return true;
        }
        catch (FileNotFoundException) { return false; }
        catch (DirectoryNotFoundException) { return false; }
        catch (JsonException) { return false; }
        catch (SaveFormatException) { return false; }
        catch (IOException) { return false; }
    }

    private SaveGameDto ReadAndValidate(string path)
    {
        var json = File.ReadAllText(path, new System.Text.UTF8Encoding(false));
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions { AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow });
        if (document.RootElement.ValueKind != JsonValueKind.Object) throw new SaveFormatException("Save JSON root must be an object.");
        var dto = JsonSerializer.Deserialize<SaveGameDto>(document.RootElement.GetRawText(), _jsonOptions)
            ?? throw new SaveFormatException("Save JSON contained no object.");
        // A missing version is the original v0 shape. Property initializers
        // cannot distinguish that case, so inspect the raw object first.
        if (!document.RootElement.TryGetProperty("version", out var versionElement)) dto.Version = 0;
        else if (versionElement.ValueKind != JsonValueKind.Number || !versionElement.TryGetInt32(out var parsedVersion))
            throw new SaveFormatException("Save version must be an integer.");
        else dto.Version = parsedVersion;
        if (dto.Version > SaveSchema.CurrentVersion) throw new SaveVersionException(dto.Version);
        SaveMigrations.Migrate(dto);
        dto.Validate();
        return dto;
    }

    private int ValidateSlot(int slot)
    {
        if (slot < 0 || slot >= MaxSlots) throw new ArgumentOutOfRangeException(nameof(slot));
        return slot;
    }

    private static void FallbackReplace(string temp, string target, string backup)
    {
        // File.Replace is unavailable on some filesystems (and older Windows
        // volumes). Copy the last known-good file before replacing the target;
        // this ordering preserves a recoverable .bak if the process dies.
        File.Copy(target, backup, overwrite: true);
        File.Move(temp, target, overwrite: true);
    }
}
