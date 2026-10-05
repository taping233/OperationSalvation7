# WF-xart-z1 首批执行报告：Codex 移交收尾 + 三线研究 + 三个实施批次

2026-10-03，Friday（ZCode 侧）。HEAD 425d03920e，混树（多会话完成未提交共存，本会话未提交）。

## 玩家可见变化（本会话全部改动）

### 接手收编（Codex exec 已停止，老板令收尾）
- 盘点 Codex exec 15 文件在途改动：**46/46 定向测试全绿**（frames/pouch/stats/recorder/probe 六文件）、三文件 node --check 通过、altar 叠加态（PH1-sys02 回执 + Codex 文案）自洽。它声称"vitest 无法运行（spawn EPERM）"不成立，本会话补验通过。
- **A7 性能探针补验**：tests/perf-probe-summary.test.js 11/11 绿（Codex 侧从未跑成）。
- **A5 消费统一实页验证**（它实施后未验）：真实撤离链（构造路径 doExtract 触发）走通 整理→回执结算→回基地 全链，「保本返回·撤离成功」收束+回执数字（真实入库 2 张/首探经验+22/抵达第1层）全读回执。证据 a5-live-extraction.md + 结算页截图。
- 冒烟定稿：游戏链路全通；FACTS B01 战斗按钮裁切在 1280×720 未复现（B01 结论只在 755×586 窗口成立）；战斗图「无」与认可立绘身份差异属实（A4 依据确认）。

### 批次1 · 四小修（源码 + 6 测试）
| 发现 | 修法 | 文件 |
| --- | --- | --- |
| A6-ACH-01 成就/收藏领取失败静默（仓库满/存档写失败无反馈，像坏按钮） | claimAch 补 else 分支消费 r.msg；claimColl 补 save 失败分支 | game.hub.js:287-293,305-311 |
| A3-PREP-01 预设资格失败无原因（「需要处理·0缺失·0禁带」无从修复） | prep-summary 追加 qualificationHints（人物/宠物未收录/未拥有原因行）+ .prep-qual-hint 样式 | preparation.view.js:11-24,18 |
| A6-MENU-01 右键留言基地商店页签识别缺失 | tabName 映射补 shop | game.menu.js:127 |
| A3-ALTAR-01 祭坛道具路径复原页误显「营火休整」 | openPocketRestore 道具路径传 opts（tone/icon/title 跟祭坛身份） | game.run.altar.js:505-509 |

### 批次2 · 三项表现增强（源码 + 5 测试）
| 发现 | 修法 | 文件 |
| --- | --- | --- |
| A5-DEATH-01 死亡页不展示关键损失明细（对照撤离页有逐名表达） | doom-panel 顶部补 losses 行读 token.receipt.losses（散失 N 张含传说/史诗逐名+口袋散失） | game.session.death.js:152-161 |
| A5-EXSTASH-01 整理页不区分带入卡（未入库即永久损失却与局内散卡同呈现） | ext-card 加「带入 ×N」角标（o.brought 按名聚合）+title 说明，样式 .ext-brought | game.run.altar.js:864-880 + winter.css |
| A3-PREP-02 预设预览按种类数计容、手动路径封顶口径错（「局内叠放上限」描述不存在的规则） | previewDeployment 改分段占格 ceil(count/cap)+extraStackSlots 字段；摘要显示「占 N 格（同名超限多占 N 格）」；depart 手动封顶与帮助文案改「每格叠放上限，局内超出另占一格」 | preparation.commands.js:77-91 + preparation.view.js:18 + game.hub.depart.js:219-226,138 |

### 批次3 · 五小修（源码，复用既有测试面验证）
- A3-SHOP-01：商店买不下/补不了文案改真实口径（分段占格，不再教玩家不存在的全局叠上限）。
- A5-EXRETRY-01：撤离重试页补「撤离前局面已保存，退出重进安全」兜底说明（SYS-10 同款）。
- A6-STASH-01：口袋复原按钮可用性改按真实钥匙储备 data.keys 判定（原 keyCount() 折算材料卡会亮按钮但点击报不足）。
- A6-STASH-02：仓库材料「使用/卖出」命令失败分支补 warn 提示（原静默关弹层无解释）。

## 实际检查（验证记录）

- **定向测试**：本会话新增 2 测试文件 11 例全绿；关联回归 63+49+54 例三轮全绿（preparation/hub/collection/menu/extraction/death/sys03/terminal/retry 系列）。
- **实页验证**（ZCode 内置浏览器 1280×720，5340 独立 origin 档01）：
  - 撤离回执链全通 + 结算页截图；死亡页损失明细行实页生效（「散失：卡牌 13 张（含【毒爆】【银河之旅】【毒杖】）· 口袋散失 1 张」）+ 死亡页截图；预设摘要新「占 1 格」文案实页生效；未拥有人物→canStart=false 构造预览验证通过。
- **三线研究工作流**（dwfrun-c89eba8c）：A6 22 页签/A5 11 页/A3 13 页，16 发现（5 medium 全部经独立复核员复现 verified，其中预览失真经 ssrLoadModule 实跑证实），汇总 RESEARCH-SUMMARY.md。

## 性能影响

- 本会话改动全部为文案/提示/分支消费/预览计算（O(n) 聚合 n=手牌或仓库内同名），无新渲染路径、无新监听/计时器、无图片/动画新增。页面负载与改动前无可测差异（未采样数值——探针已有，数值采样按 A7 计划归独立测量批次）。
- 死亡页 lossRow 与整理页角标为静态 DOM 单节点增量，不构成性能风险。

## 未核项与移交说明

1. A6-ACH-01/A3-ALTAR-01/A5-EXSTASH-01 的实页复现需构造场景（仓库满/走到祭坛/带卡撤离），行为已由测试钉死；实页留待后续批次顺带覆盖。
2. clear（首脑突破）收束页、保存失败注入链实页未验。
3. 低优先级发现仍开放：A5-DEATH-02（死亡页抢运张数与回执口径分歧，珍珠盒边界）、A5-ABANDON-01（放弃页/死亡页抢运清单视觉不一致——归 A2 结算样板统一）、A3-PREP-03/04（预设人物字段空转、busy 态）、A3-SRC-01（evidenceRef 四处漂移，维护性）。清单见 RESEARCH-SUMMARY.md。
4. coverage.json 未动（executionOwner=WF-experience-art-exec；本会话域结论自记本目录，供其收口或老板改判后合并）。
5. battle-v2 资产、VISUAL-BIBLE/nai_style.py 规范修订为 Codex exec 在途内容，本会话盘点未续写（A2/A4 主线，见其 art-spec.json/art-sample.json）。
6. 服务 5340（PID15172）保留，档01 为本会话测试档（含构造路径痕迹，非真实存档）。
