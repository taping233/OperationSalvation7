# 卡牌右下金币图标

共享卡面金币图标从6cqw放大到10cqw（约1.67倍），图标与币值间距从1.2cqw缩至.6cqw；显式保持图片比例和独立尺寸。币值数字、右下角锚点、金币素材和URL沿用。

仅修改game/css/card-layout-selected.css；修改前副本.tmp/card-coin-scale-1025/before.css。按老板持续要求未验证，未构建、提交或推送。

## 最新：取消币值底框

hsc-val背景透明，取消边框、圆角与阴影；数值改深金棕以适应卡纸背景。保留目前14cqw金币图标、数值字号、右下锚点和间距。修改前副本.tmp/card-coin-frameless-1025/before.css。按老板持续要求未验证，未提交。

## 最新：黑底金字

按老板最新要求恢复币值底板：近黑背景#090b0ef2、金色数值#f0cf78和细金边。保留14cqw金币图标、数值字号、间距与右下锚点。修改前副本.tmp/card-coin-black-gold-1025/before.css；按老板持续要求未验证，未提交。

## 最新：缩小黑底

币值容器改透明，黑底与细金边移至内缩伪元素：上下3.7cqw、左5cqw、右.6cqw。保留图标与数值布局，黑底不完全包住金币。修改前副本.tmp/card-coin-compact-plate-1025/before.css；按要求未验证，未提交。

## 最新：金币突出小黑框

金币图像在14cqw布局占位上以中心额外scale(1.25)，视觉再大25%，小黑底、金字和数值位置不随之增大。修改前副本.tmp/card-coin-overhang-1025/before.css；按要求未验证，未提交。

## 最新：继续放大金币

图像scale从1.25提高到1.55，较上次再大24%；布局占位、黑底框与金字不变。修改前副本.tmp/card-coin-overhang-larger-1025/before.css；按要求未验证，未提交。

## 最新：当前大小再放大一半

按老板要求，图像scale从1.55提高至2.325，即在当前大小上再增加50%；布局占位、黑底框与金字不变。修改前副本.tmp/card-coin-plus-half-1025/before.css；按要求未验证，未提交。
