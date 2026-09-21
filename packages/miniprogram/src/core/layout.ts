import type { Rect, TipLayout } from './types'

export const PAD = 6
export const TIP_WIDTH_RPX = 512
export const TIP_EST_HEIGHT = 150
export const GAP = 12
export const MARGIN = 12

/** 高亮孔：目标矩形外扩一圈留白 */
export function computeHole(target: Rect, pad = PAD): Rect {
  return {
    x: target.x - pad,
    y: target.y - pad,
    width: target.width + pad * 2,
    height: target.height + pad * 2,
  }
}

/**
 * 气泡摆放：优先放在目标下方，放不下移到上方；
 * 上下都放不下时（目标近乎占满屏幕）叠进高亮区顶部内侧，箭头朝上指向目标。
 * left 与箭头位置均做视口边缘钳制。
 */
export function placeTip(
  hole: Rect,
  tipWidth: number,
  tipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = MARGIN,
  gap = GAP,
): TipLayout {
  const fitsBelow = hole.y + hole.height + gap + tipHeight < viewportHeight
  const fitsAbove = hole.y - gap - tipHeight >= margin
  const below = fitsBelow || !fitsAbove
  const top = fitsBelow
    ? hole.y + hole.height + gap
    : fitsAbove
      ? Math.max(margin, hole.y - gap - tipHeight)
      : hole.y + gap + 8
  const left = Math.min(
    Math.max(margin, hole.x + hole.width / 2 - tipWidth / 2),
    viewportWidth - tipWidth - margin,
  )
  const arrowLeft =
    Math.min(Math.max(left + 18, hole.x + hole.width / 2 - 5), left + tipWidth - 23) - left
  return { top, left, below, arrowLeft }
}

export interface ScrollPrediction {
  finalScroll: number
  /** 滚动到位后目标的预测视口纵坐标 */
  viewY: number
}

/**
 * 预测把目标滚动进视口后的停留位置。
 * 页面内容底部已接近视口底部时滚不到理想位置，按钳制后的停留点摆放，
 * 避免滚动结束后再跳一次；pageHeight 未知时不做钳制补偿。
 */
export function predictScroll(input: {
  rectY: number
  rectHeight: number
  scrollTop: number
  pageHeight?: number | null
  viewportHeight: number
  tipEstHeight?: number
  margin?: number
  gap?: number
}): ScrollPrediction {
  const margin = input.margin ?? MARGIN
  const gap = input.gap ?? GAP
  const tipEst = input.tipEstHeight ?? TIP_EST_HEIGHT
  const fitsBelow =
    input.viewportHeight - margin - tipEst - gap - input.rectHeight >= margin
  const desiredY = fitsBelow
    ? input.viewportHeight - margin - tipEst - gap - input.rectHeight
    : margin + tipEst + gap
  let finalScroll = Math.max(0, input.scrollTop + (input.rectY - desiredY))
  if (input.pageHeight && input.pageHeight > input.viewportHeight) {
    finalScroll = Math.min(finalScroll, input.pageHeight - input.viewportHeight)
  }
  return { finalScroll, viewY: input.rectY - (finalScroll - input.scrollTop) }
}

export interface Placement {
  hole: Rect
  tip: TipLayout
}

/**
 * 位置没有实质变化时返回 true，调用方据此跳过 setState，
 * 避免 CSS 过渡造成气泡/高亮孔二次移动。
 */
export function samePlacement(
  a: Placement,
  b: Placement,
  tolerance = 1.5,
): boolean {
  const near = (x: number, y: number) => Math.abs(x - y) < tolerance
  return (
    near(a.hole.x, b.hole.x) &&
    near(a.hole.y, b.hole.y) &&
    near(a.hole.width, b.hole.width) &&
    near(a.hole.height, b.hole.height) &&
    near(a.tip.top, b.tip.top) &&
    near(a.tip.left, b.tip.left) &&
    a.tip.below === b.tip.below &&
    near(a.tip.arrowLeft, b.tip.arrowLeft)
  )
}
