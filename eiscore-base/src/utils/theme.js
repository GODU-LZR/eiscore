// src/utils/theme.js

// 混合函数 (保持不变)
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

export const setThemeColor = (color) => {
  const el = document.documentElement
  const pre = '--el-color-primary'
  
  // 1. 基础设置
  el.style.setProperty(pre, color)
  for (let i = 1; i <= 9; i++) {
    el.style.setProperty(`${pre}-light-${i}`, mix(color, '#ffffff', i / 10))
  }
  el.style.setProperty(`${pre}-dark-2`, mix(color, '#000000', 0.2))
  el.style.setProperty('--primary-color', color)
  
  // --- 🔴 核心修改区 ---
  
  // 1. 页面背景色 (原先的卡片微光)：95% 白 + 5% 主题色
  // 这会让整个大背景带有一层极淡的滤镜
  el.style.setProperty('--page-bg-tint', mix(color, '#ffffff', 0.95))
  
  // 2. 卡片/组件背景色 (加深)：85% 白 + 15% 主题色
  // 这比背景深 3 倍，能明显区分出"卡片"和"底色"
  el.style.setProperty('--card-bg-tint', mix(color, '#ffffff', 0.85))
}