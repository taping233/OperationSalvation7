
# Task Group: 代号柒 NAI 网络与画风试验

scope: `D:\素材\代号柒\搜打撤` 的 NAI 客户端、Codex Windows 沙箱和无立绘 4.5 对照。
applies_to: network failure diagnosis and prompt comparison; current status lives in `tools/NAI-PROMPTS.md` and `docs/evidence/2026-10-13-wu-nai45-prompt-compare/README.md`.

## Task 1: 2026-10-13 NAI 4.5 四版同 seed 对照与 HTTP 000 诊断

### keywords

- NAI, NovelAI, 代理, HTTP 000, image.novelai.net, HTTPS_PROXY, miv4t, quasarcake, 无立绘, 4.5

## Reusable knowledge

- `HTTP 000` 只表明 curl 没拿到 HTTP 响应。先读退出码与 stderr，再用不带 token 的探针区分宿主 shell、Python 子进程、直连和代理。2026-10-13 宿主 PowerShell 到 NAI 返回 401，普通 Codex 沙箱 Python 子进程分别报 DNS 6 和代理连接 7；单次获准的扩展权限运行同一 `nai_gen.py` 请求则返回 200。[Task 1]
- 当前 `nai_gen.py` 从环境 `HTTPS_PROXY` / `ALL_PROXY` 取代理，不再硬编码旧端口。持续项目网络配置即使写了域名白名单，本轮测试仍未能证明拦截非 NAI 连接；配置已恢复原字节，不应把实验补丁当成修复。需要当前授权时对特定命令申请扩展权限，仍走 `nai_guard` 节流与额度。[Task 1]
- 无立绘 4.5 的四张同 seed 图中，缩短画风块的 B 只是候选；单画师 C 过平，降低 guidance 的 D 未改善背剑结构。没有老板选择或跨 seed 稳定性证据，不修改 `nai_style.py` 默认。[Task 1]
