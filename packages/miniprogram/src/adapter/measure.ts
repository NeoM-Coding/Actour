import Taro from '@tarojs/taro'
import type { Rect, Snapshot } from '../core/types'

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const normalizeRect = (res: unknown): Rect | null => {
  const rect = (Array.isArray(res) ? res[0] : res) as {
    left: number
    top: number
    width: number
    height: number
  } | null
  return rect && rect.width != null
    ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    : null
}

/**
 * 单次 exec 同步测出目标元素、当前滚动位置和页面根节点，
 * 得到的是同一帧快照，避免多次独立查询之间因页面滚动/动画导致数值互相矛盾。
 * scrollRootSelector 用于滚动钳制补偿（页面内容高度），传 null 则跳过该测量。
 */
export const snapshot = (selector: string, scrollRootSelector?: string | null) =>
  new Promise<Snapshot>((resolve) => {
    let rect: Rect | null = null
    let pageRect: Rect | null = null
    let scrollTop = 0
    const query = Taro.createSelectorQuery()
    query.select(selector).boundingClientRect((res) => {
      rect = normalizeRect(res)
    })
    if (scrollRootSelector) {
      query.select(scrollRootSelector).boundingClientRect((res) => {
        pageRect = normalizeRect(res)
      })
    }
    query
      .selectViewport()
      .scrollOffset((res) => {
        scrollTop = (res as { scrollTop?: number } | null)?.scrollTop ?? 0
      })
      .exec(() => resolve({ rect, scrollTop, pageRect }))
  })

/**
 * 轮询测量：元素未渲染出来时重试，坐标稳定（页面滚动/进入动画结束）后才返回，
 * 避免把动画中间的坐标当成最终位置。
 */
export const stableSnapshot = async (
  selector: string,
  scrollRootSelector?: string | null,
) => {
  let snap = await snapshot(selector, scrollRootSelector)
  for (let attempt = 0; !snap.rect && attempt < 4; attempt++) {
    await sleep(120)
    snap = await snapshot(selector, scrollRootSelector)
  }
  for (let attempt = 0; snap.rect && attempt < 3; attempt++) {
    await sleep(50)
    const next = await snapshot(selector, scrollRootSelector)
    if (!next.rect) break
    if (
      Math.abs(next.rect.x - snap.rect.x) < 1 &&
      Math.abs(next.rect.y - snap.rect.y) < 1
    ) {
      return next
    }
    snap = next
  }
  return snap
}
