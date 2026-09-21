export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface TipLayout {
  top: number
  left: number
  below: boolean
  arrowLeft: number
}

/** 单帧快照：目标矩形、当前滚动位置、页面根节点矩形（滚动钳制预测用） */
export interface Snapshot {
  rect: Rect | null
  scrollTop: number
  pageRect: Rect | null
}

export interface ActourStep {
  /** 目标元素 id；小程序选择器能力弱，配置 #id 最可靠 */
  id: string
  title: string
  description: string
  /**
   * 定位测量前执行的动作（如同步打开目标弹层）。
   * 约定：依赖特定数据/状态才存在的目标，run 里必须自行判空，
   * 且目标元素也应条件渲染——元素不存在时引擎轮询后自动跳过该步。
   */
  run?: () => void | Promise<void>
}

export interface TourLocale {
  skip: string
  prev: string
  next: string
  done: string
}

export const defaultLocale: TourLocale = {
  skip: '跳过',
  prev: '上一步',
  next: '下一步',
  done: '完成',
}

/** 已读标记的持久化抽象；默认使用 Taro storage，可替换为任意同步 KV 实现 */
export interface StorageLike {
  get(key: string): unknown
  set(key: string, value: unknown): void
}
