using System;
using System.IO;
using Sdt.Run;

var directory = Path.Combine(AppContext.BaseDirectory, "cases-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(directory);
var file = Path.Combine(directory, "slot1.json");
void Require(bool value, string message) { if (!value) throw new Exception(message); }
Require(AtomicJsonFile.TryWrite(file, "{\"coins\":1}", out var error), "initial save: " + error);
Require(File.ReadAllText(file) == "{\"coins\":1}", "initial bytes");
Require(AtomicJsonFile.TryWrite(file, "{\"coins\":2}", out error), "replace save: " + error);
Require(File.ReadAllText(file) == "{\"coins\":2}", "replaced bytes");
Require(File.ReadAllText(file + ".previous") == "{\"coins\":1}", "previous complete save retained");
using (var locked = new FileStream(file, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
    Require(!AtomicJsonFile.TryWrite(file, "{\"coins\":3}", out error) && !string.IsNullOrEmpty(error), "locked target must report failure");
Require(File.ReadAllText(file) == "{\"coins\":2}", "failed save preserved primary");
Require(File.ReadAllText(file + ".previous") == "{\"coins\":1}", "failed save preserved backup");
Require(AtomicJsonFile.TryWrite(file, "{\"coins\":4}", out error), "retry after failed write: " + error);
Require(File.ReadAllText(file) == "{\"coins\":4}", "retry bytes");
Require(File.ReadAllText(file + ".previous") == "{\"coins\":2}", "retry retained last good save");
Console.WriteLine("PASS new save / replace / backup / failure protection / retry; " + directory);
