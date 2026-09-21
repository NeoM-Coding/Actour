import { PageMeta, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  computeHole,
  placeTip,
  predictScroll,
  samePlacement,
  TIP_EST_HEIGHT,
  TIP_WIDTH_RPX,
  type Placement,
} from '../core/layout'
import { createSeenStore } from '../core/seen'
import {
  defaultLocale,
  type ActourStep,
  type Rect,
  type StorageLike,
  type TipLayout,
  type TourLocale,
} from '../core/types'
import { sleep, snapshot, stableSnapshot } from './measure'
import './coach.scss'

/** 全局同时只允许一组引导在播：重复进入页面等场景下后挂载的实例直接放弃，避免双层气泡叠加 */
let activeTourKey: string | null = null

const defaultStorage = (): StorageLike => ({
  get: (key) => Taro.getStorageSync(key),
  set: (key, value) => Taro.setStorageSync(key, value),
})

/**
 * 微信小程序（Taro React）分步引导：遮罩 + 高亮孔 + 气泡。
 * 整组看完或跳过后才记已读，中途退出下次重播全部步骤。
 *
 * 页面侧配合约定：
 * - 页面需在数据就绪后再挂载本组件（如 (loaded || error) && <ActourTour />），
 *   否则目标未渲染会导致步骤被跳过；
 * - 条件性步骤（某场景不应出现的步骤）由页面在组装 steps 时按条件追加，
 *   目标 id 同步条件渲染，双保险；
 * - 目标元素不存在（含 run 动作没有创建出目标的情况）时，引擎轮询重试后自动跳过该步；
 * - 步骤动作通过 ActourStep.run 声明，引导中途退出时经 onExit 交页面清理；
 * - 页面需在页面配置开启 enablePageMeta（滚动锁依赖 page-meta），
 *   且根节点最好提供 scrollRootSelector 对应的类名以启用滚动钳制预测。
 */
export function ActourTour({
  tourKey,
  steps,
  onExit,
  locale = defaultLocale,
  storage,
  scrollRootSelector = '.academic-page',
}: {
  tourKey: string
  steps: ActourStep[]
  onExit?: () => void
  locale?: TourLocale
  storage?: StorageLike
  scrollRootSelector?: string | null
}) {
  const seen = useRef(
    createSeenStore(storage ?? defaultStorage()),
  ).current
  const [pending, setPending] = useState<ActourStep[]>([])
  const [idx, setIdx] = useState(0)
  const [hole, setHole] = useState<Rect | null>(null)
  const [tip, setTip] = useState<TipLayout | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const startedRef = useRef(false)
  const placedRef = useRef<Placement | null>(null)
  /** 下一步的预测量结果：用户阅读当前步骤时后台量好，点击后只需一次快速复核 */
  const preparedRef = useRef<{ index: number; snap: Awaited<ReturnType<typeof snapshot>> } | null>(null)
  /** 上一个气泡的真实尺寸：作为下一步的估算值，多数情况下第二轮收敛直接 no-op */
  const tipSizeRef = useRef<{ width: number; height: number } | null>(null)

  /** 后台预测量：趁用户阅读当前步骤，提前完成下一步的稳定测量，把点击后的轮询等待消化在阅读时间里 */
  const prepare = async (list: ActourStep[], index: number) => {
    if (index >= list.length) return
    const snap = await stableSnapshot(`#${list[index].id}`, scrollRootSelector)
    if (snap.rect) preparedRef.current = { index, snap }
  }

  const draw = async (list: ActourStep[], index: number) => {
    if (index >= list.length || index < 0) {
      placedRef.current = null
      preparedRef.current = null
      tipSizeRef.current = null
      if (activeTourKey === tourKey) activeTourKey = null
      onExit?.()
      setPending([])
      setHole(null)
      setTip(null)
      return
    }
    const step = list[index]
    const { windowWidth, windowHeight } = Taro.getWindowInfo()
    const estTipWidth = (TIP_WIDTH_RPX * windowWidth) / 750
    // 先执行步骤动作（如自动点开卡片弹层），再测量目标；动作未创建出目标时由下方跳过逻辑兜底
    await step.run?.()
    // 命中预测量时快速复核一次（偏差 <8px 视为页面无变化）；目标依赖 run 副作用才存在、
    // 或位置已漂移时回退到完整稳定测量
    const pre = preparedRef.current
    preparedRef.current = null
    let snap: Awaited<ReturnType<typeof snapshot>>
    if (pre && pre.index === index && pre.snap.rect) {
      const preRect = pre.snap.rect
      const now = await snapshot(`#${step.id}`, scrollRootSelector)
      snap =
        now.rect &&
        Math.abs(now.rect.x - preRect.x) < 8 &&
        Math.abs(now.rect.y - preRect.y) < 8
          ? now
          : await stableSnapshot(`#${step.id}`, scrollRootSelector)
    } else {
      snap = await stableSnapshot(`#${step.id}`, scrollRootSelector)
    }
    const rect = snap.rect
    if (!rect) {
      void draw(list, index + 1)
      return
    }
    const apply = (target: Rect, tipWidth: number, tipHeight: number) => {
      const next: Placement = {
        hole: computeHole(target),
        tip: placeTip(computeHole(target), tipWidth, tipHeight, windowWidth, windowHeight),
      }
      if (placedRef.current && samePlacement(placedRef.current, next)) return
      placedRef.current = next
      setHole(next.hole)
      setTip(next.tip)
    }
    // 目标不在视口内：先算出滚动量和滚动后的预测坐标，滚动到位后把高亮孔/气泡一次性摆到目标处。
    // 真机上 page-meta 锁定（overflow: hidden）期间 pageScrollTo 会失效，所以滚动前后要临时解锁、
    // 滚完再锁；解锁窗口内的触摸仍被遮罩 catchMove 拦截，用户无法趁机滚动
    let view = rect
    if (rect.y < 0 || rect.y + rect.height > windowHeight) {
      const predicted = predictScroll({
        rectY: rect.y,
        rectHeight: rect.height,
        scrollTop: snap.scrollTop,
        pageHeight: snap.pageRect?.height ?? null,
        viewportHeight: windowHeight,
      })
      const finalScroll = predicted.finalScroll
      view = { ...rect, y: predicted.viewY }
      setUnlocking(true)
      await sleep(100)
      const scrollOnce = () =>
        Taro.pageScrollTo({ scrollTop: finalScroll, duration: 200 })
          .then(() => undefined)
          .catch(() => undefined)
      await scrollOnce()
      const fixed = (await stableSnapshot(`#${step.id}`, scrollRootSelector)).rect || rect
      if (Math.abs(fixed.y - view.y) > 8) {
        // 滚动未生效（解锁样式尚未生效等），延长等待再试一次
        await sleep(200)
        await scrollOnce()
        view =
          (await stableSnapshot(`#${step.id}`, scrollRootSelector)).rect || fixed
      } else {
        view = fixed
      }
      setUnlocking(false)
    }
    // 用上一步气泡的真实尺寸做估算，内容长度相近时第二轮收敛直接 no-op
    const est = tipSizeRef.current
    apply(view, est?.width ?? estTipWidth, est?.height ?? TIP_EST_HEIGHT)
    setIdx(index)
    // 气泡已渲染过一轮，量出真实尺寸后一次性收敛到位；多数情况下与预测一致，不再移动
    const tipRect = (await snapshot('#actourTip')).rect
    if (tipRect) tipSizeRef.current = { width: tipRect.width, height: tipRect.height }
    apply(view, tipRect?.width ?? estTipWidth, tipRect?.height ?? TIP_EST_HEIGHT)
    // 用户阅读本步期间，后台预测量下一步，把点击后的稳定轮询等待提前消化
    void prepare(list, index + 1)
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (activeTourKey) return // 已有其他引导在播，本实例静默退出
    const fresh = seen.freshSteps(tourKey, steps)
    if (!fresh.length) return
    activeTourKey = tourKey
    setPending(fresh)
    // 等页面进入动画（约 300ms）结束后再开始测量定位
    const timer = setTimeout(() => void draw(fresh, 0), 400)
    return () => {
      clearTimeout(timer)
      if (activeTourKey === tourKey) activeTourKey = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 引导期间锁定页面滚动（页面配置需开启 enablePageMeta；配合遮罩 catchMove 拦截触摸）。
  // PageMeta 必须常驻：Taro 的 transfer 元素卸载时不会回收 page-meta 数据，直接不渲染会让
  // page-style='overflow: hidden' 残留在页面上导致无法滚动，所以结束时改回空串而不是卸载。
  // PageMeta 单独包一层固定结构的容器：transfer 元素在页面数据里单独占一位、不渲染实际节点，
  // 让它与气泡层做同级兄弟时 diff 容易错位产生重复层，包一层后树形稳定。
  const lock = (
    <View className="coach-lock">
      <PageMeta pageStyle={pending.length && !unlocking ? 'overflow: hidden' : ''} />
    </View>
  )
  // 待播步骤已定但定位未完成时，先铺透明遮罩拦截触摸，避免引导弹出前用户点击跳转导致状态错乱
  let overlay: ReactElement | null = null
  if (pending.length && (!hole || !tip))
    overlay = <View className="coach coach--pending" catchMove />
  if (pending.length && hole && tip) {
    const step = pending[idx]
    const last = idx === pending.length - 1
    const close = () => {
      placedRef.current = null
      preparedRef.current = null
      tipSizeRef.current = null
      if (activeTourKey === tourKey) activeTourKey = null
      onExit?.()
      setUnlocking(false)
      setPending([])
      setHole(null)
      setTip(null)
    }
    // 只有整组看完（完成/跳过）才记已读；中途退出不记进度，下次重播全部步骤
    const finish = () => {
      seen.markTourSeen(tourKey, pending)
      close()
    }
    const skip = finish
    const next = () => {
      if (last) finish()
      else void draw(pending, idx + 1)
    }

    overlay = (
      <View className="coach" catchMove>
        <View
          className="coach__hole"
          style={{
            top: hole.y,
            left: hole.x,
            width: hole.width,
            height: hole.height,
          }}
        />
        <View
          id="actourTip"
          className="coach__tip"
          style={{ top: tip.top, left: tip.left }}
        >
          <View
            className={`coach__arrow ${tip.below ? 'coach__arrow--up' : 'coach__arrow--down'}`}
            style={{ left: tip.arrowLeft }}
          />
          <View className="coach__head">
            <Text className="coach__title">{step.title}</Text>
            <Text className="coach__prog">
              {idx + 1} / {pending.length}
            </Text>
          </View>
          <Text className="coach__desc">{step.description}</Text>
          <View className="coach__foot">
            <Text className="coach__skip" onClick={skip}>
              {locale.skip}
            </Text>
            <View className="coach__nav">
              {idx > 0 && (
                <Text
                  className="coach__prev"
                  onClick={() => void draw(pending, idx - 1)}
                >
                  {locale.prev}
                </Text>
              )}
              <Text className="coach__next" onClick={next}>
                {last ? locale.done : locale.next}
              </Text>
            </View>
          </View>
        </View>
      </View>
    )
  }
  return (
    <>
      {lock}
      {overlay}
    </>
  )
}
