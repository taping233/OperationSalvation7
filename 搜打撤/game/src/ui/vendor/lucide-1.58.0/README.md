# Lucide 1.58.0：layers-plus

仅引入一个装饰图标，不安装 npm 图标库。获取日期：2026-10-17。

- SVG：https://raw.githubusercontent.com/lucide-icons/lucide/1.58.0/icons/layers-plus.svg
- 原许可：https://raw.githubusercontent.com/lucide-icons/lucide/1.58.0/LICENSE
- 上游项目：https://github.com/lucide-icons/lucide
- layers-plus.svg：540 字节；SHA256 `96fb0cc0a8ceb75aab8316d42622527d923d3a96658cc2932fe628dc22671530`
- LICENSE.txt：3208 字节；SHA256 `b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57`

两个文件均保留获取时的原字节。许可包含 ISC 条文和上游附带的 Feather 版权说明，全文随分发保留，不截取或改写。

本项目使用位置：战斗手牌同叠「入手 +N」与其他栏「新增 N」提示；由 `ui/lucide-acquisition-icon.js` 静态导入 SVG 原文，在 DOM 实例设置 16×16、aria-hidden=true、focusable=false、类名和本地许可 URL。SVG 自带 currentColor，颜色由现有黑蓝/冰白提示继承；原 SVG 文件不修改。图标不承载独立语义，数字和 ARIA 文本保留在相邻节点。

打包：SVG 以 ?raw 内联到模块；原许可使用 ?url&no-inline，生成独立 LICENSE-*.txt，图标 data-license 属性引用该本地分发文件。不加载远程图标，不复制整库。独立 Vite write:false 探针验证所需 SVG 内容与原许可均保留，记录在 docs/evidence/2026-10-17-lucide-feedback/；该探针不代表整项目构建验收。
