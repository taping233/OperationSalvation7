
## Task 2: 老板明确授权后的项目级网络修复

### keywords

- NAI, NovelAI, network_access, requests, Schannel, 新沙箱, 4.5

## Reusable knowledge

- 老板在 2026-10-13 明确授权代号柒项目访问任意公网域名。根 `.codex/config.toml` 只追加 `[sandbox_workspace_write] network_access = true`，保留时间戳备份并验证 TOML 与原字节前缀；这是项目级广泛网络权限，先前白名单试验仍只作失败诊断。当前配置与实测以项目证据 README 为准。[Task 2]
- 新 Codex 沙箱里 Windows curl 的 Schannel 仍报 `SEC_E_NO_CREDENTIALS`，所以仅改网络权限不足以让旧默认客户端生图。`tools/nai_gen.py` 改为默认 Python requests 直连，失败 000 后按环境代理重试；`NAI_TRANSPORT=curl` 保留显式旧通道。默认 `generate_image` 未注入 transport 的 4.5 完整请求在新沙箱 HTTP 200，图片尺寸与 SHA256 已验；`nai_guard` 节流和额度未绕过。旧聊天沙箱可能维持旧权限，验证新设置用新沙箱。[Task 2]
