# 战斗二级背景隔离

老板实报发现轻退焦会透出地图。同源原因是发现/牌堆把整个 retained stage 设为 opacity .72，而公共二级外壳和 card 本身透明；合成时底层地图会参与画面。

本次只改 `battle-discover.css`、`battle-pile-view.css`：在对应战斗二级页存在时，`#ovBody` 使用不透明 `#10161b` 战斗底板，并设置 isolate/hidden 裁切。保留原 7 px blur、.72 stage opacity 和暗罩，透明战场像素现在仅和不透明战斗底板合成，不依靠加大虚化隐藏地图。卡牌、发现输入门、效果、JS 接线及公共 secondary-overlay 文件均未修改。

注能只降低 arena 的透明度，外层 stage 本身保留不透明背景；未发现同源透图缺口，未修改注能 CSS。编辑前 scoped handoff 覆盖三张模式 CSS，退出 0、相关活跃占用 0，既有改动归属沿用。

实际验证：专属布局、牌堆可读性、二级页、发现保留反馈四文件 34 例全部通过，退出 0；新增回归核对发现/牌堆均存在不透明、隔离、裁切底板且保持认可的轻退焦参数。目标测试 ESLint、CSS PostCSS 解析、实际字节尾空白检查和 tracked diff-check 均退出 0；未构建或启服务。

最终两张 CSS 的逐字节副本和 SHA256 位于 `background-isolation-source/sha256.json`。父会话同步后以构造发现样本及自然入城真实地图复验；本子代理尚未作实页通过判断。
