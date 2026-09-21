import type { ActourStep, StorageLike } from './types'

const SEEN_KEY = 'actour:seen'

const read = (storage: StorageLike): Record<string, boolean> => {
  const value = storage.get(SEEN_KEY)
  return value && typeof value === 'object' ? (value as Record<string, boolean>) : {}
}

export interface SeenStore {
  /** 过滤掉已读步骤；全部已读返回空数组 */
  freshSteps: (tourKey: string, steps: ActourStep[]) => ActourStep[]
  /** 整组看完/跳过后才调用：把该组全部步骤记为已读；中途退出不记进度，下次重播全部 */
  markTourSeen: (tourKey: string, steps: ActourStep[]) => void
  /** 清除某个 tour 的全部已读标记（如"重置引导"功能） */
  resetTour: (tourKey: string) => void
}

export function createSeenStore(storage: StorageLike): SeenStore {
  return {
    freshSteps: (tourKey, steps) => {
      const seen = read(storage)
      return steps.filter((step) => !seen[`${tourKey}:${step.id}`])
    },
    markTourSeen: (tourKey, steps) => {
      const seen = read(storage)
      steps.forEach((step) => {
        seen[`${tourKey}:${step.id}`] = true
      })
      storage.set(SEEN_KEY, seen)
    },
    resetTour: (tourKey) => {
      const seen = read(storage)
      Object.keys(seen).forEach((key) => {
        if (key.startsWith(`${tourKey}:`)) delete seen[key]
      })
      storage.set(SEEN_KEY, seen)
    },
  }
}
