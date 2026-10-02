# 一手制作与评估资料（首版）

核验日期：2026-10-02。15 条记录见 [records.json](records.json)。只在本分目录写入；未改游戏、未 build、未安装、未提交、未操作存档或服务。原文/视频均未下载，下载字节数为 0；JSON 是自写目录记录，不代表原始材料已落盘。

## 优先阅读

| 顺序 | 来源 | 对代号柒的具体帮助 | 核验范围 |
| --- | --- | --- | --- |
| 1 | [Slay the Spire 制作方平衡演讲](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics%EF%BB%BF) | 卡牌选取、胜率、难度与手感交叉诊断 | 官方简介；未观看完整视频 |
| 2 | [FTL 制作方复盘](https://gdcvault.com/play/1018034/Designing-Without-a-Pitch-FTL) | 先明确继续深入还是带资源撤退的核心感受，再判断系统价值 | 官方简介；未观看完整视频 |
| 3 | [Riot 原型制作](https://www.riotgames.com/en/r-and-d-office/prototype-building-a-games-substance) | 最小可玩骨架回答具体玩法问题，降低先做完整内容的成本 | 官方正文 |
| 4 | [Ubisoft 公开阶段流程](https://www.ubisoft.com/en-us/company/how-we-make-games/creative-process) | 以完整可玩体验划分 First Playable、Alpha、Beta | 官方正文；发布日期未知 |
| 5 | [GameDevBench v1](https://arxiv.org/html/2602.11103v1) | AI 修改需要规则断言与实际视觉反馈双重验证 | 固定 v1 HTML、研究方法及摘要 |

## 如何落到下一轮制作

以下为本资料库的项目适用推论，尚未实施或证明本项目需要改动：

1. 先写清一轮探索的体验目标及要回答的一个问题，例如“当前生命与背包价值是否让撤退选择有意义”，再决定观测数据。
2. 用本项目真实玩法规则验证卡牌与节点行为；模拟代理结果只说明该模拟策略下的表现。
3. 玩家访谈、边玩边说、数据分析各回答不同问题；不要以熟练代理的通关率替代新玩家理解成本。
4. AI 生成 UI、美术或行为后分别验视觉、交互和状态。研究基准提升的是特定任务表现，不能直接给本项目全局完成度背书。
5. 交付前冻结范围、给缺陷写影响与复现概率，实际版本走完整核心循环烟测；不照搬 AAA 的组织规模或时间表。

## 分类与证据边界

- **开发者复盘/访谈（5）**：Slay the Spire、Into the Breach、FTL、Darkest Dungeon、Hades 纪录片入口。前四条仅核验官方演讲简介，Hades 为工作室确认的纪录片入口；本轮没有逐集观看，未编造时间码。
- **大厂制作流程（3）**：Ubisoft 阶段流程、Riot 原型、2XKO 补丁生命周期。
- **评估方法（3）**：Xbox 研究方法采访、The Sims Mobile 代理试玩研究、主动学习参数调优。后两条论文核验摘要、作者、提交日期和许可，不宣称已完成全文方法复现。
- **AI 游戏制作（4）**：Grounded NPC 的 8 人探索研究、Xbox AI 制作观点、Genie 2 研究演示、GameDevBench 制作代理基准。观点和演示不当作受控效率实证。
- Ubisoft 与 Grounded NPC 页面没有明确页面发布日期，记录为 null；Grounded 页面提到 WordPlay 2022，只作为研究年代线索。
- GDC 页面显示通用会员提示，同时条目标注 free content；仅能确认简介可读，不推断视频本轮已经成功播放。
- 截至本轮没有必须绕过的访问限制；未尝试登录、付费或规避访问控制。

## 许可

全组 useStatus 都为 reference-only。GDC free content 不等于开源资产；各厂商文章未见开放素材复用许可。两篇旧 arXiv 论文为作者向 arXiv 授予的非独占分发许可，不是读者复用游戏代码/素材的许可证。GameDevBench v1 论文 HTML 标注 CC BY 4.0；该许可不自动覆盖其仓库、教程或第三方素材。这里只保留链接与自写短摘要，不分发视频、整篇文章或插图。

所有条目的 localFiles=[]、bytes=0、sha256=null 指原始下载文件不存在，不是下载失败被标成已拥有。实际源码/资源下载由其他资料分工负责。

