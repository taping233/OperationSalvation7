# 首页直连界面桌面视觉复核

老板授权实页检查并修改不合理处，随后指定正常桌面全屏比例，并追加「卡牌的新样式没有在仓库实装」。本轮使用 Codex 内置浏览器、既有 localhost:5200 服务，最终验收窗口为 1920×1080。完成未提交。

## 修正与实页结果

| 修正 | 已核实结果与证据 |
| --- | --- |
| 指南与留言信箱取消重复右上关闭键 | 共用返回键保留；[指南](desktop-guide-after.jpg)、[信箱](desktop-inbox-after.jpg) |
| 已完成留言取消整行淡化，增加正文字号与对比 | 历史内容可正常阅读；[信箱](desktop-inbox-after.jpg) |
| 指南出发顺序改为选择人物后整备卡牌 | 与当前基地入口流程一致；同步正文与机制图示；[指南](desktop-guide-after.jpg) |
| 基地补给说明提高对比与字号 | 浅纸底文字恢复深色、22px；[补给](desktop-base-supplies-after.jpg) |
| 人物页按剩余窗口高度设置展示区 | 展示区高度728，底端1049.8，页内scrollHeight/clientHeight均1004；人物完整可见，详情独立滚动；[人物](desktop-base-personnel-after.jpg) |
| 照相馆取消通用层多余导航左偏移 | 导航与照片分区中心偏差由11.7px降至0；[图库](desktop-studio-aligned.jpg) |
| 浅纸关闭键使用深图标 | PNG图标计算样式brightness(0)、opacity .7；[照片](desktop-studio-close-after.jpg) |
| 仓库容器沿用272/406全幅比例，数量移出卡面 | 神灯列表卡与容器均202.5625×302.35；数量y667.05，品质标签y354.81，零交叠；[仓库](desktop-warehouse-card-style-after.jpg) |

仓库新全幅样式实际已加载，史诗神灯的银墨SVG在列表、右侧详情及放大页可见；本轮修的是仓库适配中的数量遮挡和旧容器比例，没有替换已认可的卡面方案。[放大页](desktop-warehouse-epic-zoom-before.jpg)是在本轮仓库适配修正前采集，新卡面本身已出现。古朴无银墨装饰符合当前卡牌显示规则。

真实控件检查覆盖：首页入口、选档进入基地、基地分区、设置分类、成就总览与详情、制作名单、指南翻页、照片打开/收回与仓库浏览。仓库搜索无结果→清除筛选恢复5种原库存；待复原空态→返回卡牌仓库成功。照片空筛选→重置恢复，Esc收回后焦点回原照片；指南从第5页下一页到末页、从第2页上一页到首页，焦点均回对应目录按钮，禁用翻页键不会保留焦点。[建设](desktop-base-workshop-after.jpg)、[设置数据页](desktop-settings-data-after.jpg)已复核，无需布局修改。

仅浏览已有存档，未购买、出售、归档培养、升级、孵化、改设置、编辑备注或删除用户数据。未进行战斗/新局交付验收、真实鼠标悬停性能评测或多尺寸适配验收。

## 验证范围

- CSS五文件解析、指南JSON解析以及本轮两处JS语法检查通过。
- `docs:check`通过；自有目标diff空白检查通过。
- `tests/hub-pages-rework.test.js`：6项通过、2项失败。失败均在归档培养测试，测试mock未提供`window.SDT.Meta`，当前仓库代码读取`Meta.LEVEL_MAX`时报错；本轮没有改该交易实现或他会话测试文件。此套测试未全绿。
- 同文件针对本轮展示壳改动的「分页与资源更新保留同一个基地壳」用例：1项通过，其余7项明确跳过。
- 本轮内置tab5采集的console error为0；不据此声称其他标签或全项目无错误。
- 未运行全量测试、build、提交、推送或发布；未新建服务、未停止既有5200服务。

标准浏览器快照由当前内置页只读DOM采集，输入为[warehouse-browser-input.json](warehouse-browser-input.json)，通过`workflow browser import`入档至[正式快照](../2026-10-10-WF-linked-ui-visual-review-1010/browser-efc296ed-a8ba-4e2a-81af-d8268a1b5d1b-snapshot.json)。快照静态样式与截图不替代真实输入，本记录分别列出范围。

本目录保留早期1280×720及临时窄窗观察，均不作为最终桌面验收。早期部分`tab.screenshot()`截图延迟一帧，文件名可能不对应画面；最终采用`getScreenshot()`与新鲜页面状态。上述表格所列修正后截图及仓库放大截图为实际核实来源；其余before/current截图只保留过程，不据其作前后对比结论。
