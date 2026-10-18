# 无：A / D 画风候选对照

2026-10-16，老板授权用无生成现行版、A 向、A＋D 向三组对照并补一张日间场景；随后明确更喜欢原始参考 D，第三、四张采用 D 主导方案。此批只交候选，不改共享配方、不替换游戏素材。

## 输入与比较边界

- 身份来自 `docs/character-bible/wu.md` 现行段及实际查看的 `game/assets/portraits/full/wu.webp`。参考未上传，按现行身份转成角色标签；没有使用 Vibe 或图生图身份锁定。
- A 来源：法典图鉴 `nai5_community_pack_mengshen_korean_0045`；D 来源：`nai5_community_pack_mengshen_september_2026_0662`，均为社区样图。
- 共用未来城市冬季观景台、无坐姿、角色槽、种子1771067347、NAI V5 Full、1216×832、Euler A、28步、CFG5.5、CFG rescale0、karras、Variety+关闭及同一质量尾/负面。采用免费档像素范围，未尝试大图。
- 01沿当前NAI配方v3.4；02改A向画师链与画法；03改D主导的画师链与画法；04仅将03的夜间光照换成日间。三组属于整体方案比较，不能单独归因到某位画师。固定种子不保证改词后构图不变。
- 原始请求、每张状态、全部非凭据payload、PNG与网页副本SHA256记录于 [request.json](request.json)；复现入口 [generate.py](generate.py)。脚本拒绝覆盖已有候选，不应整批重放。

## 交付与存储

原始PNG位于仓库根 `.tmp/nai/wu-style-AD-20261016/`，均按请求记录获取，不入Git。网页压缩副本和页面位于本聊天仓库外可视化目录 `arknights-style`，复用5347本地服务。页面保留原始A、D参考和上一轮参考入口，支持大图切换、多选及复制选择。

本轮画师链只存在于候选脚本和请求记录，现行 `tools/nai_style.py`、角色设定与游戏素材均未编辑。最终选择和配方落库等待老板看图后决定。
