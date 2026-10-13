# 代号柒 NAI 网络诊断经验（2026-10-13）

- 适用：`D:\素材\代号柒\搜打撤` 的 `tools/nai_gen.py` 与 Codex Windows 命令沙箱。现行能力和任务状态以项目 `tools/NAI-PROMPTS.md`、`docs/evidence/2026-10-13-wu-nai45-prompt-compare/README.md` 复核。
- `HTTP 000` 只是 curl 未拿到 HTTP 响应，不能据此断言代理端口过期。先看 curl 退出码和 stderr，再用不带 token 的 POST 探针分别检查宿主 shell、Python 子进程、直连与代理。
- 本次宿主 PowerShell 到 NAI 返回 401（无凭据，说明到达端点），普通沙箱 Python 子进程直连 DNS 6、连本机代理 7；同一 NAI 客户端经单次扩展权限返回 HTTP 200。当前 `nai_gen.py` 从环境 `HTTPS_PROXY` / `ALL_PROXY` 取代理，不硬编码端口。
- 项目级持续网络权限不等于域名隔离；本次两个白名单试验仍允许非 NAI 连接，已恢复 `.codex/config.toml` 原始字节。不要把实验配置当成已验证修复。需当前授权时对特定 NAI 命令申请网络权限，仍走 `nai_guard` 节流和额度。
- 无立绘 4.5 同 seed 四版比较中，缩短风格块的 B 是候选而非已确认通用配方；单画师 C 过平，降低 guidance 的 D 未改善持剑结构。老板审美选择与跨 seed 稳定性未完成，不改 `nai_style.py` 默认。

后续：老板已明确授权代号柒项目访问任意公网域名。根 `.codex/config.toml` 已追加 `[sandbox_workspace_write] network_access = true`，只作用于该项目；当前配置和备份核验见项目证据 README。新沙箱中 Windows curl 的 Schannel 仍失败，`nai_gen.py` 现默认 Python requests 直连并在 000 时试环境代理，`NAI_TRANSPORT=curl` 可显式回退。未经传输覆盖的默认 `generate_image` 已在新沙箱完整出图 HTTP 200，保持 `nai_guard`。此前白名单试验及「配置已恢复」描述只对应授权前阶段。
