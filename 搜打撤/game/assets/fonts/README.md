# 内嵌字体

## HarmonyOS Sans SC

界面正文首选 HarmonyOS Sans SC，Noto Sans SC 子集作为回退。项目内的 Regular、Bold 为华为[官方 HarmonyOS Sans 字体包](https://developer.huawei.com/consumer/cn/design/resource-V1/)中的未修改原版文件，随附 `LICENSE-HarmonyOS-Sans.txt`。版权归 Huawei Device Co., Ltd. 所有；字体依据 HarmonyOS Sans Fonts License Agreement 随游戏使用和分发。

## 其他字体（OFL）

- `cascadia-code-400/700.woff2`：Cascadia Code（微软终端字体）子集，OFL；来源 C:\Windows\Fonts（https://github.com/microsoft/cascadia-code）
- `notosans-sc-400/700.woff2`：Noto Sans SC（思源黑体同源）按项目文本子集（1704 字形），OFL；来源本机 NotoSansSC-VF.ttf 实例化（wght 400/700）
- 子集重建：`pyftsubset`（fonttools）；字符集 = 项目全部 src/css/html/ink 文本 + ASCII + 常用符号。
  新增文案含生僻字时会回退 "Microsoft YaHei"，视觉差异可接受；必要时重跑子集化。
