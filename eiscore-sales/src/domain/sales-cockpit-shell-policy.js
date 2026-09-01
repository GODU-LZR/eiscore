// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const DESIGN_WIDTH = 1600
const DESIGN_HEIGHT = 900
const MIN_AVAILABLE_WIDTH = 320
const MIN_AVAILABLE_HEIGHT = 180
const MIN_SCALE = 0.2

export const buildSalesCockpitFrame = ({
  clientWidth = DESIGN_WIDTH,
  clientHeight = DESIGN_HEIGHT,
  paddingX = 0,
  paddingY = 0
} = {}) => {
  const availableWidth = Math.max(Number(clientWidth) - Number(paddingX), MIN_AVAILABLE_WIDTH)
  const availableHeight = Math.max(Number(clientHeight) - Number(paddingY), MIN_AVAILABLE_HEIGHT)
  const scale = Math.min(availableWidth / DESIGN_WIDTH, availableHeight / DESIGN_HEIGHT)
  const nextScale = Math.max(MIN_SCALE, Number(scale.toFixed(4)))
  return {
    scale: nextScale,
    width: Math.round(DESIGN_WIDTH * nextScale),
    height: Math.round(DESIGN_HEIGHT * nextScale),
    designWidth: DESIGN_WIDTH,
    designHeight: DESIGN_HEIGHT
  }
}
