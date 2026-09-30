/* motion-primitives.js —— 纯时间函数动效原语（数字进、数字出）。
 * 接口形制参照 GitHub onetake 项目（feitangyuan/onetake）lib/motion.js 的设计约定：
 * 原语=纯时间函数、无 DOM、无状态、无随机，同参数恒同结果；实现为本项目自研代码
 * （onetake 为 PolyForm Noncommercial 许可，未复制其任何代码）。
 * 消费方式与全站既有手法一致：DOM 侧预采样成 WAAPI 关键帧（同 battle.vfx.js 的
 * stsShake/physicsFloat），canvas 侧逐帧采样（同 drawIcons 的呼吸缩放）。时间单位=秒。 */

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* 曲线族：t80 注记 = 多小比例的时长走完 80% 路程（小=先甩后稳的落定感，大=对称缓动）。
 * 选型口径：镜头腿/位移用对称 S（起停都在静止），入场/落点用 out 系（快起缓收）。 */
const ease = {
  linear: u => u,
  smooth: u => u * u * (3 - 2 * u),                                            // t80≈.71 对称 S
  smoother: u => u * u * u * (u * (u * 6 - 15) + 10),                          // t80≈.67 对称 S（收得更稳）
  cubicOut: u => 1 - Math.pow(1 - u, 3),                                       // t80≈.42
  quintOut: u => 1 - Math.pow(1 - u, 5),                                       // t80≈.28
  cubicInOut: u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2), // 相机移动腿：起停在静止
};

/* 欠阻尼二阶系统对单位阶跃的响应：0→1，带一次过冲后回稳；形态由 zeta（阻尼比，<1 才过冲）
 * 与 omega（固有角频率，越大越快）决定。omega=18、zeta=.62 时约 0.35s 收敛、过冲 ~8%。 */
function spring({ zeta = 0.6, omega = 18 } = {}) {
  const z = Math.min(0.99, Math.max(0.05, zeta));
  const wd = omega * Math.sqrt(1 - z * z);
  return (t) => {
    if (!(t > 0)) return 0;
    return 1 - Math.exp(-z * omega * t) * (Math.cos(wd * t) + (z * omega / wd) * Math.sin(wd * t));
  };
}

/* spring 收敛时长（毫秒）：|1-f(t)| 首次小于 eps 的时刻——驱动器窗口/兜底清理据此取值，不手拍秒数 */
function settleMs({ zeta = 0.6, omega = 18, eps = 0.02 } = {}) {
  const z = Math.min(0.99, Math.max(0.05, zeta));
  return Math.ceil(-Math.log(Math.max(1e-6, eps)) / (z * omega) * 1000);
}

/* 弧线跳跃：from→to 按曲线插值 + 抛物拱抬升（height*4h(1-h)，中点最高、两端落地）。
 * u∈[0,1] 归一化进度入参；返回世界/屏幕坐标点。用于「卡牌收进背包」这类 carry 演出采样。 */
function hopPoint(u, from, to, { height = 120, curve = ease.smoother } = {}) {
  const h = clamp01(curve(clamp01(u)));
  return {
    x: from.x + (to.x - from.x) * h,
    y: from.y + (to.y - from.y) * h - height * 4 * h * (1 - h),
  };
}

/* 接触衰减振荡：t0 时刻受力后的回弹包络（幅度 amp 指数衰减 + 频率 freq 正弦）。
 * 用于接收方的弹性 pop（scale = 1 + decayOsc(...)）。静置期（t<t0）恒 0。 */
function decayOsc(t, t0, { amp = 0.16, decay = 9, freq = 13 } = {}) {
  const dt = t - t0;
  if (!(dt > 0)) return 0;
  return amp * Math.exp(-decay * dt) * Math.sin(2 * Math.PI * freq * dt);
}

export { clamp01, decayOsc, ease, hopPoint, settleMs, spring };
