# 第一张壁纸替换

老板指定以本聊天去水印版本替换第一张主页壁纸。图片转为WebP（1672×941，431540 bytes），不裁切缩放；更新本条资产清单及CSS/预载缓存串，保留原有布局和切换逻辑。原图备份 before.webp，来源与SHA见 asset-source.json。生成源PNG超过1MB保留于记录中的路径，不入Git。

验证：title-wallpaper.test.js 5/5通过；新WebP完整解码、哈希与清单一致；本资产审计零问题。全局资产门被范围外 cards/spell-tt3-holy-water.webp 未登记阻断，未修改他会话素材。Codex内置浏览器 http://127.0.0.1:5200 当前1280×720窗口确认snow及snow-clean-1009资源、右下水印已消失，console error0；截图 current-window.png。无新增交互，未测其他尺寸。

完成未提交，不build。临时Vite服务PID14756/exec16636由本会话创建并在收官停止，端口复核无监听。

## 人物位置续调

老板令人物放到中间。第一壁纸以图中横向37.5%的面部焦点对齐窗口50%（background-position: calc(37.5% + 12.5vw) 56px）；保留纵向留白与原比例，用同图模糊延伸补齐横移边缘。第二壁纸保留原位置及延伸图片。title-wallpaper测试5/5通过；Codex内置浏览器当前606×958窗口目视人物面部居中，截图 centered-current-window.png；本轮未设置尺寸覆盖、未验其他尺寸。临时服务5200/PID10516/exec14604已停止，端口无监听。完成未提交。
