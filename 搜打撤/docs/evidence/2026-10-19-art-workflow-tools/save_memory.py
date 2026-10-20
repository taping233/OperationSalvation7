"""Apply the user-authorized small memory addition; preserve existing bytes and back up."""
import datetime
from pathlib import Path

folder = Path(__file__).resolve().parent
memory = Path(r'C:/Users/太平/.codex/memories')
topic = (folder / 'memory-entry.md').read_bytes()
summary = memory / 'memory_summary.md'
detail = memory / 'MEMORY.md'
marker = 'Task Group: 代号柒 单张皮肤接入与内置浏览器取证效率'.encode('utf-8')
summary_line = ('- 代号柒皮肤接入效率：皮肤接入、asset-audit、浏览器取证、退出码；入口 `D:\\素材\\代号柒\\搜打撤\\docs\\art-workflow-tools.md`，正文见 MEMORY.md 同名主题。\n').encode('utf-8')
for file, addition, check in [(detail, topic + b'\n', marker), (summary, summary_line + b'\n', '代号柒皮肤接入效率'.encode('utf-8'))]:
    before = file.read_bytes()
    if check in before:
        print(file.name + ': already indexed')
        continue
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup = file.with_name(file.name + '.bak-art-workflow-' + stamp)
    backup.write_bytes(before)
    if file.read_bytes() != before:
        raise SystemExit('Concurrent memory update; stop')
    if file == summary:
        first_line_end = before.index(b'\n') + 1
        file.write_bytes(before[:first_line_end] + b'\n' + addition + before[first_line_end:])
    else:
        file.write_bytes(addition + before)
    print(file.name + ': added; backup=' + backup.name)
