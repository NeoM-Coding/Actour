# @actour/miniprogram

Tour / onboarding engine for **WeChat Mini Program** (via Taro 4 + React), extracted from a
production app where it survived real-device testing. It renders a scrim + highlight hole +
tooltip, auto-scrolls to off-screen targets, remembers completed tours per step, and never
dead-locks when a target element does not exist.

The package is split so the layout math and the tour state stay free of any Taro/React
dependency (`src/core`), while everything platform-specific lives in `src/adapter`.

## Usage

```tsx
import { ActourTour, type ActourStep } from '@actour/miniprogram'

const steps: ActourStep[] = [
  { id: 'sync', title: '同步', description: '点这里从教务系统拉取最新课表。' },
  { id: 'card', title: '成绩卡片', description: '点任意卡片查看详情。', run: openFirstCard },
]

// mount only after the page data is ready, otherwise targets are missing and steps get skipped
;(loaded || error) && <ActourTour tourKey="timetable" steps={steps} onExit={closeSheet} />
```

Page requirements and conventions:

1. `enablePageMeta: true` in the page config — the scroll lock relies on `<page-meta>`.
2. Target elements must carry the configured `id`; mini-program selectors are weak, so `#id`
   is the only reliable form.
3. Conditional steps (e.g. "only when grades exist") must be appended by the page when
   assembling `steps`, with the target `id` rendered conditionally as well. Missing targets
   are skipped after a few polls — the tour never dead-locks.
4. Give the page root the class `.academic-page` (or pass `scrollRootSelector`) so the
   scroll-clamp prediction works; otherwise scrolling to bottom-clamped targets jumps twice.
5. Only one tour plays globally at a time; a second mounted instance yields silently.

## Mini-program gotchas (baked into the implementation)

- `page-meta` with `overflow: hidden` **disables `pageScrollTo` on real devices** (not in
  devtools). The engine briefly unlocks the page around auto-scroll and re-locks afterwards;
  touches are still blocked by the scrim during the unlocked window.
- `<PageMeta>` must stay mounted: Taro transfer elements do not reclaim page data on
  unmount, so removing the node would leave `overflow: hidden` behind forever. The engine
  resets `page-style` to an empty string instead, and wraps `PageMeta` in a stable container
  to avoid sibling-diff artifacts from transfer elements.
- `pageScrollTo` is clamped at the page bottom; the engine predicts the clamped landing
  position and places the tooltip there in one pass instead of jumping after the scroll ends.
- Measurement uses single-frame `SelectorQuery.exec` snapshots (target + scroll offset +
  page root in one batch) so values cannot contradict each other mid-scroll, and a stability
  poll so enter animations settle before coordinates are trusted.
- The next step is pre-measured in the background while the user reads the current step, and
  the previous tooltip's real size seeds the next placement — most step changes converge in
  one frame with no visible tooltip movement.

## API

| Prop                    | Type             | Default            | Notes                                             |
| ----------------------- | ---------------- | ------------------ | ------------------------------------------------- |
| `tourKey`               | `string`         | —                  | storage namespace, one key per tour               |
| `steps`                 | `ActourStep[]`   | —                  | see below                                         |
| `onExit`                | `() => void`     | —                  | cleanup when the tour exits mid-way               |
| `locale`                | `TourLocale`     | Chinese defaults   | `skip` / `prev` / `next` / `done` labels          |
| `storage`               | `StorageLike`    | Taro storage       | sync KV for seen marks                            |
| `scrollRootSelector`    | `string \| null` | `'.academic-page'` | page root for scroll-clamp prediction             |

`ActourStep`: `{ id: string; title: string; description: string; run?: () => void | Promise<void> }`

- `id` — target element id.
- `run` — executed before measuring (e.g. open the target's popup). Must no-op safely when
  its precondition is absent; the step is skipped if the target still does not exist.

Seen-mark semantics: the whole tour is marked seen only when finished or skipped; exiting
mid-way replays everything next time. `createSeenStore(storage).resetTour(tourKey)` backs a
"replay this tour" feature.

## Roadmap

- Promote `src/core` into `@actour/core` once a second adapter needs the same math.
- Real-interaction steps (`advanceOn: press`) like the React Native adapter, via `catchtap`
  delegation on the target.
- Skyline rendering-mode verification; native components (`video`/`map`) are out of scope
  for v1 — a `cover-view` scrim would be needed.
