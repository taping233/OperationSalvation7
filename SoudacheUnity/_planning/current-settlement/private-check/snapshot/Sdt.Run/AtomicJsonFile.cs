using System;
using System.IO;
using System.Text;

namespace Sdt.Run
{
    /// <summary>同目录临时写入与替换；替换前保留上一份完整文件。</summary>
    public static class AtomicJsonFile
    {
        public static bool TryWrite(string path, string json, out string error)
        {
            error = null;
            var temporary = path + ".writing";
            try
            {
                var directory = Path.GetDirectoryName(Path.GetFullPath(path));
                Directory.CreateDirectory(directory);
                using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    var bytes = new UTF8Encoding(false).GetBytes(json);
                    stream.Write(bytes, 0, bytes.Length);
                    stream.Flush(true);
                }
                if (File.Exists(path)) File.Replace(temporary, path, path + ".previous", true);
                else File.Move(temporary, path);
                return true;
            }
            catch (Exception exception)
            {
                error = exception.Message;
                return false;
            }
        }
    }
}
