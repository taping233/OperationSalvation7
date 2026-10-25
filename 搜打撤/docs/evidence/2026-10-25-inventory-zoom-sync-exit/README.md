# 卡牌放大收起时资料同步淡出

原因：普通特写关闭类cz-out已有卡面、脚注和备注动画，但inventory-zoom-info整组资料没有退场，标题与效果正文会保持可见直到弹层移除。

仅在inventory-zoom.css补齐右侧资料栏czFadeOut，卡面和资料栏统一--motion-zoom-exit（默认260ms）、ease及零延迟；内层脚注不叠加单独退场。不改他人活跃card-zoom-controller.js或公共焦点、输入和移除生命周期。修改前副本.tmp/inventory-zoom-sync-exit-1025/before.css。按老板持续要求未验证，未构建、提交、推送或跨对话消息。
