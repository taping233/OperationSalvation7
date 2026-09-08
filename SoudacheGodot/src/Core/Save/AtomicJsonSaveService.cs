using System;
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

    public AtomicJsonSaveService(string rootDirectory, int maxSlots = 10)
    {
        if (string.IsNullOrWhiteSpace(rootDirectory)) throw new ArgumentException("Save directory is required.", nameof(rootDirectory));
        if (maxSlots <= 0) throw new ArgumentOutOfRangeException(nameof(maxSlots));
        RootDirectory = Path.GetFullPath(rootDirectory);
        MaxSlots = maxSlots;
        Directory.CreateDirectory(RootDirectory);
    }

    public string GetSlotPath(int slot) => Path.Combine(RootDirectory, $"save_{ValidateSlot(slot)}.json");
    public string GetBackupPath(int slot) => GetSlotPath(slot) + ".bak";

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
        var dto = JsonSerializer.Deserialize<SaveGameDto>(json, _jsonOptions)
            ?? throw new SaveFormatException("Save JSON contained no object.");
        if (dto.Version > SaveSchema.CurrentVersion) throw new SaveVersionException(dto.Version);
        if (dto.Version < SaveSchema.CurrentVersion)
            throw new SaveFormatException($"Save version {dto.Version} has no registered migration.");
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
        File.Copy(target, backup, overwrite: true);
        File.Move(temp, target, overwrite: true);
    }
}
