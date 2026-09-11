#!/usr/bin/env bash
# 批次 6b' 运行管线（对齐 HANDOFF §8 批次 6c 管线 + 7a-fix 口径）
# 1) dotnet build（B 领地 0 错前提；A 线半成品错会阻塞本管线）
# 2) 拷新 dll 进 data 目录；3) rebuild-embedded-pck.py 重建嵌入 pck；4) 跑模板 exe
set -e
PROJ="D:/素材/代号柒/SoudacheGodot"
cd "$PROJ"
dotnet build SoudacheGodot.csproj -v q 2>&1 | grep -E "错误|error" | sort -u || true
cp -f ".godot/mono/temp/bin/Debug/SoudacheGodot.dll" "data_SoudacheGodot_windows_x86_64/SoudacheGodot.dll"
python "_planning/evidence/6c-battle/rebuild-embedded-pck.py" "build/windows/升格会的的冬日猜想.exe.old" "build/windows/升格会的的冬日猜想.exe.new"
mv -f "build/windows/升格会的的冬日猜想.exe.new" "build/windows/升格会的的冬日猜想.exe"
echo "PIPELINE_OK"
