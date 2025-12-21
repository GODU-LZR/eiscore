// src/utils/theme.js

/**
 * 颜色混合函数
 * @param {string} c1 颜色1 (Hex)
 * @param {string} c2 颜色2 (Hex)
 * @param {number} ratio 混合比例 (0-1)
 */
// ... mix 函数保持不变 ...
export const mix = (c1, c2, ratio) => {
  ratio = Math.max(Math.min(Number(ratio), 1), 0)
  const r1 = parseInt(c1.substring(1, 3), 16)
  const g1 = parseInt(c1.substring(3, 5), 16)
  const b1 = parseInt(c1.substring(5, 7), 16)
  const r2 = parseInt(c2.substring(1, 3), 16)
  const g2 = parseInt(c2.substring(3, 5), 16)
  const b2 = parseInt(c2.substring(5, 7), 16)
  
  let r = Math.round(r1 * (1 - ratio) + r2 * ratio)
  let g = Math.round(g1 * (1 - ratio) + g2 * ratio)
  let b = Math.round(b1 * (1 - ratio) + b2 * ratio)

  r = ("0" + (r || 0).toString(16)).slice(-2)
  g = ("0" + (g || 0).toString(16)).slice(-2)
  b = ("0" + (b || 0).toString(16)).slice(-2)

  return "#" + r + g + b
}

/**
 * 设置主题色
 * @param {string} color 主色 (Hex)
 */
export const setThemeColor = (color) => {
  const el = document.documentElement
  const pre = '--el-color-primary'
  
  // 1. 设置主色
  el.style.setProperty(pre, color)
  
  // 2. 混合生成 Light 系列 (用于 hover, border 等)
  for (let i = 1; i <= 9; i++) {
    el.style.setProperty(`${pre}-light-${i}`, mix(color, '#ffffff', i / 10))
  }
  
  // 3. 混合生成 Dark 系列 (用于 active 状态)
  el.style.setProperty(`${pre}-dark-2`, mix(color, '#000000', 0.2))

  // --- 4. 🔴 新增：覆盖菜单相关的特定变量 ---
  // 让菜单选中的背景色，变成淡一点的主题色 (仅影响使用了 var(--el-menu-hover-bg-color) 的地方)
  // 注意：Element Plus 默认菜单 hover 是灰色，如果你想让 hover 变成淡主题色，可以解开下面这行
  // el.style.setProperty('--el-menu-hover-bg-color', mix(color, '#ffffff', 0.9))
  
  // 设置一个全局通用的 CSS 变量，方便我们在自己的 css 里用
  el.style.setProperty('--primary-color', color)
}